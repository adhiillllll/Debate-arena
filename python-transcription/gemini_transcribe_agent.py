"""
Entrypoint 2: LiveKit WebRTC transcription & real-time fact-checking worker.

Usage:
    python gemini_transcribe_agent.py dev
"""

import asyncio
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from livekit import rtc
from livekit.agents import AgentServer, JobContext, cli

from debate_ai.config import (
    GEMINI_API_KEY,
    TRANSCRIPTION_API_VERSION,
    TRANSCRIPTION_FRAME_MS,
    TRANSCRIPTION_LANGUAGE_CODES,
    TRANSCRIPTION_MODEL,
)
from debate_ai.db.debate_repo import (
    get_debate_transcription_context,
    is_valid_uuid,
    save_fact_check_results,
    save_final_transcript,
)
from debate_ai.services.fact_check_pipeline import process_transcript

ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env.local"
load_dotenv(ENV_PATH)

client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options={"api_version": TRANSCRIPTION_API_VERSION},
)
server = AgentServer()

MODEL = TRANSCRIPTION_MODEL
TRANSCRIPT_FILE = Path(__file__).resolve().parent / "gemini_transcripts.txt"
LANGUAGE_TAG = ",".join(TRANSCRIPTION_LANGUAGE_CODES)


@dataclass(frozen=True)
class SpeakerContext:
    identity: str
    participant_id: str | None
    display_name: str
    role: str


def diagnostic(message: str):
    timestamp = datetime.now().isoformat(timespec="seconds")
    print(f"[{timestamp}] [diagnostic] {message}", flush=True)


def _parse_json_dict(raw: str | None) -> dict:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def resolve_debate_id(ctx: JobContext) -> str | None:
    """Resolve real Debate UUID from dispatch metadata, room metadata, or room name."""
    job_meta = _parse_json_dict(getattr(ctx.job, "metadata", None))
    room_meta = _parse_json_dict(getattr(ctx.room, "metadata", None))

    for candidate in (
        job_meta.get("debateId"),
        job_meta.get("debate_id"),
        room_meta.get("debateId"),
        room_meta.get("debate_id"),
        ctx.room.name,
    ):
        if is_valid_uuid(candidate):
            return str(candidate).strip()

    return None


def resolve_speaker_context(participant: rtc.RemoteParticipant) -> SpeakerContext:
    """Extract DebateParticipant UUID, role, and display name from LiveKit participant."""
    meta = _parse_json_dict(getattr(participant, "metadata", None))

    raw_pid = (
        meta.get("participantId")
        or meta.get("participant_id")
        or participant.identity
    )
    participant_id = str(raw_pid).strip() if is_valid_uuid(raw_pid) else None

    display_name = (
        meta.get("displayName")
        or getattr(participant, "name", None)
        or participant.identity
    )
    role = str(meta.get("role") or "DEBATER").upper()

    return SpeakerContext(
        identity=participant.identity,
        participant_id=participant_id,
        display_name=str(display_name),
        role=role,
    )


def build_claim_context(debate_ctx: dict | None) -> str | None:
    """Build compact debate topic context for ASR-aware claim extraction."""
    if not debate_ctx:
        return None

    title = debate_ctx.get("title") or debate_ctx.get("topic") or ""
    summary = debate_ctx.get("core_summary") or debate_ctx.get("description") or ""
    concepts = debate_ctx.get("core_concepts") or []

    lines = []
    if title:
        lines.append(f"Debate Motion: {title}")
    if summary:
        lines.append(f"Topic Summary: {summary}")
    if concepts:
        lines.append(f"Key Domain Terms: {', '.join(concepts[:6])}")

    return "\n".join(lines) if lines else None


def describe_track(publication, participant):
    return (
        f"participant={participant.identity} track={publication.sid} "
        f"kind={rtc.TrackKind.Name(publication.kind)} "
        f"source={rtc.TrackSource.Name(publication.source)} "
        f"muted={publication.muted} subscribed={publication.subscribed}"
    )


async def run_fact_check_and_publish(
    text: str,
    speaker: SpeakerContext,
    timestamp: str,
    room: rtc.Room,
    debate_id: str | None,
    transcript_id: str | None,
    debate_context: str | None,
):
    """Run fact-checking in a worker thread, persist to Postgres, and publish to room."""
    try:
        results = await asyncio.to_thread(
            process_transcript,
            text,
            speaker.display_name,
            timestamp,
            debate_context,
        )
        if not results:
            return

        persisted_ids: list[dict[str, str]] = []
        if debate_id and transcript_id:
            try:
                persisted_ids = await asyncio.to_thread(
                    save_fact_check_results,
                    debate_id,
                    transcript_id,
                    speaker.participant_id,
                    results,
                    LANGUAGE_TAG,
                )
                diagnostic(
                    f"Persisted {len(persisted_ids)} fact-check result(s) for "
                    f"debate={debate_id} transcript={transcript_id}"
                )
            except Exception as db_exc:
                diagnostic(
                    f"DB persistence error for fact-checks (continuing broadcast): {db_exc}"
                )

        for idx, result in enumerate(results):
            enriched = {
                **result,
                "participantIdentity": speaker.identity,
                "participantId": speaker.participant_id,
                "displayName": speaker.display_name,
                "role": speaker.role,
                "transcriptId": transcript_id,
            }
            if idx < len(persisted_ids):
                enriched["claimId"] = persisted_ids[idx]["claimId"]
                enriched["factCheckResultId"] = persisted_ids[idx]["factCheckResultId"]

            await room.local_participant.publish_data(
                json.dumps(enriched).encode("utf-8"),
                reliable=True,
                topic="debate-fact-check",
            )
            diagnostic(
                f"Fact-check published: speaker={speaker.display_name} ({speaker.identity}) "
                f"verdict={result['verdict']} claim={result['normalizedClaim']!r}"
            )
    except Exception as exc:
        diagnostic(
            f"Fact-check error (transcription unaffected) for {speaker.identity}: {exc}"
        )


async def transcribe_track(
    track: rtc.Track,
    publication: rtc.RemoteTrackPublication,
    speaker: SpeakerContext,
    room: rtc.Room,
    debate_id: str | None,
    debate_context: str | None,
):
    print(
        f"Starting Gemini transcription worker for {speaker.display_name} "
        f"(identity={speaker.identity}, role={speaker.role}, debate_id={debate_id})"
    )

    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=TRANSCRIPTION_LANGUAGE_CODES,
        ),
    )

    audio_stream = rtc.AudioStream(
        track=track,
        sample_rate=16000,
        num_channels=1,
        frame_size_ms=TRANSCRIPTION_FRAME_MS,
    )
    audio_iter = audio_stream.__aiter__()
    fact_check_tasks: set[asyncio.Task] = set()

    try:
        while publication.subscribed:
            # Drain frames without opening a Gemini Live socket while mic is muted
            if publication.muted:
                try:
                    await asyncio.wait_for(audio_iter.__anext__(), timeout=0.25)
                except asyncio.TimeoutError:
                    continue
                except StopAsyncIteration:
                    break
                continue

            try:
                diagnostic(
                    f"Connecting to Gemini: participant={speaker.identity} "
                    f"model={MODEL} langs={TRANSCRIPTION_LANGUAGE_CODES}"
                )
                async with client.aio.live.connect(
                    model=MODEL,
                    config=config,
                ) as session:
                    diagnostic(
                        f"Gemini session connected: participant={speaker.identity}"
                    )

                    async def send_audio():
                        frames_sent = 0
                        try:
                            while publication.subscribed and not publication.muted:
                                try:
                                    event = await asyncio.wait_for(
                                        audio_iter.__anext__(), timeout=0.25
                                    )
                                except asyncio.TimeoutError:
                                    continue
                                except StopAsyncIteration:
                                    break

                                audio_bytes = bytes(event.frame.data)
                                if frames_sent == 0:
                                    diagnostic(
                                        f"First audio frame received: participant={speaker.identity} "
                                        f"bytes={len(audio_bytes)}"
                                    )

                                await session.send_realtime_input(
                                    audio=types.Blob(
                                        data=audio_bytes,
                                        mime_type="audio/pcm;rate=16000",
                                    )
                                )
                                frames_sent += 1
                                if frames_sent == 1 or frames_sent % 100 == 0:
                                    diagnostic(
                                        f"Audio frames sent to Gemini: participant={speaker.identity} "
                                        f"count={frames_sent}"
                                    )
                        finally:
                            diagnostic(
                                f"Audio sender ending: participant={speaker.identity} "
                                f"frames_sent={frames_sent}"
                            )
                            try:
                                await session.send_realtime_input(
                                    audio_stream_end=True
                                )
                            except Exception:
                                pass

                    async def receive_transcripts():
                        received_response = False
                        async for response in session.receive():
                            if not received_response:
                                diagnostic(
                                    f"First Gemini response received: participant={speaker.identity}"
                                )
                                received_response = True
                            content = response.server_content
                            if not content:
                                continue

                            partial = content.interim_input_transcription
                            final = content.input_transcription

                            if partial and partial.text:
                                print(
                                    f"\r[{speaker.display_name} - live] {partial.text}",
                                    end="",
                                    flush=True,
                                )

                            if final and final.text and final.text.strip():
                                text = final.text.strip()
                                timestamp = datetime.now().isoformat(
                                    timespec="seconds"
                                )

                                line = (
                                    f"[{timestamp}] [{speaker.display_name}] {text}"
                                )
                                print(f"\n{line}")

                                with TRANSCRIPT_FILE.open(
                                    "a", encoding="utf-8"
                                ) as file:
                                    file.write(line + "\n")

                                transcript_id: str | None = None
                                if debate_id:
                                    try:
                                        transcript_id = await asyncio.to_thread(
                                            save_final_transcript,
                                            debate_id,
                                            speaker.participant_id,
                                            text,
                                            LANGUAGE_TAG,
                                            timestamp,
                                        )
                                        diagnostic(
                                            f"Transcript saved to Postgres: id={transcript_id} "
                                            f"debate={debate_id} participant={speaker.participant_id}"
                                        )
                                    except Exception as db_exc:
                                        diagnostic(
                                            f"DB persistence error for transcript (continuing broadcast): {db_exc}"
                                        )

                                message = {
                                    "type": "transcript",
                                    "transcriptId": transcript_id,
                                    "participantIdentity": speaker.identity,
                                    "participantId": speaker.participant_id,
                                    "displayName": speaker.display_name,
                                    "role": speaker.role,
                                    "text": text,
                                    "timestamp": timestamp,
                                    "language": LANGUAGE_TAG,
                                }

                                await room.local_participant.publish_data(
                                    json.dumps(message).encode("utf-8"),
                                    reliable=True,
                                    topic="debate-transcript",
                                )

                                print(
                                    f"Transcript published for {speaker.display_name}"
                                )

                                fc_task = asyncio.create_task(
                                    run_fact_check_and_publish(
                                        text=text,
                                        speaker=speaker,
                                        timestamp=timestamp,
                                        room=room,
                                        debate_id=debate_id,
                                        transcript_id=transcript_id,
                                        debate_context=debate_context,
                                    )
                                )
                                fact_check_tasks.add(fc_task)
                                fc_task.add_done_callback(
                                    fact_check_tasks.discard
                                )

                        diagnostic(
                            f"Gemini receive stream ended: participant={speaker.identity}"
                        )

                    sender = asyncio.create_task(send_audio())
                    receiver = asyncio.create_task(receive_transcripts())

                    done, pending = await asyncio.wait(
                        [sender, receiver],
                        return_when=asyncio.FIRST_COMPLETED,
                    )

                    # Give Gemini up to 1.5s to flush final transcript when mic mutes
                    if sender in done and receiver in pending and publication.muted:
                        try:
                            await asyncio.wait_for(receiver, timeout=1.5)
                        except (asyncio.TimeoutError, Exception):
                            pass

                    for task in pending:
                        if not task.done():
                            task.cancel()

                    await asyncio.gather(*pending, return_exceptions=True)

                    for task in done:
                        if not task.cancelled() and task.exception():
                            raise task.exception()

            except asyncio.CancelledError:
                raise
            except Exception as session_exc:
                diagnostic(
                    f"Gemini session closed for {speaker.display_name} "
                    f"({session_exc}); reconnecting if track stays active..."
                )
                await asyncio.sleep(0.5)

    except asyncio.CancelledError:
        diagnostic(f"Transcription task cancelled: participant={speaker.identity}")
        raise
    finally:
        await audio_stream.aclose()
        print(f"Transcription stopped for {speaker.display_name}")


@server.rtc_session(agent_name="gemini-transcriber")
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}
    tasks: dict[str, asyncio.Task] = {}
    debate_id: str | None = None
    debate_context: str | None = None

    async def on_shutdown(reason):
        diagnostic(f"Job shutdown callback: room={ctx.room.name} reason={reason!r}")

    ctx.add_shutdown_callback(on_shutdown)

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        diagnostic(f"Participant connected: {participant.identity}")

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        diagnostic(f"Participant disconnected: {participant.identity}")

    @ctx.room.on("track_published")
    def on_track_published(publication, participant):
        diagnostic(f"Track published: {describe_track(publication, participant)}")

    @ctx.room.on("track_unsubscribed")
    def on_track_unsubscribed(track, publication, participant):
        diagnostic(f"Track unsubscribed: {describe_track(publication, participant)}")
        key = f"{participant.identity}:{track.sid}"
        existing = tasks.pop(key, None)
        if existing and not existing.done():
            existing.cancel()

    @ctx.room.on("track_subscription_failed")
    def on_track_subscription_failed(participant, track_sid, error):
        diagnostic(
            f"Track subscription failed: participant={participant.identity} "
            f"track={track_sid} error={error}"
        )

    @ctx.room.on("track_muted")
    def on_track_muted(participant, publication):
        diagnostic(f"Track muted: {describe_track(publication, participant)}")

    @ctx.room.on("track_unmuted")
    def on_track_unmuted(participant, publication):
        diagnostic(f"Track unmuted: {describe_track(publication, participant)}")

    @ctx.room.on("connection_state_changed")
    def on_connection_state_changed(state):
        diagnostic(f"Room connection state: {rtc.ConnectionState.Name(state)}")

    @ctx.room.on("disconnected")
    def on_disconnected(reason):
        diagnostic(f"Room disconnected: reason={rtc.DisconnectReason.Name(reason)}")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        diagnostic(f"Track subscribed: {describe_track(publication, participant)}")
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            diagnostic("Skipping track: not audio")
            return

        if publication.source != rtc.TrackSource.SOURCE_MICROPHONE:
            diagnostic("Skipping track: source is not microphone")
            return

        speaker = resolve_speaker_context(participant)
        if speaker.role == "AUDIENCE":
            diagnostic(
                f"Skipping track: participant={speaker.identity} has role AUDIENCE"
            )
            return

        key = f"{participant.identity}:{track.sid}"
        existing = tasks.get(key)
        if existing and not existing.done():
            return

        tasks[key] = asyncio.create_task(
            transcribe_track(
                track,
                publication,
                speaker,
                ctx.room,
                debate_id,
                debate_context,
            )
        )

    diagnostic(f"Connecting to LiveKit room: {ctx.room.name}")
    await ctx.connect()
    debate_id = resolve_debate_id(ctx)
    if debate_id:
        try:
            db_ctx = await asyncio.to_thread(
                get_debate_transcription_context, debate_id
            )
            debate_context = build_claim_context(db_ctx)
        except Exception as ctx_exc:
            diagnostic(f"Debate context lookup skipped: {ctx_exc}")

    print(
        f"Gemini transcriber connected to room: {ctx.room.name} "
        f"(debate_id={debate_id or 'sandbox-mode'}, context={'loaded' if debate_context else 'none'})"
    )
    diagnostic(f"Existing remote participants: {len(ctx.room.remote_participants)}")
    for participant in ctx.room.remote_participants.values():
        diagnostic(
            f"Existing participant: {participant.identity} "
            f"tracks={len(participant.track_publications)}"
        )
        for publication in participant.track_publications.values():
            diagnostic(f"Existing track: {describe_track(publication, participant)}")

    try:
        await asyncio.Event().wait()
    finally:
        diagnostic(f"Entrypoint cleanup: transcription_tasks={len(tasks)}")
        for task in tasks.values():
            task.cancel()
        await asyncio.gather(*tasks.values(), return_exceptions=True)


if __name__ == "__main__":
    cli.run_app(server)
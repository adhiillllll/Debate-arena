
import asyncio
import os
import json
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types
from livekit import rtc
from livekit.agents import AgentServer, JobContext, cli

ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env.local"
load_dotenv(ENV_PATH)

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY is missing from web/.env.local")

client = genai.Client(api_key=api_key, http_options={"api_version": "v1beta"})
server = AgentServer()

MODEL = "gemini-3.5-transcribe-live"
TRANSCRIPT_FILE = Path(__file__).resolve().parent / "gemini_transcripts.txt"


def diagnostic(message):
    timestamp = datetime.now().isoformat(timespec="seconds")
    print(f"[{timestamp}] [diagnostic] {message}", flush=True)


def describe_track(publication, participant):
    return (
        f"participant={participant.identity} track={publication.sid} "
        f"kind={rtc.TrackKind.Name(publication.kind)} "
        f"source={rtc.TrackSource.Name(publication.source)} "
        f"muted={publication.muted} subscribed={publication.subscribed}"
    )


async def transcribe_track(
    track: rtc.Track,
    identity: str,
    room: rtc.Room,
):
    print(f"Starting Gemini transcription for {identity}")

    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=["ml-IN", "en-US"],
        ),
    )

    audio_stream = rtc.AudioStream(
        track=track,
        sample_rate=16000,
        num_channels=1,
        frame_size_ms=100,
    )

    try:
        diagnostic(f"Connecting to Gemini: participant={identity} model={MODEL} api=v1beta")
        async with client.aio.live.connect(
            model=MODEL,
            config=config,
        ) as session:
            diagnostic(f"Gemini session connected: participant={identity}")

            async def send_audio():
                frames_sent = 0
                try:
                    async for event in audio_stream:
                        audio_bytes = bytes(event.frame.data)
                        if frames_sent == 0:
                            diagnostic(f"First audio frame received: participant={identity} bytes={len(audio_bytes)}")

                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=audio_bytes,
                                mime_type="audio/pcm;rate=16000",
                            )
                        )
                        frames_sent += 1
                        if frames_sent == 1 or frames_sent % 100 == 0:
                            diagnostic(f"Audio frames sent to Gemini: participant={identity} count={frames_sent}")
                finally:
                    diagnostic(f"Audio sender ending: participant={identity} frames_sent={frames_sent}")
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
                        diagnostic(f"First Gemini response received: participant={identity}")
                        received_response = True
                    content = response.server_content
                    if not content:
                        continue

                    partial = content.interim_input_transcription
                    final = content.input_transcription

                    if partial and partial.text:
                        print(f"\r[{identity} - live] {partial.text}", end="", flush=True)

                    if final and final.text and final.text.strip():
                        text = final.text.strip()
                        timestamp = datetime.now().isoformat(timespec="seconds")
                        
                        line = f"[{timestamp}] [{identity}] {text}"
                        print(f"\n{line}")
                        
                        # Keep the existing local transcript backup.
                        with TRANSCRIPT_FILE.open("a", encoding="utf-8") as file:
                            file.write(line + "\n")
                        
                        # Send the finalized transcript to everyone in the LiveKit room.
                        message = {
                            "type": "transcript",
                            "participantIdentity": identity,
                            "text": text,
                            "timestamp": timestamp,
                            "language": "unknown",
                        }
                        
                        await room.local_participant.publish_data(
                            json.dumps(message).encode("utf-8"),
                            reliable=True,
                            topic="debate-transcript",
                        )
                        
                        print(f"Transcript published for {identity}")
                diagnostic(f"Gemini receive stream ended: participant={identity}")

            sender = asyncio.create_task(send_audio())
            receiver = asyncio.create_task(receive_transcripts())

            done, pending = await asyncio.wait(
                [sender, receiver],
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in pending:
                task.cancel()

            await asyncio.gather(*pending, return_exceptions=True)

            for task in done:
                if not task.cancelled() and task.exception():
                    raise task.exception()

    except asyncio.CancelledError:
        diagnostic(f"Transcription task cancelled: participant={identity}")
        raise
    except Exception as exc:
        print(f"\nGemini transcription error for {identity}: {exc}")
    finally:
        await audio_stream.aclose()
        print(f"Transcription stopped for {identity}")


@server.rtc_session(agent_name="gemini-transcriber")
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}
    tasks = {}

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

    @ctx.room.on("track_subscription_failed")
    def on_track_subscription_failed(participant, track_sid, error):
        diagnostic(f"Track subscription failed: participant={participant.identity} track={track_sid} error={error}")

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

        key = f"{participant.identity}:{track.sid}"
        if key not in tasks:
            tasks[key] = asyncio.create_task(
                transcribe_track(track, participant.identity, ctx.room)
            )

    diagnostic(f"Connecting to LiveKit room: {ctx.room.name}")
    await ctx.connect()
    print(f"Gemini transcriber connected to room: {ctx.room.name}")
    diagnostic(f"Existing remote participants: {len(ctx.room.remote_participants)}")
    for participant in ctx.room.remote_participants.values():
        diagnostic(f"Existing participant: {participant.identity} tracks={len(participant.track_publications)}")
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

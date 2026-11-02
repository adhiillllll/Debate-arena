
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

client = genai.Client(api_key=api_key)
server = AgentServer()

MODEL = "gemini-3.5-transcribe-live"
TRANSCRIPT_FILE = Path(__file__).resolve().parent / "gemini_transcripts.txt"


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
        async with client.aio.live.connect(
            model=MODEL,
            config=config,
        ) as session:

            async def send_audio():
                try:
                    async for event in audio_stream:
                        audio_bytes = bytes(event.frame.data)

                        await session.send_realtime_input(
                            audio=types.Blob(
                                data=audio_bytes,
                                mime_type="audio/pcm;rate=16000",
                            )
                        )
                finally:
                    try:
                        await session.send_realtime_input(
                            audio_stream_end=True
                        )
                    except Exception:
                        pass

            async def receive_transcripts():
                async for response in session.receive():
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

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        if track.kind != rtc.TrackKind.KIND_AUDIO:
            return

        if publication.source != rtc.TrackSource.SOURCE_MICROPHONE:
            return

        key = f"{participant.identity}:{track.sid}"
        if key not in tasks:
            tasks[key] = asyncio.create_task(
                transcribe_track(track, participant.identity, ctx.room)
            )

    await ctx.connect()
    print(f"Gemini transcriber connected to room: {ctx.room.name}")

    try:
        await asyncio.Event().wait()
    finally:
        for task in tasks.values():
            task.cancel()
        await asyncio.gather(*tasks.values(), return_exceptions=True)


if __name__ == "__main__":
    cli.run_app(server)

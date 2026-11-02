import asyncio
import os
import queue

import numpy as np
import sounddevice as sd
from dotenv import load_dotenv
from google import genai
from google.genai import types


# ============================================================
# Configuration
# ============================================================

from pathlib import Path

load_dotenv(
    Path(__file__).resolve().parent.parent / "web" / ".env.local"
)

if not os.getenv("GEMINI_API_KEY"):
    raise RuntimeError("GEMINI_API_KEY not found in .env")


MODEL = "gemini-3.5-transcribe-live"

# USB microphone
INPUT_DEVICE = 2
INPUT_RATE = 48000
CHANNELS = 2

# Gemini expects 16 kHz PCM audio
GEMINI_RATE = 16000

# 200 ms of audio at 48 kHz
CHUNK_FRAMES = 9600

# Buffer between microphone and Gemini
audio_queue = queue.Queue(maxsize=20)


# ============================================================
# Audio conversion
# ============================================================

def resample_48k_to_16k(audio):
    """
    Convert:
        48 kHz stereo int16
        ->
        16 kHz mono int16
    """

    # Stereo -> mono
    if audio.ndim == 2:
        audio = np.mean(audio, axis=1)

    # Make length divisible by 3.
    # 48,000 Hz / 3 = 16,000 Hz.
    usable_length = (len(audio) // 3) * 3
    audio = audio[:usable_length]

    # Simple low-pass-ish averaging before downsampling.
    audio = audio.reshape(-1, 3).mean(axis=1)

    return np.clip(audio, -32768, 32767).astype(np.int16)


# ============================================================
# Send microphone audio to Gemini
# ============================================================

async def send_audio(session):
    while True:

        # Wait for microphone audio without blocking
        # the asyncio event loop.
        audio = await asyncio.to_thread(audio_queue.get)

        # Convert 48 kHz stereo -> 16 kHz mono.
        audio_16k = resample_48k_to_16k(audio)

        # Send raw PCM audio to Gemini Live.
        await session.send_realtime_input(
            audio=types.Blob(
                data=audio_16k.tobytes(),
                mime_type=f"audio/pcm;rate={GEMINI_RATE}",
            )
        )


# ============================================================
# Receive Gemini transcription
# ============================================================

async def receive_transcripts(session):

    async for response in session.receive():

        server_content = response.server_content

        if not server_content:
            continue

        # ----------------------------------------------------
        # Interim transcription
        # ----------------------------------------------------

        if server_content.interim_input_transcription:

            text = server_content.interim_input_transcription.text

            if text:
                print(
                    f"\r[Interim] {text}",
                    end="",
                    flush=True,
                )

        # ----------------------------------------------------
        # Final transcription
        # ----------------------------------------------------

        if server_content.input_transcription:

            text = server_content.input_transcription.text

            if text:
                print(f"\r[Final]   {text}")


# ============================================================
# Main
# ============================================================

async def main():

    client = genai.Client()

    # Gemini Live configuration.
    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=[],
        ),
    )

    print()
    print("=" * 60)
    print(" Gemini Live Transcription")
    print("=" * 60)

    print()
    print("Input device:")
    print(sd.query_devices(INPUT_DEVICE))

    print()
    print("Connecting...")

    async with client.aio.live.connect(
        model=MODEL,
        config=config,
    ) as session:

        print("Connected!")
        print()
        print("Speak into your microphone.")
        print("Press Ctrl+C to stop.")
        print("-" * 60)

        # ----------------------------------------------------
        # Microphone callback
        #
        # IMPORTANT:
        # Keep this callback extremely lightweight.
        # Do not resample or call Gemini here.
        # ----------------------------------------------------

        def audio_callback(indata, frames, time, status):

            if status:
                print(
                    f"\nAudio status: {status}",
                    flush=True,
                )

            try:
                # Copy because PortAudio reuses its buffer.
                audio_queue.put_nowait(indata.copy())

            except queue.Full:

                # If Gemini falls behind, discard the oldest
                # chunk so we keep processing recent speech.
                try:
                    audio_queue.get_nowait()
                except queue.Empty:
                    pass

                try:
                    audio_queue.put_nowait(indata.copy())
                except queue.Full:
                    pass

        # ----------------------------------------------------
        # Start asynchronous tasks
        # ----------------------------------------------------

        sender_task = asyncio.create_task(
            send_audio(session)
        )

        receiver_task = asyncio.create_task(
            receive_transcripts(session)
        )

        try:

            # Capture the USB microphone at its native
            # 48 kHz stereo format.
            with sd.InputStream(
                device=INPUT_DEVICE,
                samplerate=INPUT_RATE,
                channels=CHANNELS,
                dtype="int16",
                blocksize=CHUNK_FRAMES,
                callback=audio_callback,
            ):

                # Keep running until Ctrl+C or an error.
                await asyncio.gather(
                    sender_task,
                    receiver_task,
                )

        finally:

            sender_task.cancel()
            receiver_task.cancel()

            # Wait for tasks to finish cancellation cleanly.
            await asyncio.gather(
                sender_task,
                receiver_task,
                return_exceptions=True,
            )


# ============================================================
# Program entry point
# ============================================================

if __name__ == "__main__":

    try:

        asyncio.run(main())

    except KeyboardInterrupt:

        print("\n\nStopped.")

    except Exception as error:

        print("\nERROR:")
        print(error)
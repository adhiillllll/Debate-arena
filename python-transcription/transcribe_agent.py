
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    cli,
    inference,
)

# Load the existing LiveKit credentials.
ENV_PATH = Path(__file__).resolve().parent.parent / "web" / ".env.local"
load_dotenv(ENV_PATH)

server = AgentServer()


@server.rtc_session(agent_name="debate-transcriber")
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    print(f"Transcriber connected to room: {ctx.room.name}")

    session = AgentSession(
        stt=inference.STT(
            model="cartesia/ink-whisper",
            language="ml",
        )
    )

    @session.on("user_input_transcribed")
    def on_transcript(transcript):
        if not transcript.is_final:
            return

        text = transcript.transcript.strip()
        if not text:
            return

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {text}")

        with open(
            Path(__file__).resolve().parent / "transcripts.txt",
            "a",
            encoding="utf-8",
        ) as file:
            file.write(f"[{timestamp}] {text}\n")

    await session.start(
        agent=Agent(
            instructions="Transcribe the participant's speech accurately."
        ),
        room=ctx.room,
    )

    await ctx.connect()


if __name__ == "__main__":
    cli.run_app(server)

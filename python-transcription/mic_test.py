import sounddevice as sd
import numpy as np
import time

DEVICE = 6
SAMPLE_RATE = 48000
CHANNELS = 2
CHUNK = 4800

print("Microphone:", DEVICE)
print(sd.query_devices(DEVICE))
print()
print("Speak normally for 5 seconds...")
print()

levels = []


def callback(indata, frames, time_info, status):
    if status:
        print("\nSTATUS:", status)

    # Calculate RMS without printing constantly from the callback
    audio = indata.astype(np.float32)

    rms = np.sqrt(np.mean(audio ** 2))

    if rms > 0:
        db = 20 * np.log10(rms / 32768.0)
    else:
        db = -100.0

    levels.append(db)


with sd.InputStream(
    device=DEVICE,
    samplerate=SAMPLE_RATE,
    channels=CHANNELS,
    dtype="int16",
    blocksize=CHUNK,
    callback=callback,
):
    for _ in range(50):
        time.sleep(0.1)

print()

if levels:
    print(f"Average: {np.mean(levels):.1f} dBFS")
    print(f"Minimum: {np.min(levels):.1f} dBFS")
    print(f"Maximum: {np.max(levels):.1f} dBFS")
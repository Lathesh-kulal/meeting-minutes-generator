"""
transcribe.py
Wraps OpenAI Whisper to convert an audio file into a raw transcript.
"""

import whisper

# Load the model once at import time so repeated calls are fast.
# "base" is a good speed/accuracy tradeoff for CPU. Use "small" or "medium"
# if you have a GPU and want better accuracy.
_MODEL_SIZE = "base"
_model = None


def _get_model():
    global _model
    if _model is None:
        _model = whisper.load_model(_MODEL_SIZE)
    return _model


def transcribe_audio(audio_path: str) -> dict:
    """
    Transcribes an audio file to text using Whisper.

    Args:
        audio_path: path to a .wav/.mp3/.m4a file (already converted if needed)

    Returns:
        dict with:
            "text": full transcript as a single string
            "segments": list of {"start": float, "end": float, "text": str}
    """
    model = _get_model()
    result = model.transcribe(audio_path, verbose=False)

    segments = [
        {
            "start": seg["start"],
            "end": seg["end"],
            "text": seg["text"].strip(),
        }
        for seg in result["segments"]
    ]

    return {
        "text": result["text"].strip(),
        "segments": segments,
    }


if __name__ == "__main__":
    # Quick manual test: python transcribe.py path/to/audio.wav
    import sys
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_path>")
    else:
        out = transcribe_audio(sys.argv[1])
        print(out["text"])

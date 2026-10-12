"""
preprocess.py
Cleans raw transcript text: strips Zoom/Teams-style transcript formatting
(timestamps, header metadata, speaker labels), removes filler words, fixes
spacing/casing, and splits into sentences for downstream modules.
"""

import re
import nltk

nltk.download("punkt", quiet=True)
nltk.download("punkt_tab", quiet=True)  # required by newer NLTK versions
from nltk.tokenize import sent_tokenize

# Common spoken-language filler words/disfluencies to strip out.
FILLER_WORDS = [
    r"\buh\b", r"\bum\b", r"\bmm-hmm\b", r"\ber\b", r"\bhmm\b",
    r"\byou know\b", r"\blike,\b", r"\bi mean\b",
]
_FILLER_PATTERN = re.compile("|".join(FILLER_WORDS), flags=re.IGNORECASE)

# --- Structured meeting-transcript artifacts (Zoom/Teams-style exports) ---
# A pasted transcript may not be plain prose (Whisper's own output) — it may
# be exported directly from Zoom or Teams, which prepend timestamps, a
# metadata header block, and a speaker-name label to every line of dialogue.
# None of this is spoken content, so it's stripped before segmentation,
# summarization, or NER ever see it. These patterns don't match anything in
# plain prose, so this is safe to always run.

# Bracketed timestamps, e.g. "[00:00:21]" or "[00:00:21.500]"
_TIMESTAMP_PATTERN = re.compile(r"\[\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\]")

# Header lines some platforms prepend before the dialogue starts,
# e.g. "Meeting Topic: ...", "Date: ...", "Duration: 00:04:15"
_HEADER_LINE_PATTERN = re.compile(
    r"^\s*(?:Meeting Topic|Date|Duration|Attendees|Participants)\s*:.*$",
    flags=re.IGNORECASE | re.MULTILINE,
)

# A speaker label at the start of a line, e.g. "David Chen (Engineering Lead):"
# or just "David Chen:" — optionally with a role in parentheses. Only the
# label prefix is removed; any spoken text that follows on the same line
# (Zoom's single-line style) is kept.
_SPEAKER_LABEL_PATTERN = re.compile(
    r"^\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3}(?:\s*\([^)]*\))?\s*:\s*",
    flags=re.MULTILINE,
)


def _strip_transcript_artifacts(text: str) -> str:
    """Strips timestamps, metadata headers, and speaker-name labels."""
    text = _TIMESTAMP_PATTERN.sub("", text)
    text = _HEADER_LINE_PATTERN.sub("", text)
    text = _SPEAKER_LABEL_PATTERN.sub("", text)
    return text


def clean_text(text: str) -> str:
    """Strips transcript formatting artifacts, filler words, and normalizes whitespace/casing."""
    text = _strip_transcript_artifacts(text)
    text = _FILLER_PATTERN.sub("", text)
    text = re.sub(r"\s+", " ", text)              # collapse whitespace
    text = re.sub(r"\s+([,.?!])", r"\1", text)      # fix space-before-punctuation
    text = re.sub(r",\s*,", ",", text)              # collapse double commas left by filler removal
    text = re.sub(r"^\s*,\s*", "", text)            # drop a leading stray comma
    return text.strip()


def split_sentences(text: str) -> list[str]:
    """Splits cleaned text into a list of sentences."""
    return [s.strip() for s in sent_tokenize(text) if s.strip()]


def preprocess_transcript(raw_text: str) -> dict:
    """
    Full preprocessing step: clean + sentence-split.

    Returns:
        dict with "cleaned_text" (str) and "sentences" (list[str])
    """
    cleaned = clean_text(raw_text)
    sentences = split_sentences(cleaned)
    return {
        "cleaned_text": cleaned,
        "sentences": sentences,
    }


if __name__ == "__main__":
    sample = "uh So, um, I think we should, you know, finish the report by Friday."
    print(preprocess_transcript(sample))

    zoom_style = (
        "Meeting Topic: Q4 Product Launch\n"
        "Date: October 12, 2026\n"
        "Duration: 00:04:15\n"
        "[00:00:02] Sarah Jenkins (Product Manager):\n"
        "All right, everyone, let's get started.\n"
        "[00:00:21] David Chen (Engineering Lead):\n"
        "Yeah, sure, Sarah. We wrapped up the Phase 2 beta last Friday.\n"
    )
    print(preprocess_transcript(zoom_style))
"""
preprocess.py
Cleans raw transcript text: strips Zoom/Teams-style transcript formatting
(timestamps, section headers, header metadata, speaker labels), removes filler
words, fixes spacing/casing, and splits into sentences for downstream modules.

The speaker of every sentence is remembered (see "speakers" in the result) so
later steps can tell who said "Update the Jira sprint board by 5 PM".
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
# Section headers with a time range, e.g. "[22:00 - 27:00] Risk Assessment".
# The whole line is a title, not speech, so it is removed.
_RANGE_HEADER_PATTERN = re.compile(
    r"^\s*\[\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*\d{1,2}:\d{2}(?::\d{2})?\]\s*.*$",
    flags=re.MULTILINE,
)

# Bracketed timestamps, e.g. "[00:00:21]" or "[00:00:21.500]"
_TIMESTAMP_PATTERN = re.compile(r"\[\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\]")

# Header lines some platforms prepend before the dialogue starts,
# e.g. "Meeting Topic: ...", "Date: ...", "Duration: 00:04:15"
_HEADER_LINE_PATTERN = re.compile(
    r"^\s*(?:Meeting Topic|Date|Duration|Attendees|Participants)\s*:.*$",
    flags=re.IGNORECASE | re.MULTILINE,
)

# A speaker label at the start of a line, e.g. "David Chen (Engineering Lead):"
# or just "David Chen:" — optionally with a role in parentheses.
_SPEAKER_LABEL_PATTERN = re.compile(
    r"^\s*[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3}(?:\s*\([^)]*\))?\s*:\s*",
    flags=re.MULTILINE,
)


def _strip_headers_and_timestamps(text: str) -> str:
    text = _RANGE_HEADER_PATTERN.sub("", text)
    text = _TIMESTAMP_PATTERN.sub("", text)
    text = _HEADER_LINE_PATTERN.sub("", text)
    return text


def _strip_transcript_artifacts(text: str) -> str:
    """Strips timestamps, section/metadata headers, and speaker-name labels."""
    text = _strip_headers_and_timestamps(text)
    text = _SPEAKER_LABEL_PATTERN.sub("", text)
    return text


def _clean_body(text: str) -> str:
    """Filler removal and whitespace/punctuation normalisation (no label stripping)."""
    text = _FILLER_PATTERN.sub("", text)
    text = re.sub(r"\s+", " ", text)              # collapse whitespace
    text = re.sub(r"\s+([,.?!])", r"\1", text)      # fix space-before-punctuation
    text = re.sub(r",\s*,", ",", text)              # collapse double commas left by filler removal
    text = re.sub(r"^\s*,\s*", "", text)            # drop a leading stray comma
    return text.strip()


def clean_text(text: str) -> str:
    """Strips transcript formatting artifacts, filler words, and normalizes whitespace/casing."""
    return _clean_body(_strip_transcript_artifacts(text))


def split_sentences(text: str) -> list[str]:
    """Splits cleaned text into a list of sentences."""
    return [s.strip() for s in sent_tokenize(text) if s.strip()]


def _speaker_name(label: str) -> str:
    """'David Chen (Engineering Lead):' -> 'David Chen'."""
    label = re.sub(r"\([^)]*\)", "", label)
    return label.strip().rstrip(":").strip()


def _split_turns(text: str) -> list[tuple]:
    """Splits text into (speaker or None, text) turns at each speaker label."""
    turns, last_end, speaker = [], 0, None
    for m in _SPEAKER_LABEL_PATTERN.finditer(text):
        chunk = text[last_end:m.start()]
        if chunk.strip():
            turns.append((speaker, chunk))
        speaker = _speaker_name(m.group(0))
        last_end = m.end()
    tail = text[last_end:]
    if tail.strip():
        turns.append((speaker, tail))
    return turns


def preprocess_transcript(raw_text: str) -> dict:
    """
    Full preprocessing step: clean + sentence-split.

    Returns:
        dict with
          "cleaned_text" (str),
          "sentences"    (list[str]),
          "speakers"     (list[str | None], same length as sentences; None when
                          the transcript has no speaker labels).
    """
    text = _strip_headers_and_timestamps(raw_text)
    sentences, speakers, parts = [], [], []
    for speaker, chunk in _split_turns(text):
        cleaned = _clean_body(chunk)
        if not cleaned:
            continue
        parts.append(cleaned)
        for s in split_sentences(cleaned):
            sentences.append(s)
            speakers.append(speaker)
    return {
        "cleaned_text": " ".join(parts),
        "sentences": sentences,
        "speakers": speakers,
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
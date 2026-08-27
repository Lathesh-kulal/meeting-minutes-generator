"""
preprocess.py
Cleans raw transcript text: removes filler words, fixes spacing/casing,
and splits into sentences for downstream modules.
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


def clean_text(text: str) -> str:
    """Removes filler words and normalizes whitespace/casing artifacts."""
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
    result = preprocess_transcript(sample)
    print(result)

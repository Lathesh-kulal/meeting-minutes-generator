"""
summarize.py
Wraps a pretrained BART model to generate:
  - a short summary + title for each chapter (for the Chapters view)
  - a compact set of overall highlights (for the Highlights view)
"""

from collections import Counter

import spacy
from transformers import pipeline

_MODEL_NAME = "facebook/bart-large-cnn"
_summarizer = None
_nlp = None

# Titles built from stray pronouns/generic time words/meeting-preamble filler
# read as noise, not topic — skip them so the title favors the actual subject
# matter instead. (The meeting-preamble list matters especially for a
# chapter's opening lines, e.g. "thanks for joining today's meeting" — without
# it, that greeting can out-rank the real topic on a word-count tie.)
_STOP_PHRASES = {"it", "this", "that", "we", "they", "i", "you", "he", "she",
                  "everyone", "someone", "thanks", "everything", "today",
                  "guys", "lot", "stuff", "thing", "things", "kind", "sort",
                  "bit", "anyone", "anything", "nothing", "no one"}

_GENERIC_TIME_LEMMAS = {"week", "day", "month", "time", "minute", "hour", "year",
                         "monday", "tuesday", "wednesday", "thursday", "friday",
                         "saturday", "sunday"}
_GENERIC_MEETING_LEMMAS = {"meeting", "morning", "afternoon", "note", "thank",
                            "everyone", "today"}


def _get_summarizer():
    global _summarizer
    if _summarizer is None:
        _summarizer = pipeline("summarization", model=_MODEL_NAME)
    return _summarizer


def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def _safe_summarize(text: str, max_length: int = 80, min_length: int = 20) -> str:
    """Runs the summarizer with length bounds adjusted for short inputs."""
    summarizer = _get_summarizer()
    word_count = len(text.split())
    if word_count < 10:
        # Too short to meaningfully summarize — just return as-is.
        return text.strip()

    max_length = min(max_length, max(word_count, min_length + 5))
    result = summarizer(
        text,
        max_length=max_length,
        min_length=min(min_length, max_length - 5),
        do_sample=False,
    )
    return result[0]["summary_text"].strip()


def _make_title(chapter_text: str, max_phrases: int = 2) -> str:
    """Derives a short topic-style title (e.g. "Q3 Budget & Marketing Team")
    from a chapter's raw text, using noun-phrase frequency via spaCy.

    This intentionally runs on the chapter's raw text, not its BART summary —
    a plain "first N words" truncation of a summary tends to just repeat a
    truncated sentence (e.g. "We discussed delaying the launch by..."), which
    isn't a topic label. Ranking noun chunks by frequency, while excluding
    person names and generic time words, gets much closer to a real topic
    title without needing a second model call.
    """
    nlp = _get_nlp()
    doc = nlp(chapter_text)

    person_spans = [(ent.start_char, ent.end_char) for ent in doc.ents if ent.label_ == "PERSON"]

    def _overlaps_person(chunk) -> bool:
        return any(chunk.start_char < end and chunk.end_char > start for start, end in person_spans)

    def _is_generic(lemma_or_text: str, generic_set: set) -> bool:
        # Catches plural forms the lemmatizer doesn't reduce (e.g. "Fridays"
        # not reducing to "friday") by also checking the word with a
        # trailing "s" stripped.
        return lemma_or_text in generic_set or lemma_or_text.rstrip("s") in generic_set

    counts: Counter = Counter()
    for chunk in doc.noun_chunks:
        if _overlaps_person(chunk):
            continue
        root_lemma = chunk.root.lemma_.lower()
        root_text = chunk.root.text.lower()
        if _is_generic(root_lemma, _GENERIC_TIME_LEMMAS) or _is_generic(root_text, _GENERIC_TIME_LEMMAS):
            continue
        if _is_generic(root_lemma, _GENERIC_MEETING_LEMMAS) or _is_generic(root_text, _GENERIC_MEETING_LEMMAS):
            continue
        if chunk.root.pos_ == "PRON":
            continue
        if any(tok.lemma_.lower() in _GENERIC_MEETING_LEMMAS for tok in chunk):
            continue

        phrase = chunk.text.strip().lower()
        for article in ("the ", "a ", "an "):
            if phrase.startswith(article):
                phrase = phrase[len(article):]
                break

        if phrase and phrase not in _STOP_PHRASES:
            counts[phrase] += 1

    if not counts:
        words = chapter_text.split()
        return " ".join(words[:6]).rstrip(".,;") or "Untitled Topic"

    multi_word = [(p, c) for p, c in counts.most_common() if len(p.split()) > 1]
    single_word = [(p, c) for p, c in counts.most_common() if len(p.split()) == 1]

    top_phrases = [p for p, _ in multi_word[:max_phrases]]
    if len(top_phrases) < max_phrases:
        top_phrases += [p for p, _ in single_word[:max_phrases - len(top_phrases)]]

    return " & ".join(phrase.title() for phrase in top_phrases)


def summarize_chapters(chapters: list[dict]) -> list[dict]:
    """
    Generates a title + summary for each chapter.

    Args:
        chapters: list of {"chapter_id": int, "text": str}

    Returns:
        list of {"chapter_id": int, "title": str, "summary": str, "text": str}
    """
    enriched = []
    for ch in chapters:
        summary = _safe_summarize(ch["text"])
        enriched.append({
            "chapter_id": ch["chapter_id"],
            "title": _make_title(ch["text"]),
            "summary": summary,
            "text": ch["text"],  # keep raw text for drill-down view
        })
    return enriched


def generate_highlights(full_text: str, num_highlights: int = 5) -> list[str]:
    """
    Generates a short list of key-point highlights from the full transcript.
    Uses the summarizer on the whole transcript, then splits into bullet-style
    sentences.
    """
    summary = _safe_summarize(full_text, max_length=150, min_length=40)

    import re
    sentences = re.split(r"(?<=[.!?])\s+", summary)
    sentences = [s.strip() for s in sentences if s.strip()]
    return sentences[:num_highlights]


if __name__ == "__main__":
    sample = (
        "Hello everyone, thank you guys for coming to our weekly student success meeting. "
        "And let's just get started. So I have our list of chronically absent students here "
        "and I've been noticing a troubling trend. A lot of students are skipping on Fridays. "
        "Does anyone have any idea what's going on? I've heard some of my mentees talking about "
        "how it's really hard to get out of bed on Fridays. It might be good if we did something "
        "like a pancake breakfast to encourage them to come. I think that's a great idea."
    )
    print(_safe_summarize(sample))
    print(_make_title(sample))
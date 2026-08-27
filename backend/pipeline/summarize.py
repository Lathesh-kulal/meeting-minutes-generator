"""
summarize.py
Wraps a pretrained BART model to generate:
  - a short summary + title for each chapter (for the Chapters view)
  - a compact set of overall highlights (for the Highlights view)
"""

from transformers import pipeline

_MODEL_NAME = "facebook/bart-large-cnn"
_summarizer = None


def _get_summarizer():
    global _summarizer
    if _summarizer is None:
        _summarizer = pipeline("summarization", model=_MODEL_NAME)
    return _summarizer


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


def _make_title(summary_text: str) -> str:
    """Derives a short chapter title from its summary (first ~6 words)."""
    words = summary_text.split()
    title = " ".join(words[:6])
    return title.rstrip(".,;") + ("..." if len(words) > 6 else "")


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
            "title": _make_title(summary),
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
        "We discussed the Q3 budget first. The marketing team needs more funds "
        "because the current allocation is not enough to cover the new campaign. "
        "John will send the revised numbers by Friday so the finance team can review them."
    )
    print(_safe_summarize(sample))

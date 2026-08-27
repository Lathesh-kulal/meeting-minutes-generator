"""
segment.py
Splits a cleaned transcript into topic-coherent "chapters" using NLTK's
TextTiling algorithm. Falls back to fixed-size chunking for short transcripts
where TextTiling doesn't have enough signal.
"""

import nltk
from nltk.tokenize import TextTilingTokenizer

nltk.download("stopwords", quiet=True)

_MIN_CHARS_FOR_TEXTTILING = 2000  # TextTiling needs enough text to find boundaries


def _fixed_chunk(sentences: list[str], chunk_size: int = 8) -> list[str]:
    """Fallback: groups sentences into fixed-size chunks."""
    chunks = []
    for i in range(0, len(sentences), chunk_size):
        chunk = " ".join(sentences[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


def segment_transcript(cleaned_text: str, sentences: list[str]) -> list[dict]:
    """
    Splits the transcript into topic segments ("chapters").

    Args:
        cleaned_text: full cleaned transcript as one string
        sentences: sentence-tokenized version (used for fallback chunking)

    Returns:
        list of dicts: [{"chapter_id": int, "text": str}, ...]
    """
    if len(cleaned_text) >= _MIN_CHARS_FOR_TEXTTILING:
        try:
            # TextTiling expects paragraph breaks to detect boundaries well,
            # so we insert them between sentences as a reasonable proxy.
            paragraphed = "\n\n".join(sentences)
            tt = TextTilingTokenizer()
            raw_segments = tt.tokenize(paragraphed)
            segments = [s.replace("\n\n", " ").strip() for s in raw_segments if s.strip()]
            if segments:
                return [
                    {"chapter_id": i + 1, "text": seg}
                    for i, seg in enumerate(segments)
                ]
        except Exception:
            # TextTiling can fail on short/uniform text — fall back gracefully
            pass

    # Fallback for short transcripts or TextTiling failures
    chunks = _fixed_chunk(sentences)
    return [
        {"chapter_id": i + 1, "text": chunk}
        for i, chunk in enumerate(chunks)
    ]


if __name__ == "__main__":
    from preprocess import preprocess_transcript

    sample = (
        "We discussed the Q3 budget first. The marketing team needs more funds. "
        "John will send the revised numbers by Friday. "
        "Next we moved to the product roadmap. "
        "Sarah proposed delaying the launch by two weeks. "
        "Everyone agreed the extra testing time was worth it."
    )
    pre = preprocess_transcript(sample)
    chapters = segment_transcript(pre["cleaned_text"], pre["sentences"])
    for ch in chapters:
        print(ch)

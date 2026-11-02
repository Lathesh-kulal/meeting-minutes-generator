"""
summarize.py
Wraps a pretrained BART model to generate:
  - a short summary + title for each chapter (for the Chapters view)
  - a compact set of overall highlights (for the Highlights view)
"""

from collections import Counter

import spacy
from transformers import pipeline
import re

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
        summary = ground_names(_safe_summarize(ch["text"]), ch["text"])
        enriched.append({
            "chapter_id": ch["chapter_id"],
            "title": _make_title(ch["text"]),
            "summary": summary,
            "text": ch["text"],  # keep raw text for drill-down view
        })
    return enriched


_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")
_FIRST_PERSON = re.compile(
    r"^(i\b|i'm\b|i've\b|i'd\b|in my opinion\b|personally\b|my\b)", re.I)
_LEAD_CONJ = re.compile(r"^(but|and|so|well|also)\s+", re.I)
_QUOTE_TAIL = re.compile(r"\b(he|she|they)\s+says?\W*$", re.I)


_OPINION = re.compile(r",?\s*\b(in my opinion|personally|i think|i feel)\b,?", re.I)
_PRONOUN_START = re.compile(r"^(that|it|this|these|those|they)\b", re.I)
_NAME_SEQ = re.compile(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b")


def ground_names(summary: str, source_text: str) -> str:
    """Remove names BART invented: a capitalised multi-word name that is not in
    the source text is cut back to the part(s) that are (e.g. "David Cameron" ->
    "David" when the transcript only says "David"). If no part of the name is in
    the source, the sentence containing it is dropped (when other text remains)."""
    src = source_text.lower()

    def fix(m):
        name = m.group(0)
        if name.lower() in src:
            return name
        kept = [t for t in name.split() if t.lower() in src]
        return " ".join(kept) if kept else "\0"

    out = _NAME_SEQ.sub(fix, summary)
    if "\0" in out:
        sents = [x for x in _split_sentences(out) if "\0" not in x]
        out = " ".join(sents) if sents else out.replace("\0", "")
    return out


def _clean(s: str) -> str:
    s = _OPINION.sub("", s) if " in my opinion" in s.lower() or s.lower().startswith("in my opinion") else s
    s = _LEAD_CONJ.sub("", s.strip())
    return s[:1].upper() + s[1:]


def _is_poor(s: str) -> bool:
    """Questions, quoted speech and first-person remarks make poor key points."""
    t = s.strip()
    return (t.endswith("?") or t[:1] in "\"'\u201c\u2018" or bool(_QUOTE_TAIL.search(t))
            or bool(_FIRST_PERSON.match(t)))
_embedder = None


def _split_sentences(text: str) -> list[str]:
    return [s.strip() for s in _SENT_SPLIT.split(text) if s.strip()]


def _words(s: str) -> set:
    return set(re.findall(r"[a-z0-9']+", s.lower()))


def _is_duplicate(candidate: str, chosen: list[str], threshold: float = 0.6) -> bool:
    cw = _words(candidate)
    for other in chosen:
        ow = _words(other)
        if cw and ow and len(cw & ow) / len(cw | ow) >= threshold:
            return True
    return False


def _get_embedder():
    """MiniLM (same model as the action-item classifier); None if unavailable."""
    global _embedder
    if _embedder is None:
        try:
            from sentence_transformers import SentenceTransformer
            _embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
        except Exception:
            _embedder = False
    return _embedder or None


def _score_sentences(sentences: list[str], embed=None) -> list[float]:
    """Higher = more central to the meeting. embed: fn(list[str]) -> 2-D array."""
    n = len(sentences)
    base = [0.0] * n
    try:
        if embed is None:
            model = _get_embedder()
            embed = (lambda xs: model.encode(xs, normalize_embeddings=True)) if model else None
        if embed is not None and n:
            import numpy as np
            vecs = np.asarray(embed(sentences), dtype=float)
            norms = np.linalg.norm(vecs, axis=1, keepdims=True)
            vecs = vecs / np.where(norms == 0, 1, norms)
            centroid = vecs.mean(axis=0)
            centroid = centroid / (np.linalg.norm(centroid) or 1)
            base = [float(v) for v in vecs @ centroid]
    except Exception:
        base = [0.0] * n

    scores = []
    for s, b in zip(sentences, base):
        wc = len(s.split())
        score = b + 0.02 * min(wc, 25) / 25          # tiny length bonus (also the no-embedder fallback)
        if _FIRST_PERSON.match(s):
            score -= 0.15
        if _PRONOUN_START.match(s):
            score -= 0.10                              # "That would be a big project." lacks context
        scores.append(score)
    return scores


def generate_highlights(full_text: str, num_highlights: int = 10,
                        chapters: list[dict] | None = None, _embed=None) -> list[str]:
    """
    Key points for the Highlights view, taken from the chapter summaries.
    Every chapter contributes its best sentence first; remaining slots go to
    the highest-scoring sentences overall (max 2 per chapter). Fragments
    ("...", under 6 words) and near-duplicates are skipped. Output keeps
    meeting order. Falls back to the old whole-transcript summary when fewer
    than 3 points result.
    """
    points: list[str] = []

    if chapters:
        cands = []                                     # (chapter_idx, pos, sentence)
        for ci, ch in enumerate(chapters):
            for pos, s in enumerate(_split_sentences(ch.get("summary", ""))):
                s = _clean(s)
                if len(s.split()) >= 6 and not s.rstrip().endswith(("...", "…")):
                    cands.append((ci, pos, s))
        good = [c for c in cands if not _is_poor(c[2])]
        if len(good) >= 3:                             # otherwise keep everything
            cands = good

        if cands:
            scores = _score_sentences([c[2] for c in cands], _embed)
            ranked = sorted(zip(cands, scores), key=lambda x: x[1], reverse=True)
            chosen, per_chapter = [], {}

            def take(item):
                (ci, pos, s), _ = item
                if len(chosen) >= num_highlights or per_chapter.get(ci, 0) >= 2:
                    return
                if _is_duplicate(s, [c[2] for c in chosen]):
                    return
                chosen.append((ci, pos, s))
                per_chapter[ci] = per_chapter.get(ci, 0) + 1

            # Round 1: best sentence of each chapter (coverage), strongest chapters first
            best = {}
            for item in ranked:
                best.setdefault(item[0][0], item)
            for item in sorted(best.values(), key=lambda x: x[1], reverse=True):
                take(item)
            # Round 2: fill the remaining slots with the best of the rest
            for item in ranked:
                take(item)

            chosen.sort(key=lambda c: (c[0], c[1]))
            points = [c[2] for c in chosen]

    if len(points) >= 3:
        return points[:num_highlights]

    summary = ground_names(_safe_summarize(full_text, max_length=150, min_length=40), full_text)
    return _split_sentences(summary)[:5]
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
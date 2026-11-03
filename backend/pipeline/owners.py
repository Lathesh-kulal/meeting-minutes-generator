"""
owners.py
Uses the speaker of each sentence to fill in who an action item belongs to when
the sentence itself names nobody (e.g. in a closing recap, "Marcus: Update the
Jira sprint board by 5 PM today ..." is Marcus's task).

Only applies to transcripts that have speaker labels. A name that is already
the speaker or is spoken in the sentence ("David, could you ...") is never
overridden.
"""

import re

_FILLERS = {"please", "also", "and", "so", "then", "now", "okay", "ok", "just", "first", "next"}

# Common task verbs, used when the POS tagger is not available or mis-tags a
# sentence-initial verb.
_TASK_VERBS = {
    "update", "revise", "submit", "send", "prepare", "draft", "schedule", "review",
    "finalize", "finalise", "check", "share", "create", "set", "book", "follow",
    "contact", "ping", "call", "email", "write", "fix", "test", "deploy", "organize",
    "organise", "arrange", "coordinate", "make", "confirm", "complete", "finish",
    "circulate", "reach", "collect", "compile", "post", "upload", "add", "remove",
}

_FIRST_PERSON_COMMIT = re.compile(
    r"^(i will|i'll|i can|i'm going to|i am going to|let me|i shall)\b", re.I)


def _words(s: str) -> set:
    return set(re.findall(r"[a-z0-9']+", s.lower()))


def _is_imperative_or_commitment(sentence: str, use_spacy: bool = True) -> bool:
    s = sentence.strip()
    if _FIRST_PERSON_COMMIT.match(s):
        return True
    tokens = re.findall(r"[A-Za-z']+", s)
    while tokens and tokens[0].lower() in _FILLERS:
        tokens = tokens[1:]
    if not tokens:
        return False
    if tokens[0].lower() in _TASK_VERBS:
        return True
    if use_spacy:
        try:
            from .ner_utils import _get_nlp
            doc = _get_nlp()(" ".join(tokens))
            return bool(doc) and doc[0].tag_ == "VB"
        except Exception:
            return False
    return False


def _best_sentence_index(item: dict, sentences: list[str]):
    """Index of the transcript sentence that the item's task came from."""
    target = _words(item.get("task") or item.get("text") or "")
    if not target:
        return None
    best, best_key = None, None
    for i, s in enumerate(sentences):
        sw = _words(s)
        if not sw:
            continue
        cover = len(target & sw) / len(target)
        if cover < 0.6:
            continue
        key = (cover, -abs(len(sw) - len(target)))
        if best_key is None or key > best_key:
            best, best_key = i, key
    return best


def assign_owners(items: list[dict], sentences: list[str], speakers: list,
                  use_spacy: bool = True) -> list[dict]:
    """
    Returns items with "assigned_to" filled from the speaker where appropriate.

    Rules (only when the transcript has speaker labels):
      * find the sentence the task came from;
      * if that sentence is an instruction ("Update ...") or a first-person
        commitment ("I'll ..."), and the current assignee is empty or is not
        one of the speakers, the assignee becomes that sentence's speaker.
      * otherwise the existing assignee is kept.
    """
    counts = {}
    for sp in speakers or []:
        if sp:
            counts[sp] = counts.get(sp, 0) + 1
    # a real speaker appears more than once; one-off "Note:" style labels do not
    speaker_names = {n for n, c in counts.items() if c >= 2}
    if not speaker_names:
        return items
    known = set()
    for n in speaker_names:
        known.add(n.lower())
        known.add(n.split()[0].lower())

    out = []
    for item in items:
        new = dict(item)
        assigned = (item.get("assigned_to") or "").strip()
        is_speaker = assigned.lower() in known
        idx = _best_sentence_index(item, sentences)
        if idx is not None and not is_speaker:
            sp = speakers[idx] if idx < len(speakers) else None
            if sp in speaker_names and _is_imperative_or_commitment(sentences[idx], use_spacy):
                new["assigned_to"] = sp.split()[0] if " " in sp else sp
                new["owner_source"] = "speaker"
        out.append(new)
    return out


# --- Guard against invented action items -----------------------------------
# The LLM must give an evidence quote, and the quote is checked against the
# transcript — but the *task* is not checked against the quote, so a task copied
# from a prompt example can slip through with an unrelated (real) quote.

_STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "by", "at",
    "is", "are", "be", "this", "that", "it", "we", "you", "they", "our", "your", "their",
    "will", "would", "should", "could", "can", "need", "needs", "have", "has", "from",
    "up", "out", "about", "as", "so", "then", "also", "please",
}


def _stem(w: str) -> str:
    return w[:5] if len(w) > 5 else w


def _content_stems(s: str) -> set:
    return {_stem(w) for w in re.findall(r"[a-z0-9']+", s.lower())
            if w not in _STOPWORDS and len(w) > 2}


def drop_ungrounded_items(items: list[dict], transcript: str, min_overlap: float = 0.3) -> list[dict]:
    """
    Removes LLM items whose task shares (almost) no content words with their own
    evidence quote, and clears an assignee that never appears in the transcript.
    Items without a task/quote pair (classifier or rule-based) are left alone.
    """
    transcript_words = set(re.findall(r"[a-z0-9']+", (transcript or "").lower()))
    kept = []
    for item in items:
        task, quote = item.get("task"), item.get("text")
        if task and quote:
            task_stems = _content_stems(task)
            if task_stems:
                overlap = len(task_stems & _content_stems(quote)) / len(task_stems)
                if overlap < min_overlap:
                    continue                      # task is not supported by its quote
        new = dict(item)
        assigned = (item.get("assigned_to") or "").strip()
        if assigned and not any(tok in transcript_words
                                for tok in re.findall(r"[a-z0-9']+", assigned.lower())):
            new["assigned_to"] = None             # a name nobody in the meeting said
        kept.append(new)
    return kept
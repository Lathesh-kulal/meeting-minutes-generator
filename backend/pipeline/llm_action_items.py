"""
llm_action_items.py
Action-item extraction using a LOCAL, free LLM served by Ollama
(https://ollama.com). Nothing leaves the machine and there is no API cost.

Why an LLM instead of the TF-IDF classifier?
  * It reads context (e.g. "Sure, I'll take that" only makes sense after
    "Can someone update the deck?"), which sentence-by-sentence
    classification cannot do.
  * It extracts the task, the assignee and the due date in one step, and can
    resolve "I'll" / "you" from the surrounding dialogue.
  * It needs no labeled training data, so the Enron-email vs spoken-meeting
    domain mismatch disappears.

Safeguards against LLM weaknesses:
  * Output is constrained to a JSON schema (Ollama structured outputs).
  * Every item must carry a verbatim "evidence" quote; items whose quote
    cannot be found in the transcript are discarded (anti-hallucination).
  * Long transcripts are processed in overlapping windows; duplicates found
    in the overlap are merged.
  * If Ollama is unreachable or the model is missing, this module raises
    LLMUnavailable and action_items.py falls back to the trained classifier
    / rules, so the pipeline never breaks.

Configuration (environment variables):
    OLLAMA_URL            default http://localhost:11434
    OLLAMA_MODEL          default qwen2.5:7b   (needs ~8 GB RAM; use qwen2.5:3b
                                                on weaker machines - it is faster
                                                but noticeably less accurate)
    OLLAMA_TIMEOUT        seconds per request, default 180
    LLM_WINDOW_CHARS      max characters per window, default 3500
    LLM_OVERLAP_SENTENCES sentences shared between windows, default 3
"""

import difflib
import json
import os
import re
import time

import requests

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:7b")
OLLAMA_TIMEOUT = int(os.environ.get("OLLAMA_TIMEOUT", "180"))
WINDOW_CHARS = int(os.environ.get("LLM_WINDOW_CHARS", "3500"))
OVERLAP_SENTENCES = int(os.environ.get("LLM_OVERLAP_SENTENCES", "3"))

_EVIDENCE_MATCH_THRESHOLD = 0.80  # fuzzy match ratio for quote verification
_AVAILABILITY_TTL = 30  # seconds to cache the "is Ollama up?" check

_availability_cache = {"checked_at": 0.0, "ok": False, "reason": ""}


class LLMUnavailable(RuntimeError):
    """Raised when the local LLM can't be used (server down, model missing...)."""


# --------------------------------------------------------------------------
# Prompt + schema
# --------------------------------------------------------------------------

_SCHEMA = {
    "type": "object",
    "properties": {
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task": {"type": "string"},
                    "assignee": {"type": ["string", "null"]},
                    "due_date": {"type": ["string", "null"]},
                    "evidence": {"type": "string"},
                },
                "required": ["task", "assignee", "due_date", "evidence"],
            },
        }
    },
    "required": ["action_items"],
}

_SYSTEM_PROMPT = """You extract ACTION ITEMS from meeting transcripts.

An action item is a concrete task that someone commits to do, or is asked or \
assigned to do, AFTER the meeting.

DO extract:
- Commitments: "I'll send the report tomorrow", "John will update the deck".
- Assignments/requests that get accepted or are clearly directed at someone: \
"Priya, can you book the venue by Friday?"
- Decisions that create a to-do: "We need to get legal sign-off before launch" \
(assignee may be null).

DO NOT extract:
- Meeting framing and facilitation: "Let's start with the budget", \
"Any comments?", "Thanks for joining", "Let's move on".
- Discussion, opinions, or status of work already done: "The launch went well", \
"We discussed the Q3 budget".
- Vague wishes with no task: "It would be nice to improve onboarding".
- Questions and opinions raised in the discussion: "Why did sign-ups drop in \
March?", "I think the design is too busy." A question only counts when it asks \
someone to do work after the meeting ("Could you look into the March drop?").

Rules:
- A request addressed to a named person counts even when their reply ("Sure", \
"Will do", "I'll get it done") is in the next sentence. Use both sentences as evidence.
- "X needs to do Y" and "X should do Y" assign the task to X.
- "task": a short, clear imperative rewrite of the task (e.g. "Send the revised \
budget numbers to finance").
- "assignee": the person responsible. Resolve "I" to the speaker and "you" to \
the person addressed when the transcript makes that clear. Use null if \
unknown. Never invent names.
- "due_date": the deadline exactly as spoken ("by Friday", "next Monday"), or null.
- "evidence": copy the exact sentence(s) from the transcript that justify the \
item, word for word. Do not paraphrase the evidence.
- If there are no action items, return an empty list.
- Output JSON only."""

_FEW_SHOT_USER = (
    "Transcript:\n"
    "Okay, first up is the website redesign. "
    "The new homepage tested well with users. "
    "Meera, could you share the analytics report with the team by Tuesday? "
    "Yes, I'll get it to everyone tomorrow. "
    "Does anyone have questions? "
    "Vikram needs to renew the hosting contract this month. "
    "We should also ask design to prepare two more mockups."
)

_FEW_SHOT_ASSISTANT = json.dumps(
    {
        "action_items": [
            {
                "task": "Share the analytics report with the team",
                "assignee": "Meera",
                "due_date": "by Tuesday",
                "evidence": "Meera, could you share the analytics report with the team by Tuesday? Yes, I'll get it to everyone tomorrow.",
            },
            {
                "task": "Renew the hosting contract",
                "assignee": "Vikram",
                "due_date": "this month",
                "evidence": "Vikram needs to renew the hosting contract this month.",
            },
            {
                "task": "Ask design to prepare two more mockups",
                "assignee": None,
                "due_date": None,
                "evidence": "We should also ask design to prepare two more mockups.",
            },
        ]
    }
)


# --------------------------------------------------------------------------
# Availability check
# --------------------------------------------------------------------------

def check_availability(force: bool = False) -> tuple[bool, str]:
    """Returns (is_available, reason). Cached briefly to avoid hammering Ollama."""
    now = time.time()
    if not force and now - _availability_cache["checked_at"] < _AVAILABILITY_TTL:
        return _availability_cache["ok"], _availability_cache["reason"]

    ok, reason = False, ""
    try:
        resp = requests.get(f"{OLLAMA_URL}/api/tags", timeout=3)
        resp.raise_for_status()
        installed = [m.get("name", "") for m in resp.json().get("models", [])]
        wanted = OLLAMA_MODEL if ":" in OLLAMA_MODEL else OLLAMA_MODEL + ":latest"
        if wanted in installed or OLLAMA_MODEL in installed:
            ok = True
        else:
            reason = (f"Model '{OLLAMA_MODEL}' is not installed in Ollama. "
                      f"Run: ollama pull {OLLAMA_MODEL}")
    except requests.RequestException as exc:
        reason = (f"Cannot reach Ollama at {OLLAMA_URL} ({exc.__class__.__name__}). "
                  "Is it running? Start it with: ollama serve")

    _availability_cache.update(checked_at=now, ok=ok, reason=reason)
    return ok, reason


# --------------------------------------------------------------------------
# Windowing
# --------------------------------------------------------------------------

def build_windows(sentences: list[str], max_chars: int = None,
                  overlap: int = None) -> list[tuple[int, int]]:
    """
    Groups sentence indices into overlapping windows of at most max_chars.

    Returns a list of (start_idx, end_idx_exclusive).
    """
    max_chars = max_chars or WINDOW_CHARS
    overlap = OVERLAP_SENTENCES if overlap is None else overlap
    n = len(sentences)
    if n == 0:
        return []

    windows = []
    start = 0
    while start < n:
        end, size = start, 0
        while end < n and (size + len(sentences[end]) + 1 <= max_chars or end == start):
            size += len(sentences[end]) + 1
            end += 1
        windows.append((start, end))
        if end >= n:
            break
        start = max(end - overlap, start + 1)  # always make progress
    return windows


# --------------------------------------------------------------------------
# LLM call
# --------------------------------------------------------------------------

def _call_llm(window_text: str) -> list[dict]:
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "format": _SCHEMA,
        "options": {"temperature": 0, "num_ctx": 4096},
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": _FEW_SHOT_USER},
            {"role": "assistant", "content": _FEW_SHOT_ASSISTANT},
            {"role": "user", "content": f"Transcript:\n{window_text}"},
        ],
    }
    try:
        resp = requests.post(f"{OLLAMA_URL}/api/chat", json=payload,
                             timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
    except requests.RequestException as exc:
        raise LLMUnavailable(f"Ollama request failed: {exc}") from exc

    content = resp.json().get("message", {}).get("content", "")
    return _parse_items(content)


def _parse_items(content: str) -> list[dict]:
    """Parses the model's JSON; tolerant of stray text around the JSON."""
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", content, flags=re.DOTALL)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []

    items = data.get("action_items", []) if isinstance(data, dict) else []
    clean = []
    for it in items:
        if not isinstance(it, dict):
            continue
        task = str(it.get("task") or "").strip()
        evidence = str(it.get("evidence") or "").strip()
        if not task or not evidence:
            continue
        clean.append({
            "task": task,
            "assignee": _none_if_blank(it.get("assignee")),
            "due_date": _none_if_blank(it.get("due_date")),
            "evidence": evidence,
        })
    return clean


# Words that are not a usable owner. Transcripts usually have no speaker
# labels, so the model sometimes writes "You" / "I" instead of leaving the
# assignee empty; those must become None, not a fake owner on the results page.
_NOT_A_NAME = {
    "", "null", "none", "n/a", "na", "unknown", "unassigned", "tbd",
    "i", "me", "my", "myself", "you", "your", "we", "us", "our", "they",
    "them", "he", "she", "it", "someone", "somebody", "anyone", "anybody",
    "everyone", "everybody", "team", "all", "speaker", "the speaker",
}


def _none_if_blank(value):
    if value is None:
        return None
    value = str(value).strip()
    return None if value.lower().strip(".,!?") in _NOT_A_NAME else value


# --------------------------------------------------------------------------
# Verification against the transcript
# --------------------------------------------------------------------------

def _norm(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", "", re.sub(r"\s+", " ", text.lower())).strip()


def _locate_evidence(evidence: str, sentences: list[str], lo: int, hi: int):
    """
    Finds which sentences in [lo, hi) the evidence quote refers to.

    Returns (first_idx, last_idx) or None if the quote can't be verified.
    Tries spans of 1-3 consecutive sentences and picks the best fuzzy match.
    """
    target = _norm(evidence)
    if not target:
        return None

    best, best_ratio = None, 0.0
    for i in range(lo, hi):
        for span in (1, 2, 3):
            j = i + span
            if j > hi:
                break
            candidate = _norm(" ".join(sentences[i:j]))
            if not candidate:
                continue
            if target in candidate or candidate in target:
                # containment: score by length similarity so the tightest span wins
                ratio = 0.9 + 0.1 * min(len(target), len(candidate)) / max(len(target), len(candidate))
            else:
                ratio = difflib.SequenceMatcher(None, target, candidate).ratio()
            if ratio > best_ratio:
                best, best_ratio = (i, j - 1), ratio

    return best if best_ratio >= _EVIDENCE_MATCH_THRESHOLD else None


# A question is only an action item if it also contains a request or a
# commitment ("could you...", "I'll...", "please...", "need to..."). The model
# does not reliably follow the prompt rule for this, so it is enforced here.
_REQUEST_OR_COMMITMENT_CUE = re.compile(
    r"\b(?:"
    r"(?:can|could|would|will|shall|should|might)\s+(?:you|someone|somebody|anyone|anybody|we|i)"
    r"|i\s+(?:can|could|will)"
    r"|\w+'ll"
    r"|will|please|should|must|let's"
    r"|needs?\s+to|have\s+to|has\s+to|going\s+to"
    r"|make\s+sure|follow\s+up|take\s+care\s+of|happy\s+to|responsible\s+for"
    r")\b",
    flags=re.IGNORECASE,
)


def _is_uncued_question(text: str) -> bool:
    """True if text contains a question but no request/commitment wording."""
    if "?" not in text:
        return False
    return not _REQUEST_OR_COMMITMENT_CUE.search(text.replace("\u2019", "'"))


# Opinion openers such as "I personally feel...", "Well, I think...".
_OPINION_OPENER = re.compile(
    r"^\W*(?:(?:well|but|and|so|actually|honestly),?\s+)*"
    r"i\s+(?:personally\s+)?(?:think|feel|believe|guess|suppose|reckon)\b",
    flags=re.IGNORECASE,
)


def _is_chatter(sentence: str) -> bool:
    """A question or opinion with no request/commitment wording."""
    text = sentence.replace("\u2019", "'")
    if _REQUEST_OR_COMMITMENT_CUE.search(text):
        return False
    return "?" in text or bool(_OPINION_OPENER.search(text))


def _trim_span(sentences: list[str], span: tuple[int, int]):
    """
    Trims leading/trailing chatter (uncued questions and opinions) off an
    item's evidence span so e.g. "<question>? <opinion>. <real proposal>."
    becomes just the real proposal. Only the ends are trimmed, so the text
    stays contiguous and a real request is never cut. Returns the new
    (first, last) span, or None if nothing but chatter was left.
    """
    first, last = span
    while first <= last and _is_chatter(sentences[first]):
        first += 1
    while last >= first and _is_chatter(sentences[last]):
        last -= 1
    return (first, last) if first <= last else None


def _same_item(a: dict, b: dict) -> bool:
    """Duplicate detection for items surfaced twice via window overlap."""
    if a["_span"][0] <= b["_span"][1] and b["_span"][0] <= a["_span"][1]:
        return True  # overlapping evidence sentences
    return difflib.SequenceMatcher(None, _norm(a["task"]), _norm(b["task"])).ratio() > 0.85


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------

def extract_action_items_llm(sentences: list[str]) -> list[dict]:
    """
    Extracts action items from a list of transcript sentences using the local LLM.

    Returns a list of dicts:
        {"text": <original transcript sentence(s)>,
         "task": <clean imperative summary>,
         "assigned_to": str | None,
         "due_date": str | None,
         "method": "llm"}

    Raises LLMUnavailable if Ollama can't be used.
    """
    if not sentences:
        return []

    ok, reason = check_availability()
    if not ok:
        raise LLMUnavailable(reason)

    found: list[dict] = []
    for lo, hi in build_windows(sentences):
        window_text = " ".join(sentences[lo:hi])
        for item in _call_llm(window_text):
            span = _locate_evidence(item["evidence"], sentences, lo, hi)
            if span is None:
                continue  # quote not in transcript -> likely hallucinated
            span = _trim_span(sentences, span)
            if span is None:
                continue  # nothing but a question/opinion, no request or commitment
            item["_span"] = span
            found.append(item)

    # Merge duplicates from overlapping windows (keep the first, fill gaps)
    merged: list[dict] = []
    for item in found:
        dup = next((m for m in merged if _same_item(m, item)), None)
        if dup is None:
            merged.append(item)
        else:
            dup["assignee"] = dup["assignee"] or item["assignee"]
            dup["due_date"] = dup["due_date"] or item["due_date"]
            dup["_span"] = (min(dup["_span"][0], item["_span"][0]),
                            max(dup["_span"][1], item["_span"][1]))

    merged.sort(key=lambda m: m["_span"][0])
    return [
        {
            "text": " ".join(sentences[m["_span"][0]:m["_span"][1] + 1]),
            "task": m["task"],
            "assigned_to": m["assignee"],
            "due_date": m["due_date"],
            "method": "llm",
        }
        for m in merged
    ]


if __name__ == "__main__":
    demo = [
        "Let's start with the marketing budget.",
        "Priya, can you book the venue by Friday?",
        "Sure, I'll do it tomorrow morning.",
        "The last campaign went well.",
        "Amit will share the slides after lunch.",
    ]
    ok, why = check_availability(force=True)
    print("Ollama available:", ok, why)
    if ok:
        for r in extract_action_items_llm(demo):
            print(r)

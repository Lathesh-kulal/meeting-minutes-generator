"""
translate.py
Translates a meeting's final generated output (highlights, chapter titles/
summaries, action-item text) into a target language, using pretrained
Helsinki-NLP (OPUS-MT) models.

Scope, by design:
  - Translated: highlights, chapter titles, chapter summaries, action-item text
  - NOT translated: the raw transcript, action-item assignee names, and due
    dates. Names and dates are left as detected — translating a name is
    usually wrong (transliteration != translation), and due dates are already
    normalized strings that shouldn't be re-rendered in another language.
  - meeting_title is also left untranslated for the same "don't touch proper
    nouns" reasoning, and because it's user-supplied, not model-generated.

Called from app/routes/export.py as translate_result(meeting_data, lang),
only when lang is something other than "en"/"original". Raises
NotImplementedError for any lang code not in _LANGUAGE_CONFIG, which
export.py already catches and turns into a 501 response.

Adding a new language later: add one entry to _LANGUAGE_CONFIG below. Most
languages have a direct Helsinki-NLP/opus-mt-en-<code> model; ones that
don't (e.g. Telugu) may need a multilingual model + a source-text prefix
token instead — see the "te" entry for the pattern to follow.
"""

from transformers import pipeline
from ner_utils import find_person_names
import re

# Each entry: model name, and an optional prefix token some multilingual
# OPUS-MT models require prepended to the source text to select the target
# language (e.g. the Dravidian-language model needs ">>tel<<" for Telugu).
_LANGUAGE_CONFIG = {
    "hi": {"model": "Helsinki-NLP/opus-mt-en-hi", "prefix": None},   # Hindi
    "es": {"model": "Helsinki-NLP/opus-mt-en-es", "prefix": None},   # Spanish
    "te": {"model": "Helsinki-NLP/opus-mt-en-dra", "prefix": ">>tel<<"},  # Telugu
    # Sharing the same en-dra model — free to add later:
    "ta": {"model": "Helsinki-NLP/opus-mt-en-dra", "prefix": ">>tam<<"},  # Tamil
    "kn": {"model": "Helsinki-NLP/opus-mt-en-dra", "prefix": ">>kan<<"},  # Kannada
    "ml": {"model": "Helsinki-NLP/opus-mt-en-dra", "prefix": ">>mal<<"},  # Malayalam
}

# One loaded pipeline per model name, not per language — languages that
# share a multilingual model (like the three Dravidian ones above) reuse
# the same loaded model instead of loading it multiple times.
_translators: dict[str, "pipeline"] = {}


def _get_translator(model_name: str):
    if model_name not in _translators:
        _translators[model_name] = pipeline("translation", model=model_name)
    return _translators[model_name]


def _translate_batch(texts: list[str], lang: str) -> list[str]:
    """Translates a list of strings in one batched model call. Empty strings
    are passed through unchanged rather than sent to the model."""
    if not texts:
        return texts

    config = _LANGUAGE_CONFIG[lang]
    translator = _get_translator(config["model"])
    prefix = config["prefix"]

    inputs = [f"{prefix} {t}" if prefix and t else t for t in texts]

    # Keep track of which entries were actually non-empty, so we don't waste
    # a model call translating blank strings (e.g. a chapter with no summary).
    non_empty_indices = [i for i, t in enumerate(texts) if t.strip()]
    if not non_empty_indices:
        return texts

    to_translate = [inputs[i] for i in non_empty_indices]
    results = translator(to_translate)
    translated_texts = [r["translation_text"].strip() for r in results]

    output = list(texts)
    for idx, translated in zip(non_empty_indices, translated_texts):
        output[idx] = translated
    return output
def _split_on_names(text: str, names: list[str]) -> list[str]:
    """Splits text around each detected name, keeping the names themselves
    as separate elements. Result alternates [text, name, text, name, ...] —
    even indices are ordinary text, odd indices are names, so parity alone
    tells you which is which."""
    if not names:
        return [text]
    sorted_names = sorted(set(names), key=len, reverse=True)
    pattern = "(" + "|".join(re.escape(n) for n in sorted_names) + ")"
    return re.split(pattern, text)


def _translate_texts_protecting_names(texts: list[str], lang: str) -> list[str]:
    """Translates free text (highlights, chapter summaries, action-item
    text) while protecting any person names found in it from being
    translated. Names are detected via the same NER used for assignee
    extraction, the text is split around each name, only the surrounding
    fragments go through translation, and the original name is spliced
    back in unchanged."""
    if not texts:
        return texts

    split_per_text = [
        _split_on_names(t, find_person_names(t) if t.strip() else [])
        for t in texts
    ]

    to_translate = [
        part for parts in split_per_text
        for i, part in enumerate(parts) if i % 2 == 0
    ]
    translated = _translate_batch(to_translate, lang)
    translated_iter = iter(translated)

    output = []
    for parts in split_per_text:
        pieces = []
        for i, part in enumerate(parts):
            value = part if i % 2 == 1 else next(translated_iter)
            if value:
                pieces.append(value)
        output.append(" ".join(pieces))
    return output

def translate_result(meeting_data: dict, lang: str) -> dict:
    """
    Translates the final-output fields of a meeting's result dict into the
    requested language. Does not mutate the input.

    Args:
        meeting_data: dict as returned by Meeting.to_dict(include_full_result=True)
        lang: target language code, e.g. "hi", "es", "te"

    Returns:
        A new dict with highlights/chapter titles+summaries/action-item text
        translated. transcript, meeting_title, action-item assigned_to/
        due_date/method are copied through unchanged.

    Raises:
        NotImplementedError: if lang is not a supported language code.
    """
    if lang not in _LANGUAGE_CONFIG:
        raise NotImplementedError(f"Translation to '{lang}' is not supported.")

    result = dict(meeting_data)  # shallow copy — we replace whole fields below, not mutate in place

    highlights = meeting_data.get("highlights") or []
    result["highlights"] = _translate_texts_protecting_names(highlights, lang)

    chapters = meeting_data.get("chapters") or []
    if chapters:
        titles = [ch.get("title", "") for ch in chapters]
        summaries = [ch.get("summary", "") for ch in chapters]
        translated_titles = _translate_titles(titles, lang)
        translated_summaries = _translate_texts_protecting_names(summaries, lang)

        result["chapters"] = [
            {**ch, "title": translated_titles[i], "summary": translated_summaries[i]}
            for i, ch in enumerate(chapters)
        ]

    action_items = meeting_data.get("action_items") or []
    if action_items:
        texts = [item.get("text", "") for item in action_items]
        translated_texts = _translate_texts_protecting_names(texts, lang)
        # assigned_to, due_date, and method are intentionally left untouched
        result["action_items"] = [
            {**item, "text": translated_texts[i]}
            for i, item in enumerate(action_items)
        ]

    return result
def _split_title(title: str) -> list[str]:
    """Splits a chapter title into its individual noun-phrase fragments.
    Titles are built by joining fragments with " & " (see summarize.py's
    _make_title); translating each fragment separately, rather than the
    whole joined string, avoids a trailing-artifact bug where OPUS-MT
    sometimes appends junk (e.g. a stray "(c)") to short, unnatural,
    ampersand-joined inputs it wasn't trained on."""
    return [part.strip() for part in title.split(" & ") if part.strip()]


def _translate_titles(titles: list[str], lang: str) -> list[str]:
    """Translates chapter titles fragment-by-fragment (see _split_title),
    then rejoins each title's fragments with " & "."""
    if not titles:
        return titles

    fragments_per_title = [_split_title(t) for t in titles]
    all_fragments = [frag for frags in fragments_per_title for frag in frags]
    translated_fragments = _translate_batch(all_fragments, lang)

    output = []
    cursor = 0
    for frags in fragments_per_title:
        n = len(frags)
        output.append(" & ".join(translated_fragments[cursor:cursor + n]))
        cursor += n
    return output


if __name__ == "__main__":
    sample = {
        "meeting_title": "Test Meeting",
        "transcript": "raw transcript stays untouched...",
        "highlights": ["We discussed delaying the launch by two weeks."],
        "chapters": [
            {"chapter_id": 1, "title": "Marketing Budget & Current Allocation",
             "summary": "We discussed delaying the launch by two weeks.", "text": "..."},
        ],
        "action_items": [
            {"text": "Reha will prepare the revised budget numbers.",
             "assigned_to": "Reha", "due_date": "Friday", "method": "trained"},
        ],
    }
    import json
    print(json.dumps(translate_result(sample, "hi"), indent=2, ensure_ascii=False))

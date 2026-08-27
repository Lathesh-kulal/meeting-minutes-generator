"""
translate.py
Translates final output text (highlights, chapter summaries/titles, action
item text) into a user-selected target language using a pretrained
Hugging Face translation model. Names and dates inside action items, and
the raw transcript, are intentionally left untranslated.
"""

# TODO: pick a model — e.g. facebook/nllb-200-distilled-600M (many languages,
# one model) or Helsinki-NLP/opus-mt-en-<lang> (lighter, per language pair)

_translator_cache = {}


def _get_translator(target_lang: str):
    """Loads (and caches) a translation pipeline for the given target language."""
    raise NotImplementedError


def translate_text(text: str, target_lang: str) -> str:
    """Translates a single string into target_lang."""
    raise NotImplementedError


def translate_result(result: dict, target_lang: str) -> dict:
    """
    Translates the final pipeline output (highlights, chapters, action item
    text) into target_lang, leaving transcript and entity fields untouched.

    Args:
        result: the dict produced by pipeline_runner.run_pipeline()
        target_lang: ISO language code, e.g. "hi", "es", "te"

    Returns:
        a new dict with translated highlights/chapters/action_items
    """
    if target_lang in (None, "en", "original"):
        return result

    raise NotImplementedError

"""
action_items.py
Extracts action items from a transcript.

Backend priority (ACTION_ITEM_BACKEND=auto, the default):
  1. Local LLM via Ollama           (pipeline/llm_action_items.py)
  2. Trained sentence-embedding classifier (ml_training/saved_models/action_item_clf.pkl)
  3. Rule-based heuristic           (modal verbs + imperative patterns)

If a higher-priority backend is unavailable (e.g. Ollama isn't running), the
next one is used automatically so the pipeline never breaks.

Force a single backend with the ACTION_ITEM_BACKEND environment variable:
    auto | llm | classifier | rules
"""

import logging
import os
import re
import joblib

from .llm_action_items import LLMUnavailable, extract_action_items_llm

logger = logging.getLogger(__name__)

BACKEND = os.environ.get("ACTION_ITEM_BACKEND", "auto").lower()

_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "..", "ml_training", "saved_models", "action_item_clf.pkl"
)

_clf = None
_embedder = None

# --- Rule-based fallback ---
_ACTION_PATTERNS = re.compile(
    r"\b(will|should|need to|needs to|must|going to|let's|plan to|"
    r"has to|have to|assign|responsible for|by (monday|tuesday|wednesday|"
    r"thursday|friday|saturday|sunday|next week|tomorrow|end of))\b",
    flags=re.IGNORECASE,
)


def _load_trained_model():
    global _clf, _embedder
    if _clf is None and os.path.exists(_MODEL_PATH):
        # Imported lazily so the LLM / rule-based paths don't pay the
        # torch + sentence-transformers import cost (or fail if it's missing).
        from sentence_transformers import SentenceTransformer

        bundle = joblib.load(_MODEL_PATH)
        _clf = bundle["classifier"]
        _embedder = SentenceTransformer(bundle["embedding_model_name"])
    return _clf, _embedder


def _rule_based_is_action_item(sentence: str) -> bool:
    return bool(_ACTION_PATTERNS.search(sentence))


def _extract_with_classifier_or_rules(sentences: list[str]) -> list[dict]:
    clf, embedder = _load_trained_model()
    results = []

    if clf is not None and embedder is not None:
        X = embedder.encode(sentences)
        preds = clf.predict(X)
        for sentence, pred in zip(sentences, preds):
            if pred == 1:
                results.append({"text": sentence, "method": "trained"})
    else:
        for sentence in sentences:
            if _rule_based_is_action_item(sentence):
                results.append({"text": sentence, "method": "rule_based"})

    return results


def extract_action_items(sentences: list[str]) -> list[dict]:
    """
    Detects action items in a list of transcript sentences.

    Args:
        sentences: list of transcript sentences (in order)

    Returns:
        list of {"text": str, "method": "llm"|"trained"|"rule_based"}.
        LLM results also include "task", "assigned_to" and "due_date".
    """
    if BACKEND in ("auto", "llm"):
        try:
            return extract_action_items_llm(sentences)
        except LLMUnavailable as exc:
            if BACKEND == "llm":
                raise
            logger.warning("LLM action-item extraction unavailable (%s). "
                           "Falling back to classifier/rules.", exc)

    return _extract_with_classifier_or_rules(sentences)


if __name__ == "__main__":
    sample_sentences = [
        "We discussed the Q3 budget.",
        "John will send the revised numbers by Friday.",
        "The weather was nice today.",
        "Sarah needs to finalize the report before the next meeting.",
    ]
    for item in extract_action_items(sample_sentences):
        print(item)

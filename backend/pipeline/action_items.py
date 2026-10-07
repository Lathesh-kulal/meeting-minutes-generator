"""
action_items.py
Extracts action-item sentences from a transcript.

Uses the trained classifier from ml_training/saved_models/action_item_clf.pkl
if it exists. Falls back to a simple rule-based heuristic (modal verbs +
imperative patterns) if no trained model is available yet — this lets the
rest of the pipeline run end-to-end before training is done.
"""

import os
import re
import joblib
from sentence_transformers import SentenceTransformer
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
        bundle = joblib.load(_MODEL_PATH)
        _clf = bundle["classifier"]
        _embedder = SentenceTransformer(bundle["embedding_model_name"])
    return _clf, _embedder


def _rule_based_is_action_item(sentence: str) -> bool:
    return bool(_ACTION_PATTERNS.search(sentence))


def extract_action_items(sentences: list[str]) -> list[dict]:
    """
    Flags sentences that look like action items.

    Args:
        sentences: list of transcript sentences

    Returns:
        list of {"text": str, "method": "trained"|"rule_based"}
    """

    clf, embedder = _load_trained_model()
    results = []

    if clf is not None and embedder is not None:
        X = embedder.encode(sentences)
        preds = clf.predict(X)
        for sentence, pred in zip(sentences, preds):
            if pred == 1:
                results.append({"text": sentence, "method": "trained"})
    else:
        # Fallback so the pipeline still works before the classifier is trained
        for sentence in sentences:
            if _rule_based_is_action_item(sentence):
                results.append({"text": sentence, "method": "rule_based"})

    return results


if __name__ == "__main__":
    sample_sentences = [
        "We discussed the Q3 budget.",
        "John will send the revised numbers by Friday.",
        "The weather was nice today.",
        "Sarah needs to finalize the report before the next meeting.",
    ]
    for item in extract_action_items(sample_sentences):
        print(item)

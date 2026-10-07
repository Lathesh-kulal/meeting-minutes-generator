"""
train_classifier.py
Trains the action-item classifier on the labeled dataset produced by
prepare_dataset.py, and saves it to saved_models/action_item_clf.pkl.

Uses a pretrained sentence-embedding model (all-MiniLM-L6-v2) to turn each
sentence into a dense vector that captures meaning, not just word overlap,
then trains Logistic Regression on top of those vectors. This replaced an
earlier TF-IDF (bag-of-words) version, which couldn't distinguish
semantically different but lexically similar sentences — e.g. "Any
comments?" and "Could you look into the market research?" share enough
surface vocabulary to confuse a bag-of-words model, even though they're
clearly different kinds of sentences to a human reader.

The embedding model itself is NOT pickled — only the trained classifier is
saved. Both training and inference load the same named pretrained embedder
fresh each time, via sentence-transformers' own model cache, avoiding the
kind of version-fragility a pickled deep-learning model would introduce.

pipeline/action_items.py automatically picks this up once it exists —
no other code changes needed there beyond matching the embedding step.

Usage:
    python -m ml_training.train_classifier
"""

import os
import csv
import joblib

from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix

_LABELED_DIR = os.path.join(os.path.dirname(__file__), "data", "labeled")
_TRAIN_PATH = os.path.join(_LABELED_DIR, "train.csv")
_TEST_PATH = os.path.join(_LABELED_DIR, "test.csv")

_MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
_MODEL_PATH = os.path.join(_MODEL_DIR, "action_item_clf.pkl")

# Shared constant — pipeline/action_items.py must use this exact same name
# so training and inference embed sentences identically.
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


def _load_csv(path: str):
    texts, labels = [], []
    with open(path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            texts.append(row["text"])
            labels.append(int(row["label"]))
    return texts, labels


def train_classifier():
    if not (os.path.exists(_TRAIN_PATH) and os.path.exists(_TEST_PATH)):
        raise FileNotFoundError(
            "train.csv / test.csv not found. Run `python -m ml_training.prepare_dataset` first."
        )

    train_texts, train_labels = _load_csv(_TRAIN_PATH)
    test_texts, test_labels = _load_csv(_TEST_PATH)

    print(f"Training on {len(train_texts)} examples, testing on {len(test_texts)}.")
    print(f"Loading embedding model ({EMBEDDING_MODEL_NAME})... this may take a moment the first time.")

    embedder = SentenceTransformer(EMBEDDING_MODEL_NAME)

    print("Embedding training sentences...")
    X_train = embedder.encode(train_texts, show_progress_bar=True)
    print("Embedding test sentences...")
    X_test = embedder.encode(test_texts, show_progress_bar=True)

    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(X_train, train_labels)

    preds = clf.predict(X_test)

    print("\n--- Test set performance (sanity check, not for report evaluation) ---")
    print(classification_report(test_labels, preds, target_names=["not_action_item", "action_item"]))
    print("Confusion matrix:")
    print(confusion_matrix(test_labels, preds))

    os.makedirs(_MODEL_DIR, exist_ok=True)
    joblib.dump({"classifier": clf, "embedding_model_name": EMBEDDING_MODEL_NAME}, _MODEL_PATH)
    print(f"\nSaved trained model to {_MODEL_PATH}")


if __name__ == "__main__":
    train_classifier()
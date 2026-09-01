"""
train_classifier.py
Trains the action-item classifier (TF-IDF + Logistic Regression) on the
labeled dataset produced by prepare_dataset.py, and saves it to
saved_models/action_item_clf.pkl.

pipeline/action_items.py automatically picks this up once it exists —
no other code changes needed.

Usage:
    python -m ml_training.train_classifier
"""

import os
import joblib

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix
import csv

_LABELED_DIR = os.path.join(os.path.dirname(__file__), "data", "labeled")
_TRAIN_PATH = os.path.join(_LABELED_DIR, "train.csv")
_TEST_PATH = os.path.join(_LABELED_DIR, "test.csv")

_MODEL_DIR = os.path.join(os.path.dirname(__file__), "saved_models")
_MODEL_PATH = os.path.join(_MODEL_DIR, "action_item_clf.pkl")


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

    vectorizer = TfidfVectorizer(
        max_features=10000,
        ngram_range=(1, 2),
        stop_words="english",
    )
    X_train = vectorizer.fit_transform(train_texts)
    X_test = vectorizer.transform(test_texts)

    clf = LogisticRegression(max_iter=1000, class_weight="balanced")
    clf.fit(X_train, train_labels)

    preds = clf.predict(X_test)

    print("\n--- Test set performance (sanity check, not for report evaluation) ---")
    print(classification_report(test_labels, preds, target_names=["not_action_item", "action_item"]))
    print("Confusion matrix:")
    print(confusion_matrix(test_labels, preds))

    os.makedirs(_MODEL_DIR, exist_ok=True)
    joblib.dump({"classifier": clf, "vectorizer": vectorizer}, _MODEL_PATH)
    print(f"\nSaved trained model to {_MODEL_PATH}")


if __name__ == "__main__":
    train_classifier()

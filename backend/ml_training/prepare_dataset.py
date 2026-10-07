"""
prepare_dataset.py
Loads the labeled action-item dataset and splits it into train/test CSVs
under data/labeled/.

Expected input format (tab-separated), one statement per line:
    LABEL<TAB>statement text

Where LABEL is "ACTION" for sentences that are action items, and anything
else (e.g. "NOACTION" or a blank/other label) for sentences that are not.
Quoted statements (wrapped in " ") are unquoted automatically.

Primary source dataset (2,750 labeled statements, public, used in prior
meeting-summarization research):
    https://github.com/kiransarv/actionitemdetection/blob/master/dataset

This primary dataset is built from written Enron corporate emails. Testing
showed a domain mismatch when applied to spoken meeting transcripts: casual
discourse phrases ("Let's start with...", "That's everything for today")
were misclassified as action items, since they superficially resemble the
imperative/directive phrasing common in the email-style training data.

To address this, a small supplementary file of meeting-discourse-style
examples (both negative — conversational framing — and positive — spoken-
style task assignments) is merged in alongside the primary dataset:
    ml_training/data/raw/meeting_discourse_augmentation.tsv

Because this supplementary set is much smaller than the primary dataset
(~50 vs ~2,700 examples), each augmentation example is duplicated
(oversampled) a configurable number of times so it carries meaningful
weight during training, rather than being statistically drowned out.
Oversampled duplicates are added ONLY to the training split, never to the
test split — otherwise the model would be evaluated on data it had
memorized, which would inflate test accuracy dishonestly.

Usage:
    1. Download the raw "dataset" file from the link above (click "Download
       raw file" on GitHub) and save it as:
           ml_training/data/raw/action_items_dataset.tsv
    2. Run: python -m ml_training.prepare_dataset
"""

import csv
import os
import random

_RAW_PATH = os.path.join(
    os.path.dirname(__file__), "data", "raw", "action_items_dataset.tsv"
)
_AUGMENTATION_PATH = os.path.join(
    os.path.dirname(__file__), "data", "raw", "meeting_discourse_augmentation.tsv"
)
_LABELED_DIR = os.path.join(os.path.dirname(__file__), "data", "labeled")
_TRAIN_PATH = os.path.join(_LABELED_DIR, "train.csv")
_TEST_PATH = os.path.join(_LABELED_DIR, "test.csv")

_TEST_FRACTION = 0.2
_RANDOM_SEED = 42

# How many times each augmentation example is duplicated in the training
# set. Tuned so the augmentation carries meaningful weight against the much
# larger base dataset without overwhelming it.
_AUGMENTATION_OVERSAMPLE_FACTOR = 6


def _load_raw_rows(path: str) -> list[tuple[str, int]]:
    """
    Reads the tab-separated raw file and returns a list of
    (text, is_action_item) tuples, deduplicated.
    """
    rows = []
    seen = set()

    with open(path, encoding="utf-8", errors="ignore") as f:
        for line in f:
            line = line.rstrip("\n")
            if not line.strip():
                continue

            parts = line.split("\t", 1)
            if len(parts) != 2:
                continue

            label, text = parts
            label = label.strip()
            text = text.strip().strip('"').strip()

            if not text or text in seen:
                continue
            seen.add(text)

            is_action = 1 if label.upper() == "ACTION" else 0
            rows.append((text, is_action))

    return rows


def _write_csv(path: str, rows: list[tuple[str, int]]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["text", "label"])
        writer.writerows(rows)


def prepare_dataset():
    if not os.path.exists(_RAW_PATH):
        raise FileNotFoundError(
            f"Raw dataset not found at {_RAW_PATH}. "
            "Download it from https://github.com/kiransarv/actionitemdetection/blob/master/dataset "
            "and save it there first."
        )

    base_rows = _load_raw_rows(_RAW_PATH)
    if not base_rows:
        raise ValueError("No valid rows parsed from the raw dataset file.")

    # Split the BASE dataset only, so test metrics reflect genuine
    # generalization on the original distribution.
    random.seed(_RANDOM_SEED)
    shuffled_base = base_rows[:]
    random.shuffle(shuffled_base)
    split_index = int(len(shuffled_base) * (1 - _TEST_FRACTION))
    train_rows = shuffled_base[:split_index]
    test_rows = shuffled_base[split_index:]

    print(f"Base dataset: {len(base_rows)} statements "
          f"({sum(1 for _, l in base_rows if l == 1)} action items, "
          f"{sum(1 for _, l in base_rows if l == 0)} non-action-items).")

    # Augmentation examples are added only to the training split, oversampled.
    if os.path.exists(_AUGMENTATION_PATH):
        aug_rows = _load_raw_rows(_AUGMENTATION_PATH)
        base_texts = {text for text, _ in base_rows}
        new_aug_rows = [r for r in aug_rows if r[0] not in base_texts]

        oversampled_aug = new_aug_rows * _AUGMENTATION_OVERSAMPLE_FACTOR
        train_rows = train_rows + oversampled_aug
        random.shuffle(train_rows)

        print(f"Merged in {len(new_aug_rows)} meeting-discourse augmentation examples, "
              f"oversampled {_AUGMENTATION_OVERSAMPLE_FACTOR}x "
              f"({len(oversampled_aug)} total added to training set only).")
    else:
        print(f"No augmentation file found at {_AUGMENTATION_PATH} — using base dataset only.")

    print(f"Final split: {len(train_rows)} training rows, {len(test_rows)} test rows.")

    _write_csv(_TRAIN_PATH, train_rows)
    _write_csv(_TEST_PATH, test_rows)

    print(f"Wrote {len(train_rows)} rows to {_TRAIN_PATH}")
    print(f"Wrote {len(test_rows)} rows to {_TEST_PATH}")


if __name__ == "__main__":
    prepare_dataset()

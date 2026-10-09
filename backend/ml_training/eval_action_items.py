"""
eval_action_items.py
Compares action-item backends (rules / trained classifier / local LLM) on a
small hand-labeled meeting file. Scored per predicted item: an item is correct
if its span contains a gold sentence. Consecutive [A] lines count as ONE gold
action, found if any of its lines is covered.

Usage (from backend/):
    python -m ml_training.eval_action_items                 # all backends
    python -m ml_training.eval_action_items --backend llm   # one backend
    python -m ml_training.eval_action_items --file path/to/your_meetings.txt

File format: see data/eval/meeting_eval.txt ([A] marks gold action sentences,
blank line separates meetings). Add your own real meetings for a trustworthy
score - the bundled file is small and only a smoke test.
"""

import argparse
import os

from pipeline import action_items, llm_action_items

_DEFAULT_FILE = os.path.join(os.path.dirname(__file__), "data", "eval", "meeting_eval.txt")


def load_meetings(path: str):
    meetings, cur = [], []
    with open(path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if line.startswith("#"):
                continue
            if not line:
                if cur:
                    meetings.append(cur)
                    cur = []
                continue
            is_action = line.startswith("[A]")
            cur.append((line[3:].strip() if is_action else line, is_action))
    if cur:
        meetings.append(cur)
    return meetings


def run_backend(name: str, sentences: list[str]) -> list[set[str]]:
    """
    Returns one set of covered transcript sentences per predicted item.

    An LLM item can span several sentences (e.g. a request plus the reply
    accepting it), so scoring is done per item, not per sentence.
    """
    if name == "llm":
        found = llm_action_items.extract_action_items_llm(sentences)
        return [{s for s in sentences if s in item["text"]} for item in found]
    action_items.BACKEND = name
    return [{i["text"]} for i in action_items.extract_action_items(sentences)]


def gold_groups(meeting) -> list[tuple[str, ...]]:
    """Consecutive [A] lines form ONE action (e.g. a request + its acceptance)."""
    groups, cur = [], []
    for sentence, is_action in meeting:
        if is_action:
            cur.append(sentence)
        elif cur:
            groups.append(tuple(cur))
            cur = []
    if cur:
        groups.append(tuple(cur))
    return groups


def score(items: list[set[str]], groups: list[tuple[str, ...]]):
    """
    precision = predicted items overlapping a gold action / all predicted items
    recall    = gold actions with at least one covered sentence / all gold actions
    Returns (good_items, bad_items, found_groups, missed_groups).
    """
    gold = {s for g in groups for s in g}
    good = [it for it in items if it & gold]
    bad = [it for it in items if not (it & gold)]
    covered = set().union(*items) if items else set()
    found = [g for g in groups if covered & set(g)]
    missed = [g for g in groups if not (covered & set(g))]
    return good, bad, found, missed


def evaluate(name: str, meetings) -> None:
    n_items = n_good = n_gold = n_found = 0
    misses, false_alarms = [], []
    for meeting in meetings:
        sentences = [s for s, _ in meeting]
        groups = gold_groups(meeting)
        items = run_backend(name, sentences)
        good, bad, found, missed = score(items, groups)
        n_items += len(items)
        n_good += len(good)
        n_gold += len(groups)
        n_found += len(found)
        misses += [" ".join(g) for g in missed]
        false_alarms += [" ".join(sorted(it, key=sentences.index)) for it in bad]

    p = n_good / n_items if n_items else 0.0
    r = n_found / n_gold if n_gold else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    print(f"\n=== {name} ===  precision {p:.2f}  recall {r:.2f}  F1 {f1:.2f}  "
          f"(items {n_items}, correct {n_good}, gold actions found {n_found}/{n_gold})")
    for s in false_alarms:
        print(f"  false alarm: {s}")
    for s in misses:
        print(f"  missed:      {s}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", choices=["rules", "classifier", "llm"])
    ap.add_argument("--file", default=_DEFAULT_FILE)
    args = ap.parse_args()

    meetings = load_meetings(args.file)
    total = sum(len(m) for m in meetings)
    gold_total = sum(len(gold_groups(m)) for m in meetings)
    print(f"Loaded {len(meetings)} meetings, {total} sentences, {gold_total} gold actions.")

    names = [args.backend] if args.backend else ["rules", "classifier", "llm"]
    for n in names:
        if n == "classifier" and not os.path.exists(action_items._MODEL_PATH):
            print("\n=== classifier === skipped (train it first: python -m ml_training.train_classifier)")
            continue
        try:
            evaluate(n, meetings)
        except llm_action_items.LLMUnavailable as exc:
            print(f"\n=== {n} === skipped: {exc}")

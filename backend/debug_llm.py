"""
debug_llm.py
Shows, window by window, what the LLM returned and which items were kept or
dropped (and why). Use it to find out why an expected action item is missing.

Usage (from backend/, venv active, OLLAMA_MODEL set):
    python debug_llm.py            # first meeting in the eval file
    python debug_llm.py 2          # third meeting
"""

import sys

from pipeline import llm_action_items as llm
from ml_training.eval_action_items import load_meetings, _DEFAULT_FILE

idx = int(sys.argv[1]) if len(sys.argv) > 1 else 0
meeting = load_meetings(_DEFAULT_FILE)[idx]
sentences = [s for s, _ in meeting]
print(f"Meeting {idx}: {len(sentences)} sentences, model {llm.OLLAMA_MODEL}")

for lo, hi in llm.build_windows(sentences):
    chars = sum(len(s) for s in sentences[lo:hi])
    print(f"\n=== window: sentences {lo}-{hi - 1} ({chars} chars)")
    for item in llm._call_llm(" ".join(sentences[lo:hi])):
        span = llm._locate_evidence(item["evidence"], sentences, lo, hi)
        if span is None:
            verdict = "DROPPED: evidence not found in transcript"
        elif llm._trim_span(sentences, span) is None:
            verdict = "DROPPED: only question/opinion, no request or commitment"
        else:
            verdict = "KEPT"
        print(f"- [{verdict}] {item['task']} | {item['assignee']} | {item['due_date']}")
        print(f"    evidence: {item['evidence']}")

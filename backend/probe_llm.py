"""
probe_llm.py
Quick recall/precision check on short, fresh mini-meetings that were NOT used
to tune the prompt. Prints what the LLM extracted next to the expected count.

Usage (from backend/, venv active, Ollama running):
    python probe_llm.py
"""

from pipeline import llm_action_items as llm

CASES = [
    (2, ["Thanks everyone for coming.",
         "Sara will send the minutes to the team by tomorrow.",
         "The server migration finished last week.",
         "Imran will prepare the demo environment before Monday."]),
    (1, ["Can someone check the invoices?",
         "I'll take a look this afternoon.",
         "The invoices were late last month."]),
    (2, ["Next, the hiring plan.",
         "We've got four open roles.",
         "Neha needs to post the job ads this week.",
         "Vikas should reach out to the two agencies we used before."]),
    (0, ["Our revenue grew eight percent.",
         "The new office will open in March.",
         "Everyone seems happy with the results.",
         "Let's wrap up."]),
    (2, ["Ravi, please update the budget sheet by Wednesday.",
         "Okay.",
         "Meena, can you also send it to the auditors?",
         "Will do, I'll send it Thursday."]),
    (0, ["Do we know why signups dropped?",
         "I think it's the new pricing.",
         "That's an interesting theory."]),
    (2, ["The client wants a revised quote.",
         "Arjun will send it by Friday.",
         "Also, Divya will schedule the follow-up call.",
         "That's all for today."]),
]

exact = 0
for n, (expected, sentences) in enumerate(CASES, 1):
    found = llm.extract_action_items_llm(sentences)
    ok = len(found) == expected
    exact += ok
    print(f"\nCase {n}: expected {expected}, found {len(found)}  [{'OK' if ok else 'CHECK'}]")
    for it in found:
        print(f"   - {it['task']} | {it['assigned_to']} | {it['due_date']}")
print(f"\n{exact}/{len(CASES)} cases matched the expected count.")

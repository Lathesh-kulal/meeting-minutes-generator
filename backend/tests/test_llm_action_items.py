"""Tests for LLM action-item extraction. Ollama is mocked, so no server needed."""

import json

import pytest

from pipeline import action_items, llm_action_items as llm

SENTENCES = [
    "Let's start with the marketing budget.",
    "The campaign went over by ten percent.",
    "Rahul, can you send the revised numbers by Thursday?",
    "Sure, I'll send them to finance.",
    "Any other comments?",
    "We should also get legal to review the vendor contract.",
]


def _fake_llm(items):
    return lambda window_text: items


@pytest.fixture(autouse=True)
def _ollama_up(monkeypatch):
    monkeypatch.setattr(llm, "check_availability", lambda force=False: (True, ""))


def test_extracts_and_maps_back_to_transcript(monkeypatch):
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([
        {"task": "Send revised numbers to finance", "assignee": "Rahul",
         "due_date": "by Thursday",
         "evidence": "Rahul, can you send the revised numbers by Thursday? Sure, I'll send them to finance."},
        {"task": "Get legal to review the vendor contract", "assignee": None,
         "due_date": None,
         "evidence": "We should also get legal to review the vendor contract."},
    ]))
    out = llm.extract_action_items_llm(SENTENCES)
    assert len(out) == 2
    assert out[0]["assigned_to"] == "Rahul" and out[0]["due_date"] == "by Thursday"
    assert out[0]["text"].startswith("Rahul, can you")
    assert out[0]["method"] == "llm"
    assert out[1]["assigned_to"] is None


def test_hallucinated_evidence_is_dropped(monkeypatch):
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([
        {"task": "Launch rocket", "assignee": "Elon", "due_date": None,
         "evidence": "Elon will launch the rocket on Mars next week."},
    ]))
    assert llm.extract_action_items_llm(SENTENCES) == []


def test_slightly_misquoted_evidence_still_matches(monkeypatch):
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([
        {"task": "Get legal review", "assignee": None, "due_date": None,
         "evidence": "we should also get legal to review vendor contract"},
    ]))
    out = llm.extract_action_items_llm(SENTENCES)
    assert len(out) == 1 and "legal" in out[0]["text"]


def test_overlapping_windows_dedupe(monkeypatch):
    monkeypatch.setattr(llm, "WINDOW_CHARS", 120)
    monkeypatch.setattr(llm, "OVERLAP_SENTENCES", 2)
    item = {"task": "Get legal to review the contract", "assignee": None,
            "due_date": None,
            "evidence": "We should also get legal to review the vendor contract."}
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([item]))
    out = llm.extract_action_items_llm(SENTENCES)
    assert len(out) == 1


def test_windows_cover_everything_and_progress():
    sents = [f"Sentence number {i} is here." for i in range(50)]
    wins = llm.build_windows(sents, max_chars=100, overlap=2)
    assert wins[0][0] == 0 and wins[-1][1] == 50
    assert all(b[0] > a[0] for a, b in zip(wins, wins[1:]))


def test_parse_tolerates_junk_and_blank_values():
    raw = 'Sure! {"action_items":[{"task":"Do X","assignee":"null","due_date":"","evidence":"Do X."},{"task":"","evidence":"y"}]}'
    items = llm._parse_items(raw)
    assert len(items) == 1
    assert items[0]["assignee"] is None and items[0]["due_date"] is None
    assert llm._parse_items("not json at all") == []


def test_falls_back_when_ollama_down(monkeypatch):
    monkeypatch.setattr(llm, "check_availability", lambda force=False: (False, "down"))
    monkeypatch.setattr(action_items, "BACKEND", "auto")
    out = action_items.extract_action_items(["John will send the numbers by Friday."])
    assert out and out[0]["method"] in {"rule_based", "trained"}


def test_forced_llm_backend_raises_when_down(monkeypatch):
    monkeypatch.setattr(llm, "check_availability", lambda force=False: (False, "down"))
    monkeypatch.setattr(action_items, "BACKEND", "llm")
    with pytest.raises(llm.LLMUnavailable):
        action_items.extract_action_items(["John will send the numbers."])


@pytest.mark.parametrize("bad", ["You", "I", "we", "Someone", "everyone", "Unknown", "N/A", "", None, " the speaker "])
def test_pronoun_assignees_become_none(bad):
    raw = json.dumps({"action_items": [{"task": "Email the client", "assignee": bad,
                                        "due_date": None, "evidence": "I'll email them."}]})
    assert llm._parse_items(raw)[0]["assignee"] is None


def test_real_names_are_kept():
    raw = json.dumps({"action_items": [{"task": "Email the client", "assignee": "Priya",
                                        "due_date": "by Friday", "evidence": "x"}]})
    item = llm._parse_items(raw)[0]
    assert item["assignee"] == "Priya" and item["due_date"] == "by Friday"


def test_embedding_classifier_fallback_path(monkeypatch):
    """When the LLM is down, the sentence-embedding classifier (if trained) is used."""
    import numpy as np

    class FakeEmbedder:
        def encode(self, sentences):
            return np.array([[1.0 if "will" in s else 0.0] for s in sentences])

    class FakeClf:
        def predict(self, X):
            return (X[:, 0] > 0).astype(int)

    monkeypatch.setattr(llm, "check_availability", lambda force=False: (False, "down"))
    monkeypatch.setattr(action_items, "BACKEND", "auto")
    monkeypatch.setattr(action_items, "_load_trained_model", lambda: (FakeClf(), FakeEmbedder()))
    out = action_items.extract_action_items(["John will send it.", "Any comments?"])
    assert out == [{"text": "John will send it.", "method": "trained"}]


def test_question_without_request_is_dropped(monkeypatch):
    sents = ["Do the customers say why they dislike it?",
             "I personally feel this is vital information.",
             "Thanks."]
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([
        {"task": "Find out why customers dislike it", "assignee": "Anna", "due_date": None,
         "evidence": "Do the customers say why they dislike it? I personally feel this is vital information."}]))
    assert llm.extract_action_items_llm(sents) == []


@pytest.mark.parametrize("sents,evidence", [
    (["Priya, could you check the numbers?", "Sure."], "Priya, could you check the numbers? Sure."),
    (["Who can take this?", "I'll do it."], "Who can take this? I'll do it."),
    (["Can we get legal to look at it?", "Yes, we need to."], "Can we get legal to look at it? Yes, we need to."),
])
def test_question_with_request_or_commitment_is_kept(monkeypatch, sents, evidence):
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([
        {"task": "Do it", "assignee": None, "due_date": None, "evidence": evidence}]))
    assert len(llm.extract_action_items_llm(sents)) == 1


def test_statement_without_question_mark_unaffected():
    assert llm._is_uncued_question("Send me the report by Friday.") is False
    assert llm._is_uncued_question("Is that fine? Sure it\u2019ll be done.") is False


# ---- trimming of question/opinion chatter around a real item ----

ANNA = [
    "There's also been an increase in customers cancelling new contracts.",
    "Do the customers say why they don't like our offer?",
    "I personally feel that this is vital information.",
    "If I can finish what I was saying, I'd like to suggest we review our account procedures.",
    "Thanks, Anna.",
]


def test_leading_question_and_opinion_are_trimmed_off(monkeypatch):
    monkeypatch.setattr(llm, "_call_llm", _fake_llm([
        {"task": "Review account procedures", "assignee": "Anna", "due_date": None,
         "evidence": " ".join(ANNA[1:4])}]))
    out = llm.extract_action_items_llm(ANNA)
    assert len(out) == 1
    assert out[0]["text"] == ANNA[3]


def test_imperative_after_uncued_question_is_kept():
    sents = ["Do we know why the build failed?", "Check the logs tomorrow."]
    assert llm._trim_span(sents, (0, 1)) == (1, 1)


def test_request_before_trailing_question_is_kept():
    sents = ["Rahul, send me the numbers by Friday.", "Does that work?"]
    assert llm._trim_span(sents, (0, 1)) == (0, 0)


def test_opinion_with_commitment_wording_is_not_chatter():
    assert llm._is_chatter("I think we need to send it today.") is False
    assert llm._is_chatter("I personally feel this is vital information.") is True
    assert llm._is_chatter("Sure.") is False


def test_only_chatter_is_dropped():
    sents = ["Why did sign-ups drop?", "I think it's the pricing."]
    assert llm._trim_span(sents, (0, 1)) is None

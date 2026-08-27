"""
ner_utils.py
Uses spaCy's pretrained NER model to pull out person names and date
mentions from a sentence, used to attach "assigned to" / "due date"
fields to detected action items.
"""

import spacy

_nlp = None


def _get_nlp():
    global _nlp
    if _nlp is None:
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def extract_entities(sentence: str) -> dict:
    """
    Extracts person names and date expressions from a sentence.

    Returns:
        dict with "people": list[str], "dates": list[str]
    """
    nlp = _get_nlp()
    doc = nlp(sentence)

    people = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    dates = [ent.text for ent in doc.ents if ent.label_ == "DATE"]

    return {"people": people, "dates": dates}


def enrich_action_items(action_items: list[dict]) -> list[dict]:
    """
    Adds "assigned_to" and "due_date" fields to each action item by running
    NER over its text.

    Args:
        action_items: list of {"text": str, "method": str}

    Returns:
        same list with added "assigned_to" (str or None) and "due_date" (str or None)
    """
    enriched = []
    for item in action_items:
        entities = extract_entities(item["text"])
        enriched.append({
            **item,
            "assigned_to": entities["people"][0] if entities["people"] else None,
            "due_date": entities["dates"][0] if entities["dates"] else None,
        })
    return enriched


if __name__ == "__main__":
    items = [{"text": "John will send the revised numbers by Friday.", "method": "rule_based"}]
    print(enrich_action_items(items))

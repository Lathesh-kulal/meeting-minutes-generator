"""
ner_utils.py
Uses spaCy's pretrained NER model to pull out person names and date
mentions from a sentence, used to attach "assigned to" / "due date"
fields to detected action items.

Known limitation: spaCy's en_core_web_sm (and en_core_web_md) models show
reduced accuracy detecting PERSON entities for names less represented in
their training data (e.g. many South Asian names), while performing well
on more Western-common names. Confirmed via controlled testing: identical
sentence structures with "John"/"Sarah" were correctly tagged as PERSON,
while "Rahul"/"Ananya"/"Reha" were not.

To mitigate this without retraining the underlying model, two lightweight
fallbacks are layered on top of spaCy's statistical NER:
  1. A gazetteer (curated name list) added via spaCy's EntityRuler, which
     always tags known names as PERSON regardless of the base model's
     prediction.
  2. A structural regex fallback that looks for the pattern
     "<Capitalized Word> will/needs to/is going to ..." at the start of
     a sentence, catching names not present in the gazetteer.
"""

import re
import spacy

_nlp = None

# A curated list of common names (including many underrepresented in
# spaCy's default training data) that should always be tagged as PERSON.
# Extend this list as more gaps are found during testing.
GAZETTEER_NAMES = [
    "Rahul", "Ananya", "Reha", "Priya", "Amit", "Sneha", "Vikram", "Divya",
    "Rohan", "Kavya", "Arjun", "Neha", "Karan", "Pooja", "Aditya", "Isha",
    "Siddharth", "Meera", "Varun", "Anjali", "Nikhil", "Shreya", "Kunal",
    "Riya", "Manish", "Tanvi", "Lathesh", "Deepak", "Swati", "Harsh",
]


def _get_nlp():
    global _nlp
    if _nlp is None:
        nlp = spacy.load("en_core_web_sm")
        # Add an EntityRuler before the statistical NER component so the
        # gazetteer's matches take priority for the names we've listed.
        ruler = nlp.add_pipe("entity_ruler", before="ner")
        patterns = [{"label": "PERSON", "pattern": name} for name in GAZETTEER_NAMES]
        ruler.add_patterns(patterns)
        _nlp = nlp
    return _nlp


# Matches a capitalized word at the start of a sentence, followed by a verb
# phrase commonly used to introduce an assigned task.
_NAME_FALLBACK_PATTERN = re.compile(
    r"^([A-Z][a-zA-Z]+)\s+(?:will|needs to|is going to|has to|should)\b"
)


def _fallback_name_extraction(sentence: str) -> str | None:
    """
    Regex-based fallback: if spaCy (even with the gazetteer) finds no
    PERSON entity, check whether the sentence starts with a capitalized
    word directly followed by a task-assigning verb phrase, and treat
    that word as the likely assignee.
    """
    match = _NAME_FALLBACK_PATTERN.match(sentence.strip())
    return match.group(1) if match else None


def extract_entities(sentence: str) -> dict:
    """
    Extracts person names and date expressions from a sentence.

    Applies spaCy NER (augmented with a name gazetteer) first; if no
    person is found, falls back to a structural regex heuristic.

    Returns:
        dict with "people": list[str], "dates": list[str]
    """
    nlp = _get_nlp()
    doc = nlp(sentence)

    people = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    dates = [ent.text for ent in doc.ents if ent.label_ == "DATE"]

    if not people:
        fallback_name = _fallback_name_extraction(sentence)
        if fallback_name:
            people = [fallback_name]

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
def find_person_names(text: str) -> list[str]:
    """
    Returns all distinct person names detected in text, in order of first
    appearance — via spaCy NER (augmented with the gazetteer) plus the
    structural regex fallback. Used by translate.py to protect names from
    being mangled by translation (OPUS-MT sometimes "translates" proper
    nouns along with the rest of the sentence, e.g. "Reha" becoming
    "Reblant").
    """
    nlp = _get_nlp()
    doc = nlp(text)
    names = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
    if not names:
        fallback_name = _fallback_name_extraction(text)
        if fallback_name:
            names = [fallback_name]

    seen = set()
    unique_names = []
    for n in names:
        if n not in seen:
            seen.add(n)
            unique_names.append(n)
    return unique_names


if __name__ == "__main__":
    items = [
        {"text": "John will send the revised numbers by Friday.", "method": "rule_based"},
        {"text": "Rahul needs to update the roadmap document by next Monday.", "method": "rule_based"},
        {"text": "Ananya will release revised slides by Wednesday.", "method": "rule_based"},
        {"text": "Deepshikha is going to review the contract by Tuesday.", "method": "rule_based"},
    ]
    for result in enrich_action_items(items):
        print(result)

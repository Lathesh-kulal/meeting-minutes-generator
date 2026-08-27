"""
pipeline_runner.py
Orchestrates the full meeting-minutes pipeline:

    audio/text input
        -> transcribe (if audio)
        -> preprocess (clean + sentence split)
        -> segment (topic chapters)
        -> summarize (chapter summaries + overall highlights)
        -> action_items (detect + enrich with names/dates)
        -> assemble final JSON

This is the one function the Flask app (and any offline scripts) should
call to go from raw input to a fully structured result.
"""

from . import transcribe
from . import preprocess
from . import segment
from . import summarize
from . import action_items
from . import ner_utils


def run_pipeline(audio_path: str = None, raw_text: str = None, meeting_title: str = None) -> dict:
    """
    Runs the full pipeline end-to-end.

    Args:
        audio_path: path to an audio file (used if raw_text is not provided)
        raw_text: existing transcript text (skips ASR if provided)
        meeting_title: optional title for the meeting

    Returns:
        dict shaped like:
        {
            "meeting_title": str,
            "transcript": str,
            "chapters": [{"chapter_id", "title", "summary", "text"}, ...],
            "highlights": [str, ...],
            "action_items": [{"text", "assigned_to", "due_date", "method"}, ...],
        }
    """
    if raw_text is None and audio_path is None:
        raise ValueError("Must provide either audio_path or raw_text")

    # Step 1: Transcription (skip if text was already provided)
    if raw_text is None:
        transcription = transcribe.transcribe_audio(audio_path)
        raw_text = transcription["text"]

    # Step 2: Preprocessing
    pre = preprocess.preprocess_transcript(raw_text)
    cleaned_text = pre["cleaned_text"]
    sentences = pre["sentences"]

    # Step 3: Topic segmentation
    chapters_raw = segment.segment_transcript(cleaned_text, sentences)

    # Step 4: Summarization (per-chapter + overall highlights)
    chapters = summarize.summarize_chapters(chapters_raw)
    highlights = summarize.generate_highlights(cleaned_text)

    # Step 5: Action item extraction + enrichment
    raw_action_items = action_items.extract_action_items(sentences)
    enriched_action_items = ner_utils.enrich_action_items(raw_action_items)

    return {
        "meeting_title": meeting_title or "Untitled Meeting",
        "transcript": cleaned_text,
        "chapters": chapters,
        "highlights": highlights,
        "action_items": enriched_action_items,
    }


if __name__ == "__main__":
    # Quick manual test with a text transcript (no audio needed)
    sample_text = (
        "We discussed the Q3 budget first. The marketing team needs more funds "
        "because the current allocation is not enough to cover the new campaign. "
        "John will send the revised numbers by Friday so the finance team can review them. "
        "Next we moved to the product roadmap. "
        "Sarah proposed delaying the launch by two weeks. "
        "Everyone agreed the extra testing time was worth it. "
        "Sarah needs to update the roadmap document by next Monday."
    )
    result = run_pipeline(raw_text=sample_text, meeting_title="Test Meeting")

    import json
    print(json.dumps(result, indent=2))

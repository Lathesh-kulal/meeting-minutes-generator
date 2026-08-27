"""
docx_export.py
Renders the final meeting-minutes JSON into a DOCX using python-docx.
Structure: title, metadata table, Highlights (bullets + action items
table), Chapters (heading + summary per topic).
"""
# TODO: build with python-docx — see the verified sample structure
# (sample_meeting_minutes.docx) for the target layout.

def generate_docx(meeting_data: dict) -> bytes:
    raise NotImplementedError

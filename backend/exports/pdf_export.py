"""
pdf_export.py
Renders the final meeting-minutes JSON into a PDF using WeasyPrint
(HTML -> PDF).
"""
# TODO: build an HTML template (title/metadata, highlights, action items
# table, chapters), render with weasyprint.HTML(string=html).write_pdf()

def generate_pdf(meeting_data: dict) -> bytes:
    raise NotImplementedError

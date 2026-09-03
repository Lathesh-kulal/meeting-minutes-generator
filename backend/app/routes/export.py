"""
export.py
GET /api/meetings/<id>/export?format=pdf|docx&lang=<code>
Generates and returns a downloadable minutes document, optionally
translated into the requested language first.
"""
import io

from flask import Blueprint, request, jsonify, send_file

from ..extensions import db
from ..models import Meeting
from exports import pdf_export, docx_export
from pipeline import translate

export_bp = Blueprint("export", __name__)

_MIME_TYPES = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@export_bp.route("/api/meetings/<int:meeting_id>/export", methods=["GET"])
def export_meeting(meeting_id):
    fmt = request.args.get("format", "pdf").lower()
    lang = request.args.get("lang", "en")

    if fmt not in _MIME_TYPES:
        return jsonify({"error": f"Unsupported format '{fmt}'. Use 'pdf' or 'docx'."}), 400

    meeting = db.session.get(Meeting, meeting_id)
    if meeting is None:
        return jsonify({"error": "Meeting not found."}), 404
    if meeting.status != "done":
        return jsonify({"error": f"Meeting is not ready for export (status: {meeting.status})."}), 409

    meeting_data = meeting.to_dict(include_full_result=True)

    try:
        if lang and lang not in ("en", "original"):
            meeting_data = translate.translate_result(meeting_data, lang)

        if fmt == "pdf":
            file_bytes = pdf_export.generate_pdf(meeting_data)
        else:
            file_bytes = docx_export.generate_docx(meeting_data)
    except NotImplementedError:
        return jsonify({
            "error": f"Export to '{fmt}' (or translation to '{lang}') is not implemented yet."
        }), 501

    filename = f"{(meeting.title or 'meeting_minutes').replace(' ', '_')}.{fmt}"
    return send_file(
        io.BytesIO(file_bytes),
        mimetype=_MIME_TYPES[fmt],
        as_attachment=True,
        download_name=filename,
    )

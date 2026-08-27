"""
export.py
GET /api/meetings/<id>/export?format=pdf|docx&lang=<code>
Generates and returns a downloadable minutes document, optionally translated.
"""
from flask import Blueprint, jsonify

export_bp = Blueprint("export", __name__)


@export_bp.route("/api/meetings/<int:meeting_id>/export", methods=["GET"])
def export_meeting(meeting_id):
    # TODO: fetch meeting data, optionally translate.py, then
    # exports.pdf_export / exports.docx_export, send_file(...)
    return jsonify({"message": "not implemented"}), 501

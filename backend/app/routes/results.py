"""
results.py
GET /api/meetings/<id> — fetch a processed meeting's transcript, chapters,
highlights, and action items.
GET /api/meetings/<id>/status — lightweight status check for polling
while a meeting is still processing.
"""
from flask import Blueprint, jsonify

from ..extensions import db
from ..models import Meeting
from flask_login import login_required, current_user

results_bp = Blueprint("results", __name__)


@results_bp.route("/api/meetings/<int:meeting_id>", methods=["GET"])
@login_required
def get_meeting(meeting_id):
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=current_user.id).first()
    if meeting is None:
        return jsonify({"error": "Meeting not found."}), 404
    return jsonify(meeting.to_dict(include_full_result=True))


@results_bp.route("/api/meetings/<int:meeting_id>/status", methods=["GET"])
@login_required
def get_meeting_status(meeting_id):
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=current_user.id).first()
    if meeting is None:
        return jsonify({"error": "Meeting not found."}), 404
    return jsonify(meeting.to_dict(include_full_result=False))
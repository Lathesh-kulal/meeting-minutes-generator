"""
history.py
GET    /api/meetings               — list all past meetings (most recent first).
DELETE /api/meetings/<id>          — delete one meeting.
PATCH  /api/meetings/<id>          — rename a meeting.
POST   /api/meetings/bulk-delete   — delete several meetings at once.
"""
from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Meeting

history_bp = Blueprint("history", __name__)


@history_bp.route("/api/meetings", methods=["GET"])
@login_required
def list_meetings():
    meetings = Meeting.query.filter_by(user_id=current_user.id).order_by(Meeting.created_at.desc()).all()
    return jsonify([m.to_dict(include_full_result=False) for m in meetings])


@history_bp.route("/api/meetings/<int:meeting_id>", methods=["DELETE"])
@login_required
def delete_meeting(meeting_id):
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=current_user.id).first()
    if meeting is None:
        return jsonify({"error": "Meeting not found."}), 404
    if meeting.status == "processing":
        return jsonify({"error": "This meeting is still processing. Try again once it finishes."}), 409
    db.session.delete(meeting)
    db.session.commit()
    return jsonify({"deleted": meeting_id})


@history_bp.route("/api/meetings/<int:meeting_id>", methods=["PATCH"])
@login_required
def rename_meeting(meeting_id):
    meeting = Meeting.query.filter_by(id=meeting_id, user_id=current_user.id).first()
    if meeting is None:
        return jsonify({"error": "Meeting not found."}), 404
    data = request.get_json(silent=True) or {}
    title = (data.get("meeting_title") or "").strip()
    if not title:
        return jsonify({"error": "Title cannot be empty."}), 400
    meeting.title = title[:200]
    db.session.commit()
    return jsonify(meeting.to_dict(include_full_result=False))


@history_bp.route("/api/meetings/bulk-delete", methods=["POST"])
@login_required
def bulk_delete_meetings():
    data = request.get_json(silent=True) or {}
    ids = data.get("ids")
    if not isinstance(ids, list) or not ids:
        return jsonify({"error": "Provide a non-empty list of meeting ids."}), 400
    ids = [i for i in ids if isinstance(i, int)]

    meetings = Meeting.query.filter(
        Meeting.user_id == current_user.id, Meeting.id.in_(ids)
    ).all()

    deleted, skipped = [], []
    for m in meetings:
        if m.status == "processing":
            skipped.append(m.id)
        else:
            deleted.append(m.id)
            db.session.delete(m)
    db.session.commit()
    return jsonify({"deleted": deleted, "skipped_processing": skipped})
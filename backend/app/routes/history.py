"""
history.py
GET /api/meetings — list all past meetings (most recent first).
"""
from flask import Blueprint, jsonify

from ..models import Meeting
from flask_login import login_required, current_user

history_bp = Blueprint("history", __name__)


@history_bp.route("/api/meetings", methods=["GET"])
@login_required
def list_meetings():
    meetings = Meeting.query.filter_by(user_id=current_user.id).order_by(Meeting.created_at.desc()).all()
    return jsonify([m.to_dict(include_full_result=False) for m in meetings])
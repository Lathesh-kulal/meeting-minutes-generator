"""
history.py
GET /api/meetings — list all past meetings (most recent first).
"""
from flask import Blueprint, jsonify

from ..models import Meeting

history_bp = Blueprint("history", __name__)


@history_bp.route("/api/meetings", methods=["GET"])
def list_meetings():
    meetings = Meeting.query.order_by(Meeting.created_at.desc()).all()
    return jsonify([m.to_dict(include_full_result=False) for m in meetings])

"""
history.py
GET /api/meetings — list all past meetings (requires auth if enabled).
"""
from flask import Blueprint, jsonify

history_bp = Blueprint("history", __name__)


@history_bp.route("/api/meetings", methods=["GET"])
def list_meetings():
    # TODO: query DB, return jsonify(list of meetings)
    return jsonify({"message": "not implemented"}), 501

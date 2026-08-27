"""
results.py
GET /api/meetings/<id> — fetch a processed meeting's transcript, chapters,
highlights, and action items.
"""
from flask import Blueprint, jsonify

results_bp = Blueprint("results", __name__)


@results_bp.route("/api/meetings/<int:meeting_id>", methods=["GET"])
def get_meeting(meeting_id):
    # TODO: fetch from DB, return jsonify(meeting_data)
    return jsonify({"message": "not implemented"}), 501

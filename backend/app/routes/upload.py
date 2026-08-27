"""
upload.py
POST /api/meetings — accepts audio/video/text upload, triggers the pipeline.
"""
from flask import Blueprint, request, jsonify

upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/api/meetings", methods=["POST"])
def create_meeting():
    # TODO: handle file upload, call pipeline.pipeline_runner.run_pipeline(),
    # save result via app.models.Meeting, return meeting id / result
    return jsonify({"message": "not implemented"}), 501

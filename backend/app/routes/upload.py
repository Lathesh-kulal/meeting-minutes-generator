"""
upload.py
POST /api/meetings — accepts audio/video/text upload, triggers the pipeline
as a background job, and returns immediately with a meeting id the client
can poll for status/results.
"""
import os
import uuid

from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename

from ..extensions import db, executor
from ..models import Meeting
from pipeline.pipeline_runner import run_pipeline
from flask_login import login_required, current_user

upload_bp = Blueprint("upload", __name__)


def _process_meeting(app, meeting_id: int, audio_path: str | None, raw_text: str | None, title: str | None):
    """
    Runs in a background thread (via Flask-Executor). Pushes its own app
    context since it doesn't run inside the original request context.
    """
    with app.app_context():
        meeting = db.session.get(Meeting, meeting_id)
        if meeting is None:
            return
        try:
            result = run_pipeline(audio_path=audio_path, raw_text=raw_text, meeting_title=title)
            meeting.set_result(result)
        except Exception as exc:
            meeting.set_error(str(exc))
        finally:
            db.session.commit()
            # Clean up the temporary audio file now that processing is done.
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except OSError:
                    pass

@upload_bp.route("/api/meetings", methods=["POST"])
@login_required
def create_meeting():
    title = request.form.get("title") or request.args.get("title")
    raw_text = request.form.get("text")
    audio_file = request.files.get("audio")

    if not raw_text and not audio_file:
        return jsonify({"error": "Provide either an 'audio' file or 'text' field."}), 400

    audio_path = None
    if audio_file and audio_file.filename:
        filename = secure_filename(audio_file.filename)
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        audio_path = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_name)
        audio_file.save(audio_path)

    meeting = Meeting(title=title or "Untitled Meeting", status="processing", user_id=current_user.id)
    db.session.add(meeting)
    db.session.commit()

    app = current_app._get_current_object()
    executor.submit(_process_meeting, app, meeting.id, audio_path, raw_text, title)

    return jsonify({"id": meeting.id, "status": "processing"}), 202

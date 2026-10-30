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
from ..running_jobs import mark_running, mark_done

upload_bp = Blueprint("upload", __name__)


def _process_meeting(app, meeting_id: int, audio_path: str | None, raw_text: str | None, title: str | None):
    """
    Runs in a background thread (via Flask-Executor). Pushes its own app
    context since it doesn't run inside the original request context.
    """
    with app.app_context():
        try:
            result = run_pipeline(audio_path=audio_path, raw_text=raw_text, meeting_title=title)
            error = None
        except Exception as exc:
            result = None
            error = str(exc)

        try:
            # Load the meeting again: the user may have deleted it while it was processing.
            meeting = db.session.get(Meeting, meeting_id)
            if meeting is not None:
                if error is None:
                    meeting.set_result(result)
                else:
                    meeting.set_error(error)
                db.session.commit()
        except Exception:
            db.session.rollback()
        finally:
            mark_done(meeting_id)
            # Clean up the temporary audio file now that processing is done
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

    source = "pasted_text"
    audio_path = None
    if audio_file and audio_file.filename:
        if audio_file.filename.lower().endswith(".txt"):
            # A downloaded Zoom/Teams transcript, or any plain-text file —
            # read it as the transcript text instead of treating it as audio.
            raw_text = audio_file.read().decode("utf-8", errors="replace")
            source = "text_file"
        else:
            filename = secure_filename(audio_file.filename)
            unique_name = f"{uuid.uuid4().hex}_{filename}"
            audio_path = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_name)
            audio_file.save(audio_path)
            # The Upload page tells us when the audio came from live recording.
            # The Upload page tells us when the audio came from a live recording
            # ("recording" = online meeting, "in_person" = microphone).
            client_source = request.form.get("source")
            source = client_source if client_source in ("recording", "in_person") else "audio_file"

    meeting = Meeting(
        title=title or "Untitled Meeting",
        status="processing",
        user_id=current_user.id,
        source=source,
    )
    db.session.add(meeting)
    db.session.commit()

    app = current_app._get_current_object()
    mark_running(meeting.id)
    executor.submit(_process_meeting, app, meeting.id, audio_path, raw_text, title)

    return jsonify({"id": meeting.id, "status": "processing"}), 202

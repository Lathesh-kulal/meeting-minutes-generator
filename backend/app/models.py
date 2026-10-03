"""
models.py
SQLAlchemy models for meeting history and (optional) users.
"""
import json
from datetime import datetime, timezone

from .extensions import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)

    meetings = db.relationship("Meeting", backref="user", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Meeting(db.Model):
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # "processing" | "done" | "error"
    status = db.Column(db.String(20), default="processing", nullable=False)
    error_message = db.Column(db.Text, nullable=True)

    transcript = db.Column(db.Text, nullable=True)
    highlights_json = db.Column(db.Text, nullable=True)      # JSON-encoded list[str]
    chapters_json = db.Column(db.Text, nullable=True)        # JSON-encoded list[dict]
    action_items_json = db.Column(db.Text, nullable=True)    # JSON-encoded list[dict]
    

    def set_result(self, result: dict) -> None:
        """Populates transcript/highlights/chapters/action_items from a
        pipeline_runner.run_pipeline() result dict and marks status done."""
        self.transcript = result.get("transcript")
        self.highlights_json = json.dumps(result.get("highlights", []))
        self.chapters_json = json.dumps(result.get("chapters", []))
        self.action_items_json = json.dumps(result.get("action_items", []))
        self.status = "done"
        self.error_message = None

    def set_error(self, message: str) -> None:
        self.status = "error"
        self.error_message = message

    def to_dict(self, include_full_result: bool = True) -> dict:
        data = {
            "id": self.id,
            "meeting_title": self.title,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "status": self.status,
        }
        if self.status == "error":
            data["error_message"] = self.error_message
        if include_full_result and self.status == "done":
            data.update({
                "transcript": self.transcript,
                "highlights": json.loads(self.highlights_json) if self.highlights_json else [],
                "chapters": json.loads(self.chapters_json) if self.chapters_json else [],
                "action_items": json.loads(self.action_items_json) if self.action_items_json else [],
            })
        return data




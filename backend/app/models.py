"""
models.py
SQLAlchemy models for meeting history and (optional) users.
"""
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Meeting(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200))
    date = db.Column(db.DateTime)
    transcript = db.Column(db.Text)
    highlights_json = db.Column(db.Text)
    chapters_json = db.Column(db.Text)
    action_items_json = db.Column(db.Text)
    # user_id = db.Column(db.Integer, db.ForeignKey('user.id'))  # if auth enabled


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True)
    password_hash = db.Column(db.String(200))

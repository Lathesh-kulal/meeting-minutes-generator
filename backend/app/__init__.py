"""
App factory — creates and configures the Flask application.
"""
from flask import Flask
from flask_cors import CORS
from .models import db


def create_app():
    app = Flask(__name__)
    app.config.from_pyfile("../instance/config.py", silent=True)
    app.config.setdefault("SQLALCHEMY_DATABASE_URI", "sqlite:///meeting_minutes.db")
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    CORS(app)
    db.init_app(app)

    from .routes.upload import upload_bp
    from .routes.results import results_bp
    from .routes.export import export_bp
    from .routes.history import history_bp

    app.register_blueprint(upload_bp)
    app.register_blueprint(results_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(history_bp)

    with app.app_context():
        db.create_all()

    return app

from sqlalchemy import text

from app import create_app
from app.extensions import db

app = create_app()
with app.app_context():
    cols = [row[1] for row in db.session.execute(text("PRAGMA table_info(meeting)"))]
    if "source" not in cols:
        db.session.execute(text("ALTER TABLE meeting ADD COLUMN source VARCHAR(20)"))
        print("Added column: source")
    if "duration_seconds" not in cols:
        db.session.execute(text("ALTER TABLE meeting ADD COLUMN duration_seconds INTEGER"))
        print("Added column: duration_seconds")
    db.session.commit()
    print("Migration finished.")
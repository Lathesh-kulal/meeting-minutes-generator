"""
extensions.py
Shared Flask extension instances, created here (not in __init__.py or
models.py) to avoid circular imports between app/__init__.py, models.py,
and the route modules.
"""

from flask_sqlalchemy import SQLAlchemy
from flask_executor import Executor

db = SQLAlchemy()
executor = Executor()

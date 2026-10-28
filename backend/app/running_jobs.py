"""Tracks which meetings have a background job running in this server process."""
import threading

_running = set()
_lock = threading.Lock()


def mark_running(meeting_id):
    with _lock:
        _running.add(meeting_id)


def mark_done(meeting_id):
    with _lock:
        _running.discard(meeting_id)


def is_running(meeting_id):
    with _lock:
        return meeting_id in _running
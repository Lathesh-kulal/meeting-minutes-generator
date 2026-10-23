import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listMeetings,
  deleteMeeting,
  renameMeeting,
  bulkDeleteMeetings,
} from '../api/client'
import Modal from '../components/Modal.jsx'

const STATUS_LABEL = { done: 'Ready', processing: 'Processing', error: 'Failed' }

export default function HistoryPage() {
  const [meetings, setMeetings] = useState([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])

  // dialog: null | { type: 'rename' | 'delete', meeting } | { type: 'bulk' }
  const [dialog, setDialog] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    listMeetings()
      .then((res) => setMeetings(res.data))
      .catch(() => setError('Could not load your meeting history.'))
  }, [])

  const visible = meetings.filter((m) =>
    (m.meeting_title || '').toLowerCase().includes(query.trim().toLowerCase())
  )
  const selectableIds = visible.filter((m) => m.status !== 'processing').map((m) => m.id)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))

  const toggleSelected = (id) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )

  const toggleAll = () => setSelected(allSelected ? [] : selectableIds)

  const closeDialog = () => {
    if (busy) return
    setDialog(null)
  }

  const openRename = (m) => {
    setRenameValue(m.meeting_title || '')
    setDialog({ type: 'rename', meeting: m })
  }

  const submitRename = async (e) => {
    e.preventDefault()
    const title = renameValue.trim()
    if (!title) return
    const m = dialog.meeting
    setBusy(true)
    try {
      const res = await renameMeeting(m.id, title)
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? res.data : x)))
    } catch (err) {
      setError(err.response?.data?.error || 'Could not rename the meeting.')
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  const confirmDelete = async () => {
    const m = dialog.meeting
    setBusy(true)
    try {
      await deleteMeeting(m.id)
      setMeetings((prev) => prev.filter((x) => x.id !== m.id))
      setSelected((prev) => prev.filter((x) => x !== m.id))
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete the meeting.')
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  const confirmBulkDelete = async () => {
    setBusy(true)
    try {
      const res = await bulkDeleteMeetings(selected)
      const gone = res.data.deleted
      setMeetings((prev) => prev.filter((x) => !gone.includes(x.id)))
      setSelected([])
      if (res.data.skipped_processing.length > 0) {
        setError('Some meetings were skipped because they are still processing.')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete the selected meetings.')
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Meeting History</h1>
          <p className="subtitle">
            {meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'} saved
          </p>
        </div>
        <Link to="/" className="btn">+ New meeting</Link>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {meetings.length > 0 && (
        <div className="history-toolbar">
          <label className="select-all">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            All
          </label>
          <input
            className="search"
            type="search"
            placeholder="Search by title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {selected.length > 0 && (
            <button className="btn-danger" onClick={() => setDialog({ type: 'bulk' })}>
              Delete selected ({selected.length})
            </button>
          )}
        </div>
      )}

      {meetings.length === 0 && !error && (
        <div className="empty">
          <div className="empty-icon">🗂️</div>
          <p>No meetings yet. Upload a recording or paste a transcript to get started.</p>
          <Link to="/" className="btn">Create your first minutes</Link>
        </div>
      )}
      {meetings.length > 0 && visible.length === 0 && (
        <div className="empty"><p>No meetings match your search.</p></div>
      )}

      <ul className="history-list">
        {visible.map((m) => (
          <li
            key={m.id}
            className={`history-item${selected.includes(m.id) ? ' selected' : ''}`}
          >
            <input
              type="checkbox"
              checked={selected.includes(m.id)}
              onChange={() => toggleSelected(m.id)}
              disabled={m.status === 'processing'}
            />
            <div className="history-main">
              {m.status === 'done' ? (
                <Link to={`/results/${m.id}`} className="history-title">{m.meeting_title}</Link>
              ) : (
                <span className="history-title">{m.meeting_title}</span>
              )}
              <div className="history-meta">
                <span className={`badge badge-${m.status}`}>
                  {STATUS_LABEL[m.status] || m.status}
                </span>
                <span>
                  {new Date(m.created_at).toLocaleString([], {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            </div>
            <div className="history-actions">
              <button className="btn-secondary btn-sm" onClick={() => openRename(m)}>
                Rename
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => setDialog({ type: 'delete', meeting: m })}
                disabled={m.status === 'processing'}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {dialog?.type === 'rename' && (
        <Modal title="Rename meeting" onClose={closeDialog}>
          <form onSubmit={submitRename}>
            <label htmlFor="rename-input">Meeting title</label>
            <input
              id="rename-input"
              type="text"
              autoFocus
              maxLength={200}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={closeDialog}>
                Cancel
              </button>
              <button type="submit" disabled={busy || !renameValue.trim()}>
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog?.type === 'delete' && (
        <Modal title="Delete meeting?" onClose={closeDialog}>
          <p>
            <strong>{dialog.meeting.meeting_title}</strong> and its minutes will be
            permanently deleted. This cannot be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={closeDialog}>
              Cancel
            </button>
            <button type="button" className="btn-stop" onClick={confirmDelete} disabled={busy}>
              {busy ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {dialog?.type === 'bulk' && (
        <Modal title={`Delete ${selected.length} meeting${selected.length === 1 ? '' : 's'}?`} onClose={closeDialog}>
          <p>
            The selected meetings and their minutes will be permanently deleted.
            This cannot be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={closeDialog}>
              Cancel
            </button>
            <button type="button" className="btn-stop" onClick={confirmBulkDelete} disabled={busy}>
              {busy ? 'Deleting...' : 'Delete all'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
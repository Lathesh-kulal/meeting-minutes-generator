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
  const [loaded, setLoaded] = useState(false)
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
      .finally(() => setLoaded(true))
  }, [])

  const visible = meetings.filter((m) =>
    (m.meeting_title || '').toLowerCase().includes(query.trim().toLowerCase())
  )
  const selectableIds = visible.filter((m) => m.status !== 'processing').map((m) => m.id)
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id))

  const toggleSelected = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
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
    <div className="page narrow">
      <header className="page-head split">
        <div>
          <h1>Meeting history</h1>
          {loaded && (
            <p>{meetings.length} {meetings.length === 1 ? 'meeting' : 'meetings'} saved</p>
          )}
        </div>
        <Link className="btn btn-primary" to="/new">New meeting</Link>
      </header>

      {error && <p className="alert" role="alert" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loaded && meetings.length === 0 && !error && (
        <div className="panel empty">
          <p>No meetings yet. Upload a recording to create your first minutes.</p>
          <Link className="btn btn-primary" to="/new">Upload a meeting</Link>
        </div>
      )}

      {meetings.length > 0 && (
        <div className="hbar">
          <label className="check">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
            All
          </label>
          <input
            className="field"
            type="search"
            placeholder="Search by title"
            aria-label="Search meetings by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {selected.length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={() => setDialog({ type: 'bulk' })}>
              Delete selected ({selected.length})
            </button>
          )}
        </div>
      )}

      {meetings.length > 0 && visible.length === 0 && (
        <p className="muted">No meetings match your search.</p>
      )}

      <ul className="history">
        {visible.map((m) => (
          <li className={`hrow${selected.includes(m.id) ? ' sel' : ''}`} key={m.id}>
            <input
              type="checkbox"
              aria-label={`Select ${m.meeting_title}`}
              checked={selected.includes(m.id)}
              onChange={() => toggleSelected(m.id)}
              disabled={m.status === 'processing'}
            />
            <div className="hmain">
              {m.status === 'done' ? (
                <Link to={`/results/${m.id}`}>{m.meeting_title}</Link>
              ) : (
                <span className="title">{m.meeting_title}</span>
              )}
              <span className={`badge ${m.status}`}>{STATUS_LABEL[m.status] || m.status}</span>
              <span className="date">
                {new Date(m.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </div>
            <div className="hact">
              <button className="btn btn-sm" onClick={() => openRename(m)}>Rename</button>
              <button
                className="btn btn-danger btn-sm"
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
          <form onSubmit={submitRename} style={{ display: 'grid', gap: '1rem' }}>
            <label className="lbl">Meeting title
              <input
                className="field"
                type="text"
                autoFocus
                maxLength={200}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeDialog}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy || !renameValue.trim()}>
                {busy ? 'Saving…' : 'Save'}
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
            <button type="button" className="btn" onClick={closeDialog}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" onClick={confirmDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {dialog?.type === 'bulk' && (
        <Modal
          title={`Delete ${selected.length} meeting${selected.length === 1 ? '' : 's'}?`}
          onClose={closeDialog}
        >
          <p>
            The selected meetings and their minutes will be permanently deleted.
            This cannot be undone.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={closeDialog}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" onClick={confirmBulkDelete} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete all'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

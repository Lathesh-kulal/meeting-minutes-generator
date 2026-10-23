import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listMeetings,
  deleteMeeting,
  renameMeeting,
  bulkDeleteMeetings,
} from '../api/client'

const STATUS_LABEL = { done: 'Ready', processing: 'Processing', error: 'Failed' }

export default function HistoryPage() {
  const [meetings, setMeetings] = useState([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])

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

  const handleDelete = async (m) => {
    if (!window.confirm(`Delete "${m.meeting_title}"? This cannot be undone.`)) return
    try {
      await deleteMeeting(m.id)
      setMeetings((prev) => prev.filter((x) => x.id !== m.id))
      setSelected((prev) => prev.filter((x) => x !== m.id))
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete the meeting.')
    }
  }

  const handleRename = async (m) => {
    const title = window.prompt('New title:', m.meeting_title || '')
    if (title === null || !title.trim()) return
    try {
      const res = await renameMeeting(m.id, title.trim())
      setMeetings((prev) => prev.map((x) => (x.id === m.id ? res.data : x)))
    } catch (err) {
      setError(err.response?.data?.error || 'Could not rename the meeting.')
    }
  }

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.length} selected meeting(s)? This cannot be undone.`)) return
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
            <button className="btn-danger" onClick={handleBulkDelete}>
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
              <button className="btn-secondary btn-sm" onClick={() => handleRename(m)}>
                Rename
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => handleDelete(m)}
                disabled={m.status === 'processing'}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
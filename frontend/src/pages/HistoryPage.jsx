import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listMeetings } from '../api/client'

export default function HistoryPage() {
  const [meetings, setMeetings] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    listMeetings()
      .then((res) => setMeetings(res.data))
      .catch(() => setError('Could not load your meeting history.'))
  }, [])

  return (
    <div>
      <h1>Meeting History</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {meetings.length === 0 && !error && <p>No meetings yet.</p>}
      <ul>
        {meetings.map((m) => (
          <li key={m.id}>
            {m.status === 'done' ? (
              <Link to={`/results/${m.id}`}>{m.meeting_title}</Link>
            ) : (
              <span>{m.meeting_title} ({m.status})</span>
            )}
            {' — '}
            {new Date(m.created_at).toLocaleString()}
          </li>
        ))}
      </ul>
    </div>
  )
}
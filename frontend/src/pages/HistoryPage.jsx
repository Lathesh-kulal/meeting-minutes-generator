import React, { useEffect, useState } from 'react'
// import { listMeetings } from '../api/client'

export default function HistoryPage() {
  const [meetings, setMeetings] = useState([])

  useEffect(() => {
    // TODO: listMeetings().then(res => setMeetings(res.data))
  }, [])

  return (
    <div>
      <h1>Meeting History</h1>
      <ul>
        {meetings.map((m) => (
          <li key={m.id}>{m.title}</li>
        ))}
      </ul>
    </div>
  )
}

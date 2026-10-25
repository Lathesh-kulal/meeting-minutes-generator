import React from 'react'
import ActionItemsList from './ActionItemsList.jsx'

export default function HighlightsView({ meeting }) {
  if (!meeting) return <p className="muted">Loading…</p>

  const count = meeting.action_items?.length || 0

  return (
    <div>
      <h2>Key points</h2>
      <ul className="points">
        {meeting.highlights?.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
      <h2>Action items <span className="count">{count}</span></h2>
      <ActionItemsList items={meeting.action_items} />
    </div>
  )
}

import React from 'react'
import ActionItemsList from './ActionItemsList.jsx'

export default function HighlightsView({ meeting }) {
  if (!meeting) return <p>Loading...</p>

  return (
    <div>
      <h2>Key Points</h2>
      <ul>
        {meeting.highlights?.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
      <h2>Action Items</h2>
      <ActionItemsList items={meeting.action_items} />
    </div>
  )
}
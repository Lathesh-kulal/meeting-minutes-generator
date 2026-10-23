import React from 'react'
import ActionItemsList from './ActionItemsList.jsx'

export default function HighlightsView({ meeting }) {
  if (!meeting) {
    return (
      <div className="loading">
        <div className="spinner small" />
        Loading minutes...
      </div>
    )
  }

  const points = meeting.highlights || []
  const items = meeting.action_items || []

  return (
    <div>
      <section className="section">
        <div className="section-head">
          <h2>✨ Key Points</h2>
          {points.length > 0 && <span className="count-pill">{points.length}</span>}
        </div>
        {points.length === 0 ? (
          <div className="empty compact">No key points were generated for this meeting.</div>
        ) : (
          <ul className="keypoint-list">
            {points.map((point, i) => (
              <li key={i} className="keypoint">
                <span className="keypoint-num">{i + 1}</span>
                <p>{point}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>✅ Action Items</h2>
          {items.length > 0 && <span className="count-pill">{items.length}</span>}
        </div>
        <ActionItemsList items={items} />
      </section>
    </div>
  )
}
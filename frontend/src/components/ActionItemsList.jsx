import React from 'react'

export default function ActionItemsList({ items }) {
  if (!items || items.length === 0) {
    return <p className="muted" style={{ marginTop: '1rem' }}>No action items found in this meeting.</p>
  }

  return (
    <ul className="actions">
      {items.map((item, i) => {
        const owner = item.assigned_to
        const showQuote = item.task && item.task !== item.text
        return (
          <li className="action" key={i}>
            <span className={`avatar ${owner ? '' : 'none'}`} aria-hidden="true">
              {owner ? owner.charAt(0).toUpperCase() : '?'}
            </span>
            <div>
              <p className="task"><span className="hl">{item.task || item.text}</span></p>
              <div className="meta">
                <span className="chip owner">{owner || 'No owner'}</span>
                <span className="chip">{item.due_date || 'No due date'}</span>
              </div>
              {showQuote && <p className="quote">“{item.text}”</p>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

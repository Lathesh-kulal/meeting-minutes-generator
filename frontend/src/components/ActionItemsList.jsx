import React from 'react'

export default function ActionItemsList({ items }) {
  if (!items || items.length === 0) return <p>No action items detected.</p>

  return (
    <table>
      <thead>
        <tr>
          <th>Task</th>
          <th>Assigned To</th>
          <th>Due Date</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td>
              {item.task || item.text}
              {item.task && item.task !== item.text && (
                <div style={{ fontSize: '0.8em', opacity: 0.6 }}>“{item.text}”</div>
              )}
            </td>
            <td>{item.assigned_to || '-'}</td>
            <td>{item.due_date || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

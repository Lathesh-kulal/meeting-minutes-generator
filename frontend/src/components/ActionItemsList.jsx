import React from 'react'

export default function ActionItemsList({ items }) {
  if (!items || items.length === 0) {
    return <div className="empty compact">No action items detected.</div>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Task</th>
            <th>Assigned to</th>
            <th>Due date</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td>
                {item.task || item.text}
                {item.task && item.task !== item.text && (
                  <div className="task-quote">“{item.text}”</div>
                )}
              </td>
              <td>
                {item.assigned_to ? (
                  <span className="chip chip-person">
                    <span className="chip-avatar">{item.assigned_to[0]}</span>
                    {item.assigned_to}
                  </span>
                ) : (
                  <span className="chip chip-none">Unassigned</span>
                )}
              </td>
              <td>
                {item.due_date ? (
                  <span className="chip chip-date">📅 {item.due_date}</span>
                ) : (
                  <span className="chip chip-none">No due date</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
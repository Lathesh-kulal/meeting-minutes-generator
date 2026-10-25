import React from 'react'

export default function ChaptersView({ meeting }) {
  if (!meeting) return <p className="muted">Loading…</p>

  return (
    <div>
      {meeting.chapters?.map((chapter) => (
        <details className="chapter" key={chapter.chapter_id}>
          <summary>{chapter.title}</summary>
          <p className="sum">{chapter.summary}</p>
          <blockquote>{chapter.text}</blockquote>
        </details>
      ))}
    </div>
  )
}

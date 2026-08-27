import React from 'react'

export default function ChaptersView({ meeting }) {
  if (!meeting) return <p>Loading...</p>

  return (
    <div>
      {meeting.chapters?.map((chapter) => (
        <details key={chapter.chapter_id}>
          <summary>{chapter.title}</summary>
          <p>{chapter.summary}</p>
          <blockquote>{chapter.text}</blockquote>
        </details>
      ))}
    </div>
  )
}

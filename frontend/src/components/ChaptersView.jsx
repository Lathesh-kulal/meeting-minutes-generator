import React from 'react'

export default function ChaptersView({ meeting }) {
  if (!meeting) {
    return (
      <div className="loading">
        <div className="spinner small" />
        Loading chapters...
      </div>
    )
  }

  const chapters = meeting.chapters || []
  if (chapters.length === 0) {
    return <div className="empty compact">No chapters were generated for this meeting.</div>
  }

  return (
    <div>
      {chapters.map((chapter, i) => (
        <details key={chapter.chapter_id} className="chapter" open={i === 0}>
          <summary>
            <span className="chapter-num">{i + 1}</span>
            <span className="chapter-title">{chapter.title}</span>
            <span className="chapter-chevron">›</span>
          </summary>
          <div className="chapter-body">
            <p className="chapter-summary">{chapter.summary}</p>
            <div className="chapter-label">Transcript</div>
            <blockquote className="transcript">{chapter.text}</blockquote>
          </div>
        </details>
      ))}
    </div>
  )
}
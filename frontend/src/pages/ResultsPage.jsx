import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import HighlightsView from '../components/HighlightsView.jsx'
import ChaptersView from '../components/ChaptersView.jsx'
import ExportButton from '../components/ExportButton.jsx'
import { getMeeting } from '../api/client'

export default function ResultsPage() {
  const { meetingId } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('highlights')

  useEffect(() => {
    getMeeting(meetingId)
      .then((res) => setMeeting(res.data))
      .catch((err) => {
        setError(err.response?.data?.error || 'Could not load this meeting.')
      })
  }, [meetingId])

  if (error) {
    return (
      <div className="page narrow">
        <h1>Meeting minutes</h1>
        <p className="alert" role="alert" style={{ marginTop: '1rem' }}>{error}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <h1>{meeting ? meeting.meeting_title : 'Meeting minutes'}</h1>
      </header>
      <div className="results">
        <section>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={activeTab === 'highlights'} onClick={() => setActiveTab('highlights')}>Highlights</button>
            <button role="tab" aria-selected={activeTab === 'chapters'} onClick={() => setActiveTab('chapters')}>Chapters</button>
          </div>
          {activeTab === 'highlights' ? (
            <HighlightsView meeting={meeting} />
          ) : (
            <ChaptersView meeting={meeting} />
          )}
        </section>
        <aside className="side">
          <ExportButton meetingId={meetingId} />
        </aside>
      </div>
    </div>
  )
}

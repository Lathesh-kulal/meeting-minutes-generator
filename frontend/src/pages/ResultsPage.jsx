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
      <div>
        <h1>Meeting Minutes</h1>
        <p style={{ color: 'red' }}>{error}</p>
      </div>
    )
  }

  return (
    <div>
      <h1>{meeting ? meeting.meeting_title : 'Meeting Minutes'}</h1>
      <div>
        <button onClick={() => setActiveTab('highlights')}>Highlights</button>
        <button onClick={() => setActiveTab('chapters')}>Chapters</button>
      </div>
      {activeTab === 'highlights' ? (
        <HighlightsView meeting={meeting} />
      ) : (
        <ChaptersView meeting={meeting} />
      )}
      <ExportButton meetingId={meetingId} />
    </div>
  )
}
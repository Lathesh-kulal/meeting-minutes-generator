import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import HighlightsView from '../components/HighlightsView.jsx'
import ChaptersView from '../components/ChaptersView.jsx'
import ExportButton from '../components/ExportButton.jsx'
// import { getMeeting } from '../api/client'

export default function ResultsPage() {
  const { meetingId } = useParams()
  const [meeting, setMeeting] = useState(null)
  const [activeTab, setActiveTab] = useState('highlights')

  useEffect(() => {
    // TODO: getMeeting(meetingId).then(res => setMeeting(res.data))
  }, [meetingId])

  return (
    <div>
      <h1>Meeting Minutes</h1>
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

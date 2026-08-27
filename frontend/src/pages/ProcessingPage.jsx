import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
// import { getMeetingStatus } from '../api/client'

export default function ProcessingPage() {
  const { meetingId } = useParams()
  const [status, setStatus] = useState('Transcribing audio...')

  useEffect(() => {
    // TODO: poll getMeetingStatus(meetingId), update status,
    // navigate to /results/:meetingId when done
  }, [meetingId])

  return (
    <div>
      <h1>Processing your meeting...</h1>
      <p>{status}</p>
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getMeetingStatus } from '../api/client'

export default function ProcessingPage() {
  const { meetingId } = useParams()
  const [status, setStatus] = useState('processing')
  const [errorMessage, setErrorMessage] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const res = await getMeetingStatus(meetingId)
        if (cancelled) return

        if (res.data.status === 'done') {
          navigate(`/results/${meetingId}`)
        } else if (res.data.status === 'error') {
          setStatus('error')
          setErrorMessage(res.data.error_message || 'Something went wrong while processing.')
        } else {
          setTimeout(poll, 3000)
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage('Lost connection while checking processing status.')
        }
      }
    }

    poll()

    return () => { cancelled = true }
  }, [meetingId, navigate])

  if (status === 'error') {
    return (
      <div>
        <h1>Processing Failed</h1>
        <p>{errorMessage}</p>
      </div>
    )
  }

  return (
    <div>
      <h1>Processing your meeting...</h1>
      <p>Transcribing, summarizing, and extracting action items. This may take a few minutes.</p>
    </div>
  )
}
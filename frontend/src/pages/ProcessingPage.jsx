import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
      <div className="page narrow">
        <h1>Processing failed</h1>
        <p className="alert" role="alert" style={{ marginTop: '1rem' }}>{errorMessage}</p>
        <div className="row-actions">
          <Link className="btn btn-primary" to="/new">Try again</Link>
          <Link className="btn" to="/history">View history</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page wait" role="status">
      <div className="bar" />
      <h1>Processing your meeting</h1>
      <p>Transcribing, summarizing, and finding action items. Long meetings can take a few minutes, so you can leave this page open.</p>
      <p>
        You can also leave this page. The meeting will appear in your{' '}
        <Link to="/history">history</Link> when it is ready.
      </p>
    </div>
  )
}

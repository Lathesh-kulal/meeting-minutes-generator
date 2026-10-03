import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadMeeting } from '../api/client'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!file) {
      setError('Please choose an audio/video/text file to upload.')
      return
    }

    const formData = new FormData()
    formData.append('audio', file)
    if (title) formData.append('title', title)

    setSubmitting(true)
    try {
      const res = await uploadMeeting(formData)
      navigate(`/processing/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Upload a Meeting</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Meeting title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="file"
          accept="audio/*,video/*,.txt"
          onChange={(e) => setFile(e.target.files[0])}
        />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Uploading...' : 'Generate Minutes'}
        </button>
      </form>
    </div>
  )
}
import React, { useState } from 'react'
// import { uploadMeeting } from '../api/client'

export default function UploadPage() {
  const [file, setFile] = useState(null)
  const [title, setTitle] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    // TODO: build FormData, call uploadMeeting(), navigate to /processing/:id
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
        <button type="submit">Generate Minutes</button>
      </form>
    </div>
  )
}

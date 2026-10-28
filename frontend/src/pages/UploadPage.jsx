import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { uploadMeeting } from '../api/client'
import { useRecording, formatTime } from '../context/RecordingContext.jsx'

export default function UploadPage() {
  // The live recording lives in RecordingContext, so it keeps running if the
  // user opens other pages while recording.
  const rec = useRecording()
  const location = useLocation()

  // The recording bar links here with state { mode: 'record' }: a just-stopped
  // recording's file arrives a moment after this page opens.
  const [mode, setMode] = useState(() =>
    location.state?.mode || (rec.isRecording || rec.recordedFile ? 'record' : 'file')
  ) // 'file' | 'record' | 'text'
  const [file, setFile] = useState(null)
  const [transcriptText, setTranscriptText] = useState('')
  const { recordingTitle: title, setRecordingTitle: setTitle } = rec
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [over, setOver] = useState(false) // drag-and-drop hover state

  const navigate = useNavigate()

  const switchMode = (newMode) => {
    if (newMode === mode) return
    // A running or finished recording is kept (see the bar at the top of the page).
    setFile(null)
    setTranscriptText('')
    setError('')
    setMode(newMode)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const uploadFile = mode === 'record' ? rec.recordedFile : file

    if (mode === 'text') {
      if (!transcriptText.trim()) {
        setError('Please paste a transcript before generating minutes.')
        return
      }
    } else if (!uploadFile) {
      setError(
        mode === 'file'
          ? 'Please choose an audio/video/text file to upload.'
          : 'Please record a meeting before generating minutes.'
      )
      return
    }

    const formData = new FormData()
    if (mode === 'text') {
      formData.append('text', transcriptText)
    } else {
      formData.append('audio', uploadFile)
    }
    if (title) formData.append('title', title)
    if (mode === 'record') formData.append('source', 'recording')

    setSubmitting(true)
    try {
      const res = await uploadMeeting(formData)
      if (mode === 'record') rec.discardRecording() // the recording has been uploaded
      setTitle('') // the recording has been uploaded
      navigate(`/processing/${res.data.id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="page narrow">
      <header className="page-head">
        <h1>New meeting</h1>
        <p>Upload a recording, capture a meeting live, or paste a transcript.</p>
      </header>

      <form className="panel" onSubmit={handleSubmit}>
        <div className="seg" role="group" aria-label="Source">
          <button type="button" aria-pressed={mode === 'file'} onClick={() => switchMode('file')}>
            Upload a file
          </button>
          <button type="button" aria-pressed={mode === 'record'} onClick={() => switchMode('record')}>
            Record live
          </button>
          <button type="button" aria-pressed={mode === 'text'} onClick={() => switchMode('text')}>
            Paste transcript
          </button>
        </div>

        <label className="lbl">Meeting title (optional)
          <input
            className="field"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        {mode === 'file' && (
          <label
            className={`drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true) }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const dropped = e.dataTransfer.files[0]
              if (dropped) setFile(dropped)
            }}
          >
            <input
              type="file"
              accept="audio/*,video/*,.txt"
              onChange={(e) => setFile(e.target.files[0])}
            />
            <strong>{file ? file.name : 'Drop a file here, or click to browse'}</strong>
            <span>{file ? 'Click to choose a different file' : 'Audio, video, or a .txt transcript'}</span>
          </label>
        )}

        {mode === 'record' && (
          <div className={`rec ${rec.isRecording ? 'live' : ''}`}>
            <p className="note">
              Share the meeting's tab (or your whole screen) with audio on. Recording keeps
              going while you switch tabs or open other pages here. To finish, use the Stop
              button on the bar at the top of any page, or "Pop out controls" for a small
              always-on-top window. Keep this browser tab open until the meeting ends.
            </p>
            <div className="timer">
              {formatTime(rec.isRecording ? rec.seconds : rec.recordedSeconds)}
            </div>
            {!rec.isRecording ? (
              <button type="button" className="btn btn-primary" onClick={rec.startRecording}>
                <span className="dot" /> {rec.recordedFile ? 'Record again' : 'Start recording'}
              </button>
            ) : (
              <button type="button" className="btn" onClick={rec.stopRecording}>
                <span className="dot" /> Stop recording
              </button>
            )}
            {rec.recordedFile && !rec.isRecording && (
              <>
                <p className="ok-note">Recording ready ({formatTime(rec.recordedSeconds)})</p>
                <button type="button" className="btn btn-sm" onClick={rec.discardRecording}>
                  Discard recording
                </button>
              </>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={rec.autoGenerate}
                onChange={(e) => rec.setAutoGenerate(e.target.checked)}
              />
              Generate minutes automatically when recording stops
            </label>
            {rec.error && <p className="alert" role="alert">{rec.error}</p>}
          </div>
        )}

        {mode === 'text' && (
          <>
            <label className="lbl">Meeting transcript
              <textarea
                className="field"
                rows={10}
                placeholder="Paste the meeting transcript here…"
                value={transcriptText}
                onChange={(e) => setTranscriptText(e.target.value)}
              />
            </label>
            <p className="chars">{transcriptText.length.toLocaleString()} characters</p>
          </>
        )}

        {error && <p className="alert" role="alert">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary btn-wide"
          disabled={submitting || rec.generating || (mode === 'record' && rec.isRecording)}
        >
          {submitting ? 'Uploading…' : 'Generate minutes'}
        </button>
      </form>
    </div>
  )
}
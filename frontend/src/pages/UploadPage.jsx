import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { uploadMeeting } from '../api/client'
import { useRecording, formatTime, defaultMeetingTitle } from '../context/RecordingContext.jsx'

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
  // What to record: an online meeting (tab audio) or an in-person meeting (microphone).
  const [kind, setKind] = useState(rec.activeKind)
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
    if (title) {
      formData.append('title', title)
    } else if (mode === 'record') {
      formData.append('title', defaultMeetingTitle(rec.startedAt || new Date()))
    }
    if (mode === 'record') formData.append('source', rec.activeKind === 'in_person' ? 'in_person' : 'recording')

    setSubmitting(true)
    try {
      const res = await uploadMeeting(formData)
      if (mode === 'record') rec.discardRecording() // the recording has been uploaded
      setTitle('')
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
          <div className={`rec ${rec.isRecording && !rec.paused ? 'live' : ''}`}>
            <div className="seg" role="group" aria-label="Recording type">
              <button
                type="button"
                aria-pressed={kind === 'online'}
                disabled={rec.isRecording || rec.starting}
                onClick={() => setKind('online')}
              >
                Online meeting
              </button>
              <button
                type="button"
                aria-pressed={kind === 'in_person'}
                disabled={rec.isRecording || rec.starting}
                onClick={() => setKind('in_person')}
              >
                In-person meeting
              </button>
            </div>
            {(rec.isRecording ? rec.activeKind : kind) === 'online' ? (
              <p className="note">
                Share the meeting's tab (or your whole screen) with audio on. Recording keeps
                going while you switch tabs or open other pages here; use the Stop button on the
                bar at the top of any page (or "Pop out controls" for a small always-on-top
                window) to finish. Keep this browser tab open until the meeting ends.
              </p>
            ) : (
              <p className="note">
                Records through your microphone. Put the laptop in the middle of the table, close
                to the people speaking, and keep this tab open. Recording keeps going while you
                open other pages here; use the Stop button on the bar at the top of any page to
                finish. Please make sure everyone in the room agrees to be recorded.
              </p>
            )}
            <div className="timer">
              {formatTime(rec.isRecording ? rec.seconds : rec.recordedSeconds)}
            </div>
            {!rec.isRecording ? (
              <button type="button" className="btn btn-primary" onClick={() => rec.startRecording(kind)}>
                <span className="dot" /> {rec.recordedFile ? 'Record again' : 'Start recording'}
              </button>
            ) : (
              <div className="row-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={rec.paused ? rec.resumeRecording : rec.pauseRecording}
                >
                  {rec.paused ? 'Resume' : 'Pause'}
                </button>
                <button type="button" className="btn" onClick={rec.stopRecording}>
                  <span className="dot" /> Stop recording
                </button>
              </div>
            )}
            {rec.shareEnded && !rec.isRecording && (
              <p className="note">{rec.kindText.ended}</p>
            )}
            {rec.countdown !== null && (
              <>
                <p className="ok-note">Generating minutes in {rec.countdown}s…</p>
                <button type="button" className="btn btn-sm" onClick={rec.undoGenerate}>Undo</button>
              </>
            )}
            {rec.silent && rec.isRecording && (
              <p className="alert" role="alert">{rec.kindText.silence}</p>
            )}
            {rec.recordedFile && !rec.isRecording && rec.countdown === null && (
              <>
                <p className="ok-note">Recording ready ({formatTime(rec.recordedSeconds)})</p>
                {rec.recordedSeconds < 10 && (
                  <p className="note">That is a very short recording, so it was not generated automatically.</p>
                )}
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    if (window.confirm(`Discard this ${formatTime(rec.recordedSeconds)} recording?`)) {
                      rec.discardRecording()
                    }
                  }}
                >
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
              Generate minutes automatically when recording stops (with a 5-second Undo)
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
          disabled={submitting || rec.generating || rec.countdown !== null || (mode === 'record' && rec.isRecording)}
        >
          {submitting ? 'Uploading…' : 'Generate minutes'}
        </button>
      </form>
    </div>
  )
}
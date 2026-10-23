import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadMeeting } from '../api/client'

const MODES = [
  { id: 'file', icon: '📁', label: 'Upload a file' },
  { id: 'record', icon: '🎙️', label: 'Record live' },
  { id: 'text', icon: '📝', label: 'Paste transcript' },
]

export default function UploadPage() {
  const [mode, setMode] = useState('file') // 'file' | 'record' | 'text'
  const [file, setFile] = useState(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [dragging, setDragging] = useState(false)

  const [isRecording, setIsRecording] = useState(false)
  const [recordedInfo, setRecordedInfo] = useState('') // short label once a recording is ready
  const [seconds, setSeconds] = useState(0)

  const mediaRecorderRef = useRef(null)
  const displayStreamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const secondsRef = useRef(0)

  const navigate = useNavigate()

  // Make sure capture is fully released if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      stopCaptureTracks()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  const stopCaptureTracks = () => {
    if (displayStreamRef.current) {
      displayStreamRef.current.getTracks().forEach((t) => t.stop())
      displayStreamRef.current = null
    }
  }

  const startRecording = async () => {
    setError('')
    setRecordedInfo('')

    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError('Live recording is not supported in this browser. Try Chrome on desktop.')
      return
    }

    let displayStream
    try {
      // video: true is required by the browser even though we only want audio —
      // we drop the video track right after and only record the audio track.
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      })
    } catch (err) {
      setError('Screen/tab share was cancelled or denied, so recording could not start.')
      return
    }

    const audioTracks = displayStream.getAudioTracks()
    if (audioTracks.length === 0) {
      displayStream.getTracks().forEach((t) => t.stop())
      setError(
        'No audio was captured. When the share dialog opens, make sure to tick ' +
        '"Share tab audio" (or "Share system audio") before confirming.'
      )
      return
    }

    displayStreamRef.current = displayStream

    // If the user stops sharing from the browser's own UI (not our Stop button),
    // treat that the same as pressing Stop. stopRecording() is safe to call twice.
    displayStream.getVideoTracks()[0].onended = () => {
      stopRecording()
    }

    const audioOnlyStream = new MediaStream(audioTracks)
    const recorder = new MediaRecorder(audioOnlyStream, { mimeType: 'audio/webm' })
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      const recordedFile = new File([blob], `live-recording-${Date.now()}.webm`, {
        type: 'audio/webm',
      })
      setFile(recordedFile)
      setRecordedInfo(`Recording ready (${formatTime(secondsRef.current)})`)
      stopCaptureTracks()
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
    secondsRef.current = 0
    setSeconds(0)
    timerRef.current = setInterval(() => {
      secondsRef.current += 1
      setSeconds(secondsRef.current)
    }, 1000)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
  }

  const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const s = (totalSeconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const switchMode = (newMode) => {
    if (newMode === mode) return
    if (isRecording) stopRecording()
    setFile(null)
    setRecordedInfo('')
    setTranscriptText('')
    setError('')
    setMode(newMode)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (mode === 'text') {
      if (!transcriptText.trim()) {
        setError('Please paste a transcript before generating minutes.')
        return
      }
    } else if (!file) {
      setError(
        mode === 'file'
          ? 'Please choose an audio or video file to upload.'
          : 'Please record a meeting before generating minutes.'
      )
      return
    }

    const formData = new FormData()
    if (mode === 'text') {
      formData.append('text', transcriptText)
    } else {
      formData.append('audio', file)
    }
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
      <div className="page-header">
        <div>
          <h1>New Meeting</h1>
          <p className="subtitle">Turn a recording or transcript into structured minutes.</p>
        </div>
      </div>

      <div className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`mode-tab${mode === m.id ? ' active' : ''}`}
            onClick={() => switchMode(m.id)}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="meeting-title">
            Meeting title <span className="optional">(optional)</span>
          </label>
          <input
            id="meeting-title"
            type="text"
            placeholder="e.g. Q3 sales review"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {mode === 'file' && (
          <label
            className={`dropzone${dragging ? ' dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept="audio/*,video/*,.txt"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files[0])}
            />
            <span className="dropzone-icon">☁️</span>
            <span>Drop a file here, or click to browse</span>
            <p className="dropzone-hint">
              Audio or video recordings, or a .txt transcript (e.g. exported from Zoom or Teams)
            </p>
            {file && <span className="file-chosen">✓ {file.name}</span>}
          </label>
        )}

        {mode === 'record' && (
          <div className="record-panel">
            <p>
              Share the meeting's tab (or your whole screen) with audio enabled, and keep
              this page open for the duration of the meeting.
            </p>
            <div className="record-timer">
              <span className={`rec-dot${isRecording ? ' live' : ''}`} /> {formatTime(seconds)}
            </div>
            {!isRecording ? (
              <button type="button" onClick={startRecording}>
                ● Start recording
              </button>
            ) : (
              <button type="button" className="btn-stop" onClick={stopRecording}>
                ■ Stop recording
              </button>
            )}
            {recordedInfo && <div><span className="file-chosen">✓ {recordedInfo}</span></div>}
          </div>
        )}

        {mode === 'text' && (
          <div>
            <textarea
              rows={10}
              placeholder="Paste the meeting transcript here..."
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
            />
            <p className="char-count">{transcriptText.length.toLocaleString()} characters</p>
          </div>
        )}

        {error && <div className="alert-error" style={{ marginTop: 16 }}>{error}</div>}

        <div className="form-actions">
          <button className="btn-block" type="submit" disabled={submitting || isRecording}>
            {submitting ? 'Uploading...' : 'Generate minutes'}
          </button>
        </div>
      </form>
    </div>
  )
}
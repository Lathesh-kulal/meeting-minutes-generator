import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadMeeting } from '../api/client'

export default function UploadPage() {
  const [mode, setMode] = useState('file') // 'file' | 'record' | 'text'
  const [file, setFile] = useState(null)
  const [transcriptText, setTranscriptText] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [over, setOver] = useState(false) // drag-and-drop hover state

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
          ? 'Please choose an audio/video/text file to upload.'
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
    if (mode === 'record') formData.append('source', 'recording')

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
          <div className={`rec ${isRecording ? 'live' : ''}`}>
            <p className="note">
              Share the meeting's tab (or your whole screen) with audio on, and keep this
              page open until the meeting ends.
            </p>
            <div className="timer">{formatTime(seconds)}</div>
            {!isRecording ? (
              <button type="button" className="btn btn-primary" onClick={startRecording}>
                <span className="dot" /> Start recording
              </button>
            ) : (
              <button type="button" className="btn" onClick={stopRecording}>
                <span className="dot" /> Stop recording
              </button>
            )}
            {recordedInfo && <p className="ok-note">{recordedInfo}</p>}
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
        <button type="submit" className="btn btn-primary btn-wide" disabled={submitting || isRecording}>
          {submitting ? 'Uploading…' : 'Generate minutes'}
        </button>
      </form>
    </div>
  )
}

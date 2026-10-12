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

  const [isRecording, setIsRecording] = useState(false)
  const [recordedInfo, setRecordedInfo] = useState('') // short label once a recording is ready
  const [seconds, setSeconds] = useState(0)

  const mediaRecorderRef = useRef(null)
  const displayStreamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

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
    // treat that the same as pressing Stop.
    displayStream.getVideoTracks()[0].onended = () => {
      if (isRecording) stopRecording()
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
      setRecordedInfo(`Recording ready (${formatTime(seconds)}) — ${recordedFile.name}`)
      stopCaptureTracks()
    }

    mediaRecorderRef.current = recorder
    recorder.start()
    setIsRecording(true)
    setSeconds(0)
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
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
      <h1>Upload a Meeting</h1>

      <div>
        <button type="button" onClick={() => switchMode('file')} disabled={mode === 'file'}>
          Upload a file
        </button>
        <button type="button" onClick={() => switchMode('record')} disabled={mode === 'record'}>
          Record a live meeting
        </button>
        <button type="button" onClick={() => switchMode('text')} disabled={mode === 'text'}>
          Paste a transcript
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Meeting title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {mode === 'file' && (
          <input
            type="file"
            accept="audio/*,video/*,.txt"
            onChange={(e) => setFile(e.target.files[0])}
          />
        )}
        {mode === 'record' && (
          <div>
            <p>
              Share the meeting's tab (or your whole screen) with audio enabled, and keep
              this page open for the duration of the meeting.
            </p>
            {!isRecording ? (
              <button type="button" onClick={startRecording}>
                Start Recording
              </button>
            ) : (
              <button type="button" onClick={stopRecording}>
                Stop Recording ({formatTime(seconds)})
              </button>
            )}
            {recordedInfo && <p>{recordedInfo}</p>}
          </div>
        )}

        {mode === 'text' && (
          <textarea
            rows={10}
            placeholder="Paste the meeting transcript here..."
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            style={{ width: '100%' }}
          />
        )}

        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" disabled={submitting || isRecording}>
          {submitting ? 'Uploading...' : 'Generate Minutes'}
        </button>
      </form>
    </div>
  )
}
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { uploadMeeting } from '../api/client'

const RecordingContext = createContext(null)
export const useRecording = () => useContext(RecordingContext)

export const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const s = (totalSeconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
}

// Document Picture-in-Picture: a small always-on-top window (Chrome / Edge desktop).
const pipSupported = typeof window !== 'undefined' && 'documentPictureInPicture' in window

/**
 * Owns the live recording for the whole app, so it keeps running while the user
 * moves between pages (Upload, History, ...) or even sits on another browser tab.
 * The Upload page, the recording bar and the pop-out window all read from here.
 */
export function RecordingProvider({ children }) {
    const { user } = useAuth()
    const navigate = useNavigate()

    const [isRecording, setIsRecording] = useState(false)
    const [seconds, setSeconds] = useState(0)
    const [recordedFile, setRecordedFile] = useState(null)
    const [recordedSeconds, setRecordedSeconds] = useState(0)
    const [error, setError] = useState('')
    const [recordingTitle, setRecordingTitle] = useState('')
    const [generating, setGenerating] = useState(false)
    const [submittedId, setSubmittedId] = useState(null)
    const [pipWindow, setPipWindow] = useState(null)
    const [starting, setStarting] = useState(false) // waiting for the user to pick what to share
    const [autoGenerate, setAutoGenerateState] = useState(() => {
        try { return localStorage.getItem('autoGenerate') === '1' } catch { return false }
    })

    const recorderRef = useRef(null)
    const streamRef = useRef(null)
    const chunksRef = useRef([])
    const timerRef = useRef(null)
    const secondsRef = useRef(0)
    const autoRef = useRef(autoGenerate)
    const titleRef = useRef('')
    const submitRef = useRef(null)
    const openPipRef = useRef(null)
    titleRef.current = recordingTitle

    const setAutoGenerate = (value) => {
        setAutoGenerateState(value)
        autoRef.current = value
        try { localStorage.setItem('autoGenerate', value ? '1' : '0') } catch { /* ignore */ }
    }

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const releaseStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop())
            streamRef.current = null
        }
    }

    // Upload a finished recording and go to its processing page.
    const submitRecording = useCallback(async (file) => {
        setGenerating(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('audio', file)
            if (titleRef.current) formData.append('title', titleRef.current)
            formData.append('source', 'recording')
            const res = await uploadMeeting(formData)
            setRecordedFile(null)
            setRecordedSeconds(0)
            setSeconds(0)
            setRecordingTitle('')
            setSubmittedId(res.data.id)
            navigate(`/processing/${res.data.id}`)
        } catch (err) {
            setError(
                err.response?.data?.error ||
                'Upload failed. Your recording is kept, so you can try again from the New meeting page.'
            )
        } finally {
            setGenerating(false)
        }
    }, [navigate])
    submitRef.current = submitRecording

    // Generate minutes from the finished recording (used by the bar and the pop-out window).
    const generateRecording = () => {
        if (recordedFile && !generating) submitRecording(recordedFile)
    }

    // Stop and keep the recording (it becomes `recordedFile` once the recorder finishes).
    // Safe to call more than once.
    const stopRecording = useCallback(() => {
        clearTimer()
        const recorder = recorderRef.current
        if (recorder && recorder.state !== 'inactive') recorder.stop()
        setIsRecording(false)
    }, [])

    // Stop and throw the recording away.
    const discardRecording = useCallback(() => {
        clearTimer()
        const recorder = recorderRef.current
        if (recorder) {
            recorder.discarded = true
            if (recorder.state !== 'inactive') recorder.stop()
        }
        recorderRef.current = null
        releaseStream()
        setIsRecording(false)
        setSeconds(0)
        setRecordedFile(null)
        setRecordedSeconds(0)
    }, [])

    const startRecording = useCallback(async () => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') return
        // Open the always-on-top controls straight away: browsers only allow this right
        // after a click, and the share dialog below can take longer than that.
        if (pipSupported && openPipRef.current) openPipRef.current()
        setError('')
        setSubmittedId(null)
        setRecordedFile(null)
        setRecordedSeconds(0)

        if (!navigator.mediaDevices?.getDisplayMedia) {
            setError('Live recording is not supported in this browser. Try Chrome on desktop.')
            return
        }

        setStarting(true)
        let displayStream
        try {
            // video: true is required by the browser even though we only want audio —
            // we drop the video track and only record the audio track.
            displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        } catch (err) {
            setStarting(false)
            setError('Screen/tab share was cancelled or denied, so recording could not start.')
            return
        }

        const audioTracks = displayStream.getAudioTracks()
        if (audioTracks.length === 0) {
            displayStream.getTracks().forEach((t) => t.stop())
            setStarting(false)
            setError(
                'No audio was captured. When the share dialog opens, make sure to tick ' +
                '"Share tab audio" (or "Share system audio") before confirming.'
            )
            return
        }

        streamRef.current = displayStream
        setStarting(false)

        // If the user clicks the browser's own "Stop sharing" button, treat it as Stop.
        displayStream.getVideoTracks()[0].onended = () => stopRecording()

        const recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType: 'audio/webm' })
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = () => {
            releaseStream()
            if (recorder.discarded) return
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
            const file = new File([blob], `live-recording-${Date.now()}.webm`, { type: 'audio/webm' })
            setRecordedFile(file)
            setRecordedSeconds(secondsRef.current)
            // "Generate minutes automatically when recording stops"
            if (autoRef.current) submitRef.current(file)
        }

        recorderRef.current = recorder
        recorder.start()
        secondsRef.current = 0
        setSeconds(0)
        setIsRecording(true)
        timerRef.current = setInterval(() => {
            secondsRef.current += 1
            setSeconds(secondsRef.current)
        }, 1000)
    }, [stopRecording])

    // Open the always-on-top controls window. Must be called from a click.
    const openPip = useCallback(async () => {
        if (!pipSupported || pipWindow) return
        try {
            const win = await window.documentPictureInPicture.requestWindow({ width: 360, height: 240 })
            // Copy the app's styles so the small window looks the same.
            Array.from(document.styleSheets).forEach((sheet) => {
                try {
                    const style = win.document.createElement('style')
                    style.textContent = Array.from(sheet.cssRules).map((r) => r.cssText).join('\n')
                    win.document.head.appendChild(style)
                } catch {
                    if (sheet.href) {
                        const link = win.document.createElement('link')
                        link.rel = 'stylesheet'
                        link.href = sheet.href
                        win.document.head.appendChild(link)
                    }
                }
            })
            win.addEventListener('pagehide', () => setPipWindow(null))
            setPipWindow(win)
        } catch (err) {
            setError('Could not open the pop-out window in this browser.')
        }
    }, [pipWindow])

    openPipRef.current = openPip

    const closePip = useCallback(() => {
        if (pipWindow) pipWindow.close()
        setPipWindow(null)
    }, [pipWindow])

    // Logging out (or the session ending) discards any recording.
    useEffect(() => {
        if (!user) discardRecording()
    }, [user, discardRecording])

    // Warn before the tab is closed/reloaded: that would lose a recording.
    useEffect(() => {
        if (!isRecording && !recordedFile) return undefined
        const warn = (e) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [isRecording, recordedFile])

    // Release the screen share if the whole app goes away.
    useEffect(() => () => {
        clearTimer()
        releaseStream()
    }, [])

    const value = {
        isRecording,
        seconds,
        recordedFile,
        recordedSeconds,
        error,
        recordingTitle,
        setRecordingTitle,
        generating,
        starting,
        submittedId,
        autoGenerate,
        setAutoGenerate,
        pipSupported,
        pipWindow,
        openPip,
        closePip,
        startRecording,
        stopRecording,
        discardRecording,
        generateRecording,
    }
    return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>
}
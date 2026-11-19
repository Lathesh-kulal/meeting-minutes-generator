import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'
import { uploadMeeting, getMeetingStatus } from '../api/client'

const RecordingContext = createContext(null)
export const useRecording = () => useContext(RecordingContext)

export const formatTime = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const s = (totalSeconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
}

// Name used when the user didn't type a title, e.g. "Meeting - 29 Oct, 10:04 am".
export const defaultMeetingTitle = (date = new Date()) =>
    `Meeting - ${date.toLocaleString([], { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`

const SILENCE_SECONDS = 20   // warn if no audio is heard for this long
const COUNTDOWN_SECONDS = 5  // "Generating in 5s - Undo" after stopping
const MIN_AUTO_SECONDS = 10  // shorter recordings are not generated automatically

// Microphone settings for in-person meetings (browser audio processing). Easy to
// experiment with: for a quiet room, turning noiseSuppression off can help distant voices.
const MIC_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true }

const micErrorMessage = (err) => {
    if (err && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        return 'Microphone access was blocked. Allow it from the lock icon in the address bar, then try again.'
    }
    if (err && err.name === 'NotFoundError') {
        return 'No microphone was found. Plug one in or check your system sound settings.'
    }
    return 'Could not start the microphone.'
}

// Wording that depends on what is being recorded: an online meeting (tab/screen audio)
// or an in-person meeting (microphone).
const KIND_TEXT = {
    online: {
        starting: 'Choose what to share…',
        startingHint: 'Pick your meeting tab and tick “Share tab audio”.',
        silence: 'No audio heard for 20 s. Tick “Share tab audio” and check the meeting isn’t muted.',
        silenceShort: 'No audio heard. Tick “Share tab audio”',
        ended: 'The shared tab was closed or sharing was stopped, so the recording ended.',
        endedShort: 'The shared tab was closed, so recording ended.',
    },
    in_person: {
        starting: 'Allow microphone access…',
        startingHint: 'Choose “Allow” when your browser asks to use the microphone.',
        silence: 'No sound heard for 20 s. Check your microphone, and that people are close enough to it.',
        silenceShort: 'No sound heard. Check your microphone',
        ended: 'The microphone stopped (it may have been unplugged), so the recording ended.',
        endedShort: 'The microphone stopped, so recording ended.',
    },
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
    const [startedAt, setStartedAt] = useState(null)
    const [generating, setGenerating] = useState(false)
    const [countdown, setCountdown] = useState(null) // seconds left before auto-generate, or null
    const [silent, setSilent] = useState(false)      // no audio heard for a while
    const [paused, setPaused] = useState(false)
    const [activeKind, setActiveKind] = useState('online') // 'online' (tab audio) | 'in_person' (microphone)
    const [shareEnded, setShareEnded] = useState(false) // the shared tab was closed / sharing stopped
    const [submittedId, setSubmittedId] = useState(null)
    const [jobStatus, setJobStatus] = useState(null) // processing | done | error, for submittedId
    const [pipWindow, setPipWindow] = useState(null)
    const [starting, setStarting] = useState(false) // waiting for the user to pick what to share
    const [autoGenerate, setAutoGenerateState] = useState(() => {
        try {
            const saved = localStorage.getItem('autoGenerate')
            return saved === null ? true : saved === '1'
        } catch { return true }
    })

    const recorderRef = useRef(null)
    const streamRef = useRef(null)
    const chunksRef = useRef([])
    const timerRef = useRef(null)
    const secondsRef = useRef(0)
    const autoRef = useRef(autoGenerate)
    const titleRef = useRef('')
    const startedRef = useRef(null)
    const submitRef = useRef(null)
    const openPipRef = useRef(null)
    const silenceRef = useRef(null)
    const countdownRef = useRef(null)
    const pausedRef = useRef(false)
    const activeKindRef = useRef('online')
    const wakeRef = useRef(null)
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

    const tick = () => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
    }

    const releaseStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop())
            streamRef.current = null
        }
    }

    // Keep the screen awake while recording, so the laptop does not sleep mid-meeting.
    const acquireWakeLock = async () => {
        try {
            if ('wakeLock' in navigator && !wakeRef.current) {
                wakeRef.current = await navigator.wakeLock.request('screen')
            }
        } catch {
            /* unsupported or refused: recording still works */
        }
    }

    const releaseWakeLock = () => {
        const lock = wakeRef.current
        wakeRef.current = null
        if (lock) lock.release().catch(() => { })
    }

    // Watch the audio level; if nothing is heard for a while, tell the user.
    const stopSilenceWatch = () => {
        if (silenceRef.current) {
            clearInterval(silenceRef.current.id)
            silenceRef.current.ctx.close().catch(() => { })
            silenceRef.current = null
        }
        setSilent(false)
    }

    const startSilenceWatch = (stream) => {
        stopSilenceWatch()
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext
            const ctx = new AudioCtx()
            ctx.resume().catch(() => { })
            const analyser = ctx.createAnalyser()
            analyser.fftSize = 1024
            ctx.createMediaStreamSource(stream).connect(analyser)
            const data = new Uint8Array(analyser.fftSize)
            let lastSound = Date.now()
            const id = setInterval(() => {
                if (pausedRef.current) {
                    lastSound = Date.now()
                    return
                }
                analyser.getByteTimeDomainData(data)
                let peak = 0
                for (let i = 0; i < data.length; i += 1) peak = Math.max(peak, Math.abs(data[i] - 128))
                if (peak > 2) lastSound = Date.now()
                setSilent(Date.now() - lastSound > SILENCE_SECONDS * 1000)
            }, 500)
            silenceRef.current = { ctx, id }
        } catch {
            /* detection is best-effort; recording works without it */
        }
    }

    // "Generating in 5s - Undo": cancelling keeps the recording so it can be reviewed.
    const clearCountdown = () => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
        }
        setCountdown(null)
    }

    const startCountdown = (file) => {
        clearCountdown()
        let left = COUNTDOWN_SECONDS
        setCountdown(left)
        countdownRef.current = setInterval(() => {
            left -= 1
            if (left <= 0) {
                clearCountdown()
                submitRef.current(file)
            } else {
                setCountdown(left)
            }
        }, 1000)
    }

    // Upload a finished recording and go to its processing page.
    const submitRecording = useCallback(async (file) => {
        clearCountdown()
        setGenerating(true)
        setError('')
        try {
            const formData = new FormData()
            formData.append('audio', file)
            formData.append('title', titleRef.current.trim() || defaultMeetingTitle(startedRef.current || new Date()))
            formData.append('source', activeKindRef.current === 'in_person' ? 'in_person' : 'recording')
            const res = await uploadMeeting(formData)
            setRecordedFile(null)
            setRecordedSeconds(0)
            setSeconds(0)
            setRecordingTitle('')
            setStartedAt(null)
            setShareEnded(false)
            setJobStatus('processing')
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
        stopSilenceWatch()
        releaseWakeLock()
        pausedRef.current = false
        setPaused(false)
        const recorder = recorderRef.current
        if (recorder && recorder.state !== 'inactive') recorder.stop()
        setIsRecording(false)
    }, [])

    // Pause / resume (for breaks). The timer and the recording both stand still.
    const pauseRecording = useCallback(() => {
        const recorder = recorderRef.current
        if (!recorder || recorder.state !== 'recording') return
        recorder.pause()
        clearTimer()
        pausedRef.current = true
        setPaused(true)
    }, [])

    const resumeRecording = useCallback(() => {
        const recorder = recorderRef.current
        if (!recorder || recorder.state !== 'paused') return
        recorder.resume()
        pausedRef.current = false
        setPaused(false)
        timerRef.current = setInterval(tick, 1000)
    }, [])

    // Stop and throw the recording away.
    const discardRecording = useCallback(() => {
        clearTimer()
        clearCountdown()
        stopSilenceWatch()
        releaseWakeLock()
        pausedRef.current = false
        setPaused(false)
        setShareEnded(false)
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
        setStartedAt(null)
    }, [])

    const startRecording = useCallback(async (kind = 'online') => {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') return
        // Online meetings: open the always-on-top controls straight away (browsers only allow
        // this right after a click, and the share dialog below can take longer than that).
        // In-person meetings: the user is at the laptop, so the pop-out is optional.
        if (kind === 'online' && pipSupported && openPipRef.current) openPipRef.current()
        clearCountdown()
        setShareEnded(false)
        setError('')
        setSubmittedId(null)
        setJobStatus(null)
        setRecordedFile(null)
        setRecordedSeconds(0)
        activeKindRef.current = kind
        setActiveKind(kind)

        const inPerson = kind === 'in_person'
        const supported = inPerson
            ? !!navigator.mediaDevices?.getUserMedia
            : !!navigator.mediaDevices?.getDisplayMedia
        if (!supported) {
            setError(
                inPerson
                    ? 'This browser cannot use the microphone here. Use a recent Chrome or Edge on localhost or https.'
                    : 'Live recording is not supported in this browser. Try Chrome on desktop.'
            )
            return
        }

        setStarting(true)
        let captureStream
        try {
            captureStream = inPerson
                ? await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS })
                // video: true is required by the browser even though we only want audio —
                // we drop the video track and only record the audio track.
                : await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
        } catch (err) {
            setStarting(false)
            setError(
                inPerson ? micErrorMessage(err) : 'Screen/tab share was cancelled or denied, so recording could not start.'
            )
            return
        }

        const audioTracks = captureStream.getAudioTracks()
        if (audioTracks.length === 0) {
            captureStream.getTracks().forEach((t) => t.stop())
            setStarting(false)
            setError(
                inPerson
                    ? 'No microphone audio was available.'
                    : 'No audio was captured. When the share dialog opens, make sure to tick ' +
                    '"Share tab audio" (or "Share system audio") before confirming.'
            )
            return
        }

        streamRef.current = captureStream
        setStarting(false)

        // If the browser/tab ends the share, or the microphone is unplugged, treat it as Stop.
        // ('ended' only fires then, not when we stop the tracks ourselves.)
        const endedTrack = inPerson ? audioTracks[0] : captureStream.getVideoTracks()[0]
        endedTrack.onended = () => {
            setShareEnded(true)
            stopRecording()
        }

        const audioStream = new MediaStream(audioTracks)
        const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' })
        chunksRef.current = []

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        recorder.onstop = () => {
            releaseStream()
            stopSilenceWatch()
            if (recorder.discarded) return
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
            const file = new File([blob], `live-recording-${Date.now()}.webm`, { type: 'audio/webm' })
            const length = secondsRef.current
            setRecordedFile(file)
            setRecordedSeconds(length)
            // Generate automatically (with a short Undo), unless it is suspiciously short.
            if (autoRef.current && length >= MIN_AUTO_SECONDS) startCountdown(file)
        }

        recorderRef.current = recorder
        recorder.start()
        startedRef.current = new Date()
        setStartedAt(startedRef.current)
        secondsRef.current = 0
        setSeconds(0)
        setIsRecording(true)
        startSilenceWatch(audioStream)
        acquireWakeLock()
        timerRef.current = setInterval(tick, 1000)
    }, [stopRecording])

    // Open the always-on-top controls window. Must be called from a click.
    const openPip = useCallback(async () => {
        if (!pipSupported || pipWindow) return
        try {
            const win = await window.documentPictureInPicture.requestWindow({ width: 460, height: 150 })
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

    // "Open minutes" button in the pop-out window: bring the user to the finished meeting.
    const openMinutes = () => {
        try { window.focus() } catch { /* the browser may refuse; the page still changes */ }
        if (submittedId) navigate(`/results/${submittedId}`)
        closePip()
    }

    // After uploading, follow the meeting's status so the pop-out can say when it is ready.
    useEffect(() => {
        if (!submittedId) return undefined
        let cancelled = false
        let timer = null
        const poll = async () => {
            try {
                const res = await getMeetingStatus(submittedId)
                if (cancelled) return
                if (res.data.status === 'done' || res.data.status === 'error') {
                    setJobStatus(res.data.status)
                    return
                }
            } catch {
                /* keep trying */
            }
            timer = setTimeout(poll, 3000)
        }
        poll()
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [submittedId])

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

    // The browser drops the screen-awake lock when the tab is hidden; take it again on return.
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return
            const recorder = recorderRef.current
            if (recorder && recorder.state !== 'inactive') {
                wakeRef.current = null
                acquireWakeLock()
            }
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [])

    // Release the screen share if the whole app goes away.
    useEffect(() => () => {
        clearTimer()
        clearCountdown()
        stopSilenceWatch()
        releaseWakeLock()
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
        startedAt,
        generating,
        countdown,
        undoGenerate: clearCountdown,
        silent,
        paused,
        shareEnded,
        activeKind,
        kindText: KIND_TEXT[activeKind],
        pauseRecording,
        resumeRecording,
        starting,
        submittedId,
        jobStatus,
        autoGenerate,
        setAutoGenerate,
        pipSupported,
        pipWindow,
        openPip,
        closePip,
        openMinutes,
        startRecording,
        stopRecording,
        discardRecording,
        generateRecording,
    }
    return <RecordingContext.Provider value={value}>{children}</RecordingContext.Provider>
}
import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRecording, formatTime } from '../context/RecordingContext.jsx'
import RecordingPip from './RecordingPip.jsx'

/**
 * Slim bar shown on every page while a live recording is running, or while a
 * finished recording is waiting to be turned into minutes. It also owns the
 * always-on-top pop-out window (see RecordingContext.openPip).
 */
export default function RecordingBar() {
    const rec = useRecording()
    const { pathname } = useLocation()
    const navigate = useNavigate()

    // Close the pop-out window a few seconds after there is nothing left to show.
    const idle = !rec.isRecording && !rec.recordedFile && !rec.generating
    useEffect(() => {
        if (!rec.pipWindow || !idle) return undefined
        const t = setTimeout(rec.closePip, 3500)
        return () => clearTimeout(t)
    }, [rec.pipWindow, idle, rec.closePip])

    const popOut = rec.pipSupported && !rec.pipWindow && (
        <button type="button" className="btn btn-sm" onClick={rec.openPip}>Pop out controls</button>
    )

    let bar = null
    if (rec.isRecording) {
        bar = (
            <div className="recbar live" role="status">
                <span className="dot" />
                <strong>Recording</strong>
                <span className="recbar-time">{formatTime(rec.seconds)}</span>
                <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                        rec.stopRecording()
                        if (!rec.autoGenerate) navigate('/new', { state: { mode: 'record' } })
                    }}
                >
                    Stop
                </button>
                {popOut}
            </div>
        )
    } else if (rec.generating) {
        bar = (
            <div className="recbar ready" role="status">
                <strong>Generating minutes…</strong>
            </div>
        )
    } else if (rec.recordedFile && pathname !== '/new') {
        // A finished recording that hasn't been submitted yet (on the Upload page it is shown there).
        bar = (
            <div className="recbar ready" role="status">
                <strong>Recording ready</strong>
                <span className="recbar-time">{formatTime(rec.recordedSeconds)}</span>
                <button type="button" className="btn btn-sm" onClick={rec.generateRecording}>Generate minutes</button>
                <Link className="btn btn-sm" to="/new" state={{ mode: 'record' }}>Review</Link>
                <button type="button" className="btn btn-sm" onClick={rec.discardRecording}>Discard</button>
                {popOut}
                {rec.error && <span>{rec.error}</span>}
            </div>
        )
    }

    return (
        <>
            {bar}
            {rec.pipWindow && createPortal(<RecordingPip />, rec.pipWindow.document.body)}
        </>
    )
}
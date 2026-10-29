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

    // Close the pop-out window once there is nothing left to show: quickly after a
    // cancelled start, and after a while once the finished minutes have been announced.
    const busy =
        rec.isRecording || !!rec.recordedFile || rec.generating || rec.starting ||
        rec.countdown !== null || (!!rec.submittedId && rec.jobStatus === 'processing')
    useEffect(() => {
        if (!rec.pipWindow || busy) return undefined
        const announced = !!rec.submittedId && (rec.jobStatus === 'done' || rec.jobStatus === 'error')
        const t = setTimeout(rec.closePip, announced ? 30000 : 3500)
        return () => clearTimeout(t)
    }, [rec.pipWindow, busy, rec.jobStatus, rec.submittedId, rec.closePip])

    const popOut = rec.pipSupported && !rec.pipWindow && (
        <button type="button" className="btn btn-sm" onClick={rec.openPip}>Pop out controls</button>
    )

    const discard = () => {
        if (window.confirm(`Discard this ${formatTime(rec.recordedSeconds)} recording?`)) rec.discardRecording()
    }

    let bar = null
    if (rec.isRecording) {
        bar = (
            <div className={`recbar${rec.paused ? '' : ' live'}`} role="status">
                <span className="dot" />
                <strong>{rec.paused ? 'Paused' : 'Recording'}</strong>
                <span className="recbar-time">{formatTime(rec.seconds)}</span>
                {rec.silent && <span className="recbar-warn">No audio heard. Tick “Share tab audio”</span>}
                <button
                    type="button"
                    className="btn btn-sm"
                    onClick={rec.paused ? rec.resumeRecording : rec.pauseRecording}
                >
                    {rec.paused ? 'Resume' : 'Pause'}
                </button>
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
    } else if (rec.countdown !== null) {
        bar = (
            <div className="recbar ready" role="status">
                <strong>Generating minutes in {rec.countdown}s…</strong>
                <button type="button" className="btn btn-sm" onClick={rec.undoGenerate}>Undo</button>
                {rec.shareEnded && <span>The shared tab was closed, so recording ended.</span>}
            </div>
        )
    } else if (rec.generating) {
        bar = (
            <div className="recbar ready" role="status">
                <strong>Uploading your recording…</strong>
            </div>
        )
    } else if (rec.recordedFile && pathname !== '/new') {
        // A finished recording that hasn't been submitted yet (on the Upload page it is shown there).
        bar = (
            <div className="recbar ready" role="status">
                <strong>Recording ready</strong>
                {rec.shareEnded && <span>The shared tab was closed, so recording ended.</span>}
                <span className="recbar-time">{formatTime(rec.recordedSeconds)}</span>
                <button type="button" className="btn btn-sm" onClick={rec.generateRecording}>Generate minutes</button>
                <Link className="btn btn-sm" to="/new" state={{ mode: 'record' }}>Review</Link>
                <button type="button" className="btn btn-sm" onClick={discard}>Discard</button>
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
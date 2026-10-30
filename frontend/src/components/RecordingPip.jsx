import React, { useState } from 'react'
import { useRecording, formatTime } from '../context/RecordingContext.jsx'

/** Content of the small, wide always-on-top window that sits over the meeting tab. */
export default function RecordingPip() {
    const rec = useRecording()
    const [confirmDiscard, setConfirmDiscard] = useState(false)

    const titleInput = (
        <input
            className="field"
            type="text"
            placeholder="Meeting title (optional)"
            aria-label="Meeting title"
            maxLength={200}
            value={rec.recordingTitle}
            onChange={(e) => rec.setRecordingTitle(e.target.value)}
        />
    )

    const endedNote = rec.shareEnded && <p className="muted">{rec.kindText.ended}</p>

    let body
    if (rec.starting) {
        body = (
            <p>
                <strong>{rec.kindText.starting}</strong>{' '}
                <span className="muted">{rec.kindText.startingHint}</span>
            </p>
        )
    } else if (rec.isRecording) {
        body = (
            <>
                <div className="pip-row">
                    <div className={`pip-status${rec.paused ? '' : ' live'}`}>
                        <span className={`dot${rec.paused ? ' paused' : ''}`} />
                        <strong>{rec.paused ? 'Paused' : 'Recording'}</strong>
                        <span className="pip-timer">{formatTime(rec.seconds)}</span>
                    </div>
                    <div className="pip-btns">
                        <button
                            type="button"
                            className="btn btn-sm"
                            onClick={rec.paused ? rec.resumeRecording : rec.pauseRecording}
                        >
                            {rec.paused ? 'Resume' : 'Pause'}
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={rec.stopRecording}>
                            Stop
                        </button>
                    </div>
                </div>
                {titleInput}
                {rec.silent && (
                    <p className="alert" role="alert">
                        {rec.kindText.silence}
                    </p>
                )}
            </>
        )
    } else if (rec.countdown !== null) {
        body = (
            <>
                <div className="pip-row">
                    <strong>Generating minutes in {rec.countdown}s…</strong>
                    <button type="button" className="btn btn-sm" onClick={rec.undoGenerate}>Undo</button>
                </div>
                {endedNote}
            </>
        )
    } else if (rec.generating) {
        body = <p><strong>Uploading your recording…</strong></p>
    } else if (rec.recordedFile) {
        body = (
            <>
                <div className="pip-row">
                    <span><strong>Recording ready</strong> ({formatTime(rec.recordedSeconds)})</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={rec.generateRecording}>
                        Generate minutes
                    </button>
                </div>
                {endedNote}
                {rec.recordedSeconds < 10 && (
                    <p className="muted">That is a very short recording. Generate anyway?</p>
                )}
                {titleInput}
                {rec.error && <p className="alert" role="alert">{rec.error}</p>}
                {confirmDiscard ? (
                    <div className="pip-row">
                        <span>Discard {formatTime(rec.recordedSeconds)}?</span>
                        <div className="pip-btns">
                            <button
                                type="button"
                                className="btn btn-danger-solid btn-sm"
                                onClick={() => {
                                    rec.discardRecording()
                                    rec.closePip() // close right away instead of leaving an empty window
                                }}
                            >
                                Yes, discard
                            </button>
                            <button type="button" className="btn btn-sm" onClick={() => setConfirmDiscard(false)}>Keep</button>
                        </div>
                    </div>
                ) : (
                    <button type="button" className="linkbtn danger" onClick={() => setConfirmDiscard(true)}>
                        Discard recording
                    </button>
                )}
            </>
        )
    } else if (rec.submittedId && rec.jobStatus === 'done') {
        body = (
            <div className="pip-row">
                <strong>Your minutes are ready.</strong>
                <button type="button" className="btn btn-primary btn-sm" onClick={rec.openMinutes}>Open minutes</button>
            </div>
        )
    } else if (rec.submittedId && rec.jobStatus === 'error') {
        body = <p className="alert" role="alert">Processing failed. Open Meeting Minutes and check History for details.</p>
    } else if (rec.submittedId) {
        body = (
            <p>
                <strong>Processing your minutes…</strong>{' '}
                <span className="muted">This takes a few minutes. You can close this window.</span>
            </p>
        )
    } else if (rec.error) {
        body = <p className="alert" role="alert">{rec.error}</p>
    } else {
        body = <p className="muted">Nothing is being recorded.</p>
    }

    return <div className="pip">{body}</div>
}
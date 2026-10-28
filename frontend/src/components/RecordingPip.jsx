import React from 'react'
import { useRecording, formatTime } from '../context/RecordingContext.jsx'

/** Content of the small always-on-top window that sits over the meeting tab. */
export default function RecordingPip() {
    const rec = useRecording()

    let body = null
    if (rec.isRecording) {
        body = (
            <>
                <div className="pip-line">
                    <span className="dot" />
                    <strong>Recording</strong>
                    <span className="recbar-time">{formatTime(rec.seconds)}</span>
                </div>
                <button type="button" className="btn btn-primary" onClick={rec.stopRecording}>
                    Stop recording
                </button>
            </>
        )
    } else if (rec.generating) {
        body = <p><strong>Generating minutes…</strong></p>
    } else if (rec.recordedFile) {
        body = (
            <>
                <p><strong>Recording ready</strong> ({formatTime(rec.recordedSeconds)})</p>
                {rec.error && <p className="alert" role="alert">{rec.error}</p>}
                <div className="pip-line">
                    <button type="button" className="btn btn-primary btn-sm" onClick={rec.generateRecording}>
                        Generate minutes
                    </button>
                    <button type="button" className="btn btn-sm" onClick={rec.discardRecording}>Discard</button>
                </div>
            </>
        )
    } else if (rec.submittedId) {
        body = <p><strong>Done.</strong> Your minutes are being generated. See the Meeting Minutes tab.</p>
    }

    return <div className="pip">{body}</div>
}
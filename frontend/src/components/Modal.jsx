import React, { useEffect } from 'react'

export default function Modal({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="modal-backdrop" onMouseDown={onClose}>
            <div
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2>{title}</h2>
                {children}
            </div>
        </div>
    )
}
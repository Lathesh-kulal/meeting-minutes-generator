import React from 'react'
import LanguageSelector from './LanguageSelector.jsx'
import { exportMeeting } from '../api/client'

export default function ExportButton({ meetingId }) {
  const [format, setFormat] = React.useState('pdf')
  const [lang, setLang] = React.useState('en')
  const [exporting, setExporting] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleExport = async () => {
    setError('')
    setExporting(true)
    try {
      const res = await exportMeeting(meetingId, format, lang)

      // Pull the filename the backend set via Content-Disposition, falling
      // back to a sensible default if the header isn't readable.
      const disposition = res.headers['content-disposition'] || ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : `meeting_minutes.${format}`

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError('Export failed. The meeting may not be fully processed yet.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <select value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="pdf">PDF</option>
        <option value="docx">DOCX</option>
      </select>
      <LanguageSelector value={lang} onChange={setLang} />
      <button onClick={handleExport} disabled={exporting}>
        {exporting ? 'Preparing download...' : 'Download'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  )
}
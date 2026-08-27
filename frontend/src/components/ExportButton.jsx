import React from 'react'
import LanguageSelector from './LanguageSelector.jsx'
// import { exportMeeting } from '../api/client'

export default function ExportButton({ meetingId }) {
  const [format, setFormat] = React.useState('pdf')
  const [lang, setLang] = React.useState('en')

  const handleExport = async () => {
    // TODO: exportMeeting(meetingId, format, lang), trigger file download
  }

  return (
    <div>
      <select value={format} onChange={(e) => setFormat(e.target.value)}>
        <option value="pdf">PDF</option>
        <option value="docx">DOCX</option>
      </select>
      <LanguageSelector value={lang} onChange={setLang} />
      <button onClick={handleExport}>Download</button>
    </div>
  )
}

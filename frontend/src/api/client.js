// Thin wrapper around the Flask backend REST API.
import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

export function uploadMeeting(formData) {
  return client.post('/meetings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function getMeeting(meetingId) {
  return client.get(`/meetings/${meetingId}`)
}

export function getMeetingStatus(meetingId) {
  return client.get(`/meetings/${meetingId}/status`)
}

export function exportMeeting(meetingId, format, lang) {
  return client.get(`/meetings/${meetingId}/export`, {
    params: { format, lang },
    responseType: 'blob'
  })
}

export function listMeetings() {
  return client.get('/meetings')
}

export default client

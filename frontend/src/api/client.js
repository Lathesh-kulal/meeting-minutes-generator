// Thin wrapper around the Flask backend REST API.
import axios from 'axios'

const client = axios.create({ baseURL: '/api', withCredentials: true })

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

export function registerUser(username, email, password) {
  return client.post('/auth/register', { username, email, password })
}

export function loginUser(username, password) {
  return client.post('/auth/login', { username, password })
}

export function logoutUser() {
  return client.post('/auth/logout')
}

export function getCurrentUser() {
  return client.get('/auth/me')
}

export default client
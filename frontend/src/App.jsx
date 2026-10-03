import React from 'react'
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ProcessingPage from './pages/ProcessingPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <nav>
      <Link to="/">Upload</Link>
      {' | '}
      <Link to="/history">History</Link>
      {' | '}
      <span>Logged in as {user.username}</span>
      {' | '}
      <button onClick={handleLogout}>Log Out</button>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/processing/:meetingId" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
          <Route path="/results/:meetingId" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
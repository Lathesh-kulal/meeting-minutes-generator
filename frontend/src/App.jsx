import React from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
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

  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <span className="brand-mark">✦</span>
        Meeting Minutes
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className={linkClass}>New Meeting</NavLink>
        <NavLink to="/history" className={linkClass}>History</NavLink>
      </div>
      <div className="nav-user">
        <span className="avatar">{user.username?.[0]}</span>
        <span className="nav-username">{user.username}</span>
        <button className="btn-secondary btn-sm" onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <main className="page">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
            <Route path="/processing/:meetingId" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
            <Route path="/results/:meetingId" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}
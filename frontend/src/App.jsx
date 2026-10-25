import React from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import UploadPage from './pages/UploadPage.jsx'
import ProcessingPage from './pages/ProcessingPage.jsx'
import ResultsPage from './pages/ResultsPage.jsx'
import HistoryPage from './pages/HistoryPage.jsx'
import HomePage from './pages/HomePage.jsx'
import Logo from './components/Logo.jsx'

function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = async () => {
    // Go to the public home page first: if the user is cleared while a protected
    // page is open, ProtectedRoute would otherwise redirect to /login.
    navigate('/')
    await logout()
  }

  return (
    <nav className="nav" aria-label="Main">
      <Link to="/" className="brand"><Logo size={26} />Meeting <span className="hl">Minutes</span></Link>
      <NavLink to="/new" className="navlink">New meeting</NavLink>
      <NavLink to="/history" className="navlink">History</NavLink>
      <span className="avatar" title={user.username} aria-label={`Signed in as ${user.username}`}>
        {user.username.charAt(0).toUpperCase()}
      </span>
      <button className="btn btn-sm" onClick={handleLogout}>Log out</button>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <main>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/new" element={<ProtectedRoute><UploadPage /></ProtectedRoute>} />
          <Route path="/processing/:meetingId" element={<ProtectedRoute><ProcessingPage /></ProtectedRoute>} />
          <Route path="/results/:meetingId" element={<ProtectedRoute><ResultsPage /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
        </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  )
}
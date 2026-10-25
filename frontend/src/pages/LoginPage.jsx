import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from '../components/Logo.jsx'

export default function LoginPage() {
    const [params] = useSearchParams()
    const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login') // 'login' | 'register'
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const { login, register } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setSubmitting(true)
        try {
            if (mode === 'login') {
                await login(username, password)
            } else {
                await register(username, email, password)
            }
            navigate('/new')
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="auth-simple">
            <svg className="wave-corner" viewBox="0 0 420 320" aria-hidden="true">
                <path fill="#1C2540" d="M0,0 H420 C430,110 330,160 230,190 C130,220 60,280 0,320 Z" />
            </svg>
            <svg className="wave-bottom" viewBox="0 0 1440 420" preserveAspectRatio="none" aria-hidden="true">
                <path fill="#2A3558" d="M0,150 C200,70 420,60 640,120 C880,185 1120,200 1440,100 L1440,420 L0,420 Z" />
                <path fill="#1C2540" d="M0,220 C240,140 460,150 700,205 C940,260 1180,250 1440,170 L1440,420 L0,420 Z" />
            </svg>
            <Link to="/" className="brand"><Logo size={30} />Meeting <span className="hl">Minutes</span></Link>
            <div className="panel auth-card">
                <h2>{mode === 'login' ? 'Log in' : 'Create your account'}</h2>
                <p className="muted">{mode === 'login' ? 'Log in to see your meetings and minutes.' : 'Create an account to keep your meetings and minutes.'}</p>
                <form onSubmit={handleSubmit}>
                    <label className="lbl">Username
                        <input className="field" type="text" value={username} autoComplete="username"
                            onChange={(e) => setUsername(e.target.value)} required />
                    </label>
                    {mode === 'register' && (
                        <label className="lbl">Email
                            <input className="field" type="email" value={email} autoComplete="email"
                                onChange={(e) => setEmail(e.target.value)} required />
                        </label>
                    )}
                    <label className="lbl">Password
                        <input className="field" type="password" value={password}
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            onChange={(e) => setPassword(e.target.value)} required />
                    </label>
                    {error && <p className="alert" role="alert">{error}</p>}
                    <button type="submit" className="btn btn-primary btn-wide" disabled={submitting}>
                        {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
                    </button>
                </form>
                <button className="btn-link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
                    {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Log in'}
                </button>
            </div>
            <Link to="/" className="back-link">Back to home page</Link>
        </div>
    )
}

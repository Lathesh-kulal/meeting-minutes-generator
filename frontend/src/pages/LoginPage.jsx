import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function LoginPage() {
    const [mode, setMode] = useState('login') // 'login' | 'register'
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
            navigate('/')
        } catch (err) {
            setError(err.response?.data?.error || 'Something went wrong. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    const toggleMode = () => {
        setMode(mode === 'login' ? 'register' : 'login')
        setError('')
    }

    return (
        <div className="auth-wrap">
            <div className="auth-brand">
                <span className="brand-mark">✦</span>
                <div>
                    <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
                    <p className="subtitle">
                        {mode === 'login'
                            ? 'Log in to your meeting minutes.'
                            : 'Turn meetings into clear, shareable minutes.'}
                    </p>
                </div>
            </div>

            <form className="card auth-card" onSubmit={handleSubmit}>
                <div className="form-field">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        placeholder="Your username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>

                {mode === 'register' && (
                    <div className="form-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                )}

                <div className="form-field">
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>

                {error && <div className="alert-error">{error}</div>}

                <button className="btn-block" type="submit" disabled={submitting}>
                    {submitting ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
                </button>

                <p className="auth-switch">
                    {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                    <button type="button" className="link-button" onClick={toggleMode}>
                        {mode === 'login' ? 'Register' : 'Log in'}
                    </button>
                </p>
            </form>
        </div>
    )
}
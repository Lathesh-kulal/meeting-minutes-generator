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

    return (
        <div>
            <h1>{mode === 'login' ? 'Log In' : 'Create an Account'}</h1>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                {mode === 'register' && (
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                )}
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <button type="submit" disabled={submitting}>
                    {submitting ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Register'}
                </button>
            </form>
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Log in'}
            </button>
        </div>
    )
}
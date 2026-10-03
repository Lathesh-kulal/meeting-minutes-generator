import React, { createContext, useContext, useEffect, useState } from 'react'
import { getCurrentUser, loginUser, logoutUser, registerUser } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getCurrentUser()
            .then((res) => setUser(res.data))
            .catch(() => setUser(null))
            .finally(() => setLoading(false))
    }, [])

    const login = async (username, password) => {
        const res = await loginUser(username, password)
        setUser(res.data)
    }

    const register = async (username, email, password) => {
        const res = await registerUser(username, email, password)
        setUser(res.data)
    }

    const logout = async () => {
        await logoutUser()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
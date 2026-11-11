import { createContext, useContext, useState } from 'react'
import { login as apiLogin } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// where each role lands after login
export const homeFor = (role) => (role === 'admin' ? '/admin/cameras' : '/')

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('sentinex_user') || 'null'))
  async function login(email, password) {
    const u = await apiLogin(email, password)
    localStorage.setItem('sentinex_user', JSON.stringify(u))
    setUser(u)
    return u
  }
  function logout() {
    localStorage.removeItem('sentinex_user')
    setUser(null)
  }
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>
}

import { createContext, useContext, useState } from 'react'
import { login as apiLogin } from './api'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

// where each role lands after login
export const homeFor = (role) => (role === 'admin' ? '/admin/cameras' : '/')

export function AuthProvider({ children }) {
  // dev only (not in production builds): ?as=admin|manager|supervisor signs in a demo user for screenshots
  const as = import.meta.env.DEV && new URLSearchParams(location.search).get('as')
  const demo = as && { admin: { id: 1, name: 'Ayesha Khan', role: 'admin' }, manager: { id: 2, name: 'Bilal Ahmed', role: 'manager' }, supervisor: { id: 3, name: 'Sana Malik', role: 'supervisor' } }[as]
  const [user, setUser] = useState(() => demo || JSON.parse(localStorage.getItem('sentinex_user') || 'null'))
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

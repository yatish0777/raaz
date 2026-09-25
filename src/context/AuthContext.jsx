import { createContext, useContext, useState } from 'react'

// Demo auth only. The real system would use department SSO / LDAP + hardware OTP, with every action audit-logged.
const DEMO_USER = {
  id: 'INV01',
  name: 'Ananya Sharma',
  rank: 'Senior Analyst',
  unit: 'I4C - National Cyber Forensic Lab, New Delhi',
  badge: 'I4C-AN-2231',
  role: 'Analyst',
}

const AuthCtx = createContext(null)
const KEY = 'raaz.session'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(load)
  const login = (badge) => {
    const u = { ...DEMO_USER, badge: badge || DEMO_USER.badge, loginAt: new Date().toISOString() }
    setUser(u)
    try { localStorage.setItem(KEY, JSON.stringify(u)) } catch { /* ignore */ }
  }
  const logout = () => {
    setUser(null)
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
  }
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

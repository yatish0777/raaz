import { createContext, useContext } from 'react'

// No sign-in in this prototype: the app opens straight to the dashboard as a demo analyst.
// The real system would use department SSO / LDAP + hardware OTP, with every action audit-logged.
const DEMO_USER = {
  id: 'INV01',
  name: 'Ananya Sharma',
  rank: 'Senior Analyst',
  unit: 'I4C - National Cyber Forensic Lab, New Delhi',
  badge: 'I4C-AN-2231',
  role: 'Analyst',
}

const AuthCtx = createContext({ user: DEMO_USER })

export const useAuth = () => useContext(AuthCtx)

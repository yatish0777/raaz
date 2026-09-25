import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewInvestigation from './pages/NewInvestigation'
import Analysis from './pages/Analysis'
import Workspace from './pages/Workspace'
import WalletProfile from './pages/WalletProfile'
import Exchanges from './pages/Exchanges'
import Reports from './pages/Reports'
import ReportView from './pages/ReportView'
import Cases from './pages/Cases'
import Watchlist from './pages/Watchlist'
import NetworkMap from './pages/NetworkMap'

function RequireAuth({ children }) {
  const { user } = useAuth()
  const loc = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="investigate" element={<NewInvestigation />} />
          <Route path="analysis/:id" element={<Analysis />} />
          <Route path="cases" element={<Cases />} />
          <Route path="cases/:id" element={<Workspace />} />
          <Route path="wallets/:address" element={<WalletProfile />} />
          <Route path="exchanges" element={<Exchanges />} />
          <Route path="reports" element={<Reports />} />
          <Route path="reports/:id" element={<ReportView />} />
          <Route path="watchlist" element={<Watchlist />} />
          <Route path="network" element={<NetworkMap />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}

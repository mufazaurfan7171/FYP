import { Navigate, Route, Routes } from 'react-router-dom'
import { homeFor, useAuth } from './auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import Upload from './pages/Upload'
import Cameras from './pages/Cameras'
import Users from './pages/Users'

// role-based access (UC-09): wrong role is sent to its own home page
function Allow({ roles, children }) {
  const { user } = useAuth()
  return roles.includes(user.role) ? children : <Navigate to={homeFor(user.role)} replace />
}

export default function App() {
  const { user } = useAuth()
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }
  const MS = ['manager', 'supervisor']
  return (
    <Routes>
      <Route path="/login" element={<Navigate to={homeFor(user.role)} replace />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Allow roles={MS}><Dashboard /></Allow>} />
        <Route path="/incidents" element={<Allow roles={MS}><Incidents /></Allow>} />
        <Route path="/incidents/:id" element={<Allow roles={MS}><IncidentDetail /></Allow>} />
        <Route path="/upload" element={<Allow roles={['supervisor']}><Upload /></Allow>} />
        <Route path="/admin/cameras" element={<Allow roles={['admin']}><Cameras /></Allow>} />
        <Route path="/admin/users" element={<Allow roles={['admin']}><Users /></Allow>} />
        <Route path="*" element={<Navigate to={homeFor(user.role)} replace />} />
      </Route>
    </Routes>
  )
}

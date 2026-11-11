import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { getAlerts, roleLabel } from '../api'
import { useAuth } from '../auth'
import { Icon } from './ui'

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', roles: ['manager', 'supervisor'] },
  { to: '/incidents', label: 'Violations', icon: 'search', roles: ['manager', 'supervisor'] },
  { to: '/upload', label: 'Analyse video', icon: 'video', roles: ['supervisor'] },
  { to: '/admin/cameras', label: 'Cameras & rules', icon: 'camera', roles: ['admin'] },
  { to: '/admin/users', label: 'Users', icon: 'users', roles: ['admin'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [pending, setPending] = useState(0)

  // supervisors see the pending alert count everywhere (UC-06, polled every 5 s)
  useEffect(() => {
    if (user.role !== 'supervisor') return
    const tick = () => getAlerts().then((a) => setPending(a.length)).catch(() => {})
    tick()
    const t = setInterval(tick, 5000)
    return () => clearInterval(t)
  }, [user.role])

  return (
    <div className="shell">
      <aside className="rail">
        <a className="wordmark" href="/">
          <span className="wordmark-mark" aria-hidden="true" />
          <span className="wordmark-text">SENTINEX</span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'}>
              <Icon name={n.icon} />
              {n.label}
              {n.to === '/' && pending > 0 && <span className="nav-count" aria-label={`${pending} pending alerts`}>{pending}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="rail-foot">
          <span className="who">{user.name}</span>
          <span className="role">{roleLabel(user.role)}</span>
          <button onClick={() => { logout(); navigate('/login') }}>Sign out</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

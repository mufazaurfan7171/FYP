import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { acknowledgeAlert, getAlerts, getDashboard, violationLabel } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Empty, Skeleton, Thumb, ViolationBadge, fmtAgo, fmtDateTime, useToast } from '../components/ui'
import './Dashboard.css'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Dashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const isSupervisor = user.role === 'supervisor'
  const [data, setData] = useState(null)
  const [alerts, setAlerts] = useState([])
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState([])
  const [busy, setBusy] = useState(null)
  const acked = useRef([]) // ids acknowledged here, so a stale poll can't bring them back

  function load() {
    setError('')
    setData(null)
    getDashboard()
      .then((d) => {
        setData(d)
        setAlerts(d.alerts)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(load, [])

  // UC-06: near real-time alerts, polled every 5 s while the page is open
  useEffect(() => {
    if (!isSupervisor) return
    const t = setInterval(() => {
      getAlerts()
        .then((list) => setAlerts(list.filter((a) => !acked.current.includes(a.id))))
        .catch(() => {})
    }, 5000)
    return () => clearInterval(t)
  }, [isSupervisor])

  async function acknowledge(alert) {
    setBusy(alert.id)
    try {
      await acknowledgeAlert(alert.id, user.id)
      acked.current.push(alert.id)
      setLeaving((l) => [...l, alert.id])
      setTimeout(() => {
        setAlerts((list) => list.filter((a) => a.id !== alert.id))
        setLeaving((l) => l.filter((id) => id !== alert.id))
      }, 220)
      toast(`Alert #${alert.id} acknowledged`)
    } catch (e) {
      toast(e.message, 'error')
    }
    setBusy(null)
  }

  const first = user.name.split(' ')[0]
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>{greeting()}, {first}. Today is {today}.</p>
        </div>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}

      {!error && !data && <Loading />}

      {data && (
        <>
          {alerts.length > 0 ? (
            <section className="dash-alerts" aria-labelledby="alerts-h">
              <h2 id="alerts-h">Active alerts <span className="faint">({alerts.length})</span></h2>
              <ul className="dash-alert-list" aria-live="polite">
                {alerts.map((a) => (
                  <li key={a.id} className={`alert-card${leaving.includes(a.id) ? ' leaving' : ''}`}>
                    <Thumb incident={a.incident} />
                    <div className="dash-alert-info">
                      <span className="alert-title">{violationLabel(a.incident.type)}</span>
                      <span className="alert-meta">
                        <span className="mono">Alert #{a.id}</span>
                        <span>{a.incident.camera?.name}</span>
                        <span title={fmtDateTime(a.createdAt)}>{fmtAgo(a.createdAt)}</span>
                      </span>
                      <Link className="panel-link" to={`/incidents/${a.incident.id}`}>View incident</Link>
                    </div>
                    {isSupervisor ? (
                      <button className="btn btn-ack" disabled={busy === a.id} onClick={() => acknowledge(a)}>
                        {busy === a.id ? 'Acknowledging' : 'Acknowledge'}
                      </button>
                    ) : (
                      <span className="badge badge-yellow">Pending</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="dash-calm"><span className="badge badge-green"><span className="dot" />No active alerts</span></p>
          )}

          <div className="stats">
            <div className="stat">
              <span className="stat-value">{data.summary.today}</span>
              <span className="stat-label">Violations today</span>
            </div>
            <div className="stat">
              <span className="stat-value">{data.summary.week}</span>
              <span className="stat-label">This week</span>
            </div>
            <div className={`stat${alerts.length > 0 ? ' warn' : ''}`}>
              <span className="stat-value">{alerts.length}</span>
              <span className="stat-label">Pending alerts</span>
            </div>
            <div className="stat">
              <span className="stat-value">{data.summary.camerasOnline} <span className="dash-of">of {data.summary.camerasActive}</span></span>
              <span className="stat-label">Cameras online</span>
            </div>
          </div>

          <div className="dash-cols">
            <section className="panel">
              <div className="panel-head">
                <h2>Recent violations</h2>
                <Link className="panel-link" to="/incidents">Search violations</Link>
              </div>
              {data.recent.length === 0 ? (
                <Empty title="No violations recorded">New violations from live cameras and uploaded videos will appear here.</Empty>
              ) : (
                <ul className="dash-recent">
                  {data.recent.map((i) => (
                    <li key={i.id}>
                      <Link to={`/incidents/${i.id}`}>
                        <Thumb incident={i} />
                        <span className="dash-recent-main">
                          <ViolationBadge type={i.type} />
                          <span>{i.camera?.name}</span>
                        </span>
                        <span className="dash-recent-time faint" title={fmtDateTime(i.ts)}>{fmtAgo(i.ts)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>This week by type</h2>
              </div>
              <div className="panel-body">
                {data.summary.week === 0 ? (
                  <p className="muted">No violations this week.</p>
                ) : (
                  <>
                    <Bars rows={data.summary.byType} />
                    <h3 className="dash-sub">By camera</h3>
                    <ul className="dash-cams">
                      {[...data.summary.byCamera].sort((a, b) => b.count - a.count).map((c) => (
                        <li key={c.id} className={c.count ? '' : 'faint'}>
                          <span>{c.name}</span>
                          <span>{c.count}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function Bars({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <ul className="dash-bars">
      {rows.map((r) => (
        <li key={r.key}>
          <span>{r.label}</span>
          <span className="dash-bar" aria-hidden="true">
            <span style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="dash-bar-n">{r.count}</span>
        </li>
      ))}
    </ul>
  )
}

function Loading() {
  return (
    <>
      <Skeleton h={72} />
      <Skeleton h={86} />
      <div className="dash-cols">
        <Skeleton h={320} />
        <Skeleton h={320} />
      </div>
    </>
  )
}

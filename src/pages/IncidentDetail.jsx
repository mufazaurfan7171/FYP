import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getIncident } from '../api'
import { ErrorBox, Icon, Skeleton, Snapshot, SourceBadge, ViolationBadge, fmtAgo, fmtFull } from '../components/ui'
import './Incidents.css'

export default function IncidentDetail() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [inc, setInc] = useState(null)
  const [error, setError] = useState('')
  const [clipFailed, setClipFailed] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    let live = true
    setInc(null)
    setError('')
    setClipFailed(false)
    getIncident(id)
      .then((r) => live && setInc(r))
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [id, tries])

  const back = (e) => {
    e.preventDefault()
    if (window.history.state && window.history.state.idx > 0) navigate(-1)
    else navigate('/incidents' + (params.has('fail') ? `?fail=${params.get('fail')}` : ''))
  }

  return (
    <div className="page">
      <div>
        <Link className="crumb" to="/incidents" onClick={back}><Icon name="back" size={16} />Violations</Link>
        <h1>{inc ? `Incident #${inc.id}` : 'Incident'}</h1>
      </div>

      {error ? (
        <ErrorBox message={error} onRetry={() => setTries(tries + 1)} />
      ) : !inc ? (
        <div className="inc-detail">
          <Skeleton h={360} />
          <Skeleton h={260} />
        </div>
      ) : (
        <div className="inc-detail">
          <div className="inc-media">
            {inc.clipUrl && !clipFailed ? (
              <video
                src={inc.clipUrl}
                controls autoPlay muted playsInline
                aria-label={`Clip of ${inc.camera.name} showing the violation`}
                onError={() => setClipFailed(true)}
              />
            ) : (
              <>
                {clipFailed && <ErrorBox message="Could not load incident clip." />}
                {!inc.clipUrl && <div className="notice">No clip was saved for this incident. Showing the snapshot.</div>}
                <Snapshot incident={inc} />
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Details</h2></div>
            <div className="panel-body">
              <dl className="inc-dl">
                <div><dt>Violation</dt><dd><ViolationBadge type={inc.type} /></dd></div>
                <div><dt>Camera</dt><dd>{inc.camera.name}<div className="muted">{inc.camera.location}</div></dd></div>
                <div><dt>Time</dt><dd>{fmtFull(inc.ts)}</dd></div>
                <div><dt>Source</dt><dd><SourceBadge source={inc.source} /></dd></div>
                <div><dt>Worker tracking ID</dt><dd className="mono">{inc.trackId}</dd></div>
                <div><dt>Incident</dt><dd className="mono">#{inc.id}</dd></div>
                {inc.alert && (
                  <div>
                    <dt>Alert</dt>
                    <dd>
                      {inc.alert.status === 'pending'
                        ? <span className="badge badge-yellow">Pending</span>
                        : <span className="badge badge-green">Acknowledged</span>}
                      {inc.alert.status === 'acknowledged' && inc.alert.acknowledgedAt && (
                        <div className="muted">{fmtFull(inc.alert.acknowledgedAt)} ({fmtAgo(inc.alert.acknowledgedAt)})</div>
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

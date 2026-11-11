import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { VIOLATIONS, getCameras, searchIncidents } from '../api'
import { Empty, ErrorBox, Field, Skeleton, SourceBadge, Thumb, ViolationBadge, fmtDateTime } from '../components/ui'
import './Incidents.css'

export default function Incidents() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const filters = {
    from: params.get('from') || '',
    to: params.get('to') || '',
    cameraId: params.get('cameraId') || '',
    type: params.get('type') || '',
  }
  const [draft, setDraft] = useState(filters)
  const [cameras, setCameras] = useState([])
  const [list, setList] = useState(null)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')
  const [tries, setTries] = useState(0)
  const key = JSON.stringify(filters)
  const failQs = params.has('fail') ? `?fail=${params.get('fail')}` : ''

  useEffect(() => { getCameras().then(setCameras).catch(() => {}) }, [])
  useEffect(() => { setDraft(filters) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true
    setList(null)
    setError('')
    searchIncidents(filters)
      .then((r) => live && setList(r))
      .catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [key, tries]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value })

  function submit(e) {
    e.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeError('From date must be on or before the To date.')
      return
    }
    setRangeError('')
    const next = new URLSearchParams()
    if (params.has('fail')) next.set('fail', params.get('fail'))
    Object.entries(draft).forEach(([k, v]) => v && next.set(k, v))
    setParams(next)
  }

  function clear() {
    setRangeError('')
    const next = new URLSearchParams()
    if (params.has('fail')) next.set('fail', params.get('fail'))
    setParams(next)
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="page">
      <div className="page-head">
        <h1>Violations</h1>
      </div>

      <form className="panel" onSubmit={submit} noValidate>
        <div className="panel-body form">
          <div className="form-row inc-filters">
            <Field label="From" error={rangeError}>
              <input className="input" type="date" value={draft.from} onChange={set('from')} />
            </Field>
            <Field label="To">
              <input className="input" type="date" value={draft.to} onChange={set('to')} />
            </Field>
            <Field label="Camera">
              <select className="select" value={draft.cameraId} onChange={set('cameraId')}>
                <option value="">All cameras</option>
                {cameras.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Violation type">
              <select className="select" value={draft.type} onChange={set('type')}>
                <option value="">All types</option>
                {VIOLATIONS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
              </select>
            </Field>
            <div className="inc-actions">
              <button className="btn btn-primary" type="submit">Search</button>
              <button className="btn btn-ghost" type="button" onClick={clear}>Clear filters</button>
            </div>
          </div>
        </div>
      </form>

      {error ? (
        <ErrorBox message={error} onRetry={() => setTries(tries + 1)} />
      ) : !list ? (
        <div className="panel panel-body" style={{ display: 'grid', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={44} />)}
        </div>
      ) : list.length === 0 ? (
        <div className="panel"><Empty title="No incidents found">Try a wider date range or different filters.</Empty></div>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <span className="muted" aria-live="polite">
              {hasFilters ? `${list.length} matching violations` : 'Showing the most recent violations'}
            </span>
          </div>
          <div className="table-wrap">
            <table className="table inc-table">
              <thead>
                <tr>
                  <th>Snapshot</th><th>Violation</th><th>Camera</th><th>Time</th><th>Source</th><th>Incident</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} className="clickable" onClick={() => navigate(`/incidents/${i.id}${failQs}`)}>
                    <td>
                      <Link className="inc-link" to={`/incidents/${i.id}${failQs}`} aria-label={`Open incident ${i.id}`} onClick={(e) => e.stopPropagation()}>
                        <Thumb incident={i} />
                      </Link>
                    </td>
                    <td><ViolationBadge type={i.type} /></td>
                    <td>{i.camera.name}<div className="muted">{i.camera.location}</div></td>
                    <td>{fmtDateTime(i.ts)}</td>
                    <td><SourceBadge source={i.source} /></td>
                    <td className="mono faint">#{i.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

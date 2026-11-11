import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ANALYSIS_STEPS, analyseVideo, getCameras, ppeLabel } from '../api'
import { CountUp, Empty, ErrorBox, Field, Icon, Skeleton, Spinner, Thumb, ViolationBadge, fmtDateTime, pad } from '../components/ui'
import './Upload.css'

const mmss = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`

export default function Upload() {
  const [cameras, setCameras] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [file, setFile] = useState(null)
  const [cameraId, setCameraId] = useState('')
  const [drag, setDrag] = useState(false)
  const [step, setStep] = useState(-1)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const load = () => {
    setLoadError('')
    setCameras(null)
    getCameras().then(setCameras).catch((e) => setLoadError(e.message))
  }
  useEffect(load, [])

  const camera = cameras?.find((c) => c.id === Number(cameraId))

  const pickFile = (f) => {
    if (f) {
      setFile(f)
      setError('')
    }
  }

  const run = async (e) => {
    e.preventDefault()
    setRunning(true)
    setError('')
    setResult(null)
    setStep(0)
    try {
      setResult(await analyseVideo(file, cameraId, setStep))
    } catch (err) {
      setError(err.message)
      setFile(null)
    } finally {
      setRunning(false)
    }
  }

  const reset = () => {
    setFile(null)
    setCameraId('')
    setResult(null)
    setError('')
    setStep(-1)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Analyse recorded video</h1>
          <p className="muted">Upload a CCTV recording and choose its camera to check it against that camera's PPE rules.</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body">
          {loadError ? (
            <ErrorBox message={loadError} onRetry={load} />
          ) : !cameras ? (
            <Skeleton h={120} />
          ) : (
            <form className="form" onSubmit={run}>
              <label
                className={`dropzone${drag ? ' over' : ''}${running ? ' disabled' : ''}`}
                onDragOver={(e) => { e.preventDefault(); if (!running) setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); if (!running) pickFile(e.dataTransfer.files[0]) }}
              >
                <input type="file" accept=".mp4,.avi,.mov,.mkv,video/*" disabled={running} onChange={(e) => pickFile(e.target.files[0])} />
                <Icon name="upload" size={28} />
                {file ? (
                  <span><strong>{file.name}</strong><span className="muted"> ({mb(file.size)})</span></span>
                ) : (
                  <span><strong>Choose a video file</strong> or drop it here</span>
                )}
                <small className="muted">MP4, AVI, MOV or MKV</small>
              </label>

              <Field label="Camera">
                <select className="select" value={cameraId} disabled={running} onChange={(e) => setCameraId(e.target.value)}>
                  <option value="">Select a camera</option>
                  {cameras.map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.requiredPpe.length}>
                      {c.name}{!c.requiredPpe.length ? ' (no PPE rules)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              {camera && (
                <div className="chips" aria-label="Required PPE">
                  {camera.requiredPpe.map((p) => <span key={p} className="badge">{ppeLabel(p)}</span>)}
                </div>
              )}

              <div className="form-actions">
                <button className="btn btn-primary" disabled={!file || !cameraId || running}>Analyse video</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {error && <div className="up-gap"><ErrorBox message={error} /></div>}

      {running && (
        <div className="panel up-gap">
          <div className="panel-head"><h2>Analysing {file?.name}</h2></div>
          <ol className="steps">
            {ANALYSIS_STEPS.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'now' : 'faint'}>
                {i < step ? <Icon name="check" size={16} /> : i === step ? <Spinner /> : <span className="step-gap" />}
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      {result && (
        <div className="panel up-gap">
          <div className="panel-head">
            <h2>Analysis summary</h2>
            <button className="btn btn-sm" onClick={reset}>Analyse another video</button>
          </div>
          <div className="panel-body">
            <p className="muted">{result.fileName} from {result.camera.name}</p>
            <div className="stats">
              <div className="stat"><div className="stat-value"><CountUp value={result.durationSec} format={mmss} duration={1500} /></div><div className="stat-label">Video duration</div></div>
              <div className="stat"><div className="stat-value"><CountUp value={result.framesAnalysed} format={(n) => n.toLocaleString()} duration={1500} /></div><div className="stat-label">Frames analysed</div></div>
              <div className="stat"><div className="stat-value"><CountUp value={result.workersTracked} /></div><div className="stat-label">Workers tracked</div></div>
              <div className={`stat${result.incidents.length ? ' warn' : ''}`}><div className="stat-value"><CountUp value={result.incidents.length} /></div><div className="stat-label">Incidents found</div></div>
            </div>

            {result.incidents.length === 0 ? (
              <Empty title="No violations found in this video." />
            ) : (
              <>
                <div className="chips up-gap">
                  {result.byType.map((t) => <span key={t.key} className="badge badge-red">{t.label}: {t.count}</span>)}
                </div>
                <ul className="up-list">
                  {result.incidents.map((i) => (
                    <li key={i.id}>
                      <Thumb incident={i} />
                      <ViolationBadge type={i.type} />
                      <span className="muted">At {fmtDateTime(i.ts)}</span>
                      <Link className="panel-link" to={`/incidents/${i.id}`}>View incident {i.id}</Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="notice up-gap">Incidents from recorded video are saved with live incidents. Recorded video does not send alerts.</p>
          </div>
        </div>
      )}
    </div>
  )
}

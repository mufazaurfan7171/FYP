import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { violationLabel } from '../api'

// ---------- formatting ----------
export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const fmtFull = (iso) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })
export function fmtAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return `${Math.floor(s / 86400)} d ago`
}
export const pad = (n) => String(n).padStart(2, '0')

// ---------- CCTV snapshot (SVG stand-in until real frames come from the worker) ----------
export function Snapshot({ incident, compact = false }) {
  const id = incident.id
  const x = 70 + ((id * 53) % 150)
  const tall = 78 + ((id * 7) % 14)
  const top = 150 - tall
  const noHelmet = incident.type === 'no_helmet'
  const noVest = incident.type === 'no_vest'
  const ts = new Date(incident.ts)
  const osd = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())} ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`
  const label = `${violationLabel(incident.type)}  #${incident.trackId}`
  return (
    <svg className="snap" viewBox="0 0 320 180" role="img" aria-label={`Snapshot: ${violationLabel(incident.type)} at ${incident.camera?.name || 'camera'}`}>
      <defs>
        <linearGradient id={`bg${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#39413f" />
          <stop offset="1" stopColor="#222827" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#bg${id})`} />
      {/* back wall machinery */}
      <rect x={18 + (id % 3) * 10} y="44" width="58" height="62" fill="#4a5351" />
      <rect x="232" y="36" width="70" height="72" fill="#454e4c" />
      <rect x="240" y="46" width="22" height="14" fill="#5d6764" />
      <rect x="96" y="70" width="34" height="38" fill="#505957" />
      {/* floor */}
      <polygon points="0,108 320,108 320,180 0,180" fill="#2e3534" />
      <g stroke="#3d4644" strokeWidth="1">
        <line x1="160" y1="108" x2="10" y2="180" />
        <line x1="160" y1="108" x2="310" y2="180" />
        <line x1="0" y1="132" x2="320" y2="132" />
      </g>
      <polyline points="0,150 320,150" stroke="#8a7a2a" strokeWidth="2" strokeDasharray="10 8" opacity="0.6" />
      {/* worker */}
      <g>
        <circle cx={x} cy={top + 10} r="8" fill="#b9a48f" />
        {!noHelmet && <path d={`M${x - 9},${top + 8} a9,9 0 0 1 18,0 z`} fill="#f2b200" />}
        <rect x={x - 12} y={top + 20} width="24" height={tall * 0.45} rx="5" fill={noVest ? '#5f6b78' : '#e8731c'} />
        {!noVest && <rect x={x - 12} y={top + 20 + tall * 0.22} width="24" height="3" fill="#e9eddc" />}
        <rect x={x - 10} y={top + 20 + tall * 0.45 - 2} width="9" height={tall * 0.5} rx="3" fill="#3e4a57" />
        <rect x={x + 1} y={top + 20 + tall * 0.45 - 2} width="9" height={tall * 0.5} rx="3" fill="#3e4a57" />
      </g>
      {/* detection box */}
      <rect x={x - 20} y={top - 4} width="40" height={tall + 10} fill="none" stroke="#ff4b2e" strokeWidth="1.6" />
      {!compact && (
        <g>
          <rect x={x - 20} y={top - 17} width={label.length * 5.6 + 8} height="13" fill="#ff4b2e" />
          <text x={x - 16} y={top - 7.5} fontSize="9" fontFamily="ui-monospace, Consolas, monospace" fill="#fff">{label}</text>
          <text x="8" y="14" fontSize="9" fontFamily="ui-monospace, Consolas, monospace" fill="#fff" opacity="0.75">{(incident.camera?.name || '').toUpperCase()}</text>
          <text x="312" y="14" fontSize="9" fontFamily="ui-monospace, Consolas, monospace" fill="#fff" opacity="0.75" textAnchor="end">{osd}</text>
          {incident.source === 'live' ? (
            <g><circle cx="12" cy="170" r="3" fill="#ff4b2e" /><text x="19" y="173" fontSize="8.5" fontFamily="ui-monospace, Consolas, monospace" fill="#fff" opacity="0.75">LIVE</text></g>
          ) : (
            <text x="8" y="173" fontSize="8.5" fontFamily="ui-monospace, Consolas, monospace" fill="#fff" opacity="0.75">RECORDED</text>
          )}
        </g>
      )}
    </svg>
  )
}

export function Thumb({ incident }) {
  return <div className="thumb"><Snapshot incident={incident} compact /></div>
}

// ---------- badges ----------
export function ViolationBadge({ type }) {
  return <span className="badge badge-red">{violationLabel(type)}</span>
}
export function CameraStatus({ camera }) {
  if (!camera.active) return <span className="badge"><span className="dot" />Inactive</span>
  return camera.status === 'connected'
    ? <span className="badge badge-green"><span className="dot" />Connected</span>
    : <span className="badge badge-yellow"><span className="dot" />Disconnected</span>
}
export function SourceBadge({ source }) {
  return <span className="badge">{source === 'live' ? 'Live' : 'Recorded'}</span>
}

// ---------- states ----------
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <span>{children}</span>}
    </div>
  )
}
export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box" role="alert">
      <span>{message}</span>
      {onRetry && <button className="btn btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}
export function Skeleton({ h = 16, w = '100%', style }) {
  return <div className="skeleton" style={{ height: h, width: w, ...style }} />
}
export const Spinner = () => <span className="spinner" aria-hidden="true" />

// ---------- form field ----------
export function Field({ label, error, children }) {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span>{label}</span>
      {children}
      {error && <small className="field-error">{error}</small>}
    </label>
  )
}

// ---------- modal (native <dialog>: Esc + focus handled by the browser) ----------
export function Modal({ open, title, onClose, children }) {
  const ref = useRef(null)
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="modal" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}>
      {open && (
        <>
          <div className="modal-head">
            <h2>{title}</h2>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="modal-body">{children}</div>
        </>
      )}
    </dialog>
  )
}

// ---------- toasts ----------
const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }) {
  const [list, setList] = useState([])
  const toast = useCallback((message, kind = 'ok') => {
    const id = Math.random()
    setList((l) => [...l, { id, message, kind }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}><span className="dot" />{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- icons (stroke, 24 grid) ----------
const PATHS = {
  dashboard: 'M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
  video: 'M4 6h11v12H4zM15 10l5-3v10l-5-3',
  camera: 'M4 7h4l2-2h4l2 2h4v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M22 21c0-3-1.5-5-4-5.7',
  back: 'M15 6l-6 6 6 6',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
}
export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

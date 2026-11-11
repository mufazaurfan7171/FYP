// Mock data layer for the UI phase. Every function returns a Promise like a real fetch would.
// Backend phase: replace each body with fetch('/api/...'). Pages stay the same.
// Add ?fail=1 to the URL to force the SRS error messages.

export const PPE = [
  { key: 'helmet', label: 'Helmet' },
  { key: 'vest', label: 'Safety vest' },
  { key: 'gloves', label: 'Gloves' },
  { key: 'goggles', label: 'Goggles' },
  { key: 'shoes', label: 'Safety shoes' },
]

export const VIOLATIONS = [
  { key: 'no_helmet', label: 'No helmet', ppe: 'helmet' },
  { key: 'no_vest', label: 'No safety vest', ppe: 'vest' },
  { key: 'no_gloves', label: 'No gloves', ppe: 'gloves' },
  { key: 'no_goggles', label: 'No goggles', ppe: 'goggles' },
  { key: 'no_shoes', label: 'No safety shoes', ppe: 'shoes' },
]

export const ROLES = [
  { key: 'manager', label: 'Factory Manager' },
  { key: 'supervisor', label: 'Safety Supervisor' },
  { key: 'admin', label: 'System Admin' },
]

export const violationLabel = (k) => VIOLATIONS.find((v) => v.key === k)?.label || k
export const roleLabel = (k) => ROLES.find((r) => r.key === k)?.label || k
export const ppeLabel = (k) => PPE.find((p) => p.key === k)?.label || k


// ---------- seed data ----------
let users = [
  { id: 1, name: 'Ayesha Khan', email: 'admin@sentinex.test', password: 'password', role: 'admin', active: true },
  { id: 2, name: 'Bilal Ahmed', email: 'manager@sentinex.test', password: 'password', role: 'manager', active: true },
  { id: 3, name: 'Sana Malik', email: 'supervisor@sentinex.test', password: 'password', role: 'supervisor', active: true },
  { id: 4, name: 'Usman Tariq', email: 'usman@sentinex.test', password: 'password', role: 'supervisor', active: true },
  { id: 5, name: 'Hira Javed', email: 'hira@sentinex.test', password: 'password', role: 'manager', active: false },
]

let cameras = [
  { id: 1, name: 'Press Line A', streamUrl: 'rtsp://10.0.1.11/stream1', location: 'Hall 1', requiredPpe: ['helmet', 'vest', 'gloves', 'shoes'], active: true, status: 'connected' },
  { id: 2, name: 'Welding Bay 2', streamUrl: 'rtsp://10.0.1.12/stream1', location: 'Hall 2', requiredPpe: ['helmet', 'gloves', 'goggles', 'shoes'], active: true, status: 'connected' },
  { id: 3, name: 'Loading Dock East', streamUrl: 'rtsp://10.0.2.21/stream1', location: 'Dock', requiredPpe: ['helmet', 'vest', 'shoes'], active: true, status: 'disconnected' },
  { id: 4, name: 'Paint Shop', streamUrl: 'rtsp://10.0.3.31/stream1', location: 'Hall 3', requiredPpe: ['goggles', 'gloves', 'vest'], active: true, status: 'connected' },
  { id: 5, name: 'Assembly Line 3', streamUrl: 'rtsp://10.0.1.13/stream1', location: 'Hall 1', requiredPpe: ['helmet', 'vest'], active: true, status: 'connected' },
  { id: 6, name: 'Warehouse Aisle 7', streamUrl: 'http://10.0.4.41/video', location: 'Warehouse', requiredPpe: [], active: false, status: 'disconnected' },
]

// deterministic pseudo random so the demo looks the same every load
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = (arr) => arr[Math.floor(rand() * arr.length)]

let incidents = []
let alerts = []
let nextIncident = 1001
let nextAlert = 501

function addIncident({ cameraId, type, ts, source = 'live', videoId = null }) {
  const id = nextIncident++
  const inc = {
    id,
    cameraId,
    type,
    ts,
    source,
    videoId,
    trackId: 1 + Math.floor(rand() * 40),
    snapshot: true,
  }
  incidents.unshift(inc)
  return inc
}

;(function seedIncidents() {
  const now = Date.now()
  const live = cameras.filter((c) => c.requiredPpe.length)
  const list = []
  for (let i = 0; i < 46; i++) {
    const cam = pick(live)
    const ppe = pick(cam.requiredPpe)
    const type = VIOLATIONS.find((v) => v.ppe === ppe).key
    const ago = Math.floor(Math.pow(rand(), 1.6) * 14 * 864e5)
    list.push({ cameraId: cam.id, type, ts: new Date(now - ago).toISOString() })
  }
  list.sort((a, b) => a.ts.localeCompare(b.ts)).forEach((x) => addIncident(x))
  // a few pending alerts for the most recent live incidents
  incidents.slice(0, 3).forEach((inc) => alerts.push({ id: nextAlert++, incidentId: inc.id, status: 'pending', createdAt: inc.ts }))
  // one already acknowledged
  alerts.push({ id: nextAlert++, incidentId: incidents[3].id, status: 'acknowledged', createdAt: incidents[3].ts, acknowledgedBy: 3, acknowledgedAt: new Date().toISOString() })
})()

// ---------- helpers ----------
const wait = (ms = 380) => new Promise((r) => setTimeout(r, ms))
const failing = () => new URLSearchParams(window.location.search).has('fail')
const clone = (x) => JSON.parse(JSON.stringify(x))
const withCamera = (inc) => ({ ...inc, camera: cameras.find((c) => c.id === inc.cameraId) })
const alertView = (a) => {
  const inc = incidents.find((i) => i.id === a.incidentId)
  return { ...a, incident: withCamera(inc) }
}

// simulate live detection: a new live violation + alert roughly every 25 s
let lastLive = Date.now()
function simulateLive() {
  if (Date.now() - lastLive < 25000) return
  lastLive = Date.now()
  const cam = pick(cameras.filter((c) => c.active && c.status === 'connected' && c.requiredPpe.length))
  const ppe = pick(cam.requiredPpe)
  const inc = addIncident({ cameraId: cam.id, type: VIOLATIONS.find((v) => v.ppe === ppe).key, ts: new Date().toISOString() })
  alerts.push({ id: nextAlert++, incidentId: inc.id, status: 'pending', createdAt: inc.ts })
}

// ---------- auth (UC-09) ----------
export async function login(email, password) {
  await wait()
  const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
  if (!u || u.password !== password) throw new Error('Incorrect email or password.')
  if (!u.active) throw new Error('This account is deactivated. Contact your System Admin.')
  const { password: _, ...safe } = u
  return safe
}

// ---------- dashboard (UC-03) ----------
export async function getDashboard() {
  await wait()
  if (failing()) throw new Error('Could not load dashboard. Please try again.')
  simulateLive()
  const now = Date.now()
  const day = incidents.filter((i) => now - new Date(i.ts) < 864e5)
  const week = incidents.filter((i) => now - new Date(i.ts) < 7 * 864e5)
  const byType = VIOLATIONS.map((v) => ({ ...v, count: week.filter((i) => i.type === v.key).length }))
  const byCamera = cameras.map((c) => ({ id: c.id, name: c.name, count: week.filter((i) => i.cameraId === c.id).length }))
  return clone({
    summary: {
      today: day.length,
      week: week.length,
      pendingAlerts: alerts.filter((a) => a.status === 'pending').length,
      camerasOnline: cameras.filter((c) => c.active && c.status === 'connected').length,
      camerasActive: cameras.filter((c) => c.active).length,
      byType,
      byCamera,
    },
    recent: incidents.slice(0, 8).map(withCamera),
    alerts: alerts.filter((a) => a.status === 'pending').map(alertView).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  })
}

// ---------- alerts (UC-06) ----------
export async function getAlerts() {
  await wait(200)
  simulateLive()
  return clone(alerts.filter((a) => a.status === 'pending').map(alertView).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

export async function acknowledgeAlert(id, userId) {
  await wait(300)
  if (failing()) throw new Error('Could not acknowledge alert. Please try again.')
  const a = alerts.find((x) => x.id === id)
  a.status = 'acknowledged'
  a.acknowledgedBy = userId
  a.acknowledgedAt = new Date().toISOString()
  return clone(alertView(a))
}

// ---------- incidents (UC-04, UC-05) ----------
// filters: { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', cameraId, type }
export async function searchIncidents(filters = {}) {
  await wait()
  if (failing()) throw new Error('Could not load incidents. Please try again.')
  const { from, to, cameraId, type } = filters
  const none = !from && !to && !cameraId && !type
  let list = incidents.filter((i) => {
    const d = i.ts.slice(0, 10)
    if (from && d < from) return false
    if (to && d > to) return false
    if (cameraId && i.cameraId !== Number(cameraId)) return false
    if (type && i.type !== type) return false
    return true
  })
  if (none) list = list.slice(0, 50) // no filters: most recent violations
  return clone(list.map(withCamera))
}

export async function getIncident(id) {
  await wait()
  const inc = incidents.find((i) => i.id === Number(id))
  if (failing() || !inc) throw new Error('Could not load incident clip.')
  const alert = alerts.find((a) => a.incidentId === inc.id)
  return clone({ ...withCamera(inc), alert: alert || null })
}

// ---------- recorded video (UC-07) ----------
const VIDEO_TYPES = ['mp4', 'avi', 'mov', 'mkv']

// onStep(stepIndex) is called as analysis moves through the SRS steps
export const ANALYSIS_STEPS = ['Uploading video', 'Validating file', 'Detecting workers and PPE', 'Tracking workers', 'Checking PPE rules', 'Logging incidents']

export async function analyseVideo(file, cameraId, onStep = () => {}) {
  const cam = cameras.find((c) => c.id === Number(cameraId))
  if (!cam) throw new Error('Select a camera.')
  if (!cam.requiredPpe.length) throw new Error(`${cam.name} has no PPE rules. Ask a System Admin to set them first.`)
  onStep(0)
  await wait(900)
  onStep(1)
  await wait(600)
  const ext = file.name.split('.').pop().toLowerCase()
  if (!VIDEO_TYPES.includes(ext) || file.size === 0 || /corrupt/i.test(file.name) || failing()) {
    throw new Error('Unsupported or corrupted video file.')
  }
  for (let s = 2; s < ANALYSIS_STEPS.length; s++) {
    onStep(s)
    await wait(800)
  }
  const videoId = Math.floor(rand() * 9000) + 1000
  const start = file.lastModified ? file.lastModified - 3600e3 : Date.now() - 3600e3
  const clean = /clean/i.test(file.name)
  const count = clean ? 0 : 2 + Math.floor(rand() * 5)
  const made = []
  for (let i = 0; i < count; i++) {
    const ppe = pick(cam.requiredPpe)
    const type = VIOLATIONS.find((v) => v.ppe === ppe).key
    made.push(addIncident({ cameraId: cam.id, type, ts: new Date(start + rand() * 3000e3).toISOString(), source: 'recorded', videoId }))
  }
  const durationSec = 600 + Math.floor(rand() * 2400)
  return clone({
    videoId,
    fileName: file.name,
    camera: cam,
    durationSec,
    framesAnalysed: durationSec * 15,
    workersTracked: count + 3 + Math.floor(rand() * 8),
    incidents: made.map(withCamera),
    byType: VIOLATIONS.map((v) => ({ ...v, count: made.filter((m) => m.type === v.key).length })).filter((v) => v.count),
  })
}

// ---------- cameras & rules (UC-08) ----------
export async function getCameras() {
  await wait(250)
  return clone(cameras)
}

const urlOk = (u) => /^(rtsp|rtsps|http|https):\/\/\S+$/i.test(u.trim()) || /^webcam:\d+$/i.test(u.trim())

export async function saveCamera(cam) {
  await wait()
  const errors = {}
  if (!cam.name?.trim()) errors.name = 'Enter a camera name.'
  if (!cam.streamUrl?.trim()) errors.streamUrl = 'Enter the stream URL.'
  else if (!urlOk(cam.streamUrl)) errors.streamUrl = 'Use rtsp://, http(s):// or webcam:0.'
  if (!cam.location?.trim()) errors.location = 'Enter a location.'
  if (Object.keys(errors).length) throw Object.assign(new Error('Fix the highlighted fields.'), { fields: errors })
  if (failing()) throw new Error('Configuration could not be saved. Please try again.')
  const data = { name: cam.name.trim(), streamUrl: cam.streamUrl.trim(), location: cam.location.trim(), active: cam.active ?? true }
  if (cam.id) {
    const c = cameras.find((x) => x.id === cam.id)
    Object.assign(c, data)
    return clone(c)
  }
  const c = { id: Math.max(...cameras.map((x) => x.id)) + 1, requiredPpe: [], status: 'disconnected', ...data }
  cameras.push(c)
  return clone(c)
}

export async function saveRules(cameraId, requiredPpe) {
  await wait()
  if (failing()) throw new Error('Configuration could not be saved. Please try again.')
  const c = cameras.find((x) => x.id === cameraId)
  c.requiredPpe = [...requiredPpe]
  return clone(c)
}

// ---------- users (UC-09) ----------
export async function getUsers() {
  await wait(250)
  return clone(users.map(({ password, ...u }) => u))
}

// user: { id?, name, email, role, password? (required when creating), active }
export async function saveUser(user) {
  await wait()
  const errors = {}
  if (!user.name?.trim()) errors.name = 'Enter a name.'
  if (!/^\S+@\S+\.\S+$/.test(user.email?.trim() || '')) errors.email = 'Enter a valid email.'
  if (!ROLES.some((r) => r.key === user.role)) errors.role = 'Choose a role.'
  if (!user.id && (user.password || '').length < 6) errors.password = 'Use at least 6 characters.'
  if (Object.keys(errors).length) throw Object.assign(new Error('Fix the highlighted fields.'), { fields: errors })
  const dup = users.find((u) => u.email.toLowerCase() === user.email.trim().toLowerCase() && u.id !== user.id)
  if (dup) throw Object.assign(new Error('A user with this email already exists.'), { fields: { email: 'This email is already in use.' } })
  if (failing()) throw new Error('User could not be saved. Please try again.')
  const data = { name: user.name.trim(), email: user.email.trim(), role: user.role, active: user.active ?? true }
  if (user.id) {
    const u = users.find((x) => x.id === user.id)
    Object.assign(u, data)
    if (user.password) u.password = user.password
    const { password, ...safe } = u
    return clone(safe)
  }
  const u = { id: Math.max(...users.map((x) => x.id)) + 1, password: user.password, ...data }
  users.push(u)
  const { password, ...safe } = u
  return clone(safe)
}

export async function setUserActive(id, active) {
  await wait(300)
  if (failing()) throw new Error('User could not be saved. Please try again.')
  const u = users.find((x) => x.id === id)
  u.active = active
  const { password, ...safe } = u
  return clone(safe)
}

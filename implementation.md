# SENTINEX — Implementation

AI-based industrial safety (PPE) monitoring system. This file describes how the whole system is built.
Source of truth for *what* it does: `SENTINEX_SRS_fixed.pdf`.

## Ground rules (read first)

- **Basic only.** Build exactly what the SRS says, nothing more. If a feature is not in the SRS, it does not get built.
- **No over-engineering.** No extra layers, no abstractions "for later", no design patterns for their own sake, no state libraries, no ORMs, no microservices, no caching, no queues.
- **No security extras.** No XSS hardening, CSRF, rate limiting, audit logs, refresh tokens, etc. Only what the SRS literally asks: login with hashed password + role check on each API route.
- **It only needs to work.** Short, plain code. Few files. Few dependencies.
- **Serverless on Vercel.** Frontend + API live in one repo and deploy as one Vercel project.

## Architecture

```
 CCTV / webcam ──► Detection Worker (Python, on the factory PC)
                     YOLO detect → track → PPE rule check
                     │  POST incidents / alerts / camera status
                     ▼
 Browser ◄──────► Vercel  ──  /api/* serverless functions (Node)
 (React SPA)        │
                    ├── Postgres (Neon / Vercel Postgres)   ← all records
                    └── Vercel Blob                          ← snapshots, clips, uploaded videos
```

Why a separate worker: YOLO needs Python, OpenCV, long-running streams and ideally a GPU. Vercel functions are
short-lived and stateless, so they cannot read RTSP streams or run the model. The worker is one Python script
that talks to the same API as the dashboard. Everything else is serverless.

## Parts

| Part | Tech | Where |
|---|---|---|
| Dashboard | React + Vite + react-router-dom, plain CSS | `/src` |
| API | Vercel serverless functions (Node, ESM) | `/api` |
| Database | Postgres via `@neondatabase/serverless` (raw SQL) | Neon / Vercel Postgres |
| File storage | `@vercel/blob` | Vercel Blob |
| Auth | `bcryptjs` + `jsonwebtoken` | `/api/_lib.js` |
| Detection worker | Python, `ultralytics` (YOLOv8 + built-in ByteTrack), `opencv-python`, `requests` | `/worker/worker.py` |

## Database (simplified from the SRS ERD)

The ERD's Worker, PPE and Safety Violation entities are folded into columns (track id, PPE list, violation type
string). That is enough for every SRS requirement.

```sql
create table users (
  id serial primary key,
  name text not null,
  email text unique not null,
  password_hash text not null,
  role text not null check (role in ('manager','supervisor','admin')),
  active boolean not null default true
);

create table cameras (
  id serial primary key,
  name text not null,
  stream_url text not null,
  location text not null,
  required_ppe text[] not null default '{}',   -- helmet, vest, gloves, goggles, shoes  (UC-08 rules)
  active boolean not null default true,
  status text not null default 'disconnected' -- connected | disconnected  (UC-01)
);

create table videos (                         -- UC-07 recorded uploads
  id serial primary key,
  camera_id int references cameras(id),
  file_name text not null,
  file_url text not null,
  status text not null default 'pending',     -- pending | processing | done | failed
  summary jsonb,                              -- { frames, workers, incidents, byType }
  error text,
  created_at timestamptz default now()
);

create table incidents (                      -- UC-13 log incident
  id serial primary key,
  camera_id int references cameras(id),
  video_id int references videos(id),         -- null for live
  source text not null,                       -- live | recorded
  violation_type text not null,               -- no_helmet | no_vest | no_gloves | no_goggles | no_shoes
  track_id int,                               -- worker tracking id (UC-10)
  ts timestamptz not null,                    -- video timestamp for recorded source
  snapshot_url text,
  clip_url text
);

create table alerts (                         -- UC-12 / UC-06
  id serial primary key,
  incident_id int references incidents(id),
  status text not null default 'pending',     -- pending | acknowledged
  created_at timestamptz default now(),
  acknowledged_by int references users(id),
  acknowledged_at timestamptz
);
```

## API (Vercel functions in `/api`)

One file per resource; `req.method` switch inside. `_lib.js` holds `sql`, `auth(req, roles)` and `send(res, code, body)`.
Every route except login calls `auth(req, [...allowed roles])`; it returns 401/403 otherwise.

| Route | Method | Roles | Use case |
|---|---|---|---|
| `/api/login` | POST `{email,password}` → `{token,user}` | — | UC-09 authenticate |
| `/api/dashboard` | GET → `{summary, recent, alerts}` | manager, supervisor | UC-03 |
| `/api/incidents` | GET `?from&to&camera&type` → list (no filters = latest 50) | manager, supervisor | UC-04 |
| `/api/incidents?id=` | GET → one incident with camera | manager, supervisor | UC-05 |
| `/api/alerts` | GET → pending alerts | supervisor | UC-06 |
| `/api/alerts` | PATCH `{id}` → acknowledge | supervisor | UC-06 |
| `/api/videos` | POST `{camera_id, file_name, file_url}` | supervisor | UC-07 |
| `/api/videos?id=` | GET → status + summary | supervisor | UC-07 |
| `/api/upload` | POST — `@vercel/blob` client upload token | supervisor | UC-07 |
| `/api/cameras` | GET / POST / PUT | admin (GET also manager, supervisor for filters) | UC-08 |
| `/api/users` | GET / POST / PUT (deactivate = `active:false`) | admin | UC-09 |
| `/api/worker` | POST — incidents, camera status, video results | worker key | UC-01, 02, 10–13 |

Worker calls use one shared env key `WORKER_KEY` in a header instead of a user login.

Validation is plain `if` checks that return 400 with a message (missing fields, bad email, duplicate email → 409,
bad role, unsupported file). Error messages match the SRS text exactly, e.g.
"Configuration could not be saved. Please try again."

## Detection worker (`/worker/worker.py`)

One script, one loop per camera (a thread each):

1. `GET /api/worker?cameras` → active cameras with their `required_ppe`. No rules → skip check and log (UC-11 exception).
2. Open `stream_url` with OpenCV. Stream lost → POST status `disconnected`, retry every 5 s, POST `connected` when back (UC-01).
3. `model.track(frame, persist=True)` (YOLOv8 trained on SH17 / PPE data) → boxes with track ids. Ignore below confidence
   threshold. Frame failure → skip frame, print error (UC-02).
4. Associate PPE boxes to a person box if the PPE box centre is inside the person box (UC-02).
5. Missing required PPE → violation. Keep a set of `(track_id, type)` already reported; skip repeats, drop the entry when
   the track disappears (UC-10, UC-12 duplicate suppression).
6. New violation → save frame as JPEG + last ~5 s of frames as MP4, upload to Blob, POST incident. The API inserts the
   incident and, for `source=live`, an alert in one go (UC-13, UC-12).

Recorded video (UC-07): worker polls `GET /api/worker?videos=pending` every 10 s, downloads the file, validates it opens with
OpenCV (else posts `failed` → dashboard shows "Unsupported or corrupted video file."), runs steps 3–6 with
`source=recorded` and the video timestamp, no alerts, then posts `done` with the summary.

## Frontend (`/src`)

React SPA. Routing by role; nav only shows pages the role may open.

| Page | Route | Roles | Use case |
|---|---|---|---|
| Login | `/login` | all | UC-09 |
| Dashboard (summary, recent violations, live alerts + acknowledge) | `/` | manager, supervisor | UC-03, UC-06 |
| Search violations | `/incidents` | manager, supervisor | UC-04 |
| Incident detail + snapshot | `/incidents/:id` | manager, supervisor | UC-05 |
| Analyse recorded video | `/upload` | supervisor | UC-07 |
| Cameras & PPE rules | `/admin/cameras` | admin | UC-08 |
| Users | `/admin/users` | admin | UC-09 |

- Data access is in one file, `src/api.js`. Right now it uses in-memory mock data (UI phase). Later each function becomes
  a `fetch('/api/...')` call with the token header. Pages do not change.
- "Near real time" alerts (UC-06) = the dashboard polls `/api/alerts` every 5 s. No websockets.
- Pending alerts stay pending until acknowledged, so they show again on the next load.
- Incident page shows the saved snapshot as evidence (no video player in the UI).
- Recorded video analysis: upload to Blob → POST `/api/videos` → poll `/api/videos?id=` every 3 s → show summary.
- Token + user kept in `localStorage`.
- Mock phase only: add `?fail=1` to any URL to force the SRS error messages so every exception flow can be seen.
- Dev server only: `?as=admin|manager|supervisor` signs in a demo user (for screenshots). Not in production builds.
- Responsive: desktop rail; under 900 px a top bar + bottom tab bar; tables become stacked cards on phones.

## Environment variables (Vercel)

`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `JWT_SECRET`, `WORKER_KEY`. Worker uses `API_URL` + `WORKER_KEY`.

## Implementation plan

### Phase 1 — UI with mock data ✅ (done)

`src/` React pages for every use case, `src/api.js` mock, responsive down to phones. Nothing else.

### Phase 2 — Serverless API (Vercel) — not started

Files to add (that is all of them):

```
schema.sql          tables above + one seed admin (password hashed with bcryptjs, run once in Neon console)
api/_lib.js         sql (neon), send(res, code, body), auth(req, roles), workerAuth(req)
api/login.js        UC-09
api/dashboard.js    UC-03
api/incidents.js    UC-04, UC-05
api/alerts.js       UC-06
api/videos.js       UC-07
api/upload.js       UC-07 (Blob client-upload token)
api/cameras.js      UC-08
api/users.js        UC-09
api/worker.js       UC-01, 02, 10–13 (called by the Python worker)
```

Dependencies: `@neondatabase/serverless`, `@vercel/blob`, `bcryptjs`, `jsonwebtoken`. Nothing else.

`_lib.js` (about 30 lines):
- `auth(req, roles)`: read `Authorization: Bearer <jwt>`, `jwt.verify` with `JWT_SECRET`, check `roles.includes(user.role)`,
  return the user or `null` (route then sends 401/403).
- `workerAuth(req)`: `req.headers['x-worker-key'] === process.env.WORKER_KEY`.
- JSON keys are camelCase so the UI shape stays the same as the mock (`streamUrl`, `requiredPpe`, `cameraId`, `trackId`, `ts`,
  `snapshotUrl`, `createdAt`). Convert in SQL with `as "streamUrl"`, no mapper library.

Each route, what it does (plain SQL):

| Route | SQL / logic | Errors (exact text to UI) |
|---|---|---|
| POST `/api/login` | select user by email; `bcrypt.compare`; inactive → 403; return `{ token, user }` (token 12 h) | "Incorrect email or password." / "This account is deactivated. Contact your System Admin." |
| GET `/api/dashboard` | counts today / 7 days, count by type, count by camera, latest 8 incidents join cameras, pending alerts join incidents + cameras | "Could not load dashboard. Please try again." |
| GET `/api/incidents` | `where ts::date >= $from and ts::date <= $to and camera_id = $c and violation_type = $t` (each only if given), `order by ts desc limit 50` when no filters, else `limit 500` | "Could not load incidents. Please try again." |
| GET `/api/incidents?id=` | one incident join camera, plus its alert row | "Could not load incident clip." |
| GET `/api/alerts` | pending alerts join incidents + cameras, newest first | — |
| PATCH `/api/alerts` `{id}` | `update alerts set status='acknowledged', acknowledged_by=$user, acknowledged_at=now()` | "Could not acknowledge alert. Please try again." |
| POST `/api/upload` | `handleUpload` from `@vercel/blob/client`; allow only `video/*`, max 500 MB | — |
| POST `/api/videos` `{cameraId, fileName, fileUrl}` | camera must have rules (else 400 "<camera> has no PPE rules…"); extension in mp4/avi/mov/mkv (else 400 "Unsupported or corrupted video file."); insert `status='pending'`; return id | as left |
| GET `/api/videos?id=` | `{ status, summary, error }`; summary includes incident list | `failed` → "Unsupported or corrupted video file." |
| GET/POST/PUT `/api/cameras` | list; insert/update name, stream_url, location, active; PUT `{id, requiredPpe}` updates rules | field errors 400; DB error → "Configuration could not be saved. Please try again." |
| GET/POST/PUT `/api/users` | list (no hashes); insert with `bcrypt.hash(pw, 10)`; update (hash only if new password); PUT `{id, active}` = deactivate/reactivate | duplicate email 409 "A user with this email already exists."; DB error → "User could not be saved. Please try again." |
| GET `/api/worker?cameras=1` | active cameras with `required_ppe` | — |
| GET `/api/worker?videos=pending` | oldest pending video → set `processing`, return it | — |
| POST `/api/worker` `{type:'status', cameraId, status}` | update cameras.status | — |
| POST `/api/worker` `{type:'incident', ...}` | insert incident; if `source='live'` insert alert (pending); return incident id | — |
| POST `/api/worker` `{type:'video', id, status, summary, error}` | update videos row | — |

Then replace the mock in `src/api.js` function by function (same names, same return shapes, pages untouched):

| `src/api.js` function | becomes |
|---|---|
| `login` | POST `/api/login`, store token |
| `getDashboard` | GET `/api/dashboard` |
| `getAlerts`, `acknowledgeAlert` | GET / PATCH `/api/alerts` |
| `searchIncidents`, `getIncident` | GET `/api/incidents` |
| `analyseVideo` | `upload()` from `@vercel/blob/client` → POST `/api/videos` → poll GET `/api/videos?id=` every 3 s, call `onStep` from the status |
| `getCameras`, `saveCamera`, `saveRules` | `/api/cameras` |
| `getUsers`, `saveUser`, `setUserActive` | `/api/users` |

A 10-line `call(path, opts)` helper adds the token header and throws `new Error(body.error)` (plus `fields`) on non-200.
Delete the seed data, `simulateLive`, `?fail=1` and the dev `?as=` shortcut when this is done.

### Phase 3 — Detection worker — not started

`worker/worker.py` + `worker/requirements.txt` (`ultralytics`, `opencv-python`, `requests`). Runs on the factory PC.
Steps are in "Detection worker" above. Snapshots: `cv2.imencode('.jpg')` → upload with a Blob token from the API → send
`snapshotUrl` in the incident POST. Run: `python worker.py` with `API_URL` and `WORKER_KEY` set.

### Phase 4 — Deploy

1. Create a Neon (or Vercel Postgres) database, run `schema.sql`.
2. Create a Vercel Blob store.
3. Import the repo in Vercel, framework Vite (build `vite build`, output `dist`). `vercel.json` already rewrites routes to the SPA.
4. Set env vars `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `JWT_SECRET`, `WORKER_KEY`.
5. Start the worker on the factory PC pointing at the Vercel URL.

### Done when (one check per use case)

| UC | Check |
|---|---|
| 01 | Unplug a camera → shows Disconnected; plug back → Connected |
| 02 / 10 / 11 | Walk in front of a camera without a helmet → one incident with a snapshot and track id |
| 12 | Same worker keeps going without a helmet → still one alert |
| 03 | Dashboard shows the counts, recent violations and the alert |
| 06 | Alert appears within ~5 s; Acknowledge removes it; reload keeps acknowledged ones gone |
| 04 | Filter by date / camera / type; nonsense range → "No incidents found" |
| 05 | Open an incident → details + snapshot |
| 07 / 13 | Upload a recording → summary; its incidents appear in search; no alerts; a .txt renamed .mp4 → "Unsupported or corrupted video file." |
| 08 | Add / edit a camera, missing fields rejected, change PPE rules |
| 09 | Create / edit / deactivate users; duplicate email rejected; deactivated user cannot sign in; each role sees only its pages |

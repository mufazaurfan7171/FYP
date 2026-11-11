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
| Incident detail + clip / snapshot | `/incidents/:id` | manager, supervisor | UC-05 |
| Analyse recorded video | `/upload` | supervisor | UC-07 |
| Cameras & PPE rules | `/admin/cameras` | admin | UC-08 |
| Users | `/admin/users` | admin | UC-09 |

- Data access is in one file, `src/api.js`. Right now it uses in-memory mock data (UI phase). Later each function becomes
  a `fetch('/api/...')` call with the token header. Pages do not change.
- "Near real time" alerts (UC-06) = the dashboard polls `/api/alerts` every 5 s. No websockets.
- Pending alerts stay pending until acknowledged, so they show again on the next load.
- Recorded video analysis: upload to Blob → POST `/api/videos` → poll `/api/videos?id=` every 3 s → show summary.
- Token + user kept in `localStorage`.
- Mock phase only: add `?fail=1` to any URL to force the SRS error messages so every exception flow can be seen.

## Environment variables (Vercel)

`DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `JWT_SECRET`, `WORKER_KEY`. Worker uses `API_URL` + `WORKER_KEY`.

## Build order

1. **UI with mock data** ← current phase.
2. `/api` functions + `schema.sql` + seed admin user; swap `src/api.js` to `fetch`.
3. `worker/worker.py`.
4. Deploy: push repo, import in Vercel (framework: Vite), set env vars, run `schema.sql` once.

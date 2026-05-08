# FaceGuard — AI-Powered Attendance System

An AI-powered, face-recognition attendance system built for ENSIA. Teachers open a session, point a webcam at students, and the system recognises faces in real time, marks attendance automatically, and flags spoofing attempts — all stored in a cloud database with full audit trails.

---

## Tech Stack

| Layer        | Technology                                                      |
| ------------ | --------------------------------------------------------------- |
| Frontend     | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui         |
| State / data | TanStack Query (react-query) + React Router v6                  |
| Charts       | Recharts                                                        |
| Auth & DB    | Supabase (Postgres + pgvector + RLS + Auth)                     |
| AI backend   | Python FastAPI + InsightFace `buffalo_l` + OpenCV               |
| Liveness     | ONNX slot (heuristic fallback: sharpness · saturation · motion) |
| Tests        | Vitest (frontend) + pytest (backend) + GitHub Actions CI        |

---

## Features

### Auth & Roles

- Sign-up restricted to `@ensia.edu.dz` emails — enforced at the DB trigger level
- Email OTP verification required before any DB row is created
- Three roles: **admin**, **lecturer**, **teacher** — chosen at sign-up, enforced by Row-Level Security on every table
- First user automatically becomes admin

### Dashboard

- 11 live widgets: attendance rate, active modules, sessions today, spoof alerts, weekly trend chart, per-module breakdown, attendance heatmap, student ranking, today's schedule, live session card, system health badge
- Admins see all data; lecturers/teachers see only their own modules

### Student Management

- Register students with webcam — photo saved + 512-d face embedding stored in pgvector
- Bulk CSV import with preview, validation, and error reporting
- Student profile: photo/avatar, group badges, attendance stats, weekly trend chart, full session history

### Modules & Groups

- Create modules with academic year and assigned lecturer
- Assign groups to modules with a specific teacher per group

### Live Attendance

- Select a session → camera opens → faces recognised at ~1 fps
- Each match shows full name + matricule + confidence % — clickable link to student profile
- Anti-spoofing heuristic on every frame; spoof attempts logged separately
- Manual override available in session detail with full audit trail

### History & Reports

- Attendance history with module/group filters — CSV export
- Spoof log with CSV export
- Audit log — every manual status change recorded with actor, timestamp, before/after

---

## Project Structure

```
CNS_C1/
├── frontend/          # React + TypeScript SPA
│   └── src/
│       ├── pages/     # One file per route
│       ├── components/# DashboardLayout, CameraFeed, dashboard widgets
│       ├── lib/       # mock-data.ts (Supabase queries), api.ts (FastAPI client), csv.ts
│       ├── hooks/     # useAuth
│       └── types/     # db.ts — all TypeScript types
├── backend/           # FastAPI app
│   ├── routes/        # health.py · embed.py · recognize.py
│   └── services/      # face_service · anti_spoofing · db_service · auth
├── ai/
│   └── anti_spoofing/ # model.onnx goes here (see P7)
└── supabase/          # SQL migrations
```

---

## Database Schema

```
teachers           (id, full_name, email UNIQUE, role, auth_user_id, created_at)
groups             (id, group_name, year, created_at)
modules            (id, name, module_code, academic_year, lecturer_id, created_at)
module_groups      (module_id, group_id, assigned_teacher_id)  PK(module_id, group_id)
students           (id, student_number UNIQUE, full_name, photo_url, created_at)
student_groups     (student_id, group_id)  PK(student_id, group_id)
student_embeddings (id, student_id, embedding vector(512), captured_at)
                   + HNSW index (vector_cosine_ops)
sessions           (id, module_id, group_id, session_date, start_time, type, week, created_at)
attendance         (id, session_id, student_id, status, confidence, marked_at, updated_at)
audit_log          (id, at, actor_id, session_id, student_id, prev_status, new_status)
```

RPC: `match_student_embedding(q vector(512), g uuid, k int)` — pgvector kNN restricted to a group.

Row-Level Security is enabled on all 10 tables. Helper functions: `current_teacher_id()`, `current_user_role()`, `is_admin()`, `can_see_module(uuid)`.

---

## Data Flow

```
Browser ──→ Supabase Auth (JWT)
Browser ──→ Supabase Postgres (anon key, RLS-gated)
Browser ──→ FastAPI /embed /recognize (Bearer JWT)
              └──→ InsightFace (embedding / recognition)
              └──→ Supabase Postgres (service-role, bypasses RLS)
```

---

## Running Locally

### Prerequisites

- Node.js 18+
- Python 3.10+
- A Supabase project with the schema applied (see `supabase/` folder)

### Frontend

```bash
cd frontend
cp .env.example .env          # fill in your Supabase URL + publishable key
npm install
npm run dev                   # → http://localhost:5173
```

### Backend

```bash
cd backend
cp .env.example .env          # fill in Supabase URL + service key
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
python scripts/warmup.py      # first run only — downloads InsightFace model (~280 MB)
uvicorn app:app --reload      # → http://localhost:8000
```

### Environment variables

**`frontend/.env`**

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_FASTAPI_URL=http://localhost:8000
```

**`backend/.env`**

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
DB_SCHEMA=public
MOCK_AI=false
FACE_THRESHOLD=0.5
SPOOF_THRESHOLD=0.70
ALLOWED_ORIGINS=http://localhost:5173
```

---

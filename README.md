# Election Field Monitoring Platform

Real-time field-officer and polling-unit monitoring for Oyo State: officers
check in, report incidents, and submit results from the field; the party
dashboard sees it all live on a map.

- `backend/` — Go API (clean architecture) + MongoDB + WebSocket hub
- `frontend/` — Next.js (App Router) dashboard + field-officer PWA

## Prerequisites

- Go 1.26+
- Node 20+
- Docker (for MongoDB)
- A Cloudflare R2 bucket (S3-compatible) with a public dev URL enabled —
  used for incident/result photo & video evidence

## Local development

1. Start MongoDB:
   ```
   docker compose up -d mongo
   ```
   (Port is remapped to 27018 to avoid clashing with other local projects
   — see `docker-compose.yml`.)

2. Run the API:
   ```
   cd backend
   cp .env.example .env   # then fill in R2_* with your bucket's credentials
   go run ./cmd/api
   ```
   Listens on `:8081` by default. On startup it configures CORS on the R2
   bucket so browsers can upload directly to it via presigned URLs.

3. Seed real Oyo State polling-unit data (pulled from the public
   `election.yardcode.ng` API by sweeping a coordinate grid):
   ```
   cd backend
   go run ./cmd/seed --step-km 4 --top 20
   ```
   Start with a larger `--step-km` (coarser/faster) for local dev; lower it
   to densify coverage.

4. Bootstrap an admin user (no self-registration by design — see
   `internal/usecase/auth`): insert a `users` document with
   `role: "admin"` and a bcrypt `password_hash` directly into Mongo, or
   extend the seed tooling to do this for you.

5. Run the frontend:
   ```
   cd frontend
   npm install
   npm run dev
   ```
   Runs on `:3000`, talks to the API at `:8081`.

## Architecture

See the plan at build time for the full breakdown: clean-architecture Go
backend (`domain` → `usecase` → `repository`/`delivery`), with a
`Broadcaster` interface decoupling business logic from the WebSocket
transport. Frontend is feature-organized under `src/app/(dashboard)` for
the party view and `src/app/(field)` for the officer PWA, sharing a single
REST + WebSocket client layer in `src/lib`.

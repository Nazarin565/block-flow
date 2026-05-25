# BlockFlow — Implementation Guide

This file is the step-by-step build guide derived from [PLAN.md](./PLAN.md).
Each step lists exactly which files to create, what they contain, and what
"done" looks like before moving on.

Implementation order:

1. [Step 0 — Repo & tooling baseline](#step-0--repo--tooling-baseline)
2. [Step 1 — Backend scaffolding (Express + TS)](#step-1--backend-scaffolding-express--ts)
3. [Step 2 — Database layer (SQLite)](#step-2--database-layer-sqlite)
4. [Step 3 — Job types, repo, events](#step-3--job-types-repo-events)
5. [Step 4 — Pipeline (3 extensible steps)](#step-4--pipeline-3-extensible-steps)
6. [Step 5 — Job runner](#step-5--job-runner)
7. [Step 6 — REST API (POST/GET /jobs)](#step-6--rest-api-postget-jobs)
8. [Step 7 — WebSocket server](#step-7--websocket-server)
9. [Step 8 — Backend smoke tests](#step-8--backend-smoke-tests)
10. [Step 9 — Frontend scaffolding (Vite + React + TS)](#step-9--frontend-scaffolding-vite--react--ts)
11. [Step 10 — Shared UI components](#step-10--shared-ui-components)
12. [Step 11 — Wizard state & shell](#step-11--wizard-state--shell)
13. [Step 12 — Screens 1–3 (onboarding)](#step-12--screens-13-onboarding)
14. [Step 13 — API client (HTTP + WS)](#step-13--api-client-http--ws)
15. [Step 14 — Screen 4 (processing, both modes, reset)](#step-14--screen-4-processing-both-modes-reset)
16. [Step 15 — README & flow diagram](#step-15--readme--flow-diagram)
17. [Step 16 — Deploy backend (Render)](#step-16--deploy-backend-render)
18. [Step 17 — Deploy frontend (Firebase Hosting)](#step-17--deploy-frontend-firebase-hosting)
19. [Step 18 — End-to-end verification](#step-18--end-to-end-verification)

---

## Step 0 — Repo & tooling baseline

**Goal:** clean monorepo skeleton, ready to host `client/` and `server/`.

**Files to create/modify in repo root:**

- `.gitignore` — ignore `node_modules`, `dist`, `.env*` (except `.env.example`),
  `*.sqlite`, `.firebase/`, `firebase-debug.log`, `.DS_Store`.
- `.editorconfig` — 2-space indent, LF, UTF-8 (optional but cheap consistency).
- `docs/` — already exists with `PLAN.md` and this file.
- `client/` — empty folder (created in Step 9).
- `server/` — empty folder (created in Step 1).

**Done when:**
- `git status` is clean except for the new ignore/config files.
- Repo root contains `README.md` (placeholder for now), `docs/`, `.gitignore`.

---

## Step 1 — Backend scaffolding (Express + TS)

**Goal:** an Express server in TypeScript that boots, responds with
`{ ok: true }` on `GET /health`, reads config from env, and runs via `tsx` in
dev.

**Create `server/package.json`:**
- `name`: `blockflow-server`
- `type`: `module` (ESM)
- `scripts`:
  - `dev`: `tsx watch src/index.ts`
  - `build`: `tsc -p tsconfig.json`
  - `start`: `node dist/index.js`
- `dependencies`: `express`, `cors`, `ws`, `better-sqlite3`, `nanoid`.
- `devDependencies`: `typescript`, `tsx`, `@types/node`, `@types/express`,
  `@types/cors`, `@types/ws`, `@types/better-sqlite3`.

**Create `server/tsconfig.json`:**
- `target`: `ES2022`, `module`: `ES2022`, `moduleResolution`: `bundler`.
- `rootDir`: `src`, `outDir`: `dist`.
- `strict`: `true`, `esModuleInterop`: `true`, `skipLibCheck`: `true`,
  `resolveJsonModule`: `true`.

**Create `server/src/config.ts`:**
- Reads `PORT` (default `3000`), `DATABASE_PATH` (default `./data.sqlite`),
  `CORS_ORIGIN` (default `*` in dev, set explicitly in prod).
- Exports a frozen `config` object.

**Create `server/src/index.ts`:**
- Creates `express()` app, applies `cors({ origin: config.CORS_ORIGIN })` and
  `express.json()`.
- Mounts `GET /health` returning `{ ok: true }`.
- Creates `http.createServer(app)` (so the WS server can attach in Step 7).
- Listens on `config.PORT`; logs the URL.

**Done when:**
- `cd server && npm i && npm run dev` boots and `curl localhost:3000/health`
  returns `{"ok":true}`.

---

## Step 2 — Database layer (SQLite)

**Goal:** SQLite file initialised on boot with the `jobs` table; a singleton
`db` instance importable everywhere.

**Create `server/src/db/schema.sql`:**
```sql
CREATE TABLE IF NOT EXISTS jobs (
  id         TEXT PRIMARY KEY,
  status     TEXT NOT NULL CHECK (status IN ('queued','processing','done','failed')),
  progress   INTEGER NOT NULL DEFAULT 0,
  result     TEXT,
  createdAt  INTEGER NOT NULL
);
```

**Create `server/src/db/client.ts`:**
- Imports `better-sqlite3`, opens `new Database(config.DATABASE_PATH)`.
- Sets pragmas: `journal_mode = WAL`, `foreign_keys = ON`.
- Reads `schema.sql` synchronously (`fs.readFileSync`) and runs `db.exec(...)`
  to initialise tables idempotently.
- Exports the `db` instance as default.

**Wire-up:** `server/src/index.ts` imports `./db/client.js` near the top so DB
init happens before routes are mounted.

**Done when:**
- Booting the server creates `data.sqlite` (and `-wal`/`-shm` siblings).
- `sqlite3 data.sqlite ".schema jobs"` shows the table.

---

## Step 3 — Job types, repo, events

**Goal:** typed Job model, sync CRUD helpers, and a process-wide event bus.

**Create `server/src/jobs/types.ts`:**
- `export type JobStatus = 'queued' | 'processing' | 'done' | 'failed'`.
- `export interface Job { id: string; status: JobStatus; progress: number; result: unknown | null; createdAt: number; }`.
- `export type WsClientMessage = { type: 'subscribe'; jobId: string }`.
- `export type WsServerMessage =`
  - `| { type: 'snapshot'; job: Job }`
  - `| { type: 'status'; jobId: string; status: JobStatus }`
  - `| { type: 'progress'; jobId: string; progress: number }`
  - `| { type: 'done'; jobId: string; result: unknown }`
  - `| { type: 'error'; message: string }`.

**Create `server/src/jobs/repo.ts`:**
- Prepares statements once at module load: `INSERT`, `SELECT BY ID`,
  `UPDATE status/progress/result`.
- Exports:
  - `createJob(): Job` — generates `nanoid()` id, inserts row with
    `status='queued'`, `progress=0`, `createdAt=Date.now()`, returns the Job.
  - `getJob(id: string): Job | null` — parses `result` JSON if not null.
  - `updateJob(id, patch: Partial<Pick<Job,'status'|'progress'|'result'>>)` —
    JSON-stringifies `result` if provided; returns the updated Job.

**Create `server/src/jobs/events.ts`:**
- `import { EventEmitter } from 'node:events'`.
- Exports a singleton `jobEvents = new EventEmitter()` (set `setMaxListeners(0)`
  to silence warnings as WS clients come and go).
- Events emitted (keyed by jobId): `'status'`, `'progress'`, `'done'`,
  `'failed'` — payload matches the WS message variants.

**Done when:**
- A throwaway script can `import { createJob, updateJob, getJob } from './jobs/repo'`
  and round-trip data through SQLite.

---

## Step 4 — Pipeline (3 extensible steps)

**Goal:** an array of pipeline steps. Each step is a separate module; adding a
new one is "create file + push into the array".

**Create `server/src/pipeline/types.ts`:**
- `export interface PipelineCtx { jobId: string; }`.
- `export type PipelineStep = { name: string; run: (ctx: PipelineCtx) => Promise<void> }`.

**Create `server/src/pipeline/step1-prepare.ts`:**
- Default exports a `PipelineStep` named `'prepare'` whose `run` `await`s a
  helper `delay(1500)` (define `delay` inline or in a tiny `util/delay.ts`).

**Create `server/src/pipeline/step2-process.ts`:**
- Same shape, `name: 'process'`, delay 2000 ms.

**Create `server/src/pipeline/step3-finalize.ts`:**
- Same shape, `name: 'finalize'`, delay 1500 ms.

**Create `server/src/pipeline/index.ts`:**
- Imports the three steps and exports `export const STEPS: PipelineStep[] = [step1, step2, step3]`.
- Document at top of file: "to add a step, import it and push it into this
  array — no other code changes required".

**Done when:**
- `STEPS.length === 3` and steps can be `await`-ed sequentially in a smoke
  script.

---

## Step 5 — Job runner

**Goal:** given a `jobId`, run all pipeline steps sequentially, updating DB +
emitting events at every state transition.

**Create `server/src/jobs/runner.ts`:**
- Function `runJob(jobId: string): Promise<void>`:
  1. `updateJob(jobId, { status: 'processing', progress: 0 })`.
  2. Emit `jobEvents.emit('status', { jobId, status: 'processing' })` and
     `jobEvents.emit('progress', { jobId, progress: 0 })`.
  3. Iterate `STEPS` with index `i`:
     - `await step.run({ jobId })`.
     - Compute `progress = Math.round(((i + 1) / STEPS.length) * 100)`.
     - `updateJob(jobId, { progress })`.
     - `jobEvents.emit('progress', { jobId, progress })`.
  4. Build mock result, e.g. `{ message: 'Your plan is ready', rating: 5 }`.
  5. `updateJob(jobId, { status: 'done', result })`.
  6. Emit `'status'` (`done`) and `'done'` events.
  - On thrown error: catch, `updateJob(jobId, { status: 'failed' })`, emit
    `'status'` (`failed`) and `'failed'` with message.
- Export `enqueueJob(jobId)` — fires `runJob` without `await`-ing
  (`void runJob(jobId).catch(err => console.error(err))`) so the HTTP request
  can return immediately.

**Done when:**
- Calling `enqueueJob` flips a row through `queued → processing → done` in DB
  over ~5s with progress hitting 100.

---

## Step 6 — REST API (POST/GET /jobs)

**Goal:** the two routes from the spec.

**Create `server/src/routes/jobs.ts`:**
- Exports an Express `Router`.
- `POST /jobs`:
  - `const job = createJob()`.
  - `enqueueJob(job.id)`.
  - Respond `201` with `{ id: job.id }`.
- `GET /jobs/:id`:
  - `const job = getJob(req.params.id)`.
  - If `null` → `404 { error: 'not_found' }`.
  - Else → `200 job`.

**Wire-up in `server/src/index.ts`:**
- `import jobsRouter from './routes/jobs.js'` and `app.use('/jobs', jobsRouter)`.
- Add a final error-handler middleware that logs and responds
  `500 { error: 'internal' }`.

**Done when:**
- `curl -X POST localhost:3000/jobs` → `{ "id": "..." }`.
- Polling `GET /jobs/:id` shows the lifecycle.

---

## Step 7 — WebSocket server

**Goal:** clients subscribe by `jobId` and receive live updates.

**Create `server/src/ws/server.ts`:**
- Exports `attachWsServer(httpServer)`:
  - `new WebSocketServer({ server: httpServer })`.
  - On `connection`:
    - Track `let subscribedJobId: string | null = null` and the listener
      references so they can be removed on close.
    - On `message`:
      - Parse JSON; validate shape (`type === 'subscribe'`, `jobId: string`).
      - On invalid → send `{ type:'error', message:'invalid_message' }` and
        return.
      - If already subscribed → ignore (one subscription per connection).
      - Look up job via `getJob(jobId)`; if missing → send `error`
        `'job_not_found'` and `ws.close()`.
      - Send `{ type:'snapshot', job }`.
      - Register listeners on `jobEvents` for `'status'`, `'progress'`,
        `'done'`, `'failed'` that filter by `jobId` and forward the
        corresponding `WsServerMessage`.
      - On `'done'` or `'failed'` → close the socket after sending.
    - On `close` → remove all listeners.

**Wire-up in `server/src/index.ts`:**
- After creating `httpServer`, call `attachWsServer(httpServer)` before
  `httpServer.listen(...)`.

**Done when:**
- `wscat -c ws://localhost:3000` then sending
  `{"type":"subscribe","jobId":"<id from POST>"}` streams `snapshot` →
  `progress` frames → `done`.

---

## Step 8 — Backend smoke tests

**Goal:** verify the backend end-to-end before touching the frontend.

**Manual checks:**
1. `npm run dev` in `server/`.
2. `POST /jobs` returns `{ id }`. Within ~5s, `GET /jobs/:id` reports
   `status: 'done'`, `progress: 100`, populated `result`.
3. WS subscription delivers `snapshot` then ≥3 `progress` frames culminating
   in `done`.
4. WS with an invalid `jobId` receives `error: 'job_not_found'` and closes.
5. Server restart preserves jobs (SQLite on disk).

**Done when:** all five checks pass. Snapshot the curl/wscat output into the
PR description if useful.

---

## Step 9 — Frontend scaffolding (Vite + React + TS)

**Goal:** Vite app boots, renders "Hello", reads API/WS URLs from env.

**Create `client/` via `npm create vite@latest client -- --template react-ts`**
(or manually mirror the same structure).

**Edit `client/package.json`:**
- Confirm scripts: `dev`, `build`, `preview`.
- No extra runtime deps beyond `react`, `react-dom` (UI is hand-rolled).

**Create `client/.env.development`:**
```
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

**Create `client/.env.production`:**
```
VITE_API_BASE_URL=https://<render-url>
VITE_WS_URL=wss://<render-url>
```
(Real URLs filled in during Step 16.)

**Replace `client/src/App.tsx`** with a placeholder that renders `<h1>BlockFlow</h1>`.

**Done when:**
- `cd client && npm i && npm run dev` serves the placeholder at
  `http://localhost:5173`.

---

## Step 10 — Shared UI components

**Goal:** the small set of presentational components reused across screens.
Plain CSS Modules (`*.module.css`) per component — no UI framework.

Create under `client/src/components/`:

- **`Header.tsx`** — top bar with the app name; no navigation logic.
- **`Button.tsx`** — `{ children, onClick, disabled, variant?: 'primary'|'secondary' }`.
- **`SelectCard.tsx`** — `{ label, selected, onSelect }`; renders a row with a
  radio-like indicator. Single-select is managed by the parent.
- **`SegmentedControl.tsx`** — `{ options: string[], value, onChange }`.
- **`NumberInput.tsx`** — controlled input; accepts digits + one dot; emits
  `(value: string, isValid: boolean)` where `isValid` is `parseFloat(value) > 0`.
- **`ProgressBar.tsx`** — two modes:
  - `{ mode: 'determinate', value: number }` — width = `value%`, shows `${value}%`.
  - `{ mode: 'indeterminate' }` — CSS keyframe animation, no label.

**Done when:** each component renders in isolation (you can drop them into
`App.tsx` to eyeball them).

---

## Step 11 — Wizard state & shell

**Goal:** single source of truth for the onboarding flow.

**Create `client/src/state/onboarding.ts`:**
- `type WishId = string`.
- `type WeightUnit = 'kg' | 'lbs'`.
- `interface OnboardingState { step: 1|2|3|4; wish: WishId | null; weight: { value: string; unit: WeightUnit } | null; goal: { value: string; unit: WeightUnit } | null; }`.
- Exports a `useOnboarding()` hook returning state + actions:
  `setWish`, `setWeight`, `setGoal`, `next`, `back`, `reset`.
- Implementation: `useState` + setter functions; no external store needed.

**Update `client/src/App.tsx`:**
- Renders `<Header />` and switches on `state.step` to mount one of
  `Step1Wish | Step2Weight | Step3Goal | Step4Processing` from Step 12 / 14.

**Done when:** stepping through (with temporary buttons) advances/resets
state correctly.

---

## Step 12 — Screens 1–3 (onboarding)

Create under `client/src/screens/`:

**`Step1Wish.tsx`:**
- Local const `WISHES: { id: string; label: string }[]` with 5 entries.
- Renders title "What is your main wish?" and 5 `<SelectCard />`s wired to
  `state.wish` via `useOnboarding`.
- Continue `<Button />` calls `next()`; disabled while `wish === null`.

**`Step2Weight.tsx`:**
- Title "What is your weight?".
- `<SegmentedControl options={['kg','lbs']} />` for `state.weight.unit`.
- `<NumberInput />` for the value.
- Continue disabled until `isValid`.

**`Step3Goal.tsx`:**
- Identical to Step 2 but title "What is your goal weight?" and writes to
  `state.goal`.

**Done when:** the user can move 1 → 2 → 3 → 4, with Continue gated correctly
on each step.

---

## Step 13 — API client (HTTP + WS)

**Goal:** thin wrappers around `fetch` and `WebSocket`.

**Create `client/src/api/types.ts`:**
- Mirror the server `Job`, `JobStatus`, `WsServerMessage`, `WsClientMessage`
  definitions. Keep them in sync by hand (small surface).

**Create `client/src/api/http.ts`:**
- `const BASE = import.meta.env.VITE_API_BASE_URL`.
- `createJob(): Promise<{ id: string }>` — `POST ${BASE}/jobs`.
- `getJob(id): Promise<Job>` — `GET ${BASE}/jobs/:id`; throws on non-200.
- `pollJob(id, { intervalMs = 1000, signal }): AsyncGenerator<Job>` — `while
  (!signal?.aborted) { yield await getJob(id); if (job.status === 'done' ||
  'failed') return; await delay(intervalMs); }`.

**Create `client/src/api/ws.ts`:**
- `subscribeJob(id, onMessage: (msg: WsServerMessage) => void): () => void`:
  - Opens `new WebSocket(${import.meta.env.VITE_WS_URL})`.
  - On `open` → `ws.send(JSON.stringify({ type:'subscribe', jobId: id }))`.
  - On `message` → `onMessage(JSON.parse(event.data))`.
  - Returns a teardown that closes the socket.

**Done when:** importing these from the browser console (or a tiny temporary
button) exercises the backend successfully.

---

## Step 14 — Screen 4 (processing, both modes, reset)

**Create `client/src/screens/Step4Processing.tsx`:**

Local UI state (via `useReducer` or `useState`):
- `mode: 'idle' | 'ws' | 'http'`.
- `progress: number` (0–100).
- `status: JobStatus | null`.
- `result: unknown | null`.

**Idle state:** two `<Button />`s — "Run via WebSocket" and "Run via HTTP".

**On "Run via WebSocket":**
1. `setMode('ws')`, reset progress/result.
2. `const { id } = await createJob()`.
3. `const unsub = subscribeJob(id, msg => { ... })`:
   - On `snapshot` → set `status`/`progress` from `msg.job`.
   - On `progress` → set `progress`.
   - On `status` → set `status`.
   - On `done` → set `result`, `status='done'`.
   - On `error` / socket close → set `status='failed'`.
4. Store `unsub` in a ref; call on unmount or on Reset.

**On "Run via HTTP":**
1. `setMode('http')`, reset state.
2. `const { id } = await createJob()`.
3. Create `AbortController`; for-await over `pollJob(id, { signal })`:
   - Update `status` (keep progress hidden — bar is indeterminate).
   - On `done` → set `result`, `status='done'`, break loop.

**Render:**
- Mode `'ws'` and not done → `<ProgressBar mode="determinate" value={progress} />`.
- Mode `'http'` and not done → `<ProgressBar mode="indeterminate" />`.
- `status === 'done'` → render mock result card + `<Button>Reset</Button>` that
  calls `reset()` from `useOnboarding` (which sets `step=1` and clears state)
  and locally resets `mode/progress/result/status`.

**Cleanup:** `useEffect` return tears down WS subscription / aborts polling
on unmount.

**Done when:**
- WS button shows live `%` filling to 100, then the result card + Reset.
- HTTP button shows an indeterminate bar, then result card + Reset.
- Reset returns the user to Step 1 with empty wizard state.

---

## Step 15 — README & flow diagram

**Create `docs/flow-diagram.md`:**
- The Mermaid sequence diagram from [PLAN.md § Part 0](./PLAN.md#high-level-flow-mermaid).

**Replace root `README.md`:**
- Project summary (2–3 lines).
- **Live links:** Firebase frontend URL, Render backend URL, GitHub repo.
- **Part 0:** the two user scenarios (copy from PLAN) + the Mermaid diagram.
- **Architecture decisions:** monorepo rationale, SQLite rationale (copy from
  PLAN), how the pipeline is extensible.
- **Local development:**
  ```
  cd server && npm i && npm run dev   # http://localhost:3000
  cd client && npm i && npm run dev   # http://localhost:5173
  ```
- **Switching API endpoints:** `client/.env.development` vs `.env.production`.
- **Project layout:** quick tree of `client/` and `server/`.

**Done when:** a reviewer who has never seen the repo can run it locally and
understand the design from the README alone.

---

## Step 16 — Deploy backend (Render)

1. Push the repo to GitHub.
2. Render dashboard → **New → Web Service** → connect the GitHub repo.
3. Settings:
   - **Root Directory:** `server`.
   - **Build Command:** `npm install && npm run build`.
   - **Start Command:** `node dist/index.js`.
   - **Environment:** Node.
   - **Disk:** add a small persistent disk mounted at `/data`.
   - **Environment variables:**
     - `DATABASE_PATH=/data/data.sqlite`.
     - `CORS_ORIGIN=https://<firebase-app>.web.app` (filled after Step 17;
       initially `*` is OK).
     - `PORT` is set automatically by Render.
4. Deploy and verify `https://<render-url>/health` returns `{ ok: true }`.
5. Verify `POST /jobs` and `wss://<render-url>` work against the deployed
   instance (`wscat -c wss://<render-url>`).

**Done when:** backend smoke checks (Step 8) pass against the deployed URL.

---

## Step 17 — Deploy frontend (Firebase Hosting)

1. Update `client/.env.production` with the Render URL from Step 16.
2. `cd client && npm run build` → confirm `dist/` is produced.
3. From repo root: `firebase login` → `firebase init hosting`:
   - Existing project (or create one).
   - **Public directory:** `client/dist`.
   - **Single-page app rewrite:** Yes.
   - **GitHub Action:** optional.
4. `firebase deploy --only hosting`.
5. Note the live URL.
6. Update Render's `CORS_ORIGIN` to that URL and redeploy.

**Done when:** opening the Firebase URL in a browser walks through onboarding
and successfully runs both job modes against the Render backend.

---

## Step 18 — End-to-end verification

Run through the checklist in [PLAN.md § Verification](./PLAN.md#verification-end-to-end):

1. REST smoke against the deployed backend.
2. WS smoke against the deployed backend (`wscat -c wss://...`).
3. Frontend manual run on the deployed Firebase URL: walk all 3 onboarding
   steps; on Step 4, run both modes; confirm Reset returns to Step 1 with
   cleared state.
4. Extensibility check: add `step4-extra.ts` to `server/src/pipeline/`, push
   into `STEPS`, redeploy, run a job, confirm `progress` still ramps cleanly
   to 100 over the new step count.

**Done when:** all four checks pass against the deployed URLs and the README
links are live.

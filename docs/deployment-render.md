# Public guest portfolio deployment

## Confirmed fetch failure

The inspected Cloudflare bundle `/assets/index-CJMGPAVR.js` contained
`const ci="http://127.0.0.1:8000"` before the authentication client. It calls the
visitor's computer rather than Render. `VITE_API_URL` is the exact build-time
variable; changing backend variables cannot repair an existing Vite bundle.
Render `/api/auth/status` returned 200, `required:true`, and
`Access-Control-Allow-Origin: https://resiliospace.pages.dev` when that Origin was
sent. The inspected backend was reachable and CORS was correct; the frontend had
an incorrect embedded API base and the previous mentor login experience.

## Cloudflare Pages production configuration

- Root: `src/frontend`
- Build: `npm ci && npm run build`
- Output: `dist`
- `NODE_VERSION=22`
- `VITE_API_URL=https://resiliospace-api.onrender.com` (no `/api` suffix)
- `VITE_GUEST_DEMO=true`

Set variables for **Production**, not only Preview; rebuild after changing them.
Keep SPA fallback to `index.html` and all furniture assets. No secrets belong in
VITE variables. Production now defaults to guest mode and this HTTPS Render origin
if unspecified. Local development retains localhost and the existing local flow;
set VITE_GUEST_DEMO=true locally to exercise guest mode. Preview deployments need
their exact frontend origins added to CORS.

## Render native Python configuration

- Root: leave blank (whole repository, including `data/`).
- Build: `pip install -r src/backend/requirements.txt`
- Start: `uvicorn app.main:app --app-dir src/backend --host 0.0.0.0 --port $PORT --workers 1`
- Health check: `/health`
- Leave PYTHON_VERSION unset: `.python-version` selects Python 3.12.

```text
RESILIOSPACE_PUBLIC_DEMO=true
RESILIOSPACE_GUEST_DEMO=true
RESILIOSPACE_CORS_ORIGINS=https://resiliospace.pages.dev
RESILIOSPACE_SAMPLE_DIR=data
RESILIOSPACE_RUNTIME_DIR=/tmp/resiliospace-runtime
```

Remove the old RESILIOSPACE_DEMO_PASSWORD for this public service. Guest mode
rejects password login even if it remains, and forces authentication on shared
routes even if PUBLIC_DEMO is accidentally false. Use one worker/instance.

## Guest isolation and security

The existing app opens immediately. Structures, designs/versions, analyses and
processed images live in browser localStorage under `resiliospace:guest:v1:`;
last-plan restoration uses a separate guest key. Existing validated working
snapshots accept all 32 furniture types. Missing local IDs never fall back to
server records, and guest design CRUD sends no record IDs to the backend.
Different browser profiles have independent stores; tabs in the same profile share
storage. This is not account-based isolation. Local storage is unencrypted and
same-origin XSS could access it. Private browsing, cleared data and quotas can
remove/prevent saves; errors are reported. Export important work.

Anonymous endpoints are restricted to:

- GET `/health`, `/api/auth/status`, `/api/guest/samples/{name}` (three allowlisted samples).
- POST `/api/guest/starters/{kind}` (fresh model, no DB record).
- POST `/api/guest/upload` (validate/decode only the submitted image, return its model and processed images).
- POST `/api/guest/structure` (validate submitted geometry without saving).
- POST `/api/guest/analysis` (analyze submitted geometry/configuration without any database lookup).

Upload scratch files use per-request temporary directories cleaned on success and
failure. No guest upload/design is persisted in shared SQLite. Furniture stays in
local designs; only analysis submissions omit props because cultural rules do not
use furniture. Shared CRUD/artifacts, global metrics/telemetry, simulator controls
and API docs remain guarded. No credential is delivered to visitors. Guest
telemetry is browser-local; global adaptation history is not exposed. Administrative
simulations report unavailability explicitly. Editing, furniture, versions,
comparison, exports and traditional-rule analysis reuse the existing UI/handlers.

Limits are global: 120 guest requests/minute, 5 uploads/minute, 60 other computation
requests/minute, one computation at a time. Files: 10 MB, multipart bodies: 11 MB,
guest images: 4 megapixels, other guest bodies: 512 KB; geometry counts are bounded.
Limits do not trust forwarded IP headers and reset on restart. They are not DDoS
protection or execution timeouts. Host memory/time still needs verification.
Uploads leave the browser temporarily: use samples/non-sensitive plans. Render
SQLite remains ephemeral, but guest versions no longer depend on it.
[Render free-storage limitations](https://render.com/docs/free).

## Deployment order and manual checks

1. After reviewing/publishing changes, redeploy Render with the variables above.
   Verify `/health` is 200, guest samples/starters work, Cloudflare-origin preflight
   succeeds, and anonymous shared-record routes remain 401.
2. Rebuild/redeploy Cloudflare with its Production variables, then hard-refresh.
   The app should open without a password. In Network tools verify HTTPS Render
   `/api/guest/` requests, never localhost/shared CRUD. Free Render cold starts may
   still delay processing. Local save/duplicate/delete should make no CRUD request.
3. Use two separate browser profiles: create different designs, save/reload,
   duplicate/delete, test upload/Processed view, 2D corrections, 3D furniture and
   analysis. An ID from the other profile must not load or modify any record.

No live settings, deployment, commit or push was performed in this task.

## Focused validation

- Backend: with `PYTHONPATH=src/backend`, `python -m pytest
  src/backend/tests/test_guest.py src/backend/tests/test_demo_auth.py -q`:
  **45 passed**, one existing Starlette/httpx deprecation warning.
- Frontend: `vitest run src/guestWorkspace.test.ts src/demoAuth.test.ts
  src/utils/autosave.test.ts src/App.test.tsx`: **14 passed**.
  Guest-only tests rerun after the final structure-save mapping correction and
  all-32-props snapshot assertion: **4 passed**.
- Single frontend check: `tsc --noEmit`: **passed**. `git diff --check`: passed.
- No full suites/builds or hosted redeployment/browser validation were run.

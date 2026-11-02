# Render native Python demo (preparation only)

No service has been deployed. Shared-password access is intended only for a small,
trusted mentor group, not an isolated multi-user application. No Docker changes are needed.

## Backend configuration

Create a Render **Web Service**, language **Python 3**, using the chosen repository.

| Setting | Value |
| --- | --- |
| Root Directory | Leave blank (repository root) |
| Build Command | `pip install -r src/backend/requirements.txt` |
| Start Command | `uvicorn app.main:app --app-dir src/backend --host 0.0.0.0 --port $PORT --workers 1` |
| Health Check Path | `/health` |

Required service environment:

```text
RESILIOSPACE_PUBLIC_DEMO=true
RESILIOSPACE_DEMO_PASSWORD=<unique-strong-16-to-256-character-password>
RESILIOSPACE_CORS_ORIGINS=https://your-project.pages.dev
RESILIOSPACE_SAMPLE_DIR=data
RESILIOSPACE_RUNTIME_DIR=/tmp/resiliospace-runtime
```

Replace the Pages hostname with the actual HTTPS origin, without a path. Additional
origins may be comma-separated; preview deployments require their exact origins.
Localhost development origins remain allowed. Credentials and wildcard origins are
not enabled. CORS is a browser policy, not authentication.

The root `.python-version` selects the latest Python 3.12 patch supported by Render;
leave `PYTHON_VERSION` unset so it does not override this selection. Keep the whole
repository available: `data/` contains the three allowlisted sample plans. The
existing sample-directory override and runtime-directory creation need no changes.
Startup creates uploads/debug directories and SQLite under the writable runtime
directory. One worker preserves the existing process-local adaptation state.

For the separately hosted frontend, set **build-time**
`VITE_API_URL=https://your-backend.onrender.com` (no `/api` suffix), retain all public
furniture assets, and use SPA fallback to `index.html`.

## Mentor access and demo restrictions

Set the password as a secret environment value in the Render backend dashboard.
Do not commit the value, put it in a frontend/VITE variable, or share it in a URL.
Send mentors the HTTPS frontend URL and the password separately. They enter it on
the Mentor demo screen; successful login issues a random 30-minute bearer token.
Tokens stay only in browser memory, are validated against expiring server-side
sessions on every request, and are never placed in image URLs. Reloading the page,
server restart, expiry, or Lock demo requires login again. Lock demo revokes the
current token when the server can be reached. Re-login preserves the mounted
workspace; a full browser reload may still lose unsaved work.

All backend paths, including samples, uploads, structure processing, design CRUD,
analyses, metrics and API documentation, require a session. Only `GET /health`,
`GET /api/auth/status`, and `POST /api/auth/login` are public; CORS preflight is
handled before authentication. Authorization headers are allowed for the exact
configured frontend origins; credentialed cookies are not used. API responses are
marked no-store. Hosted-demo startup fails if the password is missing or shorter
than 16 characters. Local development needs no password when both demo settings
are absent; setting a password also enables authentication outside demo mode.

Fixed server-side limits (global across mentors, not per claimed client IP):

- 10 login attempts/minute, including successful attempts.
- 5 upload attempts/minute; existing 10 MB/image-pixel validation remains.
- 60 other expensive starter/analysis requests/minute; one upload/analysis/starter
  computation at a time. Busy requests receive 429, not an unbounded queue.
- 120 authenticated mutation attempts/minute and an 11 MB total request-body cap
  (including streamed bodies); login bodies are capped at 1 KB.

Limits and sessions live in process memory: keep **one worker, one instance**.
Restart resets them. These bounds are not DDoS protection or a processing timeout;
image-processing memory and worst-case processing time still need host validation.
The shared password provides no individual audit trail or individual revocation.
Rotate it and restart the service to revoke all access if disclosed. An XSS or
stolen bearer token can act as a mentor until expiry. Use HTTPS only. Session design
reference: [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

With `RESILIOSPACE_PUBLIC_DEMO=true`, all simulator POST actions (activate, clear,
restore) and `/api/system/telemetry` return HTTP 403 before changing state. Telemetry
is restricted because it can change global resilience mode, including degraded
rendering and recovery. Read-only status routes remain available after login. Existing
Control Center/Resilience Lab actions therefore cannot operate in this mode; no
administrative bypass or browser-stored secret is provided. Local development keeps
its existing behavior when the variable is absent/false. Never set false on an
unauthenticated public service.

**All authenticated mentors share the same data.** There are no per-user ownership
checks: every mentor can read/change/delete accessible designs and plans. Use only
sample/non-sensitive plans. Public frontend furniture assets remain public files;
they contain no design data. Local browser autosave is not encrypted and can remain
after locking the demo; use trusted devices. This is a restricted demo, not a
general public upload service.

## Storage and free-host limitations

`/tmp/resiliospace-runtime` is deliberately ephemeral: SQLite (including design
versions), uploads and debug artifacts are lost on restart/redeploy/idle shutdown.
Browser local snapshots do not back up the server. Do not upload private plans or
promise retention. Samples and GLBs are repository assets and survive redeployment.
Durable use requires persistent storage/backups for the entire runtime directory;
existing uploaded-file records contain absolute paths, so keep its mount path stable.
Free Render services cannot attach persistent disks, sleep after inactivity, and
have cold starts. Image-processing memory/concurrency still needs host validation.

References: [Render FastAPI setup](https://render.com/docs/deploy-fastapi),
[Python selection](https://render.com/docs/python-version),
[free-service limitations](https://render.com/docs/free).

## Focused local validation

With `PYTHONPATH=src/backend`, ran `.venv/Scripts/python.exe -m pytest
src/backend/tests/test_demo_auth.py src/backend/tests/test_deployment.py
src/backend/tests/test_api.py -q`. Initially 52 passed and one streamed-body test
failed. After fixing receive-side error handling, reran `test_demo_auth.py`:
**26 passed**; the other **27 deployment/API tests passed** in the initial run.
One existing Starlette/httpx deprecation warning remains. Coverage includes
unauthenticated-route denial, wrong-password throttling, token expiry/revocation,
CORS with Authorization, authenticated upload/artifact/design/structure/analysis,
preserved simulator restrictions, request size/rate/concurrency bounds, temporary
storage, and repository samples.
After keeping logout session mutation on the event loop, reran the login/logout
and streamed-body regressions: **2 passed**, 24 deselected.

Frontend: `vitest run src/demoAuth.test.ts src/App.test.tsx
src/components/StartExperience.test.tsx`: **10 passed**. `tsc --noEmit`: **passed**.
Tests cover token headers, multipart uploads, sample requests, expiry, login failure,
logout, API destination checks, and initial gate rendering. No hosted/browser login
or host memory validation has been performed; no full suites or builds were run.

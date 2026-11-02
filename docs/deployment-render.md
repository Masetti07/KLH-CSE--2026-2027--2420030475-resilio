# Render native Python demo (preparation only)

No service has been deployed. Unrestricted public access remains blocked by the
shared-data authorization limitations below. No Docker changes are needed.

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

## Demo restrictions and remaining deployment blockers

With `RESILIOSPACE_PUBLIC_DEMO=true`, all simulator POST actions (activate, clear,
restore) and `/api/system/telemetry` return HTTP 403 before changing state. Telemetry
is restricted because it can change global resilience mode, including degraded
rendering and recovery. Read-only health/status routes remain available. Existing
Control Center/Resilience Lab actions therefore cannot operate in this mode; no
administrative bypass or browser-stored secret is provided. Local development keeps
its existing behavior when the variable is absent/false. Never set false on an
unauthenticated public service.

**This is not an authenticated or isolated public application.** These essential
mutations remain unauthenticated and were deliberately not disabled:

- `POST /api/plans/upload` and `/api/plans/starters/{kind}` create shared data.
- `PUT /api/plans/{plan_id}/structure` changes a shared plan.
- `POST /api/plans/{plan_id}/designs`, `PUT /api/designs/{design_id}`,
  `POST /api/designs/{design_id}/duplicate`, and `DELETE /api/designs/{design_id}`
  create/change/delete shared designs.
- `POST /api/designs/{design_id}/vastu-analysis` persists an analysis.

Reads also lack ownership checks; IDs are not authorization. Protecting these routes
properly requires authentication/session ownership and frontend integration, beyond
this preparation. Public uploads/analysis also need abuse/rate/concurrency controls;
existing upload/image-size validation does not prevent resource exhaustion. Use an
authenticated access boundary covering the backend itself for a restricted preview,
or complete that work before unrestricted public deployment. Restricting only the
frontend leaves the backend exposed. `/api/vastu/assist-preview` is also public
compute, although it does not persist data.

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
src/backend/tests/test_deployment.py src/backend/tests/test_simulator.py
src/backend/tests/test_api.py -q`: **33 passed**, one existing Starlette/httpx
deprecation warning. The sandbox attempt stalled without results; it was stopped
and the same command completed outside the sandbox. Tests cover configured CORS,
public-demo restrictions, retained design creation, all three repository samples,
missing samples, and temporary-directory file/SQLite writes. No Render deployment
or host memory validation has been performed; no full suites or builds were run.

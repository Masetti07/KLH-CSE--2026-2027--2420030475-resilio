# Docker architecture

Day 5 defines exactly three Compose services:

- `frontend`: a multi-stage Node build served by nginx. nginx supports SPA fallback and proxies `/api/` to `backend:8000`.
- `backend`: the FastAPI application served by Uvicorn. `/app/runtime` is a named volume for the prototype SQLite database, uploaded sources, and generated processing artifacts.
- `prometheus`: Prometheus with the repository configuration mounted read-only and its data in a named volume.

The browser makes same-origin `/api` requests through nginx, so no machine-specific container address is exposed to browser code. Host ports default to 8080, 8000, and 9090, are bound to loopback, and can be changed with the non-secret values documented in `.env.example`. The frontend runs unprivileged and listens on container port 8080. The backend drops capabilities and uses no-new-privileges, but retains its original container user to preserve existing root-owned named-volume data; migration to a non-root backend would require a separate tested ownership plan. Service healthchecks cover nginx, FastAPI, and Prometheus; dependent services wait for the backend healthcheck.

## Commands

```powershell
docker compose config
docker compose build
docker compose up -d
docker compose ps
docker compose down
```

For a clean removal of prototype container state, the operator may explicitly use `docker compose down --volumes`; this deletes the named backend and Prometheus volumes. Local development remains supported using Uvicorn and Vite as described in the README.

Images contain no secrets or local `.env` file. Docker ignore rules exclude dependency directories, virtual environments, caches, runtime uploads, test output, and build output. The Compose setup is a local prototype, not a production security, backup, TLS, scaling, or cloud-deployment design.

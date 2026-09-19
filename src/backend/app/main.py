from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from time import perf_counter
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest

from app.api.designs import router as designs_router
from app.api.plans import router as plans_router
from app.api.system import router as system_router
from app.api.simulator import router as simulator_router
from app.adaptation import engine as adaptation_engine
from app.observability import observe_request
from app.config import settings
from app.database.session import create_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_runtime_directories()
    create_database()
    yield


app = FastAPI(
    title="ResilioSpace API",
    version="0.3.0",
    description="Local floor-plan processing, structural correction, design versions, and transparent traditional-rule analysis.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(plans_router)
app.include_router(designs_router)
app.include_router(system_router)
app.include_router(simulator_router)


@app.middleware("http")
async def observe_api_requests(request, call_next):
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration = perf_counter() - started
        adaptation_engine.monitor.record_request(duration * 1000, 500)
        route = request.scope.get("route")
        observe_request(request.method, getattr(route, "path", "unmatched"), 500, duration)
        raise
    duration = perf_counter() - started
    adaptation_engine.monitor.record_request(duration * 1000, response.status_code)
    route = request.scope.get("route")
    observe_request(request.method, getattr(route, "path", "unmatched"), response.status_code, duration)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metrics", tags=["observability"], include_in_schema=False)
def prometheus_metrics() -> Response:
    return Response(content=generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from time import perf_counter

from app.api.designs import router as designs_router
from app.api.plans import router as plans_router
from app.api.system import router as system_router
from app.adaptation import engine as adaptation_engine
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


@app.middleware("http")
async def observe_api_requests(request, call_next):
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        adaptation_engine.monitor.record_request((perf_counter() - started) * 1000, 500)
        raise
    adaptation_engine.monitor.record_request((perf_counter() - started) * 1000, response.status_code)
    return response


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok"}

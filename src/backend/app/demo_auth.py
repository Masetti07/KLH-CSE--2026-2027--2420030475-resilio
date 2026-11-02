"""Single-process shared-demo access; deliberately not multi-user authorization."""
import hashlib
import secrets
import re
from collections import deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.config import settings

SESSION_SECONDS = 30 * 60
MAX_BODY = 11 * 1024 * 1024  # multipart overhead above the existing 10 MB file limit
router = APIRouter(prefix="/api/auth", tags=["demo-access"])


def enabled() -> bool:
    return settings.public_demo or settings.guest_demo or bool(settings.demo_password)


def validate_configuration() -> None:
    if settings.guest_demo and not settings.demo_password:
        return  # Shared database routes stay locked; no password login is available.
    if enabled() and not 16 <= len(settings.demo_password) <= 256:
        raise ValueError("Set RESILIOSPACE_DEMO_PASSWORD to a strong 16–256 character shared password")


class DemoAccess:
    def __init__(self):
        self.sessions: dict[str, float] = {}
        self.windows: dict[str, deque] = {}
        self.processing = Lock()

    def allow(self, bucket: str, maximum: int) -> bool:
        now = monotonic()
        window = self.windows.setdefault(bucket, deque())
        while window and window[0] <= now - 60:
            window.popleft()
        if len(window) >= maximum:
            return False
        window.append(now)
        return True

    def issue(self) -> str:
        now = monotonic()
        self.sessions = {key: expiry for key, expiry in self.sessions.items() if expiry > now}
        token = secrets.token_urlsafe(32)
        # Bound memory even if all sessions are created by an authorized client.
        if len(self.sessions) >= 128:
            self.sessions.pop(next(iter(self.sessions)))
        self.sessions[hashlib.sha256(token.encode()).hexdigest()] = now + SESSION_SECONDS
        return token

    def valid(self, token: str) -> bool:
        if not token or len(token) > 128:
            return False
        key = hashlib.sha256(token.encode()).hexdigest()
        if self.sessions.get(key, 0) <= monotonic():
            self.sessions.pop(key, None)
            return False
        return True


access = DemoAccess()


@router.get("/status")
def status():
    return JSONResponse({"required": enabled()}, headers={"Cache-Control": "no-store"})


@router.post("/login")
async def login(request: Request):
    if settings.guest_demo:
        return JSONResponse({"detail": "Password login is disabled on the public guest demo."}, status_code=403)
    if not enabled():
        return JSONResponse({"required": False})
    try:
        payload = await request.json()
    except ValueError:
        return JSONResponse({"detail": "Invalid login request."}, status_code=400)
    password = payload.get("password") if isinstance(payload, dict) else None
    if (not isinstance(password, str) or not settings.demo_password
            or not secrets.compare_digest(password.encode(), settings.demo_password.encode())):
        return JSONResponse({"detail": "Incorrect demo password."}, status_code=401)
    return JSONResponse({"token": access.issue(), "expires_in": SESSION_SECONDS},
                        headers={"Cache-Control": "no-store"})


@router.post("/logout")
async def logout(request: Request):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    access.sessions.pop(hashlib.sha256(token.encode()).hexdigest(), None)
    return JSONResponse({"ok": True}, headers={"Cache-Control": "no-store"})


class DemoAccessMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not enabled():
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]
        headers = dict(scope["headers"])

        async def reply(code, detail):
            extra = {"Cache-Control": "no-store"}
            if code == 401:
                extra["WWW-Authenticate"] = "Bearer"
            if code == 429:
                extra["Retry-After"] = "60"
            await JSONResponse({"detail": detail}, status_code=code, headers=extra)(scope, receive, send)

        guest = settings.guest_demo and (
            method == "GET" and re.fullmatch(r"/api/guest/samples/[^/]+", path) is not None
            or method == "POST" and (path in {"/api/guest/upload", "/api/guest/structure", "/api/guest/analysis"}
                                     or re.fullmatch(r"/api/guest/starters/[^/]+", path) is not None))
        public = guest or (method, path) in {("GET", "/health"), ("GET", "/api/auth/status"), ("POST", "/api/auth/login")}
        if guest and not access.allow("guest", 120):
            return await reply(429, "Public demo request limit reached. Wait one minute.")
        if not public:
            authorization = headers.get(b"authorization", b"").decode("latin-1")
            if not authorization.startswith("Bearer ") or not access.valid(authorization[7:]):
                return await reply(401, "Demo login required or session expired.")
        if method == "POST" and path == "/api/auth/login" and not access.allow("login", 10):
            return await reply(429, "Too many login attempts. Wait one minute.")
        if not public and method in {"POST", "PUT", "PATCH", "DELETE"} and not access.allow("writes", 120):
            return await reply(429, "Demo write limit reached. Wait one minute.")
        upload = method == "POST" and path in {"/api/plans/upload", "/api/guest/upload"}
        expensive = (guest and method == "POST") or upload or (method == "POST" and (path.startswith("/api/plans/starters/")
                    or path.startswith("/api/vastu/") or path.endswith("/vastu-analysis")))
        if expensive and not access.allow("uploads" if upload else "processing", 5 if upload else 60):
            return await reply(429, "Demo processing limit reached. Wait one minute.")
        limit = 1024 if path == "/api/auth/login" else 512 * 1024 if guest and not upload else MAX_BODY
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await reply(400, "Invalid content length.")
        if length < 0 or length > limit:
            return await reply(413, "Request exceeds the demo size limit.")
        if expensive and not access.processing.acquire(blocking=False):
            return await reply(429, "Another plan or analysis is processing. Try again shortly.")
        size = 0
        response_started = False

        async def limited_receive():
            nonlocal size
            message = await receive()
            size += len(message.get("body", b""))
            if size > limit:
                raise HTTPException(413, "Request exceeds the demo size limit.")
            return message

        async def no_cache_send(message):
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                message["headers"] = [(key, value) for key, value in message.get("headers", []) if key.lower() != b"cache-control"]
                message["headers"].append((b"cache-control", b"no-store"))
            await send(message)

        try:
            await self.app(scope, limited_receive, no_cache_send)
        except Exception:
            # BaseHTTPMiddleware may wrap a receive-side 413 in an ExceptionGroup.
            # Handle only our own size violation, before any response was started.
            if size <= limit or response_started:
                raise
            await reply(413, "Request exceeds the demo size limit.")
        finally:
            if expensive:
                access.processing.release()

from fastapi import HTTPException

from app.config import settings


def require_local_controls() -> None:
    if settings.public_demo or settings.guest_demo:
        raise HTTPException(status_code=403, detail="Administrative resilience controls are disabled in public-demo mode.")

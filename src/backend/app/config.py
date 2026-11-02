import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlsplit


BACKEND_ROOT = Path(__file__).resolve().parents[1]


def cors_origins() -> list[str]:
    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    for origin in os.getenv("RESILIOSPACE_CORS_ORIGINS", "").split(","):
        origin = origin.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        if (parsed.scheme not in {"http", "https"} or not parsed.hostname
                or "*" in origin or parsed.username is not None or parsed.password is not None
                or parsed.path or parsed.query or parsed.fragment):
            raise ValueError("RESILIOSPACE_CORS_ORIGINS must contain explicit HTTP(S) origins only")
        if origin not in origins:
            origins.append(origin)
    return origins


def public_demo() -> bool:
    value = os.getenv("RESILIOSPACE_PUBLIC_DEMO", "false").strip().lower()
    if value not in {"true", "false", "1", "0"}:
        raise ValueError("RESILIOSPACE_PUBLIC_DEMO must be true, false, 1 or 0")
    return value in {"true", "1"}


@dataclass(frozen=True)
class Settings:
    runtime_root: Path = field(default_factory=lambda: Path(os.getenv("RESILIOSPACE_RUNTIME_DIR", BACKEND_ROOT / "runtime")).resolve())
    max_upload_bytes: int = 10 * 1024 * 1024
    max_image_pixels: int = 25_000_000
    allowed_extensions: frozenset[str] = frozenset({".png", ".jpg", ".jpeg"})
    cors_origins: list[str] = field(default_factory=cors_origins)
    public_demo: bool = field(default_factory=public_demo)
    guest_demo: bool = field(default_factory=lambda: os.getenv("RESILIOSPACE_GUEST_DEMO", "false").strip().lower() in {"true", "1"})
    demo_password: str = field(default_factory=lambda: os.getenv("RESILIOSPACE_DEMO_PASSWORD", ""), repr=False)

    @property
    def uploads_dir(self) -> Path:
        return self.runtime_root / "uploads"

    @property
    def debug_dir(self) -> Path:
        return self.runtime_root / "debug"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{(self.runtime_root / 'resiliospace.sqlite3').as_posix()}"

    def ensure_runtime_directories(self) -> None:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.debug_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()

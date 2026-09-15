import os
from dataclasses import dataclass, field
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    runtime_root: Path = field(default_factory=lambda: Path(os.getenv("RESILIOSPACE_RUNTIME_DIR", BACKEND_ROOT / "runtime")).resolve())
    max_upload_bytes: int = 10 * 1024 * 1024
    max_image_pixels: int = 25_000_000
    allowed_extensions: frozenset[str] = frozenset({".png", ".jpg", ".jpeg"})
    cors_origins: list[str] = field(default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"])

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

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from .domain import MAX_DEVICE_TTL_SECONDS


DEFAULT_DEVELOPMENT_TOKEN = "local-development-token-change-before-use"
DEFAULT_IDEMPOTENCY_SECRET = "local-idempotency-secret-change-before-use"
BACKEND_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_PATH = str(BACKEND_ROOT / "data" / "tcc.db")


def _resolve_database_path(value: str) -> str:
    if value == ":memory:":
        return value
    path = Path(value)
    if not path.is_absolute():
        path = BACKEND_ROOT / path
    return str(path.resolve())


@dataclass(frozen=True, slots=True)
class Settings:
    environment: str = "development"
    provider_mode: str = "mock"
    database_path: str = DEFAULT_DATABASE_PATH
    authorization_ttl_seconds: int = 30
    supervisor_token: str = DEFAULT_DEVELOPMENT_TOKEN
    idempotency_hmac_secret: str = DEFAULT_IDEMPOTENCY_SECRET
    cors_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )

    @classmethod
    def from_env(cls) -> "Settings":
        settings = cls(
            environment=os.getenv("APP_ENV", "development").strip().lower(),
            provider_mode=os.getenv("PROVIDER_MODE", "mock").strip().lower(),
            database_path=_resolve_database_path(
                os.getenv("DATABASE_PATH", "data/tcc.db").strip()
            ),
            authorization_ttl_seconds=int(
                os.getenv("AUTHORIZATION_TTL_SECONDS", "30")
            ),
            supervisor_token=os.getenv(
                "SUPERVISOR_TOKEN", DEFAULT_DEVELOPMENT_TOKEN
            ),
            idempotency_hmac_secret=os.getenv(
                "IDEMPOTENCY_HMAC_SECRET", DEFAULT_IDEMPOTENCY_SECRET
            ),
            cors_origins=tuple(
                origin.strip()
                for origin in os.getenv(
                    "CORS_ORIGINS",
                    "http://localhost:5173,http://127.0.0.1:5173",
                ).split(",")
                if origin.strip()
            ),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if self.provider_mode != "mock":
            raise RuntimeError(
                "Somente PROVIDER_MODE=mock está implementado. A integração "
                "SENATRAN real permanece desabilitada por segurança."
            )
        if not 5 <= self.authorization_ttl_seconds <= MAX_DEVICE_TTL_SECONDS:
            raise ValueError(
                "AUTHORIZATION_TTL_SECONDS deve estar entre 5 e "
                f"{MAX_DEVICE_TTL_SECONDS}"
            )
        if len(self.supervisor_token) < 20:
            raise ValueError("SUPERVISOR_TOKEN deve ter pelo menos 20 caracteres")
        if len(self.idempotency_hmac_secret) < 32:
            raise ValueError(
                "IDEMPOTENCY_HMAC_SECRET deve ter pelo menos 32 caracteres"
            )
        if (
            self.environment in {"production", "prod"}
            and self.supervisor_token == DEFAULT_DEVELOPMENT_TOKEN
        ):
            raise RuntimeError(
                "SUPERVISOR_TOKEN deve ser configurado fora do código em produção"
            )
        if (
            self.environment in {"production", "prod"}
            and self.idempotency_hmac_secret == DEFAULT_IDEMPOTENCY_SECRET
        ):
            raise RuntimeError(
                "IDEMPOTENCY_HMAC_SECRET deve ser configurado fora do código"
            )

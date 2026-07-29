from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from ipaddress import ip_address

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import router
from .config import Settings
from .dispenser import SimulatedDispenserGateway
from .domain import AuthorizationRepository, DispenserGateway, VehicleDataProvider
from .providers import MockVehicleDataProvider
from .repository import SqliteAuthorizationRepository
from .service import AuthorizationService, utc_now


def create_app(
    *,
    settings: Settings | None = None,
    provider: VehicleDataProvider | None = None,
    gateway: DispenserGateway | None = None,
    repository: AuthorizationRepository | None = None,
    clock: Callable[[], datetime] = utc_now,
) -> FastAPI:
    active_settings = settings or Settings.from_env()
    active_settings.validate()
    active_provider = provider or MockVehicleDataProvider()
    active_gateway = gateway or SimulatedDispenserGateway(clock=clock)
    active_repository = repository or SqliteAuthorizationRepository(
        active_settings.database_path
    )
    service = AuthorizationService(
        provider=active_provider,
        gateway=active_gateway,
        repository=active_repository,
        ttl_seconds=active_settings.authorization_ttl_seconds,
        clock=clock,
        idempotency_secret=active_settings.idempotency_hmac_secret.encode("utf-8"),
    )
    service.reconcile_startup()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        close = getattr(active_repository, "close", None)
        if close is not None:
            close()

    application = FastAPI(
        title="Fuel Guard — protótipo acadêmico",
        version="0.1.0",
        description=(
            "API simulada e fail-closed. Não realiza consultas reais à SENATRAN "
            "e não deve controlar bombas de combustível reais."
        ),
        lifespan=lifespan,
    )

    @application.exception_handler(RequestValidationError)
    async def sanitized_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # A resposta padrão do framework inclui o valor recebido em `input`.
        # Placas e outros dados operacionais não devem reaparecer no payload de
        # erro nem, por consequência, em observabilidade intermediária.
        if request.method == "POST" and request.url.path == "/api/v1/authorizations":
            try:
                payload = await request.json()
                pump_id = payload.get("pump_id") if isinstance(payload, dict) else None
                if (
                    isinstance(pump_id, str)
                    and 1 <= len(pump_id.strip()) <= 64
                    and all(
                        character.isalnum() or character in "._:@-"
                        for character in pump_id.strip()
                    )
                ):
                    service.fail_closed_invalid_request(pump_id.strip())
            except Exception:
                # Nunca transforma um erro de validação em liberação. Sem um
                # pump_id confiável, não é seguro escolher um dispositivo.
                pass

        detail = [
            {
                "type": error.get("type", "validation_error"),
                "loc": list(error.get("loc", ())),
                "msg": error.get("msg", "entrada inválida"),
            }
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": detail})
    application.state.settings = active_settings
    application.state.service = service
    application.state.gateway = active_gateway
    application.state.repository = active_repository

    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(active_settings.cors_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @application.middleware("http")
    async def local_prototype_only(request: Request, call_next):
        # O MVP ainda usa identidade autodeclarada e um token global de
        # supervisor. Até existir autenticação individual/RBAC, ele não aceita
        # clientes remotos, mesmo se iniciado por engano em 0.0.0.0.
        client_host = request.client.host if request.client else ""
        try:
            is_loopback = ip_address(client_host).is_loopback
        except ValueError:
            is_loopback = client_host == "testclient"
        if not is_loopback:
            return JSONResponse(
                status_code=403,
                content={"detail": "protótipo restrito a acesso local"},
            )
        return await call_next(request)

    @application.middleware("http")
    async def prevent_sensitive_caching(request: Request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    @application.get("/health", tags=["operational"])
    def health() -> dict[str, str]:
        return {"status": "ok", "provider_mode": active_provider.mode}

    application.include_router(router)
    return application


app = create_app()

from __future__ import annotations

import re
import secrets
from datetime import datetime
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .domain import (
    AuditEvent,
    AuthorizationNotFoundError,
    AuthorizationOutcome,
    AuthorizationRecord,
    AuthorizationStatus,
    Fuel,
    IdempotencyConflictError,
    InvalidAuthorizationStateError,
    InvalidPlateError,
    ReasonCode,
)
from .providers import normalize_plate
from .service import AuthorizationService


router = APIRouter(prefix="/api/v1")
_bearer = HTTPBearer(auto_error=False)
_OPERATOR_ID_PATTERN = re.compile(r"^[A-Za-z0-9._:@-]+$")
_SENSITIVE_FREE_TEXT_PATTERN = re.compile(
    r"\b[A-Z]{3}[- ]?[0-9][A-Z0-9][0-9]{2}\b|\b[0-9]{9,11}\b",
    re.IGNORECASE,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlateRequest(StrictModel):
    plate: str = Field(min_length=7, max_length=8, repr=False)

    @field_validator("plate")
    @classmethod
    def validate_plate(cls, value: str) -> str:
        try:
            return normalize_plate(value)
        except InvalidPlateError as exc:
            raise ValueError(str(exc)) from exc


class CompatibilityResponse(StrictModel):
    status: AuthorizationStatus
    compatible_fuels: list[Fuel]
    reason_code: ReasonCode
    provider_mode: str


class AuthorizationRequest(StrictModel):
    # A validação de formato ocorre no serviço, após LOCK_ALL. Assim, até uma
    # tentativa com placa inválida encerra com segurança a autorização anterior.
    plate: str = Field(max_length=32, repr=False)
    client_request_id: UUID = Field(default_factory=uuid4)
    requested_fuel: Fuel
    attendant_id: str = Field(min_length=1, max_length=64)
    pump_id: str = Field(min_length=1, max_length=64)

    @field_validator("attendant_id", "pump_id")
    @classmethod
    def validate_identifier(cls, value: str) -> str:
        cleaned = value.strip()
        if not _OPERATOR_ID_PATTERN.fullmatch(cleaned):
            raise ValueError("identificador contém caracteres não permitidos")
        return cleaned


class OverrideRequest(StrictModel):
    supervisor_id: str = Field(min_length=1, max_length=64)
    justification: str = Field(min_length=10, max_length=500)

    @field_validator("supervisor_id")
    @classmethod
    def validate_supervisor_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not _OPERATOR_ID_PATTERN.fullmatch(cleaned):
            raise ValueError("identificador contém caracteres não permitidos")
        return cleaned

    @field_validator("justification")
    @classmethod
    def clean_justification(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        compacted = re.sub(r"[^A-Za-z0-9]", "", cleaned).upper()
        if (
            _SENSITIVE_FREE_TEXT_PATTERN.search(cleaned)
            or re.search(r"[A-Z]{3}[0-9][A-Z0-9][0-9]{2}", compacted)
            or re.search(r"[0-9]{9,11}", compacted)
            or re.search(r"\b(?:CPF|RENAVAM|CHASSI|PLACA)\b", cleaned, re.IGNORECASE)
        ):
            raise ValueError(
                "justificativa não pode conter placa ou identificador numérico"
            )
        return cleaned


class CompleteRequest(StrictModel):
    actor_id: str = Field(min_length=1, max_length=64)

    @field_validator("actor_id")
    @classmethod
    def validate_actor_id(cls, value: str) -> str:
        cleaned = value.strip()
        if not _OPERATOR_ID_PATTERN.fullmatch(cleaned):
            raise ValueError("identificador contém caracteres não permitidos")
        return cleaned


class AuthorizationResponse(StrictModel):
    authorization_id: str
    client_request_id: str | None
    status: AuthorizationStatus
    requested_fuel: Fuel
    pump_id: str
    compatible_fuels: list[Fuel]
    reason_code: ReasonCode
    provider_mode: str
    created_at: datetime
    expires_at: datetime | None
    override_used: bool


class AuditEventResponse(StrictModel):
    event_id: str
    authorization_id: str
    event_type: str
    status: AuthorizationStatus
    reason_code: ReasonCode
    created_at: datetime
    actor_id: str | None
    justification: str | None


def _service(request: Request) -> AuthorizationService:
    return request.app.state.service


def _require_supervisor(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> None:
    expected = request.app.state.settings.supervisor_token
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
        or not secrets.compare_digest(credentials.credentials, expected)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="credencial de supervisor inválida",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post(
    "/compatibility-checks",
    response_model=CompatibilityResponse,
    summary="Consulta compatibilidade sem persistir a placa",
)
def check_compatibility(
    payload: PlateRequest,
    service: Annotated[AuthorizationService, Depends(_service)],
) -> CompatibilityResponse:
    decision, fuels, reason = service.check_compatibility(payload.plate)
    return CompatibilityResponse(
        status=decision,
        compatible_fuels=list(fuels),
        reason_code=reason,
        provider_mode=service.provider_mode,
    )


@router.post(
    "/authorizations",
    response_model=AuthorizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Decide e executa uma autorização temporária",
)
def create_authorization(
    payload: AuthorizationRequest,
    service: Annotated[AuthorizationService, Depends(_service)],
) -> AuthorizationResponse:
    try:
        outcome = service.authorize(
            plate=payload.plate,
            requested_fuel=payload.requested_fuel,
            attendant_id=payload.attendant_id,
            pump_id=payload.pump_id,
            client_request_id=str(payload.client_request_id),
        )
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _outcome_response(outcome)


@router.get(
    "/authorizations/{authorization_id}",
    response_model=AuthorizationResponse,
)
def get_authorization(
    authorization_id: str,
    service: Annotated[AuthorizationService, Depends(_service)],
) -> AuthorizationResponse:
    try:
        record = service.get(authorization_id)
    except AuthorizationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="autorização não encontrada") from exc
    return _record_response(record)


@router.post(
    "/authorizations/{authorization_id}/override",
    response_model=AuthorizationResponse,
    dependencies=[Depends(_require_supervisor)],
)
def override_authorization(
    authorization_id: str,
    payload: OverrideRequest,
    service: Annotated[AuthorizationService, Depends(_service)],
) -> AuthorizationResponse:
    try:
        record = service.override(
            authorization_id,
            supervisor_id=payload.supervisor_id,
            justification=payload.justification,
        )
    except AuthorizationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="autorização não encontrada") from exc
    except InvalidAuthorizationStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _record_response(record)


@router.post(
    "/authorizations/{authorization_id}/complete",
    response_model=AuthorizationResponse,
)
def complete_authorization(
    authorization_id: str,
    payload: CompleteRequest,
    service: Annotated[AuthorizationService, Depends(_service)],
) -> AuthorizationResponse:
    try:
        record = service.complete(authorization_id, actor_id=payload.actor_id)
    except AuthorizationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="autorização não encontrada") from exc
    except InvalidAuthorizationStateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return _record_response(record)


@router.get(
    "/authorizations/{authorization_id}/audit",
    response_model=list[AuditEventResponse],
    dependencies=[Depends(_require_supervisor)],
)
def get_audit_events(
    authorization_id: str,
    service: Annotated[AuthorizationService, Depends(_service)],
) -> list[AuditEventResponse]:
    try:
        events = service.audit_events(authorization_id)
    except AuthorizationNotFoundError as exc:
        raise HTTPException(status_code=404, detail="autorização não encontrada") from exc
    return [_audit_response(event) for event in events]


def _outcome_response(outcome: AuthorizationOutcome) -> AuthorizationResponse:
    return _record_response(outcome.record, outcome.compatible_fuels)


def _record_response(
    record: AuthorizationRecord, compatible_fuels: tuple[Fuel, ...] = ()
) -> AuthorizationResponse:
    return AuthorizationResponse(
        authorization_id=record.authorization_id,
        client_request_id=record.client_request_id,
        status=record.status,
        requested_fuel=record.requested_fuel,
        pump_id=record.pump_id,
        compatible_fuels=list(compatible_fuels),
        reason_code=record.reason_code,
        provider_mode=record.provider_mode,
        created_at=record.created_at,
        expires_at=record.expires_at,
        override_used=record.override_used,
    )


def _audit_response(event: AuditEvent) -> AuditEventResponse:
    return AuditEventResponse(
        event_id=event.event_id,
        authorization_id=event.authorization_id,
        event_type=event.event_type,
        status=event.status,
        reason_code=event.reason_code,
        created_at=event.created_at,
        actor_id=event.actor_id,
        justification=event.justification,
    )

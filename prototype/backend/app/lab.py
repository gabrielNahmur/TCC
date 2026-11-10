from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict

from .dispenser import DispenserSnapshot, DispenserTrace, SimulatedDispenserGateway
from .domain import Fuel, UnknownPumpError


router = APIRouter(prefix="/api/v1/lab", tags=["digital-bench"])


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ConnectivityRequest(StrictModel):
    online: bool


class EmergencyStopRequest(StrictModel):
    active: bool


class NozzleResponse(StrictModel):
    fuel: Fuel
    nozzle_id: str
    gpio: int


class TraceResponse(StrictModel):
    event_id: str
    timestamp: datetime
    direction: str
    event: str
    command_id: str | None
    command_type: str | None
    nozzle_id: str | None
    sequence: int | None
    result: str | None
    reason: str | None


class LabStateResponse(StrictModel):
    pump_id: str
    gateway_mode: str
    transport: str
    controls_enabled: bool
    online: bool
    session_id: str
    unlocked_nozzle_id: str | None
    unlock_expires_at: datetime | None
    last_sequence: int
    emergency_stop_active: bool
    nozzles: list[NozzleResponse]
    traces: list[TraceResponse]


GPIO_BY_FUEL: dict[Fuel, int] = {
    Fuel.GASOLINE: 25,
    Fuel.ETHANOL: 26,
    Fuel.DIESEL_S10: 27,
    Fuel.DIESEL_S500: 13,
    Fuel.GNV: 14,
}


def _gateway(request: Request) -> object:
    return request.app.state.gateway


def _simulated_gateway(
    gateway: Annotated[object, Depends(_gateway)],
) -> SimulatedDispenserGateway:
    if not isinstance(gateway, SimulatedDispenserGateway):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="controles de falha disponíveis somente no gateway simulado",
        )
    return gateway


def _state_response(gateway: object, pump_id: str) -> LabStateResponse:
    snapshot_method = getattr(gateway, "snapshot", None)
    traces_method = getattr(gateway, "traces", None)
    nozzles_method = getattr(gateway, "configured_nozzles", None)
    if snapshot_method is None or traces_method is None or nozzles_method is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="gateway atual não expõe telemetria da bancada",
        )
    try:
        snapshot: DispenserSnapshot = snapshot_method(pump_id)
        traces: tuple[DispenserTrace, ...] = traces_method(pump_id)
        nozzles: dict[Fuel, str] = nozzles_method(pump_id)
    except UnknownPumpError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="bancada não configurada",
        ) from exc

    controls_enabled = isinstance(gateway, SimulatedDispenserGateway)
    return LabStateResponse(
        pump_id=snapshot.pump_id,
        gateway_mode="simulated" if controls_enabled else "mqtt",
        transport=snapshot.transport,
        controls_enabled=controls_enabled,
        online=snapshot.online,
        session_id=snapshot.session_id,
        unlocked_nozzle_id=snapshot.unlocked_nozzle_id,
        unlock_expires_at=snapshot.unlock_expires_at,
        last_sequence=snapshot.last_sequence,
        emergency_stop_active=snapshot.emergency_stop_active,
        nozzles=[
            NozzleResponse(fuel=fuel, nozzle_id=nozzle_id, gpio=GPIO_BY_FUEL[fuel])
            for fuel, nozzle_id in nozzles.items()
        ],
        traces=[_trace_response(trace) for trace in traces],
    )


def _trace_response(trace: DispenserTrace) -> TraceResponse:
    return TraceResponse(
        event_id=trace.event_id,
        timestamp=trace.timestamp,
        direction=trace.direction,
        event=trace.event,
        command_id=trace.command_id,
        command_type=trace.command_type,
        nozzle_id=trace.nozzle_id,
        sequence=trace.sequence,
        result=trace.result,
        reason=trace.reason,
    )


@router.get("/pumps/{pump_id}", response_model=LabStateResponse)
def get_lab_state(
    pump_id: str,
    gateway: Annotated[object, Depends(_gateway)],
) -> LabStateResponse:
    return _state_response(gateway, pump_id)


@router.post("/pumps/{pump_id}/connectivity", response_model=LabStateResponse)
def set_connectivity(
    pump_id: str,
    payload: ConnectivityRequest,
    gateway: Annotated[SimulatedDispenserGateway, Depends(_simulated_gateway)],
) -> LabStateResponse:
    try:
        gateway.set_online(pump_id, payload.online)
    except UnknownPumpError as exc:
        raise HTTPException(status_code=404, detail="bancada não configurada") from exc
    return _state_response(gateway, pump_id)


@router.post("/pumps/{pump_id}/emergency-stop", response_model=LabStateResponse)
def set_emergency_stop(
    pump_id: str,
    payload: EmergencyStopRequest,
    gateway: Annotated[SimulatedDispenserGateway, Depends(_simulated_gateway)],
) -> LabStateResponse:
    try:
        gateway.set_emergency_stop(pump_id, payload.active)
    except UnknownPumpError as exc:
        raise HTTPException(status_code=404, detail="bancada não configurada") from exc
    return _state_response(gateway, pump_id)


@router.post("/pumps/{pump_id}/traces/clear", response_model=LabStateResponse)
def clear_traces(
    pump_id: str,
    gateway: Annotated[SimulatedDispenserGateway, Depends(_simulated_gateway)],
) -> LabStateResponse:
    try:
        gateway.clear_traces(pump_id)
    except UnknownPumpError as exc:
        raise HTTPException(status_code=404, detail="bancada não configurada") from exc
    return _state_response(gateway, pump_id)

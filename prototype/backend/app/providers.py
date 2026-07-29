from __future__ import annotations

import re

from .domain import (
    InvalidPlateError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    VehicleData,
    VehicleNotFoundError,
)


_PLATE_PATTERN = re.compile(r"^[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z0-9][0-9]{2})$")


def normalize_plate(plate: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9]", "", plate).upper()
    if not _PLATE_PATTERN.fullmatch(normalized):
        raise InvalidPlateError("placa deve seguir o formato brasileiro")
    return normalized


class MockVehicleDataProvider:
    """Provedor determinístico contendo somente placas fictícias."""

    mode = "mock"

    _VEHICLES = {
        "AAA1A11": VehicleData("GASOLINA", "MOCK-GASOLINE"),
        "BBB2B22": VehicleData("ETANOL", "MOCK-ETHANOL"),
        "CCC3C33": VehicleData("GASOLINA/ETANOL", "MOCK-FLEX"),
        "DDD4D44": VehicleData("DIESEL S10", "MOCK-DIESEL-S10"),
        "JJJ9J99": VehicleData("DIESEL", "MOCK-DIESEL-GRADE-UNKNOWN"),
        "EEE5E55": VehicleData("GASOLINA/ELETRICO", "MOCK-HYBRID"),
        "FFF6F66": VehicleData("ELETRICO", "MOCK-ELECTRIC"),
        "GGG7G77": VehicleData("GASOLINA/GNV/CONVERSAO", "MOCK-CONVERTED"),
        "HHH8H88": VehicleData("GASOLINA/CONVERSAO", "MOCK-AMBIGUOUS"),
    }

    def get_vehicle(self, plate: str) -> VehicleData:
        normalized = normalize_plate(plate)
        if normalized == "TTT1T11":
            raise ProviderTimeoutError("timeout sintético")
        if normalized == "UUU2U22":
            raise ProviderUnavailableError("indisponibilidade sintética")
        try:
            return self._VEHICLES[normalized]
        except KeyError as exc:
            raise VehicleNotFoundError("veículo sintético não encontrado") from exc


class SenatranVehicleDataProvider:
    """Marcador explícito para a futura integração; não realiza chamadas reais."""

    mode = "senatran"

    def get_vehicle(self, plate: str) -> VehicleData:
        normalize_plate(plate)
        raise ProviderUnavailableError(
            "adaptador SENATRAN não habilitado neste protótipo"
        )

from __future__ import annotations

import pytest

from app.domain import Fuel, MappingStatus
from app.fuel_mapping import map_vehicle_fuels


@pytest.mark.parametrize(
    ("description", "expected"),
    [
        ("Gasolina", (Fuel.GASOLINE,)),
        ("Álcool", (Fuel.ETHANOL,)),
        ("gasolina / etanol", (Fuel.GASOLINE, Fuel.ETHANOL)),
        ("Diesel S10", (Fuel.DIESEL_S10,)),
        ("Diesel S500", (Fuel.DIESEL_S500,)),
        ("Gasolina/Elétrico", (Fuel.GASOLINE,)),
        ("Gasolina/GNV", (Fuel.GASOLINE, Fuel.GNV)),
    ],
)
def test_known_descriptions_are_normalized(description, expected) -> None:
    result = map_vehicle_fuels(description)

    assert result.status is MappingStatus.RESOLVED
    assert result.compatible_fuels == expected


def test_electric_vehicle_has_no_combustible_fuel() -> None:
    result = map_vehicle_fuels("Elétrico")

    assert result.status is MappingStatus.NO_COMBUSTIBLE_FUEL
    assert result.compatible_fuels == ()


@pytest.mark.parametrize("description", ["", "HIDROGÊNIO", "não informado", "Diesel"])
def test_unknown_descriptions_are_not_authorizable(description) -> None:
    result = map_vehicle_fuels(description)

    assert result.status in {MappingStatus.UNKNOWN, MappingStatus.AMBIGUOUS}
    assert result.compatible_fuels == ()


def test_partly_known_conversion_is_ambiguous_not_partially_authorized() -> None:
    result = map_vehicle_fuels("Gasolina/Conversão")

    assert result.status is MappingStatus.AMBIGUOUS
    assert result.compatible_fuels == ()

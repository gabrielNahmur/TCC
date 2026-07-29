from __future__ import annotations

import re
import unicodedata

from .domain import Fuel, FuelMappingResult, MappingStatus


_TOKEN_TO_FUEL: dict[str, Fuel] = {
    "GASOLINA": Fuel.GASOLINE,
    "ETANOL": Fuel.ETHANOL,
    "ALCOOL": Fuel.ETHANOL,
    "DIESEL S10": Fuel.DIESEL_S10,
    "DIESEL S500": Fuel.DIESEL_S500,
    "GNV": Fuel.GNV,
    "GAS NATURAL": Fuel.GNV,
    "GAS NATURAL VEICULAR": Fuel.GNV,
}
_NON_COMBUSTIBLE_TOKENS = {"ELETRICO", "ELETRICIDADE"}
_AMBIGUOUS_TOKENS = {
    "CONVERSAO",
    "DIESEL",
    "OUTRO",
    "NAO INFORMADO",
    "INDEFINIDO",
}


def _normalize(value: str) -> str:
    without_accents = "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    return re.sub(r"\s+", " ", without_accents.upper().strip())


def map_vehicle_fuels(description: str) -> FuelMappingResult:
    """Converte descrições do provedor em produtos liberáveis de forma conservadora.

    Não são codificados números de combustível da SENATRAN sem documentação
    contratual. Qualquer token desconhecido torna o resultado não autorizável.
    """

    normalized = _normalize(description)
    if not normalized:
        return FuelMappingResult(MappingStatus.UNKNOWN, ())

    tokens = [token.strip() for token in re.split(r"[/+,;]", normalized)]
    fuels: set[Fuel] = set()
    saw_non_combustible = False
    saw_ambiguous = False
    saw_unknown = False

    for token in tokens:
        if not token:
            continue
        if token in _TOKEN_TO_FUEL:
            fuels.add(_TOKEN_TO_FUEL[token])
        elif token in _NON_COMBUSTIBLE_TOKENS:
            saw_non_combustible = True
        elif token in _AMBIGUOUS_TOKENS:
            saw_ambiguous = True
        else:
            saw_unknown = True

    ordered = tuple(fuel for fuel in Fuel if fuel in fuels)
    if saw_ambiguous or (saw_unknown and fuels):
        return FuelMappingResult(MappingStatus.AMBIGUOUS, ())
    if saw_unknown:
        return FuelMappingResult(MappingStatus.UNKNOWN, ())
    if not fuels and saw_non_combustible:
        return FuelMappingResult(MappingStatus.NO_COMBUSTIBLE_FUEL, ())
    if not fuels:
        return FuelMappingResult(MappingStatus.UNKNOWN, ())
    return FuelMappingResult(MappingStatus.RESOLVED, ordered)

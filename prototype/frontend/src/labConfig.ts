import type { Fuel, LabNozzle } from "./types";

export interface LabNozzleVisual extends LabNozzle {
  label: string;
  color: string;
  darkColor: string;
}

export const LAB_NOZZLES: LabNozzleVisual[] = [
  {
    fuel: "GASOLINE",
    label: "Gasolina",
    nozzle_id: "nozzle-gasoline",
    gpio: 25,
    color: "#e5b63f",
    darkColor: "#79550a"
  },
  {
    fuel: "ETHANOL",
    label: "Etanol",
    nozzle_id: "nozzle-ethanol",
    gpio: 26,
    color: "#5fb982",
    darkColor: "#205f3b"
  },
  {
    fuel: "DIESEL_S10",
    label: "Diesel S10",
    nozzle_id: "nozzle-diesel-s10",
    gpio: 27,
    color: "#d66f55",
    darkColor: "#773224"
  },
  {
    fuel: "DIESEL_S500",
    label: "Diesel S500",
    nozzle_id: "nozzle-diesel-s500",
    gpio: 13,
    color: "#8b70c6",
    darkColor: "#493379"
  },
  {
    fuel: "GNV",
    label: "GNV",
    nozzle_id: "nozzle-gnv",
    gpio: 14,
    color: "#4d91c7",
    darkColor: "#214f75"
  }
];

export const NOZZLE_ID_BY_FUEL = Object.fromEntries(
  LAB_NOZZLES.map((nozzle) => [nozzle.fuel, nozzle.nozzle_id])
) as Record<Fuel, string>;

const VISUAL_BY_ID = new Map(
  LAB_NOZZLES.map((nozzle) => [nozzle.nozzle_id, nozzle])
);

export function withNozzleVisuals(nozzles?: LabNozzle[]): LabNozzleVisual[] {
  if (!nozzles?.length) return LAB_NOZZLES;

  return nozzles.map((nozzle) => {
    const visual = VISUAL_BY_ID.get(nozzle.nozzle_id);
    return {
      ...nozzle,
      label: visual?.label ?? nozzle.fuel,
      color: visual?.color ?? "#7c8b84",
      darkColor: visual?.darkColor ?? "#34443c"
    };
  });
}

import { config } from "./config";
import type {
  AuthorizationDecision,
  AuthorizationRequest,
  CompatibilityCheck,
  Fuel,
  OverrideRequest
} from "./types";

interface DemoVehicle {
  summary: string;
  fuels: Fuel[];
  reviewReason?: string;
}

export const demoVehicles: Record<string, DemoVehicle> = {
  TCC1A01: { summary: "Veículo sintético — gasolina", fuels: ["GASOLINE"] },
  TCC1A02: { summary: "Veículo sintético — flex", fuels: ["GASOLINE", "ETHANOL"] },
  TCC1A03: { summary: "Veículo sintético — diesel S10", fuels: ["DIESEL_S10"] },
  TCC1A09: { summary: "Veículo sintético — diesel S500", fuels: ["DIESEL_S500"] },
  TCC1A08: { summary: "Veículo sintético — GNV", fuels: ["GASOLINE", "GNV"] },
  TCC1A04: {
    summary: "Veículo sintético — elétrico",
    fuels: [],
    reviewReason: "NO_COMBUSTIBLE_FUEL"
  },
  TCC1A05: { summary: "Veículo sintético não localizado", fuels: [], reviewReason: "VEHICLE_NOT_FOUND" },
  TCC1A06: { summary: "Simulação de indisponibilidade", fuels: [], reviewReason: "PROVIDER_TIMEOUT" },
  TCC1A07: {
    summary: "Veículo sintético com cadastro ambíguo",
    fuels: [],
    reviewReason: "FUEL_MAPPING_AMBIGUOUS"
  }
};

const wait = (milliseconds = 350) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const demoAuthorizations = new Map<string, AuthorizationDecision>();

const getDemoVehicle = (plate: string): DemoVehicle =>
  demoVehicles[plate] ?? { summary: "Veículo sintético — gasolina", fuels: ["GASOLINE"] };

export async function demoCompatibility(plate: string): Promise<CompatibilityCheck> {
  await wait();
  const vehicle = getDemoVehicle(plate);
  return {
    status:
      vehicle.reviewReason === "NO_COMBUSTIBLE_FUEL"
        ? "DENIED"
        : vehicle.reviewReason
          ? "REVIEW_REQUIRED"
          : "AUTHORIZED",
    compatible_fuels: vehicle.fuels,
    reason_code: vehicle.reviewReason ?? "FUEL_COMPATIBLE",
    provider_mode: "mock",
    vehicle_summary: vehicle.summary
  };
}

export async function demoAuthorize(request: AuthorizationRequest): Promise<AuthorizationDecision> {
  await wait();
  const existing = demoAuthorizations.get(request.client_request_id);
  if (existing) return existing;
  const vehicle = getDemoVehicle(request.plate);
  const compatible = vehicle.fuels.includes(request.requested_fuel);
  const status = vehicle.reviewReason ? "REVIEW_REQUIRED" : compatible ? "AUTHORIZED" : "DENIED";

  const decision: AuthorizationDecision = {
    authorization_id: crypto.randomUUID(),
    status,
    compatible_fuels: vehicle.fuels,
    requested_fuel: request.requested_fuel,
    pump_id: request.pump_id,
    reason_code: vehicle.reviewReason ?? (compatible ? undefined : "FUEL_INCOMPATIBLE"),
    provider_mode: "mock",
    created_at: new Date().toISOString(),
    expires_at:
      status === "AUTHORIZED"
        ? new Date(Date.now() + config.authorizationTtlSeconds * 1000).toISOString()
        : undefined,
    override_used: false
  };
  demoAuthorizations.set(request.client_request_id, decision);
  return decision;
}

export async function demoOverride(
  previous: AuthorizationDecision,
  request: OverrideRequest
): Promise<AuthorizationDecision> {
  await wait();
  if (previous.status !== "REVIEW_REQUIRED") {
    throw new Error("Somente decisões REVIEW_REQUIRED permitem override.");
  }
  if (request.token !== "DEMO-SUPERVISOR") {
    throw new Error("Token de demonstração inválido.");
  }
  return {
    ...previous,
    status: "AUTHORIZED",
    reason_code: "OVERRIDE_AUTHORIZED",
    expires_at: new Date(Date.now() + config.authorizationTtlSeconds * 1000).toISOString(),
    override_used: true
  };
}

export async function demoComplete(previous: AuthorizationDecision): Promise<AuthorizationDecision> {
  await wait(150);
  return {
    ...previous,
    status: "COMPLETED",
    reason_code: "AUTHORIZATION_COMPLETED",
    expires_at: undefined
  };
}

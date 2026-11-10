export type Fuel = "GASOLINE" | "ETHANOL" | "DIESEL_S10" | "DIESEL_S500" | "GNV";

export type Decision =
  | "PENDING_DEVICE"
  | "AUTHORIZED"
  | "DENIED"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "EXPIRED"
  | "SUPERSEDED";

export type ReasonCode =
  | "FUEL_INCOMPATIBLE"
  | "NO_COMBUSTIBLE_FUEL"
  | "VEHICLE_NOT_FOUND"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "FUEL_MAPPING_UNKNOWN"
  | "FUEL_MAPPING_AMBIGUOUS"
  | "PUMP_NOT_CONFIGURED"
  | "DISPENSER_UNAVAILABLE"
  | "OVERRIDE_AUTHORIZED"
  | "AUTHORIZATION_EXPIRED"
  | "AUTHORIZATION_COMPLETED"
  | "AUTHORIZATION_SUPERSEDED"
  | "INVALID_PLATE"
  | "INVALID_REQUEST"
  | "DEVICE_COMMAND_PENDING"
  | string;

export interface CompatibilityCheck {
  status: "AUTHORIZED" | "DENIED" | "REVIEW_REQUIRED";
  compatible_fuels: Fuel[];
  reason_code: ReasonCode;
  provider_mode: string;
  vehicle_summary?: string;
}

export interface AuthorizationRequest {
  client_request_id: string;
  plate: string;
  requested_fuel: Fuel;
  attendant_id: string;
  pump_id: string;
}

export interface AuthorizationDecision {
  authorization_id: string;
  client_request_id?: string | null;
  status: Decision;
  compatible_fuels: Fuel[];
  requested_fuel: Fuel;
  pump_id?: string;
  reason_code?: ReasonCode;
  provider_mode?: string;
  created_at?: string;
  expires_at?: string | null;
  override_used?: boolean;
}

export interface OverrideRequest {
  supervisor_id: string;
  justification: string;
  token: string;
}

export interface LabNozzle {
  fuel: Fuel;
  nozzle_id: string;
  gpio: number;
}

export interface LabTrace {
  event_id: string;
  timestamp: string;
  direction: "BACKEND_TO_DEVICE" | "DEVICE_TO_BACKEND";
  event: string;
  command_id?: string | null;
  command_type?: string | null;
  nozzle_id?: string | null;
  sequence?: number | null;
  result?: string | null;
  reason?: string | null;
}

export interface LabState {
  pump_id: string;
  gateway_mode: "visual" | "simulated" | "mqtt";
  transport: "visual" | "in_memory" | "mqtt";
  controls_enabled: boolean;
  online: boolean;
  session_id: string;
  unlocked_nozzle_id: string | null;
  unlock_expires_at: string | null;
  last_sequence: number;
  emergency_stop_active: boolean;
  nozzles: LabNozzle[];
  traces: LabTrace[];
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";
import type { AuthorizationDecision } from "./types";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const pendingAuthorization: AuthorizationDecision = {
  authorization_id: "2f77c1c6-88cf-4d54-967c-90e0c3870bf5",
  status: "AUTHORIZED",
  requested_fuel: "GASOLINE",
  pump_id: "pump-01",
  compatible_fuels: ["GASOLINE"],
  reason_code: "FUEL_COMPATIBLE",
  provider_mode: "mock",
  created_at: "2026-07-29T18:00:00Z",
  expires_at: "2026-07-29T18:01:00Z",
  override_used: false
};

afterEach(() => vi.restoreAllMocks());

describe("contrato HTTP do backend", () => {
  it("consulta por POST sem expor a placa na URL", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        status: "AUTHORIZED",
        compatible_fuels: ["GASOLINE", "ETHANOL"],
        reason_code: "FUEL_COMPATIBLE",
        provider_mode: "mock"
      })
    );

    const response = await api.checkCompatibility("CCC3C33", false);

    expect(response.status).toBe("AUTHORIZED");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:8000/api/v1/compatibility-checks");
    expect(String(url)).not.toContain("CCC3C33");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ plate: "CCC3C33" });
  });

  it("envia actor_id ao concluir e interpreta o estado COMPLETED", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({
        ...pendingAuthorization,
        status: "COMPLETED",
        reason_code: "AUTHORIZATION_COMPLETED",
        expires_at: null
      })
    );

    const response = await api.complete(pendingAuthorization, "attendant-01", false);

    expect(response.status).toBe("COMPLETED");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(`/authorizations/${pendingAuthorization.authorization_id}/complete`);
    expect(JSON.parse(String(init?.body))).toEqual({ actor_id: "attendant-01" });
  });

  it("usa Bearer apenas na operação protegida de override", async () => {
    const review: AuthorizationDecision = {
      ...pendingAuthorization,
      status: "REVIEW_REQUIRED",
      reason_code: "PROVIDER_TIMEOUT",
      expires_at: undefined
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ ...review, status: "AUTHORIZED", reason_code: "OVERRIDE_AUTHORIZED", override_used: true })
    );

    await api.override(
      review,
      { supervisor_id: "supervisor-01", justification: "Documento físico conferido.", token: "secret" },
      false
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
    expect(JSON.parse(String(init?.body))).toEqual({
      supervisor_id: "supervisor-01",
      justification: "Documento físico conferido."
    });
  });
});

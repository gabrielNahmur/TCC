import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function consultSyntheticPlate(plate: string) {
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText("Placa do veículo"));
  await user.type(screen.getByLabelText("Placa do veículo"), plate);
  await user.click(screen.getByRole("button", { name: "Consultar compatibilidade" }));
  return user;
}

describe("fluxo seguro de autorização", () => {
  it("inicia bloqueado e não habilita consulta para placa inválida", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getAllByText("Sem liberação nesta operação").length).toBeGreaterThan(0);
    const consultButton = screen.getByRole("button", { name: "Consultar compatibilidade" });
    expect(consultButton).toBeDisabled();

    await user.type(screen.getByLabelText("Placa do veículo"), "ABC12");
    expect(consultButton).toBeDisabled();
  });

  it("libera apenas uma opção compatível no cenário flex", async () => {
    render(<App />);
    const user = await consultSyntheticPlate("TCC1A02");

    expect(await screen.findByText("Escolha entre os combustíveis compatíveis")).toBeInTheDocument();
    const fuelOptions = screen.getAllByRole("radio");
    expect(fuelOptions).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: /Gasolina Compatível/ }));
    await user.click(screen.getByRole("button", { name: "Solicitar liberação" }));

    expect(await screen.findByText(/Trava de Gasolina liberada na pump-01/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encerrar e bloquear agora" })).toBeEnabled();
  });

  it("mantém o bloqueio em timeout e exige supervisor para override", async () => {
    render(<App />);
    const user = await consultSyntheticPlate("TCC1A06");

    expect(await screen.findByText("Revisão humana necessária")).toBeInTheDocument();
    expect(screen.getByText("Liberação automática impedida")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Diesel S10 Sujeito a override/ }));
    await user.click(screen.getByRole("button", { name: "Encaminhar para revisão" }));

    expect(await screen.findByText("Revisão obrigatória")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Autorizar excepcionalmente" })).toBeDisabled();

    await user.type(screen.getByLabelText("Identificação do supervisor"), "SUP-01");
    await user.type(screen.getByLabelText("Token de supervisão"), "DEMO-SUPERVISOR");
    await user.type(screen.getByLabelText(/Justificativa/), "Veículo conferido no documento físico.");
    await user.click(screen.getByRole("button", { name: "Autorizar excepcionalmente" }));

    expect(await screen.findByText(/Trava de Diesel S10 liberada na pump-01/)).toBeInTheDocument();
  });

  it("não oferece override fora de REVIEW_REQUIRED", async () => {
    render(<App />);
    const user = await consultSyntheticPlate("TCC1A01");

    expect(await screen.findAllByRole("radio")).toHaveLength(1);
    expect(screen.queryByRole("radio", { name: /Diesel/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Gasolina Compatível/ }));
    await user.click(screen.getByRole("button", { name: "Solicitar liberação" }));
    expect(await screen.findByText(/Trava de Gasolina liberada/)).toBeInTheDocument();
    expect(screen.queryByText("Liberação excepcional")).not.toBeInTheDocument();
  });

  it("encerra o fluxo bloqueado quando não há combustível para a bancada", async () => {
    render(<App />);
    await consultSyntheticPlate("TCC1A04");

    expect(await screen.findByText("Abastecimento não autorizado")).toBeInTheDocument();
    expect(screen.getByText(/não indica um combustível disponível/)).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryByText("Liberação excepcional")).not.toBeInTheDocument();
  });

  it("não trata as duas especificações de diesel como um único produto", async () => {
    render(<App />);
    await consultSyntheticPlate("TCC1A03");

    expect(await screen.findByRole("radio", { name: /Diesel S10 Compatível/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Diesel S500/ })).not.toBeInTheDocument();
  });

  it("reconcilia timeout com a mesma chave sem afirmar que o backend não liberou", async () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "AUTHORIZED",
            compatible_fuels: ["GASOLINE"],
            reason_code: "FUEL_COMPATIBLE",
            provider_mode: "mock"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockRejectedValueOnce(new TypeError("conexão interrompida"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_id: "a9e0b746-bd73-4477-b13a-8b9e46773b9e",
            status: "AUTHORIZED",
            requested_fuel: "GASOLINE",
            pump_id: "pump-01",
            compatible_fuels: ["GASOLINE"],
            reason_code: "FUEL_COMPATIBLE",
            provider_mode: "mock",
            created_at: new Date().toISOString(),
            expires_at: expiresAt,
            override_used: false
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Ativar modo de demonstração"));
    await user.type(screen.getByLabelText("Placa do veículo"), "AAA1A11");
    await user.click(screen.getByRole("button", { name: "Consultar compatibilidade" }));
    await user.click(await screen.findByRole("radio", { name: /Gasolina Compatível/ }));
    await user.click(screen.getByRole("button", { name: "Solicitar liberação" }));

    expect(await screen.findByText("Resultado não confirmado")).toBeInTheDocument();
    expect(screen.getByText(/servidor pode ter processado/)).toBeInTheDocument();
    expect(screen.queryByText(/nenhum bico foi liberado/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const originalBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));

    await user.click(screen.getByRole("button", { name: "Verificar resultado com a mesma chave" }));

    expect(await screen.findByText(/Trava de Gasolina liberada na pump-01/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const reconciliationBody = JSON.parse(String(fetchMock.mock.calls[2][1]?.body));
    expect(reconciliationBody.client_request_id).toBe(originalBody.client_request_id);
    expect(reconciliationBody).toEqual(originalBody);
  });

  it("não oferece override para REVIEW_REQUIRED de origem operacional", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "AUTHORIZED",
            compatible_fuels: ["GASOLINE"],
            reason_code: "FUEL_COMPATIBLE",
            provider_mode: "mock"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            authorization_id: "58cc50f2-0d30-4cb7-8206-479cc1519a02",
            status: "REVIEW_REQUIRED",
            requested_fuel: "GASOLINE",
            pump_id: "pump-01",
            compatible_fuels: [],
            reason_code: "PUMP_BUSY",
            provider_mode: "mock",
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60_000).toISOString(),
            override_used: false
          }),
          { status: 201, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Ativar modo de demonstração"));
    await user.type(screen.getByLabelText("Placa do veículo"), "AAA1A11");
    await user.click(screen.getByRole("button", { name: "Consultar compatibilidade" }));
    await user.click(await screen.findByRole("radio", { name: /Gasolina Compatível/ }));
    await user.click(screen.getByRole("button", { name: "Solicitar liberação" }));

    expect(await screen.findByText("Este motivo não permite override.")).toBeInTheDocument();
    expect(screen.getByText(/Aguarde o TTL da operação ativa/)).toBeInTheDocument();
    expect(screen.queryByText("Liberação excepcional")).not.toBeInTheDocument();
  });

  it("reconcilia override sem repetir a liberação quando a resposta se perde", async () => {
    const baseReview = {
      authorization_id: "2201cfb0-e432-48c2-a2cf-f8a2b169feaa",
      status: "REVIEW_REQUIRED",
      requested_fuel: "GASOLINE",
      pump_id: "pump-01",
      compatible_fuels: [],
      reason_code: "PROVIDER_TIMEOUT",
      provider_mode: "mock",
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      override_used: false
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "REVIEW_REQUIRED",
            compatible_fuels: [],
            reason_code: "PROVIDER_TIMEOUT",
            provider_mode: "mock"
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(baseReview), {
          status: 201,
          headers: { "Content-Type": "application/json" }
        })
      )
      .mockRejectedValueOnce(new TypeError("resposta perdida"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...baseReview,
            status: "AUTHORIZED",
            reason_code: "OVERRIDE_AUTHORIZED",
            override_used: true
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Ativar modo de demonstração"));
    await user.type(screen.getByLabelText("Placa do veículo"), "TTT1T11");
    await user.click(screen.getByRole("button", { name: "Consultar compatibilidade" }));
    await user.click(await screen.findByRole("radio", { name: /Gasolina Sujeito a override/ }));
    await user.click(screen.getByRole("button", { name: "Encaminhar para revisão" }));
    await screen.findByText("Liberação excepcional");
    await user.type(screen.getByLabelText("Identificação do supervisor"), "supervisor-01");
    await user.type(screen.getByLabelText("Token de supervisão"), "secret-token");
    await user.type(screen.getByLabelText(/Justificativa/), "Documento físico conferido pelo supervisor.");
    await user.click(screen.getByRole("button", { name: "Autorizar excepcionalmente" }));

    expect(await screen.findByText("O resultado da operação não foi confirmado.")).toBeInTheDocument();
    expect(screen.getByText("Estado físico desconhecido")).toBeInTheDocument();
    expect(screen.getByText(/Não repita a liberação/)).toBeInTheDocument();
    expect(screen.queryByText("Liberação excepcional")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await user.click(screen.getByRole("button", { name: "Verificar estado da autorização" }));

    expect(await screen.findByText(/Trava de Gasolina liberada na pump-01/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3][1]?.method).toBe("GET");
  });
});

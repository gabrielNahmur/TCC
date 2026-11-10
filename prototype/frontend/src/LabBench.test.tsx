import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import LabBench from "./LabBench";
import type { AuthorizationDecision, LabState } from "./types";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const authorization: AuthorizationDecision = {
  authorization_id: "4fd1399b-074e-4c25-b00f-74588c0caa82",
  status: "AUTHORIZED",
  requested_fuel: "GASOLINE",
  pump_id: "pump-01",
  compatible_fuels: ["GASOLINE"],
  reason_code: "FUEL_COMPATIBLE",
  provider_mode: "mock",
  expires_at: new Date(Date.now() + 30_000).toISOString()
};

describe("bancada digital", () => {
  it("abre a planta com os cinco bicos presos nos suportes", () => {
    render(
      <LabBench decision={null} demoMode pumpId="pump-01" remainingSeconds={0} />
    );

    expect(screen.getByRole("tab", { name: "Vista da bancada" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByText("Todos os bicos no estado seguro")).toBeInTheDocument();
    expect(screen.getAllByText("Preso")).toHaveLength(5);
    expect(screen.getByText(/representação didática no navegador/)).toBeInTheDocument();
  });

  it("mostra somente a trava e o GPIO autorizados", async () => {
    const user = userEvent.setup();
    const decisionWithForbiddenFields = {
      ...authorization,
      plate: "ABC1D23",
      renavam: "12345678901",
      owner_name: "Pessoa de teste"
    } as AuthorizationDecision;
    render(
      <LabBench
        decision={decisionWithForbiddenFields}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    expect(screen.getByText("Trava de Gasolina liberada")).toBeInTheDocument();
    expect(screen.getAllByText("Retirar")).toHaveLength(1);
    expect(screen.queryByText("ABC1D23")).not.toBeInTheDocument();
    expect(screen.queryByText("12345678901")).not.toBeInTheDocument();
    expect(screen.queryByText("Pessoa de teste")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Diagnóstico técnico" }));

    expect(screen.getByText("1 TRAVA LIBERADA")).toBeInTheDocument();
    expect(screen.getAllByText("Liberado")).toHaveLength(1);
    expect(screen.getAllByText("HIGH")).toHaveLength(1);
    expect((await screen.findAllByText("Comando enviado")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("ACK recebido").length).toBeGreaterThan(0);
  });

  it("parada de emergência desenergiza a representação visual", async () => {
    const user = userEvent.setup();
    render(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    await user.click(screen.getByRole("button", { name: "Acionar parada" }));

    expect(screen.getByText("Parada de emergência acionada")).toBeInTheDocument();
    expect(screen.getAllByText("Preso")).toHaveLength(5);
  });

  it("recusa bico incorreto e preserva a retirada ao trocar de vista", async () => {
    const user = userEvent.setup();
    render(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    await user.click(screen.getByRole("button", { name: /Etanol.*Preso/ }));
    expect(screen.getByText(/Etanol permanece preso/)).toBeInTheDocument();

    const gasolineButton = screen.getByRole("button", { name: /Gasolina.*Retirar/ });
    gasolineButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: /Gasolina.*Devolver/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Etanol.*Preso/ }));
    expect(screen.getByText(/Devolva Gasolina antes de tentar outro bico/)).toBeInTheDocument();
    expect(screen.getAllByText("Devolver")).toHaveLength(1);

    await user.click(screen.getByRole("tab", { name: "Diagnóstico técnico" }));
    await user.click(screen.getByRole("tab", { name: "Vista da bancada" }));

    const returnButton = screen.getByRole("button", { name: /Gasolina.*Devolver/ });
    expect(returnButton).toBeInTheDocument();
    returnButton.focus();
    await user.keyboard(" ");
    expect(screen.getAllByText("Preso")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Gasolina.*Retirar/ })).toBeInTheDocument();
  });

  it("mantém o bico fora quando o TTL termina e exige devolução manual", async () => {
    const user = userEvent.setup();
    const view = render(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    await user.click(screen.getByRole("button", { name: /Gasolina.*Retirar/ }));
    view.rerender(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={0}
      />
    );

    expect(screen.getByRole("button", { name: /Gasolina.*Devolver/ })).toBeInTheDocument();
    expect(screen.getByText(/A saída está LOW.*Devolva o bico/)).toBeInTheDocument();
  });

  it("não recolhe o bico nem reativa a autorização após emergência", async () => {
    const user = userEvent.setup();
    render(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    await user.click(screen.getByRole("button", { name: /Gasolina.*Retirar/ }));
    await user.click(screen.getByRole("button", { name: "Acionar parada" }));

    expect(screen.getByRole("button", { name: /Gasolina.*Devolver/ })).toBeInTheDocument();
    expect(screen.getByText(/Gasolina permanece fora.*devolva o bico/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Liberar parada" }));
    await user.click(screen.getByRole("button", { name: /Gasolina.*Devolver/ }));

    expect(screen.queryByText("Retirar")).not.toBeInTheDocument();
    expect(screen.getAllByText("Preso")).toHaveLength(5);
  });

  it("mantém o bico fora na perda de conexão e não revive a liberação", async () => {
    const user = userEvent.setup();
    render(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    await user.click(screen.getByRole("button", { name: /Gasolina.*Retirar/ }));
    await user.click(screen.getByRole("tab", { name: "Diagnóstico técnico" }));
    await user.click(screen.getByRole("button", { name: "Desconectar" }));
    await user.click(screen.getByRole("tab", { name: "Vista da bancada" }));

    expect(screen.getByText("Controlador sem comunicação")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Gasolina.*Devolver/ })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Diagnóstico técnico" }));
    await user.click(screen.getByRole("button", { name: "Reconectar" }));
    await user.click(screen.getByRole("tab", { name: "Vista da bancada" }));
    await user.click(screen.getByRole("button", { name: /Gasolina.*Devolver/ }));

    expect(screen.queryByText("Retirar")).not.toBeInTheDocument();
  });

  it("permite retirar e devolver por toque e mouse somente o bico liberado", () => {
    class MockPointerEvent extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;

      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "mouse";
      }
    }
    vi.stubGlobal("PointerEvent", MockPointerEvent);

    const { container } = render(
      <LabBench
        decision={authorization}
        demoMode
        pumpId="pump-01"
        remainingSeconds={30}
      />
    );

    const svg = container.querySelector("svg.plant-svg");
    if (!(svg instanceof SVGSVGElement)) throw new Error("SVG da planta não encontrado");
    vi.spyOn(svg, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 1100,
      height: 650,
      top: 0,
      right: 1100,
      bottom: 650,
      left: 0,
      toJSON: () => ({})
    });

    const gasoline = screen.getByTestId("scene-nozzle-nozzle-gasoline");
    fireEvent.pointerDown(gasoline, { pointerId: 7, pointerType: "touch", clientX: 335, clientY: 326 });
    fireEvent.pointerMove(gasoline, { pointerId: 7, pointerType: "touch", clientX: 865, clientY: 150 });
    fireEvent.pointerUp(gasoline, { pointerId: 7, pointerType: "touch", clientX: 865, clientY: 150 });

    expect(screen.getByRole("button", { name: /Gasolina.*Devolver/ })).toBeInTheDocument();

    fireEvent.pointerDown(gasoline, { pointerId: 8, pointerType: "touch", clientX: 865, clientY: 150 });
    fireEvent.pointerMove(gasoline, { pointerId: 8, pointerType: "touch", clientX: 335, clientY: 326 });
    fireEvent.pointerUp(gasoline, { pointerId: 8, pointerType: "touch", clientX: 335, clientY: 326 });
    expect(screen.getAllByText("Preso")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Gasolina.*Retirar/ })).toBeInTheDocument();

    fireEvent.pointerDown(gasoline, { pointerId: 9, pointerType: "mouse", clientX: 335, clientY: 326 });
    fireEvent.pointerMove(gasoline, { pointerId: 9, pointerType: "mouse", clientX: 865, clientY: 150 });
    fireEvent.pointerUp(gasoline, { pointerId: 9, pointerType: "mouse", clientX: 865, clientY: 150 });
    expect(screen.getByRole("button", { name: /Gasolina.*Devolver/ })).toBeInTheDocument();

    fireEvent.pointerDown(gasoline, { pointerId: 10, pointerType: "mouse", clientX: 865, clientY: 150 });
    fireEvent.pointerMove(gasoline, { pointerId: 10, pointerType: "mouse", clientX: 335, clientY: 326 });
    fireEvent.pointerUp(gasoline, { pointerId: 10, pointerType: "mouse", clientX: 335, clientY: 326 });
    expect(screen.getAllByText("Preso")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Gasolina.*Retirar/ })).toBeInTheDocument();
  });

  it("não apresenta bloqueio como confirmado antes da telemetria", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => undefined));

    render(
      <LabBench decision={null} demoMode={false} pumpId="pump-01" remainingSeconds={0} />
    );

    expect(screen.getByText("Estado físico não confirmado")).toBeInTheDocument();
    expect(screen.queryByText("Todos os bicos no estado seguro")).not.toBeInTheDocument();
  });

  it("distingue telemetria real do gateway Python", async () => {
    const state: LabState = {
      pump_id: "pump-01",
      gateway_mode: "simulated",
      transport: "in_memory",
      controls_enabled: true,
      online: true,
      session_id: "backend-session",
      unlocked_nozzle_id: null,
      unlock_expires_at: null,
      last_sequence: 2,
      emergency_stop_active: false,
      nozzles: [],
      traces: []
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(state), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );

    render(
      <LabBench decision={null} demoMode={false} pumpId="pump-01" remainingSeconds={0} />
    );

    expect(await screen.findByText("Gateway Python em memória")).toBeInTheDocument();
    expect(screen.queryByText(/representação didática no navegador/)).not.toBeInTheDocument();
  });
});

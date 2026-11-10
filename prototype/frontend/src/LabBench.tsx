import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowRight,
  CircuitBoard,
  Cpu,
  Fuel as FuelIcon,
  Laptop,
  LockKeyhole,
  OctagonX,
  Power,
  Radio,
  RefreshCw,
  Server,
  ShieldCheck,
  Trash2,
  UnlockKeyhole,
  Wifi,
  WifiOff
} from "lucide-react";
import { api } from "./api";
import { LAB_NOZZLES, NOZZLE_ID_BY_FUEL, withNozzleVisuals } from "./labConfig";
import PhysicalPlant from "./PhysicalPlant";
import type { AuthorizationDecision, LabState, LabTrace } from "./types";

interface LabBenchProps {
  decision: AuthorizationDecision | null;
  demoMode: boolean;
  pumpId: string;
  remainingSeconds: number;
}

const eventLabels: Record<string, string> = {
  DEVICE_ONLINE: "Dispositivo conectado",
  DEVICE_OFFLINE: "Dispositivo desconectado",
  BROKER_DISCONNECTED: "Broker desconectado",
  COMMAND_SENT: "Comando enviado",
  COMMAND_ACK: "ACK recebido",
  COMMAND_ACK_TIMEOUT: "ACK não recebido",
  TTL_EXPIRED: "TTL expirou",
  EMERGENCY_STOP: "Parada acionada",
  EMERGENCY_STOP_RELEASED: "Parada liberada",
  FAIL_SAFE_LOCK: "Bloqueio de segurança"
};

const nowIso = () => new Date().toISOString();

function trace(
  direction: LabTrace["direction"],
  event: string,
  values: Partial<LabTrace> = {}
): LabTrace {
  return {
    event_id: crypto.randomUUID(),
    timestamp: nowIso(),
    direction,
    event,
    ...values
  };
}

function demoEventsFor(decision: AuthorizationDecision): LabTrace[] {
  const sequence = Math.max(1, Math.floor(Date.now() / 1000));
  const lockId = crypto.randomUUID();
  const lock = [
    trace("BACKEND_TO_DEVICE", "COMMAND_SENT", {
      command_id: lockId,
      command_type: "LOCK_ALL",
      sequence,
      result: "VISUAL_ONLY"
    }),
    trace("DEVICE_TO_BACKEND", "COMMAND_ACK", {
      command_id: lockId,
      command_type: "LOCK_ALL",
      sequence,
      result: "APPLIED"
    })
  ];
  if (decision.status !== "AUTHORIZED") return lock;

  const unlockId = crypto.randomUUID();
  const nozzleId = NOZZLE_ID_BY_FUEL[decision.requested_fuel];
  return [
    ...lock,
    trace("BACKEND_TO_DEVICE", "COMMAND_SENT", {
      command_id: unlockId,
      command_type: "UNLOCK",
      nozzle_id: nozzleId,
      sequence: sequence + 1,
      result: "VISUAL_ONLY"
    }),
    trace("DEVICE_TO_BACKEND", "COMMAND_ACK", {
      command_id: unlockId,
      command_type: "UNLOCK",
      nozzle_id: nozzleId,
      sequence: sequence + 1,
      result: "APPLIED"
    })
  ];
}

const displayTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));

export default function LabBench({
  decision,
  demoMode,
  pumpId,
  remainingSeconds
}: LabBenchProps) {
  const [remoteState, setRemoteState] = useState<LabState | null>(null);
  const [demoOnline, setDemoOnline] = useState(true);
  const [demoEmergency, setDemoEmergency] = useState(false);
  const [demoInvalidatedAuthorizationId, setDemoInvalidatedAuthorizationId] = useState("");
  const [activeLabView, setActiveLabView] = useState<"plant" | "diagnostics">("plant");
  const [labNow, setLabNow] = useState(() => Date.now());
  const [demoTraces, setDemoTraces] = useState<LabTrace[]>([
    trace("DEVICE_TO_BACKEND", "DEVICE_ONLINE", { result: "LOCKED_ON_START" })
  ]);
  const [error, setError] = useState("");
  const [changingState, setChangingState] = useState(false);
  const lastDecisionSignature = useRef("");
  const loggedExpiration = useRef("");

  useEffect(() => {
    if (!demoMode || !decision) return;
    const signature = [
      decision.authorization_id,
      decision.status,
      decision.reason_code,
      decision.expires_at
    ].join(":");
    if (signature === lastDecisionSignature.current) return;
    lastDecisionSignature.current = signature;
    if (decision.authorization_id !== demoInvalidatedAuthorizationId) {
      setDemoInvalidatedAuthorizationId("");
    }
    setDemoTraces((current) => [...current, ...demoEventsFor(decision)].slice(-100));
  }, [decision, demoInvalidatedAuthorizationId, demoMode]);

  useEffect(() => {
    if (
      !demoMode ||
      decision?.status !== "AUTHORIZED" ||
      remainingSeconds > 0 ||
      loggedExpiration.current === decision.authorization_id
    ) {
      return;
    }
    loggedExpiration.current = decision.authorization_id;
    setDemoTraces((current) => [
      ...current,
      trace("DEVICE_TO_BACKEND", "TTL_EXPIRED", {
        result: "LOCKED",
        reason: "AUTHORIZATION_TTL_EXPIRED"
      })
    ].slice(-100));
  }, [decision, demoMode, remainingSeconds]);

  useEffect(() => {
    if (demoMode) {
      setRemoteState(null);
      setError("");
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const next = await api.getLabState(pumpId);
        if (!cancelled) {
          setRemoteState(next);
          setError("");
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Telemetria indisponível.");
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, 800);
      }
    };
    void poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [demoMode, pumpId]);

  useEffect(() => {
    const timer = window.setInterval(() => setLabNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const visualState = useMemo<LabState>(() => {
    const active =
      demoOnline &&
      !demoEmergency &&
      decision?.status === "AUTHORIZED" &&
      decision.authorization_id !== demoInvalidatedAuthorizationId &&
      remainingSeconds > 0;
    return {
      pump_id: pumpId,
      gateway_mode: "visual",
      transport: "visual",
      controls_enabled: true,
      online: demoOnline,
      session_id: "visual-session",
      unlocked_nozzle_id: active ? NOZZLE_ID_BY_FUEL[decision.requested_fuel] : null,
      unlock_expires_at: active ? decision.expires_at ?? null : null,
      last_sequence: demoTraces.reduce(
        (highest, item) => Math.max(highest, item.sequence ?? 0),
        0
      ),
      emergency_stop_active: demoEmergency,
      nozzles: LAB_NOZZLES,
      traces: demoTraces
    };
  }, [decision, demoEmergency, demoInvalidatedAuthorizationId, demoOnline, demoTraces, pumpId, remainingSeconds]);

  const state = demoMode ? visualState : remoteState;
  const stateConfirmed = Boolean(state) && (demoMode || !error);
  const unlocked = stateConfirmed ? state?.unlocked_nozzle_id ?? null : null;
  const isLocked = stateConfirmed && !unlocked;
  const displayedNozzles = withNozzleVisuals(state?.nozzles);
  const labRemainingSeconds = demoMode
    ? remainingSeconds
    : stateConfirmed && state?.unlock_expires_at
      ? Math.max(0, Math.ceil((new Date(state.unlock_expires_at).getTime() - labNow) / 1000))
      : 0;
  const traceRows = [...(state?.traces ?? [])].reverse().slice(0, 14);
  const modeLabel = demoMode
    ? "Emulação visual"
    : state?.gateway_mode === "mqtt"
      ? "PICSimLab / ESP32 via MQTT"
      : "Gateway Python em memória";

  const setConnectivity = async () => {
    if (!state) return;
    setChangingState(true);
    setError("");
    try {
      if (demoMode) {
        const nextOnline = !demoOnline;
        setDemoOnline(nextOnline);
        if (!nextOnline && decision?.status === "AUTHORIZED") {
          setDemoInvalidatedAuthorizationId(decision.authorization_id);
        }
        setDemoTraces((current) => [
          ...current,
          trace("DEVICE_TO_BACKEND", nextOnline ? "DEVICE_ONLINE" : "DEVICE_OFFLINE", {
            result: nextOnline ? "LOCKED_ON_RECONNECT" : "LOCKED",
            reason: nextOnline ? undefined : "SIMULATED_CONNECTION_LOSS"
          })
        ].slice(-100));
      } else {
        setRemoteState(await api.setLabConnectivity(pumpId, !state.online));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao alterar conectividade.");
    } finally {
      setChangingState(false);
    }
  };

  const setEmergency = async () => {
    if (!state) return;
    setChangingState(true);
    setError("");
    try {
      if (demoMode) {
        const nextEmergency = !demoEmergency;
        setDemoEmergency(nextEmergency);
        if (nextEmergency && decision?.status === "AUTHORIZED") {
          setDemoInvalidatedAuthorizationId(decision.authorization_id);
        }
        setDemoTraces((current) => [
          ...current,
          trace(
            "DEVICE_TO_BACKEND",
            nextEmergency ? "EMERGENCY_STOP" : "EMERGENCY_STOP_RELEASED",
            {
              result: nextEmergency ? "LOCKED" : "READY",
              reason: nextEmergency ? "PHYSICAL_INPUT_ACTIVE" : "PHYSICAL_INPUT_RELEASED"
            }
          )
        ].slice(-100));
      } else {
        setRemoteState(
          await api.setLabEmergencyStop(pumpId, !state.emergency_stop_active)
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao alterar a parada.");
    } finally {
      setChangingState(false);
    }
  };

  const clearTraces = async () => {
    setChangingState(true);
    setError("");
    try {
      if (demoMode) setDemoTraces([]);
      else setRemoteState(await api.clearLabTraces(pumpId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Falha ao limpar eventos.");
    } finally {
      setChangingState(false);
    }
  };

  return (
    <section className="lab-bench" aria-labelledby="lab-title">
      <div className="lab-heading">
        <div>
          <p className="kicker">Gêmeo digital da bancada</p>
          <h2 id="lab-title">Comunicação e intertravamento em tempo real</h2>
          <p>
            Acompanhe a decisão sair da aplicação, chegar ao controlador e retornar como confirmação.
          </p>
        </div>
        <div className={`lab-mode ${stateConfirmed && state?.online ? "is-online" : "is-offline"}`}>
          {stateConfirmed && state?.online ? <Wifi aria-hidden="true" /> : <WifiOff aria-hidden="true" />}
          <div><strong>{modeLabel}</strong><small>{stateConfirmed && state?.online ? "Dispositivo disponível" : "Sem confirmação do dispositivo"}</small></div>
        </div>
      </div>

      {demoMode && (
        <div className="lab-disclaimer" role="note">
          <CircuitBoard aria-hidden="true" />
          <span>Os eventos deste modo são uma representação didática no navegador. Ative “Backend configurado” para observar comandos realmente processados pelo gateway.</span>
        </div>
      )}
      {error && <div className="alert error-alert" role="alert"><WifiOff aria-hidden="true" /><span>{error}</span></div>}

      <div className="lab-view-tabs" role="tablist" aria-label="Vistas da bancada digital">
        <button
          id="plant-view-tab"
          type="button"
          role="tab"
          aria-selected={activeLabView === "plant"}
          aria-controls="plant-view-panel"
          className={activeLabView === "plant" ? "is-active" : ""}
          onClick={() => setActiveLabView("plant")}
        >
          <FuelIcon aria-hidden="true" /> Vista da bancada
        </button>
        <button
          id="diagnostics-view-tab"
          type="button"
          role="tab"
          aria-selected={activeLabView === "diagnostics"}
          aria-controls="diagnostics-view-panel"
          className={activeLabView === "diagnostics" ? "is-active" : ""}
          onClick={() => setActiveLabView("diagnostics")}
        >
          <Activity aria-hidden="true" /> Diagnóstico técnico
        </button>
      </div>

      <div
        id="plant-view-panel"
        role="tabpanel"
        aria-labelledby="plant-view-tab"
        hidden={activeLabView !== "plant"}
      >
        <PhysicalPlant
          state={state}
          stateConfirmed={stateConfirmed}
          remainingSeconds={labRemainingSeconds}
          changingState={changingState}
          onEmergencyToggle={setEmergency}
        />
      </div>

      <div
        id="diagnostics-view-panel"
        className="diagnostics-panel"
        role="tabpanel"
        aria-labelledby="diagnostics-view-tab"
        hidden={activeLabView !== "diagnostics"}
      >

      <div className="lab-flow" aria-label="Fluxo da comunicação">
        <div><Laptop aria-hidden="true" /><span>PWA</span><small>pedido</small></div>
        <ArrowRight aria-hidden="true" />
        <div><Server aria-hidden="true" /><span>FastAPI</span><small>decisão</small></div>
        <ArrowRight aria-hidden="true" />
        <div><Radio aria-hidden="true" /><span>{state?.transport === "mqtt" ? "MQTT" : "Gateway"}</span><small>{state?.transport === "mqtt" ? "mensagem" : "memória"}</small></div>
        <ArrowRight aria-hidden="true" />
        <div><Cpu aria-hidden="true" /><span>ESP32</span><small>ACK + TTL</small></div>
        <ArrowRight aria-hidden="true" />
        <div><FuelIcon aria-hidden="true" /><span>Trava</span><small>suporte do bico</small></div>
      </div>

      <div className="bench-grid">
        <div className="pump-visual" aria-label="Representação visual da bomba e dos cinco bicos">
          <div className="pump-display">
            <span>{state?.pump_id ?? pumpId}</span>
            <strong className={isLocked ? "is-locked" : "is-unlocked"}>
              {!stateConfirmed ? "ESTADO NÃO CONFIRMADO" : isLocked ? "TODOS BLOQUEADOS" : "1 TRAVA LIBERADA"}
            </strong>
            <small>{!stateConfirmed ? "aguardando telemetria" : isLocked ? "estado elétrico seguro" : `${labRemainingSeconds || "—"} s restantes`}</small>
          </div>
          <div className="nozzle-rack">
            {displayedNozzles.map((nozzle) => {
              const active = unlocked === nozzle.nozzle_id;
              return (
                <div className={`nozzle-unit ${active ? "is-active" : ""}`} key={nozzle.fuel}>
                  <div className="nozzle-head"><FuelIcon aria-hidden="true" /></div>
                  <div><strong>{nozzle.label}</strong><small>GPIO {nozzle.gpio}</small></div>
                  <span className="nozzle-state">
                    {active ? <UnlockKeyhole aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                    {!stateConfirmed ? "Desconhecido" : active ? "Liberado" : "Bloqueado"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="controller-panel">
          <div className="controller-title">
            <div><Cpu aria-hidden="true" /><span>ESP32 DevKitC</span></div>
            <span className={`status-dot ${stateConfirmed && state?.online ? "is-online" : ""}`} aria-label={!stateConfirmed ? "estado desconhecido" : state?.online ? "online" : "offline"} />
          </div>
          <div className="chip-visual" aria-label="Estado lógico dos GPIOs do ESP32">
            <span className="chip-label">INTERLOCK</span>
            {displayedNozzles.map((nozzle) => (
              <div className="pin-row" key={nozzle.gpio}>
                <span>GPIO {nozzle.gpio}</span>
                <span className={`pin-led ${!stateConfirmed ? "is-unknown" : unlocked === nozzle.nozzle_id ? "is-high" : ""}`} />
                <strong>{!stateConfirmed ? "?" : unlocked === nozzle.nozzle_id ? "HIGH" : "LOW"}</strong>
              </div>
            ))}
          </div>
          <dl className="controller-meta">
            <div><dt>Sessão</dt><dd>{state?.session_id ? state.session_id.slice(0, 12) : "aguardando"}</dd></div>
            <div><dt>Sequência</dt><dd>{state?.last_sequence ?? 0}</dd></div>
            <div><dt>Transporte</dt><dd>{state?.transport ?? "indisponível"}</dd></div>
          </dl>
          <div className={`emergency-state ${stateConfirmed && state?.emergency_stop_active ? "is-active" : ""}`}>
            <OctagonX aria-hidden="true" />
            <div><strong>GPIO 33 · parada</strong><small>{!stateConfirmed ? "Estado não confirmado" : state?.emergency_stop_active ? "ACIONADA — saídas desenergizadas" : "Normal — contato fechado"}</small></div>
          </div>
        </div>
      </div>

      <div className="lab-controls" aria-label="Controles de falha da bancada">
        <div>
          <p className="kicker">Ensaios de falha</p>
          <strong>{state?.controls_enabled ? "Controles do simulador" : "Modo observação do dispositivo"}</strong>
          <small>{state?.controls_enabled ? "Toda falha deve retornar ao bloqueio." : "Falhas físicas devem ser acionadas no PICSimLab ou na bancada."}</small>
        </div>
        <button className="secondary-button" type="button" onClick={setConnectivity} disabled={!state?.controls_enabled || changingState}>
          {state?.online ? <WifiOff aria-hidden="true" /> : <Wifi aria-hidden="true" />}
          {state?.online ? "Desconectar" : "Reconectar"}
        </button>
        <button className="danger-button" type="button" onClick={setEmergency} disabled={!state?.controls_enabled || changingState}>
          <Power aria-hidden="true" />
          {state?.emergency_stop_active ? "Liberar parada" : "Acionar parada"}
        </button>
      </div>

      <div className="trace-panel">
        <div className="trace-heading">
          <div><Activity aria-hidden="true" /><div><p className="kicker">Telemetria</p><h3>Comandos e confirmações</h3></div></div>
          <button className="secondary-button compact-button" type="button" onClick={clearTraces} disabled={changingState || !state?.controls_enabled}>
            {changingState ? <RefreshCw className="spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />} Limpar
          </button>
        </div>
        {traceRows.length === 0 ? (
          <p className="empty-trace">Execute uma autorização para ver `LOCK_ALL`, `UNLOCK` e `COMMAND_ACK`.</p>
        ) : (
          <div className="trace-table-wrap">
            <table className="trace-table">
              <thead><tr><th>Hora</th><th>Sentido</th><th>Evento</th><th>Comando / bico</th><th>Resultado</th></tr></thead>
              <tbody>
                {traceRows.map((item) => (
                  <tr key={item.event_id}>
                    <td>{displayTime(item.timestamp)}</td>
                    <td><span className={`direction ${item.direction === "BACKEND_TO_DEVICE" ? "outbound" : "inbound"}`}>{item.direction === "BACKEND_TO_DEVICE" ? "API → ESP" : "ESP → API"}</span></td>
                    <td>{eventLabels[item.event] ?? item.event}</td>
                    <td><strong>{item.command_type ?? "—"}</strong><small>{item.nozzle_id ?? item.reason ?? "—"}</small></td>
                    <td><span className={`trace-result ${item.result === "APPLIED" ? "is-applied" : ""}`}>{item.result ?? "—"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      <aside className="safety-note">
        <ShieldCheck aria-hidden="true" />
        <div><strong>Bancada seca e de baixa tensão</strong><span>O desenho representa o protótipo acadêmico; não certifica uso em bomba real ou área classificada.</span></div>
      </aside>
    </section>
  );
}

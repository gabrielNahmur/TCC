import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Clock3,
  Fuel as FuelIcon,
  Gauge,
  Leaf,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  Wifi,
  WifiOff
} from "lucide-react";
import { api, ApiError } from "./api";
import { config } from "./config";
import { demoVehicles } from "./demo";
import LabBench from "./LabBench";
import type {
  AuthorizationDecision,
  CompatibilityCheck,
  Fuel,
  AuthorizationRequest,
  OverrideRequest,
  ReasonCode
} from "./types";

const ALL_FUELS: Fuel[] = ["GASOLINE", "ETHANOL", "DIESEL_S10", "DIESEL_S500", "GNV"];
const PLATE_PATTERN = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const OVERRIDEABLE_REASONS = new Set<ReasonCode>([
  "VEHICLE_NOT_FOUND",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "FUEL_MAPPING_UNKNOWN",
  "FUEL_MAPPING_AMBIGUOUS"
]);

const fuelLabels: Record<Fuel, string> = {
  GASOLINE: "Gasolina",
  ETHANOL: "Etanol",
  DIESEL_S10: "Diesel S10",
  DIESEL_S500: "Diesel S500",
  GNV: "GNV"
};

const reasonMessages: Record<string, string> = {
  FUEL_INCOMPATIBLE: "O combustível solicitado não consta como compatível.",
  NO_COMBUSTIBLE_FUEL: "O cadastro não indica um combustível disponível nesta bancada.",
  VEHICLE_NOT_FOUND: "A placa não foi localizada pelo provedor veicular.",
  PROVIDER_TIMEOUT: "A consulta excedeu o tempo limite.",
  PROVIDER_UNAVAILABLE: "O provedor veicular está indisponível.",
  FUEL_MAPPING_UNKNOWN: "O código de combustível ainda não possui mapeamento seguro.",
  FUEL_MAPPING_AMBIGUOUS: "O cadastro retornou uma combinação que exige análise humana.",
  PUMP_NOT_CONFIGURED: "A bomba informada não está configurada.",
  PUMP_BUSY: "Já existe uma autorização ativa para esta bomba.",
  NOZZLE_NOT_CONFIGURED: "Não existe bico configurado para o produto solicitado.",
  DISPENSER_UNAVAILABLE: "O controlador da bancada não confirmou a liberação.",
  OVERRIDE_AUTHORIZED: "Liberação excepcional autorizada e registrada.",
  OVERRIDE_FAILED: "O dispositivo não confirmou a liberação excepcional.",
  AUTHORIZATION_EXPIRED: "O tempo de autorização terminou; todos os bicos devem permanecer bloqueados.",
  AUTHORIZATION_COMPLETED: "A autorização foi encerrada e o bloqueio foi solicitado.",
  AUTHORIZATION_SUPERSEDED: "Uma operação mais recente substituiu esta autorização.",
  INVALID_PLATE: "A placa informada não possui um formato aceito.",
  INVALID_REQUEST: "Os dados informados não puderam ser validados.",
  DEVICE_COMMAND_PENDING: "O dispositivo ainda não confirmou o comando; nenhum bico deve ser considerado liberado."
};

const normalizePlate = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);

const messageForReason = (reason?: ReasonCode) =>
  reason ? (reasonMessages[reason] ?? `A operação exige revisão (${reason}).`) : "Revise os dados informados.";

const outcomeIsUnknown = (caught: unknown) =>
  !(caught instanceof ApiError) || caught.outcomeUnknown || caught.status === undefined || caught.status >= 500;

function FuelMark({ fuel }: { fuel: Fuel }) {
  if (fuel === "ETHANOL") return <Leaf aria-hidden="true" />;
  if (fuel === "GNV") return <Gauge aria-hidden="true" />;
  return <FuelIcon aria-hidden="true" />;
}

function Stepper({ current }: { current: number }) {
  const steps = ["Identificação", "Combustível", "Decisão"];
  return (
    <ol className="stepper" aria-label="Etapas da autorização">
      {steps.map((step, index) => {
        const number = index + 1;
        return (
          <li key={step} className={number <= current ? "is-active" : ""} aria-current={number === current ? "step" : undefined}>
            <span>{number}</span>
            <small>{step}</small>
          </li>
        );
      })}
    </ol>
  );
}

export default function App() {
  const [activeView, setActiveView] = useState<"operation" | "lab">("operation");
  const [plate, setPlate] = useState("");
  const [attendantId, setAttendantId] = useState("attendant-01");
  const [pumpId, setPumpId] = useState("pump-01");
  const [demoMode, setDemoMode] = useState(config.demoMode);
  const [compatibility, setCompatibility] = useState<CompatibilityCheck | null>(null);
  const [selectedFuel, setSelectedFuel] = useState<Fuel | null>(null);
  const [decision, setDecision] = useState<AuthorizationDecision | null>(null);
  const [unknownRequest, setUnknownRequest] = useState<AuthorizationRequest | null>(null);
  const [unknownStatusOperation, setUnknownStatusOperation] = useState<{
    authorizationId: string;
    operation: "OVERRIDE" | "COMPLETE";
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [supervisorToken, setSupervisorToken] = useState("");
  const [justification, setJustification] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const authorizationActive = decision?.status === "AUTHORIZED" && remainingSeconds > 0;
  const deviceStateUnknown = Boolean(
    unknownRequest || unknownStatusOperation || decision?.status === "PENDING_DEVICE"
  );
  const safetyLabel = deviceStateUnknown
    ? "Estado físico desconhecido"
    : authorizationActive
      ? "Uma trava autorizada"
      : decision?.reason_code === "PUMP_BUSY"
        ? "Outra autorização pode estar ativa"
        : "Sem liberação nesta operação";
  const completed = decision?.status === "COMPLETED";
  const overrideAllowed =
    decision?.status === "REVIEW_REQUIRED" && OVERRIDEABLE_REASONS.has(decision.reason_code ?? "");
  const currentStep = decision || unknownRequest ? 3 : compatibility ? 2 : 1;
  const plateValid = PLATE_PATTERN.test(plate);

  const selectableFuels = useMemo(() => {
    if (!compatibility) return [];
    if (compatibility.status === "AUTHORIZED") return compatibility.compatible_fuels;
    if (compatibility.status === "REVIEW_REQUIRED") return ALL_FUELS;
    return [];
  }, [compatibility]);

  const recordDecision = (next: AuthorizationDecision) => {
    setDecision(next);
    setRemainingSeconds(
      next.status === "AUTHORIZED" && next.expires_at
        ? Math.max(0, Math.ceil((new Date(next.expires_at).getTime() - Date.now()) / 1000))
        : 0
    );
  };

  useEffect(() => {
    if (decision?.status !== "AUTHORIZED" || !decision.expires_at) {
      setRemainingSeconds(0);
      return;
    }

    const update = () => {
      const seconds = Math.max(0, Math.ceil((new Date(decision.expires_at!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [decision]);

  const reset = () => {
    setCompatibility(null);
    setSelectedFuel(null);
    setDecision(null);
    setUnknownRequest(null);
    setUnknownStatusOperation(null);
    setError("");
    setSupervisorId("");
    setSupervisorToken("");
    setJustification("");
    setRemainingSeconds(0);
    setPlate("");
  };

  const checkCompatibility = async (event: FormEvent) => {
    event.preventDefault();
    if (!plateValid || !attendantId.trim() || !pumpId.trim()) return;
    setBusy(true);
    setError("");
    setSelectedFuel(null);
    try {
      setCompatibility(await api.checkCompatibility(plate, demoMode));
    } catch (caught) {
      const message = caught instanceof ApiError ? caught.message : "Não foi possível consultar o provedor.";
      setError(`${message} A consulta de compatibilidade não autoriza liberação.`);
      setCompatibility({
        status: "REVIEW_REQUIRED",
        compatible_fuels: [],
        reason_code: "PROVIDER_UNAVAILABLE",
        provider_mode: demoMode ? "mock" : "unavailable"
      });
    } finally {
      setBusy(false);
    }
  };

  const requestAuthorization = async () => {
    if (!selectedFuel) return;
    const request: AuthorizationRequest = {
      client_request_id: crypto.randomUUID(),
      plate,
      requested_fuel: selectedFuel,
      attendant_id: attendantId.trim(),
      pump_id: pumpId.trim()
    };
    setBusy(true);
    setError("");
    try {
      recordDecision(
        await api.authorize(request, demoMode)
      );
    } catch (caught) {
      if (outcomeIsUnknown(caught)) {
        setUnknownRequest(request);
        setError("");
      } else {
        setError(caught instanceof Error ? caught.message : "A autorização foi recusada pelo servidor.");
      }
    } finally {
      setBusy(false);
    }
  };

  const reconcileUnknownRequest = async () => {
    if (!unknownRequest) return;
    setBusy(true);
    setError("");
    try {
      recordDecision(await api.authorize(unknownRequest, demoMode));
      setUnknownRequest(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "O servidor continua sem responder.";
      setError(`${message} O resultado permanece desconhecido; não inicie outra operação.`);
    } finally {
      setBusy(false);
    }
  };

  const reconcileKnownAuthorization = async () => {
    if (!unknownStatusOperation) return;
    setBusy(true);
    setError("");
    try {
      const next = await api.getAuthorization(unknownStatusOperation.authorizationId);
      recordDecision(next);
      if (next.status !== "PENDING_DEVICE") setUnknownStatusOperation(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "O servidor continua sem responder.";
      setError(`${message} O estado do dispositivo continua desconhecido.`);
    } finally {
      setBusy(false);
    }
  };

  const requestOverride = async (event: FormEvent) => {
    event.preventDefault();
    if (!decision || !supervisorId.trim() || !supervisorToken || justification.trim().length < 12) return;
    const request: OverrideRequest = {
      supervisor_id: supervisorId.trim(),
      token: supervisorToken,
      justification: justification.trim()
    };
    setBusy(true);
    setError("");
    try {
      recordDecision(await api.override(decision, request, demoMode));
      setSupervisorToken("");
    } catch (caught) {
      if (outcomeIsUnknown(caught) && !demoMode) {
        setUnknownStatusOperation({ authorizationId: decision.authorization_id, operation: "OVERRIDE" });
        setSupervisorToken("");
        setError("");
      } else {
        setError(caught instanceof Error ? caught.message : "Override recusado.");
      }
    } finally {
      setBusy(false);
    }
  };

  const completeAuthorization = async () => {
    if (!decision) return;
    setBusy(true);
    setError("");
    try {
      recordDecision(await api.complete(decision, attendantId.trim(), demoMode));
    } catch (caught) {
      if (outcomeIsUnknown(caught) && !demoMode) {
        setUnknownStatusOperation({ authorizationId: decision.authorization_id, operation: "COMPLETE" });
        setError("");
      } else {
        setError(caught instanceof Error ? caught.message : "Não foi possível confirmar o encerramento.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><LockKeyhole /></div>
        <div>
          <p className="eyebrow">Protótipo acadêmico · bancada sem combustível</p>
          <h1>Intertravamento de abastecimento</h1>
        </div>
        <div className={`safety-pill ${deviceStateUnknown ? "is-unknown" : authorizationActive ? "is-unlocked" : ""}`} role="status" aria-live="polite">
          {deviceStateUnknown ? <ShieldAlert aria-hidden="true" /> : authorizationActive ? <ShieldCheck aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
          <span>{safetyLabel}</span>
        </div>
      </header>

      <nav className="view-tabs" aria-label="Áreas do protótipo">
        <button
          type="button"
          className={activeView === "operation" ? "is-active" : ""}
          aria-current={activeView === "operation" ? "page" : undefined}
          onClick={() => setActiveView("operation")}
        >
          Operação
        </button>
        <button
          type="button"
          className={activeView === "lab" ? "is-active" : ""}
          aria-current={activeView === "lab" ? "page" : undefined}
          onClick={() => setActiveView("lab")}
        >
          Bancada digital
          {authorizationActive && <span className="live-dot" aria-label="autorização ativa" />}
        </button>
      </nav>

      <main>
        {activeView === "operation" ? (
        <>
        <section className="intro-panel" aria-labelledby="operation-title">
          <div>
            <p className="kicker">Operação assistida</p>
            <h2 id="operation-title">Confirme o combustível antes de liberar a bancada.</h2>
            <p>A consulta nunca libera um bico por conta própria. Toda falha mantém o estado seguro.</p>
          </div>
          <div className="mode-card">
            <span>{demoMode ? <WifiOff aria-hidden="true" /> : <Wifi aria-hidden="true" />}</span>
            <div>
              <strong>{demoMode ? "Dados sintéticos" : "Backend configurado"}</strong>
              <small>{demoMode ? "Nenhuma placa real é consultada" : "Consulta enviada sem placa na URL"}</small>
            </div>
            {config.allowDemoToggle && currentStep === 1 && (
              <label className="switch">
                <input
                  type="checkbox"
                  checked={demoMode}
                  onChange={(event) => setDemoMode(event.target.checked)}
                  aria-label="Ativar modo de demonstração"
                />
                <span aria-hidden="true" />
              </label>
            )}
          </div>
        </section>

        <Stepper current={currentStep} />

        {error && (
          <div className="alert error-alert" role="alert">
            <CircleAlert aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!compatibility && (
          <section className="workspace-card" aria-labelledby="identification-title">
            <div className="section-heading">
              <div className="number">01</div>
              <div>
                <p className="kicker">Identificação</p>
                <h2 id="identification-title">Informe os dados da operação</h2>
              </div>
            </div>

            <form onSubmit={checkCompatibility} className="lookup-form">
              <label className="field plate-field">
                <span>Placa do veículo</span>
                <input
                  aria-label="Placa do veículo"
                  value={plate}
                  onChange={(event) => setPlate(normalizePlate(event.target.value))}
                  placeholder="ABC1D23"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={7}
                  aria-describedby="plate-help"
                  aria-invalid={plate.length > 0 && !plateValid}
                  required
                />
                <small id="plate-help">Formato Mercosul ou anterior, sem espaços e sem hífen.</small>
              </label>

              <div className="field-row">
                <label className="field">
                  <span>Identificação do frentista</span>
                  <input aria-label="Identificação do frentista" value={attendantId} onChange={(event) => setAttendantId(event.target.value)} required />
                </label>
                <label className="field">
                  <span>Bomba / bancada</span>
                  <input aria-label="Bomba / bancada" value={pumpId} onChange={(event) => setPumpId(event.target.value)} required />
                </label>
              </div>

              {demoMode && (
                <fieldset className="demo-scenarios">
                  <legend>Cenários sintéticos rápidos</legend>
                  <div>
                    {Object.entries(demoVehicles).map(([scenarioPlate, vehicle]) => (
                      <button type="button" key={scenarioPlate} onClick={() => setPlate(scenarioPlate)}>
                        <strong>{scenarioPlate}</strong>
                        <span>{vehicle.summary.replace("Veículo sintético — ", "")}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <button className="primary-button" type="submit" disabled={busy || !plateValid || !attendantId.trim() || !pumpId.trim()}>
                {busy ? <RefreshCw className="spin" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                {busy ? "Consultando com bloqueio ativo…" : "Consultar compatibilidade"}
              </button>
            </form>
          </section>
        )}

        {compatibility && !decision && !unknownRequest && (
          <section className="workspace-card" aria-labelledby="fuel-title">
            <div className="section-heading">
              <div className="number">02</div>
              <div>
                <p className="kicker">Seleção controlada</p>
                <h2 id="fuel-title">
                  {compatibility.status === "AUTHORIZED"
                    ? "Escolha entre os combustíveis compatíveis"
                    : compatibility.status === "REVIEW_REQUIRED"
                      ? "Revisão humana necessária"
                      : "Abastecimento não autorizado"}
                </h2>
              </div>
            </div>

            <div className={`alert ${compatibility.status === "AUTHORIZED" ? "success-alert" : "warning-alert"}`} role="status">
              {compatibility.status === "AUTHORIZED" ? <BadgeCheck aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
              <div>
                <strong>{compatibility.status === "AUTHORIZED" ? "Consulta concluída" : "Liberação automática impedida"}</strong>
                <span>
                  {compatibility.status === "AUTHORIZED"
                    ? `${compatibility.compatible_fuels.length} opção(ões) compatível(is) retornada(s).`
                    : compatibility.status === "REVIEW_REQUIRED"
                      ? `${messageForReason(compatibility.reason_code)} A seleção abaixo apenas cria uma solicitação para o supervisor.`
                      : `${messageForReason(compatibility.reason_code)} Inicie uma nova operação somente após conferir os dados.`}
                </span>
              </div>
            </div>

            {demoMode && compatibility.vehicle_summary && (
              <p className="synthetic-summary">{compatibility.vehicle_summary}</p>
            )}

            {selectableFuels.length > 0 && (
              <div className="fuel-grid" role="radiogroup" aria-label="Combustível solicitado">
                {selectableFuels.map((fuel) => (
                <label
                  className={`fuel-option fuel-${fuel.toLowerCase()} ${selectedFuel === fuel ? "is-selected" : ""}`}
                  key={fuel}
                >
                  <input
                    type="radio"
                    name="requested-fuel"
                    value={fuel}
                    checked={selectedFuel === fuel}
                    onChange={() => setSelectedFuel(fuel)}
                  />
                  <FuelMark fuel={fuel} />
                  <span>{fuelLabels[fuel]}</span>
                  <small>{compatibility.status === "AUTHORIZED" ? "Compatível" : "Sujeito a override"}</small>
                </label>
                ))}
              </div>
            )}

            <div className="action-row">
              <button className="secondary-button" type="button" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Nova placa
              </button>
              {compatibility.status !== "DENIED" && (
                <button className="primary-button" type="button" onClick={requestAuthorization} disabled={!selectedFuel || busy}>
                  {busy ? <RefreshCw className="spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                  {compatibility.status === "AUTHORIZED" ? "Solicitar liberação" : "Encaminhar para revisão"}
                </button>
              )}
            </div>
          </section>
        )}

        {unknownRequest && !decision && (
          <section className="workspace-card" aria-labelledby="unknown-title">
            <div className="section-heading">
              <div className="number">03</div>
              <div>
                <p className="kicker">Reconciliação obrigatória</p>
                <h2 id="unknown-title">Resultado não confirmado</h2>
              </div>
            </div>
            <div className="alert warning-alert" role="alert">
              <ShieldAlert aria-hidden="true" />
              <div>
                <strong>Não inicie outra operação nesta bomba.</strong>
                <span>
                  A resposta se perdeu, mas o servidor pode ter processado a solicitação. Confirme também o estado físico do controlador.
                </span>
              </div>
            </div>
            <dl className="decision-meta">
              <div><dt>Combustível</dt><dd>{fuelLabels[unknownRequest.requested_fuel]}</dd></div>
              <div><dt>Bancada</dt><dd>{unknownRequest.pump_id}</dd></div>
              <div><dt>Solicitação</dt><dd>{unknownRequest.client_request_id.slice(0, 8)}</dd></div>
              <div><dt>Estado</dt><dd>DESCONHECIDO</dd></div>
            </dl>
            <button className="warning-button full-width" type="button" onClick={reconcileUnknownRequest} disabled={busy}>
              {busy ? <RefreshCw className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {busy ? "Verificando a mesma solicitação…" : "Verificar resultado com a mesma chave"}
            </button>
          </section>
        )}

        {decision && (
          <section className="workspace-card" aria-labelledby="decision-title">
            <div className="section-heading">
              <div className="number">03</div>
              <div>
                <p className="kicker">Decisão auditável</p>
                <h2 id="decision-title">Resultado da autorização</h2>
              </div>
            </div>

            {unknownStatusOperation && (
              <div className="alert warning-alert" role="alert">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <strong>O resultado da operação não foi confirmado.</strong>
                  <span>
                    {unknownStatusOperation.operation === "OVERRIDE"
                      ? "O override pode ter sido aplicado mesmo sem resposta. Não repita a liberação."
                      : "O bloqueio pode ter sido aplicado mesmo sem resposta. Confirme o estado atual antes de continuar."}
                  </span>
                </div>
              </div>
            )}

            <div
              className={`decision-card ${authorizationActive ? "authorized" : "locked"}`}
              role="status"
              aria-live="polite"
            >
              <div className="decision-icon">
                {authorizationActive ? <ShieldCheck aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
              </div>
              <div>
                <p className="kicker">
                  {unknownStatusOperation
                    ? "Último estado confirmado"
                    : authorizationActive
                      ? "Autorização temporária"
                      : "Resultado desta operação"}
                </p>
                <h3>
                  {authorizationActive
                    ? `Trava de ${fuelLabels[decision.requested_fuel]} liberada na ${decision.pump_id ?? pumpId}`
                    : completed
                      ? "Operação encerrada"
                      : decision.status === "AUTHORIZED" || decision.status === "EXPIRED"
                        ? "Autorização expirada"
                        : decision.status === "DENIED"
                          ? "Liberação negada"
                          : decision.status === "SUPERSEDED"
                            ? "Autorização substituída"
                            : decision.status === "PENDING_DEVICE"
                              ? "Aguardando confirmação do dispositivo"
                              : "Revisão obrigatória"}
                </h3>
                <p>
                  {authorizationActive
                    ? "Somente a trava do bico correspondente pode permanecer liberada."
                    : completed
                      ? reasonMessages.AUTHORIZATION_COMPLETED
                      : decision.status === "AUTHORIZED" || decision.status === "EXPIRED"
                        ? reasonMessages.AUTHORIZATION_EXPIRED
                        : messageForReason(decision.reason_code)}
                </p>
              </div>
              {authorizationActive && (
                <div className="countdown" aria-label={`${remainingSeconds} segundos restantes`}>
                  <Clock3 aria-hidden="true" />
                  <strong>{remainingSeconds}s</strong>
                  <small>tempo restante</small>
                </div>
              )}
            </div>

            <dl className="decision-meta">
              <div><dt>Combustível</dt><dd>{fuelLabels[decision.requested_fuel]}</dd></div>
              <div><dt>Bancada</dt><dd>{decision.pump_id ?? pumpId}</dd></div>
              <div><dt>Autorização</dt><dd>{decision.authorization_id.slice(0, 8)}</dd></div>
              <div><dt>Origem</dt><dd>{demoMode ? "Simulada" : "Backend"}</dd></div>
            </dl>

            {authorizationActive && !unknownStatusOperation && (
              <button className="danger-button full-width" type="button" onClick={completeAuthorization} disabled={busy}>
                <LockKeyhole aria-hidden="true" />
                {busy ? "Solicitando bloqueio…" : "Encerrar e bloquear agora"}
              </button>
            )}

            {!authorizationActive && !completed && !unknownStatusOperation && decision.status === "REVIEW_REQUIRED" && !overrideAllowed && (
              <div className="alert warning-alert" role="status">
                <LockKeyhole aria-hidden="true" />
                <div>
                  <strong>Este motivo não permite override.</strong>
                  <span>
                    {decision.reason_code === "PUMP_BUSY"
                      ? "Aguarde o TTL da operação ativa ou conclua-a no terminal que a iniciou."
                      : decision.reason_code === "INVALID_PLATE"
                        ? "Confira a placa e inicie uma nova operação; esta decisão permanece bloqueada."
                        : "Mantenha a bancada bloqueada e acione o responsável técnico pela configuração ou pelo dispositivo."}
                  </span>
                </div>
              </div>
            )}

            {!authorizationActive && !completed && !unknownStatusOperation && overrideAllowed && (
              <form className="override-panel" onSubmit={requestOverride}>
                <div className="override-title">
                  <UserRoundCheck aria-hidden="true" />
                  <div>
                    <h3>Liberação excepcional</h3>
                    <p>Somente um supervisor autenticado pode assumir a decisão. A justificativa será auditada.</p>
                  </div>
                </div>
                <div className="field-row">
                  <label className="field">
                    <span>Identificação do supervisor</span>
                    <input aria-label="Identificação do supervisor" value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} required />
                  </label>
                  <label className="field">
                    <span>Token de supervisão</span>
                    <input
                      aria-label="Token de supervisão"
                      type="password"
                      value={supervisorToken}
                      onChange={(event) => setSupervisorToken(event.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    {demoMode && <small>Para a demonstração: DEMO-SUPERVISOR</small>}
                  </label>
                </div>
                <label className="field">
                  <span>Justificativa (mínimo de 12 caracteres)</span>
                  <textarea
                    aria-label="Justificativa (mínimo de 12 caracteres)"
                    value={justification}
                    onChange={(event) => setJustification(event.target.value)}
                    minLength={12}
                    maxLength={500}
                    rows={3}
                    required
                  />
                  <small>Não inclua placa, CPF, nome de cliente ou outro dado pessoal.</small>
                </label>
                <button
                  className="warning-button full-width"
                  type="submit"
                  disabled={busy || !supervisorId.trim() || !supervisorToken || justification.trim().length < 12}
                >
                  <ShieldAlert aria-hidden="true" />
                  {busy ? "Validando supervisor…" : "Autorizar excepcionalmente"}
                </button>
              </form>
            )}

            {unknownStatusOperation && (
              <button className="warning-button full-width" type="button" onClick={reconcileKnownAuthorization} disabled={busy}>
                {busy ? <RefreshCw className="spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
                {busy ? "Consultando a autorização…" : "Verificar estado da autorização"}
              </button>
            )}

            {!authorizationActive && !unknownStatusOperation && (
              <button className="secondary-button full-width" type="button" onClick={reset}>
                <RotateCcw aria-hidden="true" /> Iniciar nova operação
              </button>
            )}
          </section>
        )}

        <aside className="safety-note">
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Uso exclusivo em protótipo de bancada</strong>
            <span>Sem combustível e fora de área classificada. Uma instalação real exige engenharia, integração e equipamentos certificados.</span>
          </div>
        </aside>
        </>
        ) : (
          <LabBench
            decision={decision}
            demoMode={demoMode}
            pumpId={pumpId}
            remainingSeconds={remainingSeconds}
          />
        )}
      </main>

      <footer>
        <span>Projeto de TCC · IFSul Câmpus Bagé</span>
        <span>Falha segura: bloquear é o estado padrão</span>
      </footer>
    </div>
  );
}

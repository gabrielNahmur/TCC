import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  AlertTriangle,
  CircuitBoard,
  Info,
  LockKeyhole,
  MousePointer2,
  Move,
  Power,
  RotateCcw,
  ShieldCheck,
  UnlockKeyhole
} from "lucide-react";
import { withNozzleVisuals, type LabNozzleVisual } from "./labConfig";
import type { LabState } from "./types";

interface PhysicalPlantProps {
  state: LabState | null;
  stateConfirmed: boolean;
  remainingSeconds: number;
  changingState: boolean;
  onEmergencyToggle: () => void | Promise<void>;
}

interface Point {
  x: number;
  y: number;
}

interface DragState {
  nozzleId: string;
  pointerId: number;
  offset: Point;
}

const VIEWBOX_WIDTH = 1100;
const VIEWBOX_HEIGHT = 650;

const HOLDER_POINTS: Point[] = [
  { x: 335, y: 326 },
  { x: 425, y: 326 },
  { x: 515, y: 326 },
  { x: 605, y: 326 },
  { x: 695, y: 326 }
];

const HOSE_ORIGINS: Point[] = [
  { x: 342, y: 510 },
  { x: 430, y: 510 },
  { x: 518, y: 510 },
  { x: 606, y: 510 },
  { x: 694, y: 510 }
];

const OUT_POSITIONS: Point[] = [
  { x: 865, y: 150 },
  { x: 865, y: 170 },
  { x: 865, y: 190 },
  { x: 865, y: 210 },
  { x: 865, y: 230 }
];

const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.y - b.y);

function hosePath(origin: Point, nozzle: Point) {
  const end = { x: nozzle.x + 15, y: nozzle.y + 25 };
  const depth = Math.max(origin.y + 70, end.y + 115);
  return `M ${origin.x} ${origin.y} C ${origin.x} ${depth}, ${end.x} ${depth}, ${end.x} ${end.y}`;
}

function scenePoint(
  event: ReactPointerEvent<SVGGElement>,
  svg: SVGSVGElement
): Point {
  const matrix = svg.getScreenCTM?.();
  if (matrix && typeof svg.createSVGPoint === "function") {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix.inverse());
    return { x: transformed.x, y: transformed.y };
  }

  const rect = svg.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * VIEWBOX_WIDTH,
    y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * VIEWBOX_HEIGHT
  };
}

function statusText(
  state: LabState | null,
  confirmed: boolean,
  removedNozzle: LabNozzleVisual | undefined,
  unlockedNozzle: LabNozzleVisual | undefined,
  remainingSeconds: number
) {
  if (!confirmed) {
    return {
      tone: "unknown",
      title: "Estado físico não confirmado",
      detail: "A telemetria não está disponível. Nenhum bico pode ser considerado liberado."
    };
  }
  if (state?.emergency_stop_active) {
    return {
      tone: "danger",
      title: "Parada de emergência acionada",
      detail: removedNozzle
        ? `${removedNozzle.label} permanece fora; devolva o bico manualmente.`
        : "Todas as saídas estão desenergizadas."
    };
  }
  if (!state?.online) {
    return {
      tone: "unknown",
      title: "Controlador sem comunicação",
      detail: removedNozzle
        ? `${removedNozzle.label} permanece fora; a trava não o recolhe automaticamente.`
        : "O estado seguro esperado é desenergizado, mas não há confirmação mecânica."
    };
  }
  if (removedNozzle && !unlockedNozzle) {
    return {
      tone: "warning",
      title: `${removedNozzle.label} fora do suporte`,
      detail: "A saída está LOW. Devolva o bico para que o pino possa retê-lo."
    };
  }
  if (removedNozzle && unlockedNozzle) {
    return {
      tone: "active",
      title: `${removedNozzle.label} retirado na simulação`,
      detail: `Autorização elétrica ativa por mais ${remainingSeconds} s.`
    };
  }
  if (unlockedNozzle) {
    return {
      tone: "active",
      title: `Trava de ${unlockedNozzle.label} liberada`,
      detail: `Somente esse bico pode ser retirado nos próximos ${remainingSeconds} s.`
    };
  }
  return {
    tone: "safe",
    title: "Todos os bicos no estado seguro",
    detail: "Pinos avançados e saídas desenergizadas."
  };
}

export default function PhysicalPlant({
  state,
  stateConfirmed,
  remainingSeconds,
  changingState,
  onEmergencyToggle
}: PhysicalPlantProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const positionRef = useRef<Record<string, Point>>({});
  const refusalTimer = useRef<number | undefined>(undefined);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [removedNozzleId, setRemovedNozzleId] = useState<string | null>(null);
  const [draggingNozzleId, setDraggingNozzleId] = useState<string | null>(null);
  const [rejectedNozzleId, setRejectedNozzleId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState(
    "Selecione uma operação para liberar uma trava da bancada."
  );

  const nozzles = useMemo(
    () => withNozzleVisuals(state?.nozzles),
    [state?.nozzles]
  );
  const unlockedNozzleId = stateConfirmed ? state?.unlocked_nozzle_id ?? null : null;
  const unlockedCandidate = nozzles.find(
    (nozzle) => nozzle.nozzle_id === unlockedNozzleId
  );
  const removedNozzle = nozzles.find(
    (nozzle) => nozzle.nozzle_id === removedNozzleId
  );
  const actuatorAvailable = Boolean(
    stateConfirmed &&
      state?.online &&
      !state.emergency_stop_active &&
      unlockedNozzleId &&
      remainingSeconds > 0
  );
  const unlockedNozzle = actuatorAvailable ? unlockedCandidate : undefined;
  const summary = statusText(
    state,
    stateConfirmed,
    removedNozzle,
    unlockedNozzle,
    remainingSeconds
  );

  useEffect(
    () => () => {
      if (refusalTimer.current !== undefined) {
        window.clearTimeout(refusalTimer.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!removedNozzleId) return;
    if (nozzles.some((nozzle) => nozzle.nozzle_id === removedNozzleId)) return;
    setRemovedNozzleId(null);
    setPositions({});
    positionRef.current = {};
  }, [nozzles, removedNozzleId]);

  useEffect(() => {
    if (!removedNozzle || (actuatorAvailable && unlockedNozzleId === removedNozzleId)) {
      return;
    }
    setAnnouncement(
      `${removedNozzle.label} continua fora do suporte. A saída foi desenergizada; faça a devolução manual.`
    );
  }, [actuatorAvailable, removedNozzle, removedNozzleId, unlockedNozzleId]);

  useEffect(() => {
    if (removedNozzleId) return;
    if (!stateConfirmed) {
      setAnnouncement("Telemetria indisponível: nenhuma trava pode ser considerada liberada.");
    } else if (unlockedNozzle) {
      setAnnouncement(`${unlockedNozzle.label} autorizado: retire somente esse bico.`);
    } else {
      setAnnouncement("Todos os bicos permanecem presos nos suportes.");
    }
  }, [removedNozzleId, stateConfirmed, unlockedNozzle]);

  const holderFor = (index: number) => HOLDER_POINTS[index] ?? HOLDER_POINTS[0];
  const pointFor = (nozzleId: string, index: number) =>
    positions[nozzleId] ?? holderFor(index);

  const canRemove = (nozzleId: string) =>
    actuatorAvailable &&
    unlockedNozzleId === nozzleId &&
    (!removedNozzleId || removedNozzleId === nozzleId);

  const reject = (nozzle: LabNozzleVisual, reason?: string) => {
    setRejectedNozzleId(nozzle.nozzle_id);
    setAnnouncement(
      reason ??
        `${nozzle.label} permanece preso: somente a trava autorizada pode recolher o pino.`
    );
    if (refusalTimer.current !== undefined) window.clearTimeout(refusalTimer.current);
    refusalTimer.current = window.setTimeout(() => setRejectedNozzleId(null), 480);
  };

  const removeWithButton = (nozzle: LabNozzleVisual, index: number) => {
    if (!canRemove(nozzle.nozzle_id)) {
      reject(
        nozzle,
        removedNozzleId && removedNozzleId !== nozzle.nozzle_id
          ? `Devolva ${removedNozzle?.label ?? "o bico retirado"} antes de tentar outro bico.`
          : undefined
      );
      return;
    }
    const nextPoint = OUT_POSITIONS[index] ?? OUT_POSITIONS[0];
    positionRef.current = { ...positionRef.current, [nozzle.nozzle_id]: nextPoint };
    setPositions(positionRef.current);
    setRemovedNozzleId(nozzle.nozzle_id);
    setAnnouncement(`${nozzle.label} retirado do suporte na simulação visual.`);
  };

  const returnNozzle = (nozzle: LabNozzleVisual) => {
    const nextPositions = { ...positionRef.current };
    delete nextPositions[nozzle.nozzle_id];
    positionRef.current = nextPositions;
    setPositions(nextPositions);
    setRemovedNozzleId(null);
    setAnnouncement(
      `${nozzle.label} devolvido ao suporte${
        canRemove(nozzle.nozzle_id)
          ? "; a trava ainda está eletricamente liberada."
          : "; o pino está no estado seguro."
      }`
    );
  };

  const startDrag = (
    event: ReactPointerEvent<SVGGElement>,
    nozzle: LabNozzleVisual,
    index: number
  ) => {
    const mayMove = removedNozzleId === nozzle.nozzle_id || canRemove(nozzle.nozzle_id);
    if (!mayMove) {
      reject(
        nozzle,
        removedNozzleId && removedNozzleId !== nozzle.nozzle_id
          ? `Já existe um bico fora do suporte. Devolva-o antes de retirar outro.`
          : undefined
      );
      return;
    }
    const svg = svgRef.current;
    if (!svg) return;
    const pointer = scenePoint(event, svg);
    const current = pointFor(nozzle.nozzle_id, index);
    dragRef.current = {
      nozzleId: nozzle.nozzle_id,
      pointerId: event.pointerId,
      offset: { x: pointer.x - current.x, y: pointer.y - current.y }
    };
    setDraggingNozzleId(nozzle.nozzle_id);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current;
    const svg = svgRef.current;
    if (!drag || !svg || drag.pointerId !== event.pointerId) return;
    const pointer = scenePoint(event, svg);
    const nextPoint = {
      x: Math.min(995, Math.max(70, pointer.x - drag.offset.x)),
      y: Math.min(535, Math.max(105, pointer.y - drag.offset.y))
    };
    positionRef.current = { ...positionRef.current, [drag.nozzleId]: nextPoint };
    setPositions(positionRef.current);
  };

  const finishDrag = (
    event: ReactPointerEvent<SVGGElement>,
    nozzle: LabNozzleVisual,
    index: number
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.nozzleId !== nozzle.nozzle_id) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setDraggingNozzleId(null);
    const current = positionRef.current[nozzle.nozzle_id] ?? holderFor(index);
    if (distance(current, holderFor(index)) <= 54) {
      returnNozzle(nozzle);
      return;
    }
    setRemovedNozzleId(nozzle.nozzle_id);
    setAnnouncement(`${nozzle.label} está fora do suporte na simulação visual.`);
  };

  return (
    <section className="physical-plant" aria-labelledby="physical-plant-title">
      <div className={`plant-summary is-${summary.tone}`} role="status">
        {summary.tone === "safe" ? (
          <ShieldCheck aria-hidden="true" />
        ) : summary.tone === "active" ? (
          <UnlockKeyhole aria-hidden="true" />
        ) : (
          <AlertTriangle aria-hidden="true" />
        )}
        <div>
          <strong>{summary.title}</strong>
          <span>{summary.detail}</span>
        </div>
      </div>

      <div className="plant-layout">
        <div className="plant-canvas-card">
          <div className="plant-canvas-heading">
            <div>
              <p className="kicker">Planta didática 2D</p>
              <h3 id="physical-plant-title">Bancada física simulada</h3>
            </div>
            <span><Move aria-hidden="true" /> Arraste o bico liberado</span>
          </div>

          <div className="plant-svg-wrap">
            <svg
              ref={svgRef}
              className="plant-svg"
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              aria-labelledby="plant-svg-title plant-svg-description"
            >
              <title id="plant-svg-title">Planta visual da bancada de intertravamento</title>
              <desc id="plant-svg-description">
                Bomba cenográfica com cinco mangueiras e travas nos suportes,
                tablet, ESP32, drivers, fonte de doze volts e parada de emergência.
              </desc>
              <defs>
                <linearGradient id="cabinet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#f9faf9" />
                  <stop offset="1" stopColor="#d9e2dd" />
                </linearGradient>
                <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#eef3f0" />
                  <stop offset="1" stopColor="#d9e3de" />
                </linearGradient>
                <filter id="scene-shadow" x="-30%" y="-30%" width="160%" height="180%">
                  <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#17372b" floodOpacity="0.17" />
                </filter>
                <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#cbd8d1" strokeWidth="1" />
                </pattern>
              </defs>

              <rect width="1100" height="650" rx="28" fill="#f7faf8" />
              <path d="M0 470 L1100 420 L1100 650 L0 650 Z" fill="url(#floor)" />
              <path d="M0 470 L1100 420 L1100 650 L0 650 Z" fill="url(#floor-grid)" opacity="0.8" />

              <g className="scene-tablet" filter="url(#scene-shadow)">
                <rect x="35" y="155" width="185" height="250" rx="22" fill="#17372b" />
                <rect x="49" y="174" width="157" height="199" rx="12" fill="#f8fbf9" />
                <circle cx="127" cy="389" r="6" fill="#789387" />
                <text x="127" y="207" textAnchor="middle" className="scene-label">TABLET / PWA</text>
                <rect x="67" y="229" width="121" height="28" rx="7" fill="#e7eee9" />
                <text x="127" y="248" textAnchor="middle" className="scene-small">PLACA SINTÉTICA</text>
                <rect x="67" y="274" width="121" height="53" rx="9" fill="#17372b" />
                <text x="127" y="296" textAnchor="middle" className="scene-screen">AUTORIZAÇÃO</text>
                <text x="127" y="315" textAnchor="middle" className="scene-screen is-accent">→ FASTAPI</text>
                <path d="M127 405 L127 493" stroke="#4c6d5e" strokeWidth="10" />
                <rect x="78" y="487" width="98" height="16" rx="8" fill="#355649" />
              </g>

              <path d="M220 263 C250 263 250 170 300 170" className="data-wire" />
              <rect x="231" y="206" width="82" height="33" rx="16" fill="#d9eee4" stroke="#8fbaa6" />
              <text x="272" y="227" textAnchor="middle" className="scene-small">DADOS</text>

              <g className="scene-pump" filter="url(#scene-shadow)">
                <rect x="285" y="78" width="465" height="470" rx="24" fill="url(#cabinet)" stroke="#81988d" strokeWidth="4" />
                <rect x="310" y="102" width="415" height="111" rx="14" fill="#14372b" />
                <text x="330" y="130" className="scene-kicker">BANCADA SECA · SEM COMBUSTÍVEL</text>
                <text x="517" y="167" textAnchor="middle" className="scene-status">
                  {!stateConfirmed
                    ? "ESTADO NÃO CONFIRMADO"
                    : unlockedNozzle
                      ? `TRAVA ${unlockedNozzle.label.toUpperCase()} LIBERADA`
                      : "TODAS AS TRAVAS BLOQUEADAS"}
                </text>
                <text x="517" y="193" textAnchor="middle" className="scene-status-detail">
                  {unlockedNozzle ? `${remainingSeconds} s restantes` : "desenergizado = estado seguro"}
                </text>
                <rect x="309" y="235" width="417" height="181" rx="15" fill="#eff4f1" stroke="#c7d3cd" />
                <text x="327" y="257" className="scene-small">SUPORTES COM PINO DE INTERTRAVAMENTO</text>
                <rect x="309" y="430" width="417" height="93" rx="12" fill="#cfd9d4" />
                <text x="517" y="478" textAnchor="middle" className="scene-pump-name">ESTRUTURA CENOGRÁFICA</text>
                <text x="517" y="499" textAnchor="middle" className="scene-small">não comanda bombeamento</text>
              </g>

              <g className="service-zone">
                <rect x="814" y="72" width="250" height="192" rx="20" fill="#fff9eb" stroke="#d8b66f" strokeWidth="2" strokeDasharray="8 6" />
                <text x="939" y="102" textAnchor="middle" className="scene-label">ÁREA DE RETIRADA</text>
                <text x="939" y="124" textAnchor="middle" className="scene-small">posição apenas simulada</text>
                {!removedNozzle && (
                  <g opacity="0.5">
                    <path d="M885 176 h92" stroke="#bc9c59" strokeWidth="6" strokeLinecap="round" />
                    <path d="M918 153 l24 23 -24 23" fill="none" stroke="#bc9c59" strokeWidth="5" />
                  </g>
                )}
              </g>

              {nozzles.map((nozzle, index) => {
                const holder = holderFor(index);
                const point = pointFor(nozzle.nozzle_id, index);
                const energized = actuatorAvailable && unlockedNozzleId === nozzle.nozzle_id;
                const isRemoved = removedNozzleId === nozzle.nozzle_id;
                return (
                  <g key={`hose-${nozzle.nozzle_id}`}>
                    <path
                      d={hosePath(HOSE_ORIGINS[index] ?? HOSE_ORIGINS[0], point)}
                      fill="none"
                      stroke="#213d32"
                      strokeWidth="16"
                      strokeLinecap="round"
                      opacity="0.22"
                    />
                    <path
                      d={hosePath(HOSE_ORIGINS[index] ?? HOSE_ORIGINS[0], point)}
                      fill="none"
                      stroke={nozzle.darkColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                    />

                    <g className={`holder ${energized ? "is-energized" : ""}`}>
                      <text x={holder.x} y={holder.y - 43} textAnchor="middle" className="holder-label">
                        {nozzle.label}
                      </text>
                      <rect x={holder.x - 31} y={holder.y - 26} width="62" height="61" rx="10" fill="#263f35" />
                      <rect x={holder.x - 20} y={holder.y - 18} width="40" height="44" rx="8" fill="#101e18" />
                      <g className={`lock-pin ${energized ? "is-retracted" : ""}`}>
                        <rect
                          x={holder.x + (energized ? 20 : 8)}
                          y={holder.y + 1}
                          width={energized ? 10 : 25}
                          height="9"
                          rx="4"
                          fill={energized ? "#e4ac43" : "#cfd8d3"}
                        />
                        <circle
                          cx={holder.x + 32}
                          cy={holder.y + 5.5}
                          r="7"
                          fill={energized ? "#f4bf58" : "#73867d"}
                        />
                      </g>
                      <circle
                        cx={holder.x}
                        cy={holder.y + 47}
                        r="6"
                        fill={energized ? "#efb946" : stateConfirmed ? "#61756b" : "#a66f68"}
                        className={energized ? "output-led is-high" : "output-led"}
                      />
                      <text x={holder.x} y={holder.y + 65} textAnchor="middle" className="scene-tiny">
                        GPIO {nozzle.gpio} · {stateConfirmed ? (energized ? "HIGH" : "LOW") : "?"}
                      </text>
                    </g>

                    <path
                      d={`M 802 ${355 + index * 11} C 780 ${355 + index * 11}, 774 ${holder.y + 6}, ${holder.x + 35} ${holder.y + 6}`}
                      fill="none"
                      stroke={energized ? nozzle.color : "#90a198"}
                      strokeWidth={energized ? 3 : 1.5}
                      strokeDasharray={stateConfirmed ? undefined : "5 4"}
                      opacity={energized ? 1 : 0.55}
                    />

                    <g
                      data-testid={`scene-nozzle-${nozzle.nozzle_id}`}
                      className={[
                        "scene-nozzle",
                        energized ? "is-energized" : "",
                        isRemoved ? "is-removed" : "",
                        draggingNozzleId === nozzle.nozzle_id ? "is-dragging" : "",
                        rejectedNozzleId === nozzle.nozzle_id ? "is-rejected" : ""
                      ].filter(Boolean).join(" ")}
                      transform={`translate(${point.x} ${point.y})`}
                      onPointerDown={(event) => startDrag(event, nozzle, index)}
                      onPointerMove={moveDrag}
                      onPointerUp={(event) => finishDrag(event, nozzle, index)}
                      onPointerCancel={(event) => finishDrag(event, nozzle, index)}
                      aria-hidden="true"
                    >
                      <path d="M-31 -8 H20 L35 1 L25 13 H-25 Z" fill={nozzle.color} stroke={nozzle.darkColor} strokeWidth="3" />
                      <path d="M24 -5 L49 -18 H70 L70 -10 H53 L35 3 Z" fill="#566c62" stroke="#263b32" strokeWidth="3" />
                      <path d="M-7 10 L11 10 L19 41 H-1 Z" fill={nozzle.darkColor} stroke="#263b32" strokeWidth="3" />
                      <rect x="-20" y="-3" width="28" height="7" rx="3" fill="#f7faf8" opacity="0.75" />
                    </g>
                  </g>
                );
              })}

              <g className="scene-controller" filter="url(#scene-shadow)">
                <rect x="790" y="300" width="270" height="182" rx="18" fill="#16372b" stroke="#557467" strokeWidth="3" />
                <text x="812" y="329" className="controller-box-title">CAIXA DE CONTROLE</text>
                <rect x="810" y="345" width="107" height="105" rx="10" fill="#0d241c" stroke="#739286" />
                <text x="863" y="368" textAnchor="middle" className="controller-box-label">ESP32</text>
                <rect x="829" y="380" width="68" height="43" rx="5" fill="#285846" />
                <circle cx="842" cy="436" r="4" fill={state?.online && stateConfirmed ? "#75d09d" : "#cd7068"} />
                <text x="857" y="440" className="controller-box-small">{stateConfirmed && state?.online ? "ONLINE" : "SEM LINK"}</text>
                <rect x="934" y="345" width="106" height="105" rx="10" fill="#f1f4f2" stroke="#83988e" />
                <text x="987" y="368" textAnchor="middle" className="driver-label">DRIVERS</text>
                {[0, 1, 2, 3, 4].map((pin) => (
                  <g key={pin}>
                    <rect x="950" y={379 + pin * 12} width="48" height="7" rx="3" fill="#49675a" />
                    <circle cx="1013" cy={382.5 + pin * 12} r="4" fill={unlockedNozzleId === nozzles[pin]?.nozzle_id && actuatorAvailable ? "#f0b84a" : "#9ba9a2"} />
                  </g>
                ))}
              </g>

              <g className="scene-power" filter="url(#scene-shadow)">
                <rect x="803" y="505" width="154" height="88" rx="14" fill="#edf2ef" stroke="#82958c" strokeWidth="2" />
                <text x="880" y="532" textAnchor="middle" className="driver-label">FONTE 12 V</text>
                <rect x="825" y="548" width="46" height="22" rx="5" fill="#dfe7e3" stroke="#84978d" />
                <text x="848" y="563" textAnchor="middle" className="scene-tiny">FUSÍVEL</text>
                <path d="M884 559 h47" stroke="#bb4e45" strokeWidth="5" strokeLinecap="round" />
                <text x="906" y="577" textAnchor="middle" className="scene-tiny">alimentação separada</text>
              </g>

              <g
                className={`scene-emergency ${state?.emergency_stop_active ? "is-active" : ""}`}
                onClick={() => {
                  if (state?.controls_enabled && !changingState) void onEmergencyToggle();
                }}
                aria-hidden="true"
              >
                <rect x="979" y="507" width="81" height="86" rx="14" fill="#f2dfd9" stroke="#b6695f" strokeWidth="2" />
                <circle cx="1019" cy="546" r="26" fill="#9d312c" stroke="#ffd1ca" strokeWidth="6" />
                <text x="1019" y="583" textAnchor="middle" className="scene-tiny">EMERGÊNCIA</text>
              </g>
            </svg>
          </div>

          <p className="plant-announcement" aria-live="polite">
            <MousePointer2 aria-hidden="true" />
            {announcement}
          </p>
        </div>

        <aside className="mechanism-card" aria-labelledby="mechanism-title">
          <div className="mechanism-heading">
            <CircuitBoard aria-hidden="true" />
            <div>
              <p className="kicker">Como a trava funciona</p>
              <h3 id="mechanism-title">Pino no suporte do bico</h3>
            </div>
          </div>
          <p>
            A trava fica no berço que segura o bico, nunca na ponta por onde o
            combustível passa. Este é um conceito de bancada a confirmar com o orientador.
          </p>

          <div className="mechanism-flow" aria-label="Fluxo elétrico do acionamento">
            <span>ESP32<small>sinal 3,3 V</small></span>
            <b aria-hidden="true">→</b>
            <span>Driver MOSFET<small>protege o GPIO</small></span>
            <b aria-hidden="true">→</b>
            <span>Solenoide 12 V<small>recolhe o pino</small></span>
          </div>

          <div className={`pin-cutaway ${unlockedNozzle ? "is-unlocked" : ""}`}>
            <div className="coil"><span>bobina</span></div>
            <div className="spring" aria-hidden="true">/\/\/\</div>
            <div className="cutaway-pin"><span>pino</span></div>
            <div className="cutaway-holder"><span>suporte</span></div>
          </div>
          <dl className="mechanism-states">
            <div><dt>Sem energia</dt><dd>Mola mantém o pino avançado: bloqueado.</dd></div>
            <div><dt>GPIO autorizado</dt><dd>Driver energiza a bobina e recolhe o pino.</dd></div>
            <div><dt>Queda ou TTL</dt><dd>Saída volta a LOW; o sistema não recolhe um bico já retirado.</dd></div>
          </dl>

          <div className="future-sensor-note">
            <Info aria-hidden="true" />
            <span><strong>Sensor ainda não existe.</strong> Microswitch ou sensor Hall poderá informar se o bico está realmente no suporte.</span>
          </div>

          <button
            className="danger-button full-width"
            type="button"
            onClick={() => void onEmergencyToggle()}
            disabled={!state?.controls_enabled || changingState}
          >
            <Power aria-hidden="true" />
            {state?.emergency_stop_active ? "Liberar parada" : "Acionar parada"}
          </button>
          {!state?.controls_enabled && (
            <small className="physical-control-hint">
              No modo MQTT, acione a chave física no PICSimLab ou na bancada.
            </small>
          )}
        </aside>
      </div>

      <div className="plant-nozzle-controls" aria-label="Controles acessíveis dos bicos">
        {nozzles.map((nozzle, index) => {
          const isRemoved = removedNozzleId === nozzle.nozzle_id;
          const available = canRemove(nozzle.nozzle_id);
          return (
            <button
              key={nozzle.nozzle_id}
              type="button"
              className={[
                "plant-nozzle-button",
                available ? "is-available" : "",
                isRemoved ? "is-removed" : "",
                rejectedNozzleId === nozzle.nozzle_id ? "is-rejected" : ""
              ].filter(Boolean).join(" ")}
              aria-disabled={!isRemoved && !available}
              onClick={() =>
                isRemoved ? returnNozzle(nozzle) : removeWithButton(nozzle, index)
              }
            >
              <span className="nozzle-color" style={{ background: nozzle.color }} />
              <span><strong>{nozzle.label}</strong><small>GPIO {nozzle.gpio}</small></span>
              <span className="nozzle-button-action">
                {isRemoved ? <RotateCcw aria-hidden="true" /> : available ? <UnlockKeyhole aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
                {isRemoved ? "Devolver" : available ? "Retirar" : "Preso"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="plant-scope-note" role="note">
        <ShieldCheck aria-hidden="true" />
        <span><strong>Limite do protótipo:</strong> atua somente nas travas dos suportes. Não liga, desliga ou altera a bomba, o fluxo de combustível ou a automação da empresa.</span>
      </div>
    </section>
  );
}

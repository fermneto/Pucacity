import type { RoadGraph } from '../core/RoadGraph';
import type { CityFile, LaneKind, VehicleKind } from '../core/types';

/**
 * Porta entre o loop do jogo e a simulação.
 *
 * ESPELHA a API combinada de `src/core/Simulation.ts` (escrita em paralelo pelo PC3).
 * Se a API real mudar, ajuste AQUI e em `MockSimulation.ts`; o resto de `src/game/` só conhece esta porta.
 * Quando a `Simulation` real estiver na `main`, este arquivo pode passar a só reexportar os tipos dela.
 *
 * Convenções: x, y em tiles do city.json; heading em radianos (0 = +x, π/2 = +y);
 * `edge` = índice de aresta dirigida no `RoadGraph` (ou -1 fora da rede).
 */

export interface AgentView {
  id: number;
  vehicle: VehicleKind;
  x: number;
  y: number;
  heading: number;
  edge: number;
  lane: LaneKind | null;
  group: string;
}

export interface TransitVehicleView {
  lineId: string;
  kind: 'tuktuk' | 'tandem';
  x: number;
  y: number;
  heading: number;
  load: number;
  capacity: number;
}

export interface SimStats {
  tripsStarted: number;
  tripsCompleted: number;
  tripsFailed: number;
  tripMinutesTotal: number;
  modeTrips: Partial<Record<VehicleKind, number>>;
  tripsByDistrict: Record<number, { completed: number; minutesTotal: number; failed: number }>;
  wheelchairTrips: { completed: number; failed: number };
  radicalCrossings: number;
}

export interface SimState {
  /** Minutos de jogo desde o início (= ticks). */
  minute: number;
  day: number;
  minuteOfDay: number;
  agents: readonly AgentView[];
  transit: readonly TransitVehicleView[];
  /** Saturação (fluxo/capacidade) por aresta dirigida do RoadGraph. */
  edgeSaturation: Float32Array;
  /** Acumulado desde o início. */
  stats: SimStats;
  /** Só o dia corrente. */
  statsToday: SimStats;
}

export interface SimulationOptions {
  seed: number;
  /** Fração da população do city.json que vira agente visível. */
  scale: number;
  /** Minuto de jogo inicial (ex.: 7 * 60 = 7h do dia 0). */
  startMinute: number;
}

export interface SimulationPort {
  readonly graph: RoadGraph;
  readonly city: CityFile;
  /** Avança 1 tick = 1 minuto de jogo. */
  tick(): void;
  /** Avança vários minutos de uma vez (ex.: pré-rodar para capturas). */
  step(minutes: number): void;
  getState(): SimState;
  setCity(city: CityFile): void;
  serialize(): unknown;
}

export function emptyStats(): SimStats {
  return {
    tripsStarted: 0,
    tripsCompleted: 0,
    tripsFailed: 0,
    tripMinutesTotal: 0,
    modeTrips: {},
    tripsByDistrict: {},
    wheelchairTrips: { completed: 0, failed: 0 },
    radicalCrossings: 0,
  };
}

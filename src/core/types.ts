/**
 * Contrato do arquivo de cidade (city.json) — compartilhado entre Design, Arte e Engenharia.
 * Unidades: 1 tile = 10 m; velocidade em km/h; tempos de semáforo em segundos.
 * IMPORTANTE: este módulo (e todo src/core) não pode importar three.
 */

export const EDGE_KINDS = ['street', 'avenue', 'highway'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const RESERVED_LANES = ['bus', 'bike'] as const;
export type ReservedLane = (typeof RESERVED_LANES)[number];

export const BUILDING_KINDS = ['res', 'com', 'ind', 'school', 'hospital', 'park'] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

export const INCOMES = ['low', 'mid', 'high'] as const;
export type Income = (typeof INCOMES)[number];

export type Rotation = 0 | 1 | 2 | 3;

export interface SignalPhase {
  /** IDs das arestas (do city.json) que recebem verde nesta fase. */
  edges: number[];
  /** Duração do verde em segundos. */
  green: number;
}

export interface SignalCfg {
  /** Ciclo total em segundos. */
  cycle: number;
  phases: SignalPhase[];
}

export const KPI_IDS = [
  'avgTripMinutes',
  'congestionPct',
  'carSharePct',
  'emissions',
  'balance',
  'satisfaction',
] as const;
export type KpiId = (typeof KPI_IDS)[number];

export interface Goal {
  kpi: KpiId;
  op: '<=' | '>=';
  value: number;
  stars: 1 | 2 | 3;
}

export interface CityNode {
  id: number;
  x: number;
  y: number;
  signal?: SignalCfg;
}

export interface CityEdge {
  id: number;
  from: number;
  to: number;
  lanes: number;
  speed: number;
  oneWay: boolean;
  kind: EdgeKind;
  lanesReserved?: ReservedLane[];
}

export interface CityBuilding {
  id: number;
  x: number;
  y: number;
  kind: BuildingKind;
  capacity: number;
  model: string;
  rotation: Rotation;
  /** Proposta de extensão do contrato: bairro ao qual o prédio pertence. */
  district?: number;
}

export interface CityDistrict {
  id: number;
  name: string;
  income: Income;
  population: number;
}

export interface Scenario {
  goals: Goal[];
  budget: number;
  durationDays: number;
}

export interface CityFile {
  name: string;
  size: { w: number; h: number };
  nodes: CityNode[];
  edges: CityEdge[];
  buildings: CityBuilding[];
  districts: CityDistrict[];
  scenario?: Scenario;
}

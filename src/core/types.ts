/**
 * Contrato do arquivo de cidade (city.json) — SPEC §6, cidade radical sem carros.
 * Unidades: 1 tile = 10 m; edge.width em metros; edge.speed = limite em km/h;
 * velocidades de veículos em m/s (data/arte/veiculos.json); tempos de semáforo em segundos.
 * IMPORTANTE: este módulo (e todo src/core) não pode importar three.
 */

export const LANE_KINDS = ['sidewalk', 'slow', 'fast', 'transit'] as const;
export type LaneKind = (typeof LANE_KINDS)[number];

export const VEHICLE_KINDS = [
  'pedestrian',
  'wheelchair',
  'wheelchair_powered',
  'skate',
  'longboard',
  'kick_scooter',
  'e_scooter',
  'skates',
  'hoverboard',
  'e_unicycle',
  'bmx',
  'tandem',
  'tuktuk',
] as const;
export type VehicleKind = (typeof VEHICLE_KINDS)[number];

export const RADICAL_KINDS = ['ramp_bridge', 'air_loop', 'death_jump', 'rail_walkway'] as const;
export type RadicalKind = (typeof RADICAL_KINDS)[number];

export const ACCESS_KINDS = ['bubble_lift', 'glass_walkway', 'transit_only'] as const;
export type AccessKind = (typeof ACCESS_KINDS)[number];

export const EDGE_KINDS = ['street', 'avenue', 'boulevard'] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];

export const CROSSING_OVER = ['river', 'canal', 'expressway'] as const;
export type CrossingOver = (typeof CROSSING_OVER)[number];

export const BUILDING_KINDS = ['res', 'com', 'ind', 'school', 'hospital', 'park', 'skatepark'] as const;
export type BuildingKind = (typeof BUILDING_KINDS)[number];

export const INCOMES = ['low', 'mid', 'high'] as const;
export type Income = (typeof INCOMES)[number];

export const AREA_KINDS = ['water', 'blocked'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export type Rotation = 0 | 1 | 2 | 3;

/** Faixas por tipo. Em vias de mão dupla, a contagem vale para CADA sentido. */
export type LaneCounts = Partial<Record<LaneKind, number>>;

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
  'accessibilityPct',
  'equityGapMinutes',
  'radicalityPct',
  'energyKwh',
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
  /** Largura total da via em metros (dividida entre as faixas). */
  width: number;
  /** Limite de velocidade em km/h. */
  speed: number;
  oneWay: boolean;
  kind: EdgeKind;
  lanes: LaneCounts;
}

/** Travessia sobre rio/canal/via expressa: só por elemento radical + rota acessível. */
export interface CityCrossing {
  id: number;
  from: number;
  to: number;
  over: CrossingOver;
  radical: RadicalKind;
  /** Rota acessível. Se faltar, o KPI de Acessibilidade cai (não é erro de arquivo). */
  access?: AccessKind;
  /** Jogador não pode trocar o elemento (patrimônio etc.). */
  locked?: boolean;
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
  /** % de moradores (0–100) que possuem cada veículo. */
  ownership: Partial<Record<VehicleKind, number>>;
  /** Fração (0–1) de moradores usuários de cadeira de rodas. */
  wheelchairShare: number;
}

/** Proposta de extensão do contrato: áreas de água (canal/rio) e bloqueadas (patrimônio), em tiles. */
export interface CityArea {
  kind: AreaKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scenario {
  /** Id do cenário (ex.: 'vila-nova'), igual a config/balance.json → scenarios. */
  id?: string;
  goals: Goal[];
  budget: number;
  durationDays: number;
  /** Ids de eventos (config/balance.json → events). */
  events?: string[];
  /** Ids de dilemas (docs/design, src/assets/text). */
  dilemmas?: string[];
}

/** Elementos radicais urbanos e props posicionados livremente (Arte). `rot` em quartos de volta. */
export const FEATURE_KINDS = [
  'air_loop', 'wallride', 'quarter', 'bowl', 'spiral_tower', 'megapipe', 'orb',
  'stop_shelter', 'share_station', 'crt_billboard', 'tree', 'lamp', 'bench',
] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export interface CityFeature {
  kind: FeatureKind;
  x: number;
  y: number;
  rot: number;
}

/** Morador com nome e balão de fala (docs/design/cenario-01-vila-nova.md). */
export interface CityCharacter {
  id: string;
  name: string;
  group: string;
  vehicle: VehicleKind;
  home: number;
  work?: number;
}

export interface CityFile {
  name: string;
  size: { w: number; h: number };
  nodes: CityNode[];
  edges: CityEdge[];
  crossings: CityCrossing[];
  buildings: CityBuilding[];
  districts: CityDistrict[];
  areas?: CityArea[];
  /** Extensão da Arte: elementos radicais urbanos e props. */
  features?: CityFeature[];
  /** Extensão do Design: moradores com nome. */
  characters?: CityCharacter[];
  scenario?: Scenario;
}

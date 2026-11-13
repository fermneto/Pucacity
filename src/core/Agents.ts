/**
 * Cidadãos (SPEC §4.3): criação a partir dos bairros, agenda diária com picos e escolha modal logit.
 * Lógica pura e determinística: toda aleatoriedade vem do Rng recebido.
 */
import balanceJson from '../../config/balance.json';
import veiculos from '../../data/arte/veiculos.json';
import type { Path } from './Pathfinding';
import type { RoadGraph } from './RoadGraph';
import type { Rng } from './Rng';
import type { CityBuilding, CityFile, LaneKind, RadicalKind, VehicleKind } from './types';
import { VEHICLE_KINDS } from './types';
import type { VehicleProfile } from './Vehicles';

// ---------------------------------------------------------------------------------------------
// Balanceamento (config/balance.json). Só a parte usada aqui, tipada à mão.
// ---------------------------------------------------------------------------------------------

export interface PeakCfg {
  name: string;
  startHour: number;
  endHour: number;
  intensity: number;
}

interface BalanceLike {
  time: { tickMinutes: number; minutesPerDay: number; peaks: PeakCfg[] };
  vehicles: Record<string, { fallRisk?: number; modeCost?: number } | number | string>;
  lanes: Record<string, { fallRiskMultiplier?: number } | string>;
  radical: Record<string, { fallRisk?: number; funBonus?: number } | string>;
  modalChoice: { weights: ModalWeights; noise: number };
  citizens: { groups: Record<string, { share: number; speedFactor: number }> };
  tools: Record<string, { capacityPerVehicle?: number; headwayMinutes?: number }>;
  economy: { tukTukFare: number; tandemFare: number };
}

export const BALANCE = balanceJson as unknown as BalanceLike;

export interface ModalWeights {
  tempo: number;
  custo: number;
  risco: number;
  conforto: number;
  diversao: number;
}

/** Id da Arte/balance (pt) de cada veículo individual, lido de data/arte/veiculos.json. */
const ART_ID = new Map<VehicleKind, string>(
  (veiculos as unknown as { individuais: { id: string; kind: VehicleKind }[] }).individuais.map((v) => [v.kind, v.id]),
);

const RADICAL_ART_ID: Record<RadicalKind, string> = {
  ramp_bridge: 'rampa_ponte',
  air_loop: 'loop_aereo',
  death_jump: 'salto_mortal',
  rail_walkway: 'rail_passarela',
};

const objOf = <T extends object>(v: unknown): T | undefined =>
  typeof v === 'object' && v !== null ? (v as T) : undefined;

/** Chance base de queda por viagem (balance.vehicles). Coletivo: valor provisório do pedestre. */
export function fallRiskOf(kind: VehicleKind): number {
  const id = ART_ID.get(kind);
  const v = id ? objOf<{ fallRisk?: number }>(BALANCE.vehicles[id]) : undefined;
  return v?.fallRisk ?? 0.0005;
}

/** Custo por viagem do modo (balance.vehicles.modeCost; coletivo = tarifa de economy). */
export function modeCostOf(kind: VehicleKind): number {
  if (kind === 'tuktuk') return BALANCE.economy.tukTukFare;
  if (kind === 'tandem') return BALANCE.economy.tandemFare;
  const id = ART_ID.get(kind);
  const v = id ? objOf<{ modeCost?: number }>(BALANCE.vehicles[id]) : undefined;
  return v?.modeCost ?? 0;
}

function laneRiskMult(lane: LaneKind): number {
  return objOf<{ fallRiskMultiplier?: number }>(BALANCE.lanes[lane])?.fallRiskMultiplier ?? 1;
}

const SHARED_LANE_RISK =
  objOf<{ fallRiskMultiplier?: number }>(BALANCE.lanes._sharedLanePenalty)?.fallRiskMultiplier ?? 2;

function radicalCfg(kind: RadicalKind): { fallRisk: number; funBonus: number } {
  const r = objOf<{ fallRisk?: number; funBonus?: number }>(BALANCE.radical[RADICAL_ART_ID[kind]]);
  return { fallRisk: r?.fallRisk ?? 0.01, funBonus: r?.funBonus ?? 0 };
}

const LIFT_FUN = objOf<{ funBonus?: number }>(BALANCE.radical.elevador_bolha)?.funBonus ?? 0;

/** Capacidade (lugares) e headway padrão de cada tipo de linha (balance.tools.linhaTukTuk / linhaTandem). */
export function transitToolCfg(kind: 'tuktuk' | 'tandem'): { capacity: number; headwayMinutes: number } {
  const t = BALANCE.tools[kind === 'tuktuk' ? 'linhaTukTuk' : 'linhaTandem'];
  return { capacity: t?.capacityPerVehicle ?? 3, headwayMinutes: t?.headwayMinutes ?? 10 };
}

// ---------------------------------------------------------------------------------------------
// Constantes PROVISÓRIAS (não existem em config/balance.json; propor ao PC2 mover para lá).
// ---------------------------------------------------------------------------------------------

/** Conforto 0–1 de cada modo (entra como (1 - conforto) · peso). */
export const MODE_COMFORT: Record<VehicleKind, number> = {
  pedestrian: 0.8,
  wheelchair: 0.7,
  wheelchair_powered: 0.8,
  skate: 0.5,
  longboard: 0.6,
  kick_scooter: 0.6,
  e_scooter: 0.75,
  skates: 0.55,
  hoverboard: 0.7,
  e_unicycle: 0.6,
  bmx: 0.5,
  tandem: 0.6,
  tuktuk: 0.8,
};

/** Diversão base do modo (somada ao funBonus dos elementos radicais da rota). */
export const MODE_FUN: Record<VehicleKind, number> = {
  pedestrian: 0,
  wheelchair: 0,
  wheelchair_powered: 0,
  skate: 0.5,
  longboard: 0.4,
  kick_scooter: 0.3,
  e_scooter: 0.3,
  skates: 0.4,
  hoverboard: 0.4,
  e_unicycle: 0.4,
  bmx: 0.5,
  tandem: 0.3,
  tuktuk: 0.1,
};

/** Risco de queda entra na desutilidade em pontos percentuais (0,008 → 0,8). */
export const RISK_SCALE = 100;
/** Chance de um morador sair para lazer à noite (sessão no skatepark, parque, comércio). */
export const LEISURE_CHANCE = 0.25;
/** Fração das viagens de trabalho que caem dentro da janela de pico (× intensity). */
export const PEAK_SHARE = 0.85;

// ---------------------------------------------------------------------------------------------
// Cidadãos
// ---------------------------------------------------------------------------------------------

export const PLACE_HOME = 0;
export const PLACE_WORK = 1;
export const PLACE_LEISURE = 2;

export interface Citizen {
  id: number;
  district: number;
  group: string;
  speedFactor: number;
  /** Tipo de cadeira, se for cadeirante (nunca troca de modo). */
  chair: VehicleKind | null;
  /** Veículos próprios (sem pedestre e sem coletivo, que estão sempre disponíveis). */
  owned: VehicleKind[];
  /** Ids de prédios [casa, trabalho, lazer]; -1 = nenhum. */
  places: number[];
  /** Coordenadas (tiles) dos lugares: [hx, hy, wx, wy, lx, ly]. Servem mesmo se o prédio sumir. */
  placeXY: number[];
  /** Lugar onde está agora (PLACE_*). */
  location: number;
  /** Agenda de hoje: pares [minutoDoDia, lugarDestino]. */
  agenda: number[];
  /** Quantas viagens da agenda já "deram a hora". */
  fired: number;
  /** Quantas viagens da agenda já começaram (ou foram puladas). */
  next: number;
  /** Viagem em andamento, ou -1. */
  tripId: number;
  lastMode: VehicleKind | null;
}

const PERSONAL_KINDS: readonly VehicleKind[] = VEHICLE_KINDS.filter(
  (k) => k !== 'pedestrian' && k !== 'wheelchair' && k !== 'wheelchair_powered' && k !== 'tandem' && k !== 'tuktuk',
);

const JOB_KINDS = new Set(['com', 'ind', 'school', 'hospital']);
const LEISURE_KINDS = new Set(['skatepark', 'park', 'com']);

const byCapacity = (bs: readonly CityBuilding[]) => bs.map((b) => Math.max(1, b.capacity));

/** Cria os moradores de todos os bairros (ordem por id do bairro → determinística). */
export function createCitizens(city: CityFile, rng: Rng, scale = 1): Citizen[] {
  const buildings = [...city.buildings].sort((a, b) => a.id - b.id);
  const districts = [...city.districts].sort((a, b) => a.id - b.id);
  const res = buildings.filter((b) => b.kind === 'res');
  const jobs = buildings.filter((b) => JOB_KINDS.has(b.kind));
  const schools = buildings.filter((b) => b.kind === 'school');
  const leisure = buildings.filter((b) => LEISURE_KINDS.has(b.kind));
  const skateparks = buildings.filter((b) => b.kind === 'skatepark');

  // Prédio sem bairro: distribuído entre os bairros pela ordem (o arquivo da vitrine não tem district).
  const districtOf = (b: CityBuilding, i: number) => b.district ?? districts[i % Math.max(1, districts.length)]?.id ?? -1;
  const resByDistrict = new Map<number, CityBuilding[]>();
  res.forEach((b, i) => {
    const d = districtOf(b, i);
    const list = resByDistrict.get(d) ?? [];
    list.push(b);
    resByDistrict.set(d, list);
  });

  const groups = Object.entries(BALANCE.citizens.groups).filter(([g]) => g !== 'cadeirante');
  const groupWeights = groups.map(([, g]) => g.share);
  const chairGroup = BALANCE.citizens.groups.cadeirante;

  const out: Citizen[] = [];
  if (res.length === 0) return out;

  for (const d of districts) {
    const homes = resByDistrict.get(d.id) ?? res;
    const homeW = byCapacity(homes);
    const n = Math.round(d.population * scale);
    const own = d.ownership;
    const manual = own.wheelchair ?? 0;
    const powered = own.wheelchair_powered ?? 0;
    for (let i = 0; i < n; i++) {
      const home = homes[rng.weighted(homeW)]!;
      const isChair = rng.chance(d.wheelchairShare);
      let group: string;
      let speedFactor: number;
      let chair: VehicleKind | null = null;
      const owned: VehicleKind[] = [];
      if (isChair) {
        group = 'cadeirante';
        speedFactor = chairGroup?.speedFactor ?? 1;
        chair = manual + powered > 0 && rng.chance(powered / (manual + powered)) ? 'wheelchair_powered' : 'wheelchair';
      } else {
        const gi = rng.weighted(groupWeights);
        const g = groups[gi] ?? groups[0];
        group = g?.[0] ?? 'adulto';
        speedFactor = g?.[1].speedFactor ?? 1;
        for (const k of PERSONAL_KINDS) {
          const pct = own[k] ?? 0;
          if (pct > 0 && rng.chance(pct / 100)) owned.push(k);
        }
      }

      const workPool = group === 'estudante' && schools.length > 0 ? schools : jobs;
      const work = workPool.length > 0 ? workPool[rng.weighted(byCapacity(workPool))]! : null;
      let fun: CityBuilding | null = null;
      if (leisure.length > 0) {
        const trickster = owned.some((k) => k === 'skate' || k === 'bmx' || k === 'skates' || k === 'kick_scooter');
        const pool = trickster && skateparks.length > 0 && rng.chance(0.6) ? skateparks : leisure;
        fun = pool[rng.weighted(byCapacity(pool))]!;
      }

      out.push({
        id: out.length,
        district: d.id,
        group,
        speedFactor,
        chair,
        owned,
        places: [home.id, work?.id ?? -1, fun?.id ?? -1],
        placeXY: [home.x, home.y, work?.x ?? home.x, work?.y ?? home.y, fun?.x ?? home.x, fun?.y ?? home.y],
        location: PLACE_HOME,
        agenda: [],
        fired: 0,
        next: 0,
        tripId: -1,
        lastMode: null,
      });
    }
  }
  return out;
}

/** Janela [início, fim) em minutos do dia de um pico, ou a padrão se o balance não tiver. */
function peakWindow(peaks: readonly PeakCfg[], morning: boolean): { from: number; to: number; intensity: number } {
  const p = peaks.find((pk) => (morning ? pk.startHour < 12 : pk.startHour >= 12));
  if (!p) return morning ? { from: 7 * 60, to: 9 * 60, intensity: 1 } : { from: 17 * 60, to: 19 * 60, intensity: 1 };
  return { from: p.startHour * 60, to: p.endHour * 60, intensity: p.intensity };
}

/**
 * Agenda do dia (SPEC §4.3): casa → trabalho de manhã, trabalho → casa à tarde (picos de balance.time.peaks),
 * e às vezes lazer à noite. Sobrescreve agenda/fired/next do cidadão.
 */
export function planDay(c: Citizen, rng: Rng, peaks: readonly PeakCfg[] = BALANCE.time.peaks): void {
  const a: number[] = [];
  let last = 0;
  if (c.places[PLACE_WORK]! >= 0) {
    const am = peakWindow(peaks, true);
    const pm = peakWindow(peaks, false);
    const go = rng.chance(Math.min(1, PEAK_SHARE * am.intensity))
      ? Math.floor(rng.triangular(am.from, am.to))
      : rng.int(6 * 60, 11 * 60);
    let back = rng.chance(Math.min(1, PEAK_SHARE * pm.intensity))
      ? Math.floor(rng.triangular(pm.from, pm.to))
      : rng.int(14 * 60, 20 * 60);
    back = Math.max(back, go + 60);
    a.push(go, PLACE_WORK, back, PLACE_HOME);
    last = back;
  }
  if (c.places[PLACE_LEISURE]! >= 0 && rng.chance(LEISURE_CHANCE)) {
    const go = Math.max(last + 30, Math.floor(rng.triangular(19 * 60, 21 * 60 + 30)));
    const back = go + rng.int(60, 120);
    if (back < 24 * 60 - 1) a.push(go, PLACE_LEISURE, back, PLACE_HOME);
  }
  c.agenda = a;
  c.fired = 0;
  c.next = 0;
}

/** Modos que o morador pode escolher sem coletivo: cadeira (fixo) ou a pé + veículos próprios. */
export function individualModes(c: Citizen): VehicleKind[] {
  return c.chair ? [c.chair] : ['pedestrian', ...c.owned];
}

// ---------------------------------------------------------------------------------------------
// Escolha modal
// ---------------------------------------------------------------------------------------------

export interface ModeEstimate {
  mode: VehicleKind;
  /** Tempo porta a porta estimado, minutos (inclui espera e caminhada do coletivo). */
  minutes: number;
  cost: number;
  /** Chance de queda da viagem (0–1). */
  risk: number;
  /** 0–1. */
  comfort: number;
  fun: number;
}

/** Desutilidade (balance.modalChoice): tempo·wt + custo·wc + risco·wr + (1-conforto)·wf − diversão·wd. */
export function disutility(e: ModeEstimate, w: ModalWeights = BALANCE.modalChoice.weights): number {
  return (
    e.minutes * w.tempo +
    e.cost * w.custo +
    e.risk * RISK_SCALE * w.risco +
    (1 - e.comfort) * w.conforto -
    e.fun * w.diversao
  );
}

/**
 * Logit multinomial: P(i) ∝ exp(−U_i / θ), com θ = noise · max(2, menor tempo entre as opções).
 * Ou seja, o ruído é relativo à duração da viagem (uma opção 15% pior ainda leva ~1/e da preferida).
 * Devolve o índice escolhido (-1 se a lista estiver vazia).
 */
export function chooseLogit(
  options: readonly ModeEstimate[],
  rng: Rng,
  noise = BALANCE.modalChoice.noise,
  w: ModalWeights = BALANCE.modalChoice.weights,
): number {
  if (options.length === 0) return -1;
  if (options.length === 1) return 0;
  let minT = Infinity;
  for (const o of options) minT = Math.min(minT, o.minutes);
  const theta = Math.max(1e-6, noise * Math.max(2, minT));
  const u = options.map((o) => disutility(o, w));
  let best = Infinity;
  for (const x of u) best = Math.min(best, x);
  return rng.weighted(u.map((x) => Math.exp(-(x - best) / theta)));
}

/** Risco de queda e diversão de uma rota individual (faixas usadas + elementos radicais). */
export function routeRiskFun(
  graph: RoadGraph,
  path: Path,
  kind: VehicleKind,
  profile: VehicleProfile,
): { risk: number; fun: number } {
  const base = fallRiskOf(kind);
  let risk = 0;
  let fun = MODE_FUN[kind];
  let roadLen = 0;
  let laneMult = 0;
  for (const ei of path.edges) {
    const e = graph.edges[ei]!;
    if (e.link === 'road') {
      const use = graph.laneFor(ei, profile);
      if (!use) continue;
      const m = laneRiskMult(use.lane) * (use.fallback ? SHARED_LANE_RISK : 1);
      laneMult += m * e.lengthM;
      roadLen += e.lengthM;
    } else if (e.link === 'radical' && e.radical) {
      const r = radicalCfg(e.radical);
      risk += r.fallRisk;
      fun += r.funBonus;
    } else if (e.link === 'lift') {
      fun += LIFT_FUN;
    }
  }
  risk += base * (roadLen > 0 ? laneMult / roadLen : 1);
  return { risk, fun };
}

import { crossingIsAccessible, type CityCrossing, type CityFile } from './CityFile';
import {
  ACCESS_KINDS,
  BUILDING_KINDS,
  CROSSING_OVER,
  EDGE_KINDS,
  FEATURE_KINDS,
  GOAL_OPS,
  INCOMES,
  LANE_KINDS,
  RADICAL_KINDS,
  VEHICLE_KINDS,
} from './enums';

export type ValidationResult =
  | { ok: true; city: CityFile; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

export class CityValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`city.json inválido (${errors.length} erro(s)):\n- ${errors.join('\n- ')}`);
    this.name = 'CityValidationError';
  }
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => Number.isInteger(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

/**
 * Valida um objeto já parseado de JSON contra o contrato CityFile (src/core/CityFile.ts).
 * Coleta TODOS os erros (não para no primeiro) com caminho legível, para o Design corrigir de uma vez.
 * Avisos não impedem o jogo: ex. travessia sem rota acessível é problema de jogo, não de arquivo.
 */
export function validateCity(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);
  const warn = (path: string, msg: string) => warnings.push(`${path}: ${msg}`);

  if (!isObj(raw)) return { ok: false, errors: ['raiz: precisa ser um objeto'], warnings };

  if (typeof raw.name !== 'string' || raw.name.trim() === '') err('name', 'texto não vazio obrigatório');

  let w = 0;
  let h = 0;
  if (!isObj(raw.size)) {
    err('size', 'objeto { w, h } obrigatório');
  } else {
    if (!isInt(raw.size.w) || raw.size.w <= 0) err('size.w', 'inteiro > 0');
    else w = raw.size.w;
    if (!isInt(raw.size.h) || raw.size.h <= 0) err('size.h', 'inteiro > 0');
    else h = raw.size.h;
  }

  const arr = (key: string, optional = false): unknown[] => {
    const v = raw[key];
    if (v === undefined && optional) return [];
    if (!Array.isArray(v)) {
      err(key, 'lista obrigatória');
      return [];
    }
    return v;
  };

  const checkUniqueId = (path: string, item: Obj, seen: Set<number | string>, kind: 'int' | 'string' = 'int') => {
    const ok = kind === 'int' ? isInt(item.id) : typeof item.id === 'string' && item.id !== '';
    if (!ok) {
      err(`${path}.id`, kind === 'int' ? 'inteiro obrigatório' : 'texto obrigatório');
      return;
    }
    const id = item.id as number | string;
    if (seen.has(id)) err(`${path}.id`, `id ${id} repetido`);
    seen.add(id);
  };

  const inBounds = (path: string, item: Obj) => {
    if (!isNum(item.x)) err(`${path}.x`, 'número obrigatório');
    else if (w > 0 && (item.x < 0 || item.x > w)) err(`${path}.x`, `fora do mapa (0..${w})`);
    if (!isNum(item.y)) err(`${path}.y`, 'número obrigatório');
    else if (h > 0 && (item.y < 0 || item.y > h)) err(`${path}.y`, `fora do mapa (0..${h})`);
  };

  // ---- districts
  const districtIds = new Set<number | string>();
  arr('districts').forEach((d, i) => {
    const p = `districts[${i}]`;
    if (!isObj(d)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, d, districtIds);
    if (typeof d.name !== 'string') err(`${p}.name`, 'texto obrigatório');
    if (!oneOf(INCOMES, d.income)) err(`${p}.income`, `use um de: ${INCOMES.join(', ')}`);
    if (!isInt(d.population) || d.population < 0) err(`${p}.population`, 'inteiro ≥ 0');
    if (!isNum(d.wheelchairShare) || d.wheelchairShare < 0 || d.wheelchairShare > 1) {
      err(`${p}.wheelchairShare`, 'fração entre 0 e 1 (ex.: 0.05 = 5%)');
    }
    if (!isObj(d.ownership)) {
      err(`${p}.ownership`, 'objeto { veículo: % de moradores }');
    } else {
      for (const [k, v] of Object.entries(d.ownership)) {
        if (!oneOf(VEHICLE_KINDS, k)) err(`${p}.ownership.${k}`, `veículo desconhecido; use: ${VEHICLE_KINDS.join(', ')}`);
        if (!isNum(v) || v < 0 || v > 100) err(`${p}.ownership.${k}`, 'porcentagem entre 0 e 100');
      }
    }
  });

  // ---- nodes
  const nodeIds = new Set<number | string>();
  arr('nodes').forEach((n, i) => {
    const p = `nodes[${i}]`;
    if (!isObj(n)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, n, nodeIds);
    inBounds(p, n);
    if (n.signal !== undefined) {
      const s = n.signal;
      if (!isObj(s)) err(`${p}.signal`, 'objeto { cycle, phases }');
      else {
        if (!isNum(s.cycle) || s.cycle <= 0) err(`${p}.signal.cycle`, 'número > 0 (segundos)');
        if (!isInt(s.phases) || s.phases < 1) err(`${p}.signal.phases`, 'inteiro ≥ 1 (número de fases)');
      }
    }
  });

  const checkEnds = (p: string, e: Obj) => {
    if (!isInt(e.from) || !nodeIds.has(e.from)) err(`${p}.from`, `nó ${String(e.from)} não existe`);
    if (!isInt(e.to) || !nodeIds.has(e.to)) err(`${p}.to`, `nó ${String(e.to)} não existe`);
    if (e.from === e.to) err(p, 'from e to não podem ser o mesmo nó');
  };

  // ---- edges
  const edgeIds = new Set<number | string>();
  arr('edges').forEach((e, i) => {
    const p = `edges[${i}]`;
    if (!isObj(e)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, e, edgeIds);
    checkEnds(p, e);
    if (!isNum(e.width) || e.width <= 0) err(`${p}.width`, 'número > 0 (metros)');
    if (!isNum(e.speed) || e.speed <= 0) err(`${p}.speed`, 'número > 0 (km/h)');
    if (typeof e.oneWay !== 'boolean') err(`${p}.oneWay`, 'true ou false');
    if (!oneOf(EDGE_KINDS, e.kind)) err(`${p}.kind`, `use um de: ${EDGE_KINDS.join(', ')}`);
    if (!isObj(e.lanes)) {
      err(`${p}.lanes`, `objeto { faixa: quantidade } com faixas: ${LANE_KINDS.join(', ')}`);
    } else {
      let total = 0;
      for (const [k, v] of Object.entries(e.lanes)) {
        if (!oneOf(LANE_KINDS, k)) err(`${p}.lanes.${k}`, `faixa desconhecida; use: ${LANE_KINDS.join(', ')}`);
        if (!isInt(v) || v < 0) err(`${p}.lanes.${k}`, 'inteiro ≥ 0');
        else total += v;
      }
      if (total === 0) err(`${p}.lanes`, 'a via precisa de ao menos 1 faixa');
      if (!e.lanes.sidewalk) warn(p, 'via sem calçada: pedestres e cadeiras de rodas dividem a faixa lenta');
    }
  });

  // ---- crossings
  const crossingIds = new Set<number | string>();
  arr('crossings').forEach((c, i) => {
    const p = `crossings[${i}]`;
    if (!isObj(c)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, c, crossingIds);
    checkEnds(p, c);
    if (!oneOf(CROSSING_OVER, c.over)) err(`${p}.over`, `use um de: ${CROSSING_OVER.join(', ')}`);
    if (!oneOf(RADICAL_KINDS, c.radical)) err(`${p}.radical`, `use um de: ${RADICAL_KINDS.join(', ')}`);
    if (c.access !== undefined && !oneOf(ACCESS_KINDS, c.access)) err(`${p}.access`, `use um de: ${ACCESS_KINDS.join(', ')}`);
    else if (oneOf(RADICAL_KINDS, c.radical) && !crossingIsAccessible(c as unknown as CityCrossing)) {
      warn(p, 'travessia sem rota acessível (Acessibilidade cai)');
    }
    if (c.locked !== undefined && typeof c.locked !== 'boolean') err(`${p}.locked`, 'true ou false');
  });

  // ---- buildings
  const buildingIds = new Set<number | string>();
  arr('buildings').forEach((b, i) => {
    const p = `buildings[${i}]`;
    if (!isObj(b)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, b, buildingIds);
    inBounds(p, b);
    if (!oneOf(BUILDING_KINDS, b.kind)) err(`${p}.kind`, `use um de: ${BUILDING_KINDS.join(', ')}`);
    if (!isInt(b.capacity) || b.capacity < 0) err(`${p}.capacity`, 'inteiro ≥ 0');
    if (typeof b.model !== 'string') err(`${p}.model`, 'texto obrigatório');
    if (b.rotation !== 0 && b.rotation !== 1 && b.rotation !== 2 && b.rotation !== 3) err(`${p}.rotation`, 'use 0, 1, 2 ou 3');
  });

  // ---- canals (opcional)
  arr('canals', true).forEach((c, i) => {
    const p = `canals[${i}]`;
    if (!isObj(c)) return err(p, 'objeto { y0, y1 }');
    if (!isNum(c.y0) || !isNum(c.y1) || c.y1 <= c.y0) err(p, 'y0 e y1 numéricos, com y1 > y0');
    else if (h > 0 && (c.y0 < 0 || c.y1 > h)) err(p, `fora do mapa (0..${h})`);
  });

  // ---- features (opcional)
  arr('features', true).forEach((f, i) => {
    const p = `features[${i}]`;
    if (!isObj(f)) return err(p, 'objeto { kind, x, y, rot }');
    if (!oneOf(FEATURE_KINDS, f.kind)) err(`${p}.kind`, `use um de: ${FEATURE_KINDS.join(', ')}`);
    inBounds(p, f);
    if (!isNum(f.rot)) err(`${p}.rot`, 'número (quartos de volta)');
  });

  // ---- characters (opcional)
  const characterIds = new Set<number | string>();
  arr('characters', true).forEach((c, i) => {
    const p = `characters[${i}]`;
    if (!isObj(c)) return err(p, 'objeto');
    checkUniqueId(p, c, characterIds, 'string');
    if (typeof c.name !== 'string') err(`${p}.name`, 'texto obrigatório');
    if (typeof c.group !== 'string') err(`${p}.group`, 'texto obrigatório');
    if (!oneOf(VEHICLE_KINDS, c.vehicle)) err(`${p}.vehicle`, `use um de: ${VEHICLE_KINDS.join(', ')}`);
    if (!isInt(c.home) || !buildingIds.has(c.home)) err(`${p}.home`, `prédio ${String(c.home)} não existe`);
    if (c.work !== undefined && (!isInt(c.work) || !buildingIds.has(c.work))) err(`${p}.work`, `prédio ${String(c.work)} não existe`);
  });

  // ---- scenario (opcional)
  if (raw.scenario !== undefined) {
    const s = raw.scenario;
    if (!isObj(s)) {
      err('scenario', 'objeto');
    } else {
      if (typeof s.id !== 'string') err('scenario.id', 'texto obrigatório');
      if (!isNum(s.budget)) err('scenario.budget', 'número');
      if (!isInt(s.durationDays) || s.durationDays <= 0) err('scenario.durationDays', 'inteiro > 0');
      for (const key of ['events', 'dilemmas'] as const) {
        if (!Array.isArray(s[key]) || !(s[key] as unknown[]).every((x) => typeof x === 'string')) err(`scenario.${key}`, 'lista de ids (texto)');
      }
      if (!Array.isArray(s.goals)) err('scenario.goals', 'lista');
      else s.goals.forEach((g, i) => {
        const p = `scenario.goals[${i}]`;
        if (!isObj(g)) return err(p, 'objeto');
        if (typeof g.kpi !== 'string') err(`${p}.kpi`, 'texto (id da métrica em config/balance.json)');
        if (!oneOf(GOAL_OPS, g.op)) err(`${p}.op`, `use um de: ${GOAL_OPS.join(', ')}`);
        if (!isNum(g.value)) err(`${p}.value`, 'número');
        if (g.stars !== undefined && g.stars !== 1 && g.stars !== 2 && g.stars !== 3) err(`${p}.stars`, 'use 1, 2 ou 3');
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors, warnings };
  return { ok: true, city: raw as unknown as CityFile, warnings };
}

/** Valida e devolve a cidade (e os avisos), ou lança CityValidationError com todos os erros. */
export function parseCity(raw: unknown): { city: CityFile; warnings: string[] } {
  const r = validateCity(raw);
  if (!r.ok) throw new CityValidationError(r.errors);
  return { city: r.city, warnings: r.warnings };
}

/** Busca, faz parse e valida um city.json. */
export async function loadCity(url: string): Promise<{ city: CityFile; warnings: string[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar ${url} (HTTP ${res.status})`);
  return parseCity(await res.json());
}

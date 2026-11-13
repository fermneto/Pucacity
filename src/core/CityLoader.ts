import {
  BUILDING_KINDS,
  EDGE_KINDS,
  INCOMES,
  KPI_IDS,
  RESERVED_LANES,
  type CityFile,
} from './types';

export type ValidationResult =
  | { ok: true; city: CityFile }
  | { ok: false; errors: string[] };

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
 * Valida um objeto já parseado de JSON contra o contrato CityFile.
 * Coleta TODOS os erros (não para no primeiro) com caminho legível, para o Design corrigir de uma vez.
 */
export function validateCity(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const err = (path: string, msg: string) => errors.push(`${path}: ${msg}`);

  if (!isObj(raw)) return { ok: false, errors: ['raiz: precisa ser um objeto'] };

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

  const arr = (key: string): unknown[] => {
    const v = raw[key];
    if (!Array.isArray(v)) {
      err(key, 'lista obrigatória');
      return [];
    }
    return v;
  };

  const checkUniqueId = (path: string, item: Obj, seen: Set<number>) => {
    if (!isInt(item.id)) {
      err(`${path}.id`, 'inteiro obrigatório');
      return;
    }
    if (seen.has(item.id)) err(`${path}.id`, `id ${item.id} repetido`);
    seen.add(item.id);
  };

  const inBounds = (path: string, item: Obj) => {
    if (!isNum(item.x)) err(`${path}.x`, 'número obrigatório');
    else if (w > 0 && (item.x < 0 || item.x > w)) err(`${path}.x`, `fora do mapa (0..${w})`);
    if (!isNum(item.y)) err(`${path}.y`, 'número obrigatório');
    else if (h > 0 && (item.y < 0 || item.y > h)) err(`${path}.y`, `fora do mapa (0..${h})`);
  };

  // ---- districts (validados antes para checar referência dos prédios)
  const districtIds = new Set<number>();
  arr('districts').forEach((d, i) => {
    const p = `districts[${i}]`;
    if (!isObj(d)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, d, districtIds);
    if (typeof d.name !== 'string') err(`${p}.name`, 'texto obrigatório');
    if (!oneOf(INCOMES, d.income)) err(`${p}.income`, `use um de: ${INCOMES.join(', ')}`);
    if (!isInt(d.population) || d.population < 0) err(`${p}.population`, 'inteiro ≥ 0');
  });

  // ---- nodes
  const nodeIds = new Set<number>();
  const nodes = arr('nodes');
  nodes.forEach((n, i) => {
    const p = `nodes[${i}]`;
    if (!isObj(n)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, n, nodeIds);
    inBounds(p, n);
  });

  // ---- edges
  const edgeIds = new Set<number>();
  arr('edges').forEach((e, i) => {
    const p = `edges[${i}]`;
    if (!isObj(e)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, e, edgeIds);
    if (!isInt(e.from) || !nodeIds.has(e.from)) err(`${p}.from`, `nó ${String(e.from)} não existe`);
    if (!isInt(e.to) || !nodeIds.has(e.to)) err(`${p}.to`, `nó ${String(e.to)} não existe`);
    if (e.from === e.to) err(p, 'from e to não podem ser o mesmo nó');
    if (!isInt(e.lanes) || e.lanes < 1) err(`${p}.lanes`, 'inteiro ≥ 1');
    if (!isNum(e.speed) || e.speed <= 0) err(`${p}.speed`, 'número > 0 (km/h)');
    if (typeof e.oneWay !== 'boolean') err(`${p}.oneWay`, 'true ou false');
    if (!oneOf(EDGE_KINDS, e.kind)) err(`${p}.kind`, `use um de: ${EDGE_KINDS.join(', ')}`);
    if (e.lanesReserved !== undefined) {
      if (!Array.isArray(e.lanesReserved)) {
        err(`${p}.lanesReserved`, 'lista');
      } else {
        e.lanesReserved.forEach((r, j) => {
          if (!oneOf(RESERVED_LANES, r)) err(`${p}.lanesReserved[${j}]`, `use um de: ${RESERVED_LANES.join(', ')}`);
        });
        if (isInt(e.lanes) && e.lanesReserved.length >= e.lanes) {
          err(`${p}.lanesReserved`, 'precisa sobrar ao menos 1 faixa para carros');
        }
      }
    }
  });

  // ---- signals (após edges, para checar referências)
  nodes.forEach((n, i) => {
    if (!isObj(n) || n.signal === undefined) return;
    const p = `nodes[${i}].signal`;
    const s = n.signal;
    if (!isObj(s)) return err(p, 'objeto { cycle, phases }');
    if (!isNum(s.cycle) || s.cycle <= 0) err(`${p}.cycle`, 'número > 0 (segundos)');
    if (!Array.isArray(s.phases) || s.phases.length === 0) return err(`${p}.phases`, 'lista com ao menos 1 fase');
    let total = 0;
    s.phases.forEach((ph, j) => {
      const pp = `${p}.phases[${j}]`;
      if (!isObj(ph)) return err(pp, 'objeto');
      if (!isNum(ph.green) || ph.green <= 0) err(`${pp}.green`, 'número > 0');
      else total += ph.green;
      if (!Array.isArray(ph.edges)) err(`${pp}.edges`, 'lista de ids de arestas');
      else ph.edges.forEach((eid, k) => {
        if (!isInt(eid) || !edgeIds.has(eid)) err(`${pp}.edges[${k}]`, `aresta ${String(eid)} não existe`);
      });
    });
    if (isNum(s.cycle) && total > s.cycle) err(p, `soma dos verdes (${total}s) maior que o ciclo (${s.cycle}s)`);
  });

  // ---- buildings
  const buildingIds = new Set<number>();
  arr('buildings').forEach((b, i) => {
    const p = `buildings[${i}]`;
    if (!isObj(b)) return err(p, 'objeto obrigatório');
    checkUniqueId(p, b, buildingIds);
    inBounds(p, b);
    if (!oneOf(BUILDING_KINDS, b.kind)) err(`${p}.kind`, `use um de: ${BUILDING_KINDS.join(', ')}`);
    if (!isInt(b.capacity) || b.capacity < 0) err(`${p}.capacity`, 'inteiro ≥ 0');
    if (typeof b.model !== 'string') err(`${p}.model`, 'texto obrigatório');
    if (b.rotation !== 0 && b.rotation !== 1 && b.rotation !== 2 && b.rotation !== 3) {
      err(`${p}.rotation`, 'use 0, 1, 2 ou 3');
    }
    if (b.district !== undefined && (!isInt(b.district) || !districtIds.has(b.district))) {
      err(`${p}.district`, `bairro ${String(b.district)} não existe`);
    }
  });

  // ---- scenario
  if (raw.scenario !== undefined) {
    const s = raw.scenario;
    if (!isObj(s)) {
      err('scenario', 'objeto');
    } else {
      if (!isNum(s.budget)) err('scenario.budget', 'número');
      if (!isInt(s.durationDays) || s.durationDays <= 0) err('scenario.durationDays', 'inteiro > 0');
      if (!Array.isArray(s.goals)) err('scenario.goals', 'lista');
      else s.goals.forEach((g, i) => {
        const p = `scenario.goals[${i}]`;
        if (!isObj(g)) return err(p, 'objeto');
        if (!oneOf(KPI_IDS, g.kpi)) err(`${p}.kpi`, `use um de: ${KPI_IDS.join(', ')}`);
        if (g.op !== '<=' && g.op !== '>=') err(`${p}.op`, "use '<=' ou '>='");
        if (!isNum(g.value)) err(`${p}.value`, 'número');
        if (g.stars !== 1 && g.stars !== 2 && g.stars !== 3) err(`${p}.stars`, 'use 1, 2 ou 3');
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, city: raw as unknown as CityFile };
}

/** Valida e devolve a cidade, ou lança CityValidationError com todos os erros. */
export function parseCity(raw: unknown): CityFile {
  const r = validateCity(raw);
  if (!r.ok) throw new CityValidationError(r.errors);
  return r.city;
}

/** Busca, faz parse e valida um city.json. */
export async function loadCity(url: string): Promise<CityFile> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Não foi possível carregar ${url} (HTTP ${res.status})`);
  return parseCity(await res.json());
}

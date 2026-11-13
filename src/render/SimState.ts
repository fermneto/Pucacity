/**
 * PROPOSTA DE CONTRATO (PC1 → PC3): o estado que o render espera de `Simulation.getState()`.
 *
 * O render (SimView, Overlays) só LÊ este estado: nenhuma regra de jogo mora lá. Quando o
 * PC3 expuser `Simulation.getState()` com este formato (ou um superconjunto), a troca do
 * `createMockSim` pela simulação real é direta. Este módulo NÃO importa three, DOM nem
 * `Math.random`, para ser testável em node e, se o PC3 quiser, ser movido para `src/core/`.
 *
 * Eixos e unidades (docs/engineering.md §0): posições em tiles (1 tile = 10 m), `x` → leste,
 * `y` → sul (eixo Z do Three), `h` = altura em tiles (eixo Y do Three).
 *
 * O `createMockSim` abaixo é um gerador de DEMONSTRAÇÃO (o antigo movimento do DemoTraffic):
 * cada cidadão segue a sua faixa, escolhe vias ao acaso e atravessa o canal pelo elemento
 * radical que pode usar. Não é a simulação do SPEC §4, só produz um estado plausível.
 */
import veiculos from '../../data/arte/veiculos.json';
import type { CityCrossing, CityFile, CityNode, LaneKind, VehicleKind } from '../core/types';
import { crossingIsAccessible, waterBands } from '../core/CityFile';
import { makeRng, pickWeighted, TILE_M, type Rng } from './util';

// ───────────────────────────── Contrato proposto ─────────────────────────────

/** Vetor nos eixos da cidade: x, y em tiles no plano; h = altura. */
export interface Vec3 {
  x: number;
  y: number;
  h: number;
}

/** Manobra em curso: giro no eixo vertical (`spin`) ou mortal no eixo lateral (`flip`). Ângulo em rad. */
export interface SimTrick {
  kind: 'spin' | 'flip';
  angle: number;
}

export interface SimAgent {
  /** Id estável durante toda a vida do agente (o render guarda cor e instância por id). */
  id: number;
  kind: VehicleKind;
  /** Variante visual do mesmo tipo (ex.: 'tandem_4'); o modelo é `veh_${variant ?? kind}`. */
  variant?: string;
  /** Posição em tiles e altura em tiles. */
  x: number;
  y: number;
  h: number;
  /** Direção de avanço e "para cima" do veículo (unitários). */
  forward: Vec3;
  up: Vec3;
  /** Faixa em que o agente circula (ou a faixa preferida, fora das vias). */
  lane: LaneKind;
  /** Id da aresta do city.json em que está, ou null (travessia, elemento radical). */
  edge: number | null;
  /** Sentido na aresta: 1 = from → to, -1 = to → from. */
  dir: 1 | -1;
  /** Id da travessia em uso, ou null. */
  crossing: number | null;
  /** Por onde atravessa: elemento radical ou rota acessível. */
  via?: 'radical' | 'access';
  /** No ar (salto, loop, aéreo): conta para o KPI de radicalidade. */
  airborne: boolean;
  /** Não desenhar (ex.: dentro da cápsula do Elevador de Bolha). */
  hidden: boolean;
  trick?: SimTrick;
  /** Linha de coletivo (índice em `SimState.lines`). */
  line?: number;
}

/** Ocupação de uma faixa num sentido de uma aresta. Faixas vazias podem ser omitidas. */
export interface LaneLoad {
  edge: number;
  lane: LaneKind;
  /** Lado da via, à direita do sentido from → to = 1; à esquerda = -1 (coletivo: sempre -1). */
  side: 1 | -1;
  count: number;
  /** Volume/capacidade (0 = livre, 1 = saturada, > 1 = congestionada). */
  load: number;
}

/** Ocupação agregada de uma aresta (todas as faixas). */
export interface EdgeLoad {
  edge: number;
  count: number;
  /** Maior `load` entre as faixas da aresta. */
  load: number;
}

export interface CrossingState {
  id: number;
  /** Tem rota acessível funcionando (overlay de acessibilidade). */
  accessible: boolean;
  /** Agentes atravessando agora pelo elemento radical e pela rota acessível. */
  radical: number;
  access: number;
}

/** Cápsula do Elevador de Bolha. */
export interface LiftCabinState {
  crossing: number;
  x: number;
  y: number;
  h: number;
  phase: 'up' | 'cross' | 'down' | 'return';
  occupied: boolean;
}

export interface TransitLine {
  id: number;
  kind: VehicleKind;
  variant?: string;
  /** Cor da linha (#RRGGBB), usada no veículo. */
  color: string;
}

/** Eventos ocorridos desde o passo anterior. */
export type SimEvent = { type: 'trick'; agent: number; name: string; points: number };

export interface SimState {
  /** Tempo simulado (no mock: segundos). */
  time: number;
  agents: readonly SimAgent[];
  lanes: readonly LaneLoad[];
  edges: readonly EdgeLoad[];
  crossings: readonly CrossingState[];
  lifts: readonly LiftCabinState[];
  lines: readonly TransitLine[];
  events: readonly SimEvent[];
  /** Agentes no ar neste instante. */
  airborne: number;
}

/** O que o render precisa de uma simulação (mock ou `Simulation` do core). */
export interface SimSource {
  step(dt: number): void;
  /** Estado somente leitura, válido até o próximo `step`. */
  getState(): SimState;
}

/** Nome do modelo (catálogo da Arte) de um agente. */
export function agentModel(a: Pick<SimAgent, 'kind' | 'variant'>): string {
  return `veh_${a.variant ?? a.kind}`;
}

// ───────────────────────────── Geometria compartilhada ─────────────────────────────

/** Deslocamento lateral (à direita do sentido), em tiles, de quem anda em cada faixa. */
export const LANE_OFFSET: Record<LaneKind, number> = { sidewalk: 0.4, slow: 0.24, fast: 0.12, transit: 0.025 };

/** Capacidade visual (agentes por faixa) usada no overlay do mock. */
export const MOCK_LANE_CAP: Record<LaneKind, number> = { sidewalk: 6, slow: 5, fast: 5, transit: 3 };

/** Busca de nó por id (o city.json costuma ter id = índice, mas não é garantido). */
export function nodeLookup(city: CityFile): (id: number) => CityNode {
  const byId = new Map(city.nodes.map((n) => [n.id, n]));
  return (id) => {
    const direct = city.nodes[id];
    const n = direct && direct.id === id ? direct : byId.get(id);
    if (!n) throw new Error(`city.json: nó ${id} não existe`);
    return n;
  };
}

export interface CrossingLayout {
  crossing: CityCrossing;
  /** x da travessia e z (= city.y) do meio do canal, em tiles. */
  x: number;
  zMid: number;
  /** Comprimento da travessia (de nó a nó), em tiles. */
  length: number;
}

export interface LiftAnchor {
  crossing: CityCrossing;
  x: number;
  zA: number;
  zB: number;
}

export interface CityLayout {
  /** Vão do primeiro canal, em metros. */
  canalSpanM: number;
  crossings: CrossingLayout[];
  /** Trilho das cápsulas do Elevador de Bolha (margem norte zA → margem sul zB). */
  liftCabins: LiftAnchor[];
}

/** Geometria derivada do city.json usada pelo CityView, pelos overlays e pelo mock. */
export function cityLayout(city: CityFile): CityLayout {
  const node = nodeLookup(city);
  const canals = waterBands(city);
  const first = canals[0];
  const canalSpanM = first ? (first.y1 - first.y0) * TILE_M : 0;
  const crossings: CrossingLayout[] = [];
  const liftCabins: LiftAnchor[] = [];
  for (const c of city.crossings) {
    const A = node(c.from), B = node(c.to);
    const canal = canals.find((k) => k.y0 > A.y && k.y1 < B.y) ?? { y0: A.y, y1: B.y };
    const x = A.x, zMid = (canal.y0 + canal.y1) / 2;
    crossings.push({ crossing: c, x, zMid, length: B.y - A.y });
    if (c.access === 'bubble_lift') {
      const half = (canalSpanM / 2 + 2) / TILE_M;
      liftCabins.push({ crossing: c, x: x + 0.62, zA: zMid - half, zB: zMid + half });
    }
  }
  return { canalSpanM, crossings, liftCabins };
}

// ───────────────────────────── Mock ─────────────────────────────

interface VehicleInfo { kind: VehicleKind; lane: LaneKind; speed: [number, number]; freq: number; tricks: boolean }

const LANE_OF = new Map<string, LaneKind>(
  Object.entries(veiculos.faixas).map(([k, v]) => [k, (v as { lane: LaneKind }).lane]),
);
const INFO: VehicleInfo[] = veiculos.individuais.map((v) => {
  const lane = LANE_OF.get(v.faixa);
  if (!lane) throw new Error(`veiculos.json: faixa '${v.faixa}' de '${v.kind}' não existe`);
  const [min = 1, max = min] = v.velocidade;
  return { kind: v.kind as VehicleKind, lane, speed: [min, max], freq: v.frequencia, tricks: v.manobras };
});

/** Dados de veículo individual (null para tipos só de coletivo). */
export function vehicleInfo(kind: VehicleKind): Readonly<VehicleInfo> | null {
  return INFO.find((v) => v.kind === kind) ?? null;
}

const TRICK: Partial<Record<VehicleKind, SimTrick['kind']>> = {
  skate: 'spin', longboard: 'spin', skates: 'spin', kick_scooter: 'flip', bmx: 'flip', wheelchair: 'flip',
};
const TRICK_NAMES: Partial<Record<VehicleKind, string[]>> = {
  skate: ['KICKFLIP', '360 FLIP', 'OLLIE NORTH'], longboard: ['BIG SPIN'], skates: ['MISTRIAL', 'TOPSIDE'],
  kick_scooter: ['TAILWHIP', 'BARSPIN'], bmx: ['BACKFLIP', 'SUPERMAN'], wheelchair: ['BACKFLIP DE CADEIRA'],
};
const LINE_COLORS = ['#3FD0E8', '#FF5FA8', '#B8F02A', '#FFE23A', '#7B4FD6'] as const;
const STUNT_KINDS: VehicleKind[] = ['skate', 'bmx', 'skates', 'kick_scooter', 'wheelchair'];

/** Dimensões (m) da Torre Espiral e do Mega Half-pipe; iguais a models/radical.ts (o DemoTraffic passa as reais). */
export interface StuntDims {
  spiral: { rIn: number; rOut: number; turns: number; height: number };
  megapipe: { R: number; L: number };
}
const DEFAULT_STUNTS: StuntDims = {
  spiral: { rIn: 2.4, rOut: 5.6, turns: 2, height: 12 },
  megapipe: { R: 5, L: 16 },
};

export interface MockSimOptions {
  /** Cidadãos individuais (fora coletivo e acrobatas). Padrão: 420. */
  agents?: number;
  stunts?: StuntDims;
}

export interface MockSim extends SimSource {
  readonly city: CityFile;
  readonly layout: CityLayout;
}

/** Vetor nos eixos do Three (x, altura, z = city.y), só para portar a cinemática. */
type V = [number, number, number];
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const norm = (a: V): V => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Rotação em torno do eixo vertical (mesma convenção de Matrix4.makeRotationY). */
const rotY = (a: V, ang: number): V => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [c * a[0] + s * a[2], a[1], -s * a[0] + c * a[2]];
};
const toVec = (a: V): Vec3 => ({ x: a[0], y: a[2], h: a[1] });

interface Stunt { kind: 'spiral_tower' | 'megapipe'; x: number; z: number; rot: number; phase: number; lane: number }

interface Link {
  a: number; b: number;
  len: number;
  crossing?: CityCrossing;
  edgeId?: number;
  loop?: boolean;
  hasLane: Record<LaneKind, boolean>;
  /** Faixa de cidade entre canais (0 = norte); -1 = travessia. */
  grid: number;
}

interface MockAgent {
  out: SimAgent;
  info: VehicleInfo | null;
  edge: number;            // índice em links
  forward: boolean;
  t: number;
  speed: number;           // tiles/s
  fixedRoute?: number[];   // coletivo: sequência de links
  stunt?: Stunt;           // acrobata preso a um elemento radical
}

/**
 * Gerador MOCK de `SimState` a partir de um `CityFile`, determinístico por seed.
 * `step(dt)` avança `dt` segundos; `getState()` devolve o estado atual (objetos reaproveitados).
 */
export function createMockSim(city: CityFile, seed = 7, opts: MockSimOptions = {}): MockSim {
  const rng: Rng = makeRng(seed);
  const node = nodeLookup(city);
  const layout = cityLayout(city);
  const stuntDims = opts.stunts ?? DEFAULT_STUNTS;
  const links: Link[] = [];
  const adj = new Map<number, number[]>();
  const agents: MockAgent[] = [];
  const lines: TransitLine[] = [];
  let time = 0;
  let events: SimEvent[] = [];
  let state: SimState;

  // grafo de links: vias + travessias
  {
    const addLink = (l: Link) => {
      const i = links.push(l) - 1;
      for (const n of [l.a, l.b]) adj.set(n, [...(adj.get(n) ?? []), i]);
    };
    const canals = waterBands(city);
    const band = (y: number) => canals.filter((c) => c.y1 < y).length;
    for (const e of city.edges) {
      const A = node(e.from), B = node(e.to);
      const hasLane = { sidewalk: !!e.lanes.sidewalk, slow: !!e.lanes.slow, fast: !!e.lanes.fast, transit: !!e.lanes.transit };
      const loop = (city.features ?? []).some((f) => f.kind === 'air_loop' && Math.abs(f.y - A.y) < 0.01 && Math.abs(f.y - B.y) < 0.01 && f.x > Math.min(A.x, B.x) && f.x < Math.max(A.x, B.x));
      addLink({ a: e.from, b: e.to, len: Math.hypot(B.x - A.x, B.y - A.y), edgeId: e.id, loop, hasLane, grid: band(A.y) });
    }
    for (const c of city.crossings) {
      const A = node(c.from), B = node(c.to);
      addLink({ a: c.from, b: c.to, len: Math.hypot(B.x - A.x, B.y - A.y), crossing: c, hasLane: { sidewalk: true, slow: true, fast: true, transit: false }, grid: -1 });
    }
  }
  const link = (i: number): Link => {
    const l = links[i];
    if (!l) throw new Error(`mock: link ${i} não existe`);
    return l;
  };

  const spawn = (kind: VehicleKind, info: VehicleInfo | null, extra: { route?: number[]; line?: number; variant?: string } = {}) => {
    const candidates = links.map((l, i) => ({ l, i })).filter(({ l }) => !l.crossing);
    const { route } = extra;
    const start = route ? route[Math.floor(rng() * route.length)] : candidates[Math.floor(rng() * candidates.length)]?.i;
    if (start === undefined) throw new Error('mock: cidade sem vias');
    const lane: LaneKind = info ? info.lane : 'transit';
    const speedMs = info ? info.speed[0] + rng() * (info.speed[1] - info.speed[0]) : kind === 'tuktuk' ? 7 : 4.5;
    const a: MockAgent = {
      info, edge: start, forward: rng() > 0.5, t: rng(), speed: speedMs / TILE_M, fixedRoute: route,
      out: {
        id: agents.length, kind, x: 0, y: 0, h: 0, forward: { x: 0, y: 1, h: 0 }, up: { x: 0, y: 0, h: 1 },
        lane, edge: null, dir: 1, crossing: null, airborne: false, hidden: false,
      },
    };
    if (extra.variant !== undefined) a.out.variant = extra.variant;
    if (extra.line !== undefined) a.out.line = extra.line;
    agents.push(a);
    return a;
  };

  // cidadãos individuais
  const total = opts.agents ?? 420;
  for (let i = 0; i < total; i++) {
    const info = pickWeighted(rng, INFO, (v) => v.freq);
    spawn(info.kind, info);
  }
  // linhas de coletivo: uma por faixa de cidade, alternando tuk-tuk e tandem
  const transitLinks = links.map((l, i) => ({ l, i })).filter(({ l }) => l.hasLane.transit && !l.crossing);
  const bands = [...new Set(links.filter((l) => l.grid >= 0).map((l) => l.grid))];
  const color = (k: number) => LINE_COLORS[k % LINE_COLORS.length] ?? LINE_COLORS[0];
  const lineDefs = bands.flatMap((g) => [
    { kind: (g % 2 ? 'tandem' : 'tuktuk') as VehicleKind, variant: undefined, grid: g, color: color(g), n: 6 },
    { kind: 'tandem' as VehicleKind, variant: 'tandem_4', grid: g, color: color(g + 3), n: 2 },
  ]);
  for (const def of lineDefs) {
    const id = lines.length;
    const line: TransitLine = { id, kind: def.kind, color: def.color };
    if (def.variant) line.variant = def.variant;
    lines.push(line);
    const route = transitLinks.filter(({ l }) => l.grid === def.grid).map(({ i }) => i);
    if (!route.length) continue;
    for (let k = 0; k < def.n; k++) spawn(def.kind, null, { route, line: id, variant: def.variant });
  }
  // acrobatas: riders presos à Torre Espiral e ao Mega Half-pipe
  for (const f of city.features ?? []) {
    if (f.kind !== 'spiral_tower' && f.kind !== 'megapipe') continue;
    const n = 5;
    for (let k = 0; k < n; k++) {
      const kind = STUNT_KINDS[(k + Math.floor(rng() * 5)) % STUNT_KINDS.length] ?? 'skate';
      const a = spawn(kind, vehicleInfo(kind));
      a.stunt = { kind: f.kind, x: f.x, z: f.y, rot: (f.rot * Math.PI) / 2, phase: k / n, lane: k };
    }
  }

  /** Pode atravessar? E por onde (radical ou rota acessível)? */
  const crossingMode = (a: MockAgent, c: CityCrossing, forward: boolean): 'radical' | 'access' | null => {
    const tricks = !!a.info?.tricks;
    const northToSouth = forward; // travessias vão de from (norte) para to (sul)
    if (c.radical === 'rail_walkway') return tricks ? 'radical' : 'access';
    if (tricks && (c.radical !== 'death_jump' || northToSouth)) return 'radical';
    return c.access ? 'access' : null;
  };

  const nextLink = (a: MockAgent, nodeId: number) => {
    const route = a.fixedRoute;
    let opts: number[];
    if (route) {
      // coletivo: anda pela sequência de links que tocam o nó atual, sem voltar
      opts = (adj.get(nodeId) ?? []).filter((i) => route.includes(i) && i !== a.edge);
    } else {
      opts = (adj.get(nodeId) ?? []).filter((i) => {
        if (i === a.edge) return false;
        const l = link(i);
        if (l.crossing) return crossingMode(a, l.crossing, l.a === nodeId) !== null;
        return true;
      });
    }
    a.edge = opts[Math.floor(rng() * opts.length)] ?? a.edge;
    a.forward = link(a.edge).a === nodeId;
    a.t = 0;
  };

  const write = (a: MockAgent, pos: V, dir: V, up: V, trick?: SimTrick) => {
    const o = a.out;
    o.x = pos[0]; o.y = pos[2]; o.h = pos[1];
    o.forward = toVec(norm(dir));
    o.up = toVec(norm(up));
    if (trick && trick.angle) o.trick = trick;
    else delete o.trick;
  };

  const place = (a: MockAgent) => {
    const l = link(a.edge);
    const o = a.out;
    const A = node(a.forward ? l.a : l.b), B = node(a.forward ? l.b : l.a);
    const start: V = [A.x, 0, A.y], end: V = [B.x, 0, B.y];
    const fwd = norm([end[0] - start[0], 0, end[2] - start[2]]);
    const right: V = [-fwd[2], 0, fwd[0]];
    let pos = add(lerp(start, end, a.t), scl(right, LANE_OFFSET[o.lane]));
    let up: V = [0, 1, 0];
    let dir: V = fwd;
    let trick: SimTrick | undefined;
    o.hidden = false;
    o.airborne = false;
    o.dir = a.forward ? 1 : -1;
    o.edge = l.edgeId ?? null;
    o.crossing = l.crossing?.id ?? null;
    delete o.via;

    if (l.crossing) {
      const mode = crossingMode(a, l.crossing, a.forward) ?? 'access';
      o.via = mode;
      const S = layout.canalSpanM / TILE_M;
      const base = lerp(start, end, a.t);
      if (l.crossing.radical === 'rail_walkway') {
        pos = mode === 'radical' ? [A.x - 0.2, 0.14, base[2]] : [A.x + 0.225, 0.1, base[2]];
      } else if (mode === 'access') {
        o.hidden = true; // dentro da cápsula do Elevador de Bolha
        pos = base;
      } else {
        const big = l.crossing.radical === 'death_jump';
        const lift = big ? 4.5 / TILE_M : 1.6 / TILE_M;
        const air0 = 0.5 - (S / 2) / l.len - 0.02, air1 = 0.5 + (S / 2) / l.len + 0.02;
        const rampLen = (big ? 10 : 5) / TILE_M / l.len;
        let y = 0;
        if (a.t < air0 && a.t > air0 - rampLen) y = ((a.t - (air0 - rampLen)) / rampLen) * lift;
        else if (a.t >= air0 && a.t <= air1) {
          const s = (a.t - air0) / (air1 - air0);
          y = lift * (1 - s) + 4 * (big ? 1.6 : 0.7) * s * (1 - s) + (big ? 2.6 : 1.3) / TILE_M * s;
          o.airborne = true;
          const kind = a.info ? TRICK[a.info.kind] : undefined;
          if (kind === 'spin') trick = { kind, angle: s * Math.PI * 2 };
          if (kind === 'flip') trick = { kind, angle: s * Math.PI * 2 * (big ? 2 : 1) };
        } else if (a.t > air1 && a.t < air1 + ((big ? 10 : 6) / TILE_M) / l.len) {
          const land = (big ? 10 : 6) / TILE_M / l.len;
          y = (1 - (a.t - air1) / land) * (big ? 2.6 : 1.3) / TILE_M;
        }
        pos = add(base, scl(right, 0.21));
        pos[1] = y;
      }
    } else if (l.loop && o.lane === 'fast' && a.forward === (node(l.a).x < node(l.b).x)) {
      // Loop Aéreo: só quem vai para o leste na faixa rápida dá a volta
      const R = 6 / TILE_M;
      const t0 = 0.4, t1 = 0.6;
      const mid = lerp(start, end, 0.5);
      if (a.t >= t0 && a.t <= t1) {
        const ang = ((a.t - t0) / (t1 - t0)) * Math.PI * 2;
        const xo = ((a.t - t0) / (t1 - t0) - 0.5) * 4.4 / TILE_M;
        // espaço local do loop: z = avanço, y = altura, x = hélice → mundo (rot π/2: lz→+x, lx→-z)
        pos = add(mid, [R * Math.sin(ang), R * (1 - Math.cos(ang)), -xo]);
        dir = [Math.cos(ang), Math.sin(ang), 0];
        up = [-Math.sin(ang), Math.cos(ang), 0];
        o.airborne = ang > 0.6 && ang < Math.PI * 2 - 0.6;
      } else {
        // aproxima/afasta da faixa rápida (0.12) para a entrada (+0.275) e a saída (-0.275) da hélice
        const k = a.t < t0 ? a.t / t0 : (a.t - t1) / (1 - t1);
        const off = a.t < t0 ? 0.12 + k * 0.155 : -0.275 + k * 0.395;
        pos = add(a.t < t0 ? lerp(start, mid, k) : lerp(mid, end, k), scl(right, off));
      }
    }
    write(a, pos, dir, up, trick);
  };

  /** Trajetórias dos acrobatas, em metros no espaço local do elemento → mundo. */
  const placeStunt = (a: MockAgent, st: Stunt) => {
    const o = a.out;
    let pos: V, dir: V, up: V = [0, 1, 0];
    let trick: SimTrick | undefined;
    o.airborne = false;
    o.hidden = false;
    o.edge = null;
    o.crossing = null;
    if (st.kind === 'spiral_tower') {
      const { rIn, rOut, turns, height } = stuntDims.spiral;
      const r = (rIn + rOut) / 2;
      const u = (time / 16 + st.phase) % 1;
      if (u < 0.7) { // sobe a hélice
        const s = u / 0.7, ang = s * turns * Math.PI * 2;
        pos = [Math.cos(ang) * r, s * height, Math.sin(ang) * r];
        dir = [-Math.sin(ang), height / (turns * Math.PI * 2 * r), Math.cos(ang)];
      } else if (u < 0.88) { // salta do topo com mortal duplo
        const v = (u - 0.7) / 0.18;
        pos = [r + v * 6, height * (1 - v) + 4 * 4 * v * (1 - v), 0];
        dir = [1, 0, 0];
        trick = { kind: 'flip', angle: v * Math.PI * 4 };
        o.airborne = true;
      } else { // volta rolando para a base
        const v = (u - 0.88) / 0.12;
        pos = [r + 6 - v * 6, 0, -0.8 * Math.sin(v * Math.PI)];
        dir = [-1, 0, 0];
      }
    } else {
      const { R, L } = stuntDims.megapipe;
      const w = (Math.PI * 2) / 3.6;
      const ph = time * w + st.phase * Math.PI * 2;
      const sn = Math.sin(ph), phi = (Math.PI / 2) * sn;
      const x = -L / 2 + 2 + (st.lane % 5) * ((L - 4) / 4);
      pos = [x, R * (1 - Math.cos(phi)), R * Math.sin(phi)];
      const going = Math.sign(Math.cos(ph)) || 1;
      dir = scl([0, Math.sin(phi), Math.cos(phi)], going);
      up = [0, Math.cos(phi), -Math.sin(phi)];
      const extra = Math.max(0, (Math.abs(sn) - 0.9) / 0.1);
      if (extra > 0) { // aéreo acima do coping
        pos[1] += extra * 3.5;
        trick = { kind: 'spin', angle: extra * Math.PI };
        o.airborne = true;
      }
    }
    // local (m) → mundo (tiles)
    write(a, add(scl(rotY(pos, st.rot), 1 / TILE_M), [st.x, 0, st.z]), rotY(dir, st.rot), rotY(up, st.rot), trick);
  };

  const lifts = (): LiftCabinState[] => layout.liftCabins.map((c, i) => {
    // ciclo de 14 s: sobe (3 s) · cabo (5 s) · desce (3 s) · volta pelo cabo (3 s, vazia)
    const T = (time + i * 3.3) % 14;
    const top = 8.0 / TILE_M, bottom = 0.4 / TILE_M;
    let h = bottom, z = c.zA;
    let phase: LiftCabinState['phase'];
    if (T < 3) { h = bottom + (top - bottom) * (T / 3); phase = 'up'; }
    else if (T < 8) { h = top; z = c.zA + (c.zB - c.zA) * ((T - 3) / 5); phase = 'cross'; }
    else if (T < 11) { h = top - (top - bottom) * ((T - 8) / 3); z = c.zB; phase = 'down'; }
    else { h = top; z = c.zB + (c.zA - c.zB) * ((T - 11) / 3); phase = 'return'; }
    return { crossing: c.crossing.id, x: c.x, y: z, h, phase, occupied: phase !== 'return' };
  });

  const snapshot = (): SimState => {
    let airborne = 0;
    const laneCounts = new Map<string, LaneLoad>();
    const edgeLoads = new Map<number, EdgeLoad>();
    const crossings = new Map<number, CrossingState>(
      city.crossings.map((c) => [c.id, { id: c.id, accessible: crossingIsAccessible(c), radical: 0, access: 0 }]),
    );
    for (const a of agents) {
      const o = a.out;
      if (o.airborne) airborne++;
      if (o.crossing !== null) {
        const cs = crossings.get(o.crossing);
        if (cs && o.via) cs[o.via]++;
      }
      if (o.edge === null) continue;
      const side: 1 | -1 = o.lane === 'transit' ? -1 : o.dir;
      const key = `${o.edge}|${o.lane}|${side}`;
      const ll = laneCounts.get(key) ?? { edge: o.edge, lane: o.lane, side, count: 0, load: 0 };
      ll.count++;
      ll.load = ll.count / MOCK_LANE_CAP[o.lane];
      laneCounts.set(key, ll);
    }
    for (const ll of laneCounts.values()) {
      const el = edgeLoads.get(ll.edge) ?? { edge: ll.edge, count: 0, load: 0 };
      el.count += ll.count;
      el.load = Math.max(el.load, ll.load);
      edgeLoads.set(ll.edge, el);
    }
    return {
      time,
      agents: agents.map((a) => a.out),
      lanes: [...laneCounts.values()],
      edges: [...edgeLoads.values()],
      crossings: [...crossings.values()],
      lifts: lifts(),
      lines,
      events,
      airborne,
    };
  };

  const step = (dt: number) => {
    time += dt;
    events = [];
    for (const a of agents) {
      if (a.stunt) {
        placeStunt(a, a.stunt);
        continue;
      }
      const l = link(a.edge);
      a.t += (a.speed * dt) / l.len;
      if (a.t >= 1) {
        if (a.out.airborne && a.info && rng() < 0.08) {
          const names = TRICK_NAMES[a.info.kind] ?? ['GAP'];
          const name = names[Math.floor(rng() * names.length)] ?? 'GAP';
          events.push({ type: 'trick', agent: a.out.id, name, points: l.crossing?.radical === 'death_jump' ? 3000 : 500 });
        }
        nextLink(a, a.forward ? l.b : l.a);
      }
      place(a);
    }
    state = snapshot();
  };

  // posição inicial sem avançar o tempo
  for (const a of agents) {
    if (a.stunt) placeStunt(a, a.stunt);
    else place(a);
  }
  state = snapshot();

  return { city, layout, step, getState: () => state };
}

import { RADICALS } from './Crossings';
import type { AccessKind, CityFile, EdgeKind, LaneCounts, LaneKind, RadicalKind } from './types';
import { LANE_KINDS } from './types';
import type { VehicleProfile } from './Vehicles';

/** 1 tile = 10 metros (ver docs/engineering.md §0). */
export const METERS_PER_TILE = 10;

/** Velocidade máxima típica de cada faixa, m/s (SPEC §4.2). */
export const LANE_MAX_SPEED_MPS: Record<LaneKind, number> = {
  sidewalk: 3,
  slow: 6,
  fast: 8.5,
  transit: 9,
};

/**
 * Sem a faixa própria, o veículo usa a vizinha mais lenta (SPEC §4.2).
 * Ordem de tentativa por faixa preferida.
 */
export const LANE_FALLBACK: Record<LaneKind, readonly LaneKind[]> = {
  sidewalk: ['sidewalk', 'slow', 'fast'],
  slow: ['slow', 'sidewalk'],
  fast: ['fast', 'slow', 'sidewalk'],
  transit: ['transit', 'slow'],
};

/** Números de balanceamento (placeholders até o config/balance.json do Design). */
export interface TrafficParams {
  /** Capacidade de UMA faixa de cada tipo, usuários/hora. */
  laneCapacityVph: Record<LaneKind, number>;
  /** Capacidade das ligações de travessia, usuários/hora. */
  linkCapacityVph: Record<Exclude<LinkKind, 'road'>, number>;
  /** Multiplicador de velocidade ao usar faixa que não é a sua. */
  fallbackSpeedFactor: number;
  /** Espera fixa média no Elevador de Bolha, minutos. */
  liftWaitMin: number;
  /** Velocidade de travessia do Elevador de Bolha, m/s. */
  liftSpeedMps: number;
  bprAlpha: number;
  bprBeta: number;
}

export const DEFAULT_TRAFFIC: TrafficParams = {
  laneCapacityVph: { sidewalk: 2400, slow: 1800, fast: 1500, transit: 600 },
  linkCapacityVph: { radical: 900, lift: 120, walkway: 2400, transit_only: 600 },
  fallbackSpeedFactor: 0.7,
  liftWaitMin: 1.5,
  liftSpeedMps: 1,
  bprAlpha: 0.15,
  bprBeta: 4,
};

/**
 * Tipo de ligação de uma aresta dirigida:
 * - road: trecho de via com faixas;
 * - radical / lift / walkway / transit_only: as duas metades de uma travessia (elemento radical + rota acessível).
 */
export type LinkKind = 'road' | 'radical' | 'lift' | 'walkway' | 'transit_only';

const ACCESS_LINK: Record<AccessKind, LinkKind> = {
  bubble_lift: 'lift',
  glass_walkway: 'walkway',
  transit_only: 'transit_only',
};

export interface DirectedEdge {
  /** Índice nesta lista (estável enquanto o grafo não for reconstruído). */
  index: number;
  link: LinkKind;
  /** id da aresta (road) ou da travessia (demais) no city.json. */
  sourceId: number;
  /** true se é o sentido to→from. */
  reversed: boolean;
  from: number; // índice de nó
  to: number; // índice de nó
  lengthM: number;
  /** Só em vias. */
  roadKind?: EdgeKind;
  /** Só em travessias radicais. */
  radical?: RadicalKind;
  /** Limite da via em m/s (Infinity em travessias). */
  speedLimitMps: number;
  /** Faixas por sentido (só em vias). */
  lanes: Record<LaneKind, number>;
  /** Fluxo por faixa, usuários/hora (só em vias). Atualizado pela simulação. */
  flowVph: Record<LaneKind, number>;
  /** Fluxo na ligação de travessia, usuários/hora. */
  linkFlowVph: number;
}

export interface GraphNode {
  index: number;
  id: number;
  x: number;
  y: number;
}

export interface LaneUse {
  lane: LaneKind;
  /** true se não é a faixa preferida do veículo (mais lento e mais arriscado). */
  fallback: boolean;
}

const zeroLanes = (): Record<LaneKind, number> => ({ sidewalk: 0, slow: 0, fast: 0, transit: 0 });

/**
 * Grafo dirigido derivado do city.json: vias (com faixas por tipo) + travessias (radical + rota acessível).
 * Nós e arestas são acessados por ÍNDICE (arrays densos); use nodeIndexOf(id) para converter ids do arquivo.
 */
export class RoadGraph {
  readonly nodes: GraphNode[] = [];
  readonly edges: DirectedEdge[] = [];
  /** Arestas que saem de cada nó (por índice de nó). */
  readonly out: number[][] = [];

  private readonly idToIndex = new Map<number, number>();

  constructor(city: CityFile, readonly params: TrafficParams = DEFAULT_TRAFFIC) {
    // Ordena por id para determinismo independente da ordem do arquivo.
    for (const n of [...city.nodes].sort((a, b) => a.id - b.id)) {
      const index = this.nodes.length;
      this.nodes.push({ index, id: n.id, x: n.x, y: n.y });
      this.idToIndex.set(n.id, index);
      this.out.push([]);
    }

    for (const e of [...city.edges].sort((a, b) => a.id - b.id)) {
      const lanes = normalizeLanes(e.lanes);
      const base = { link: 'road' as const, sourceId: e.id, roadKind: e.kind, speedLimitMps: e.speed / 3.6, lanes };
      const from = this.nodeIndexOf(e.from);
      const to = this.nodeIndexOf(e.to);
      this.addEdge({ ...base, from, to, reversed: false });
      if (!e.oneWay) this.addEdge({ ...base, from: to, to: from, reversed: true });
    }

    for (const c of [...city.crossings].sort((a, b) => a.id - b.id)) {
      const from = this.nodeIndexOf(c.from);
      const to = this.nodeIndexOf(c.to);
      const links: { link: LinkKind; radical?: RadicalKind }[] = [{ link: 'radical', radical: c.radical }];
      if (c.access) links.push({ link: ACCESS_LINK[c.access] });
      for (const l of links) {
        const base = { ...l, sourceId: c.id, speedLimitMps: Infinity, lanes: zeroLanes() };
        this.addEdge({ ...base, from, to, reversed: false });
        this.addEdge({ ...base, from: to, to: from, reversed: true });
      }
    }
  }

  nodeIndexOf(id: number): number {
    const i = this.idToIndex.get(id);
    if (i === undefined) throw new Error(`RoadGraph: nó ${id} não existe`);
    return i;
  }

  node(index: number): GraphNode {
    const n = this.nodes[index];
    if (!n) throw new Error(`RoadGraph: índice de nó ${index} inválido`);
    return n;
  }

  edge(index: number): DirectedEdge {
    const e = this.edges[index];
    if (!e) throw new Error(`RoadGraph: índice de aresta ${index} inválido`);
    return e;
  }

  /** Distância em linha reta entre dois nós, em metros. */
  distanceM(a: number, b: number): number {
    const na = this.node(a);
    const nb = this.node(b);
    return Math.hypot(na.x - nb.x, na.y - nb.y) * METERS_PER_TILE;
  }

  /** Qual faixa o veículo usa nesta via (ou null se nenhuma serve). */
  laneFor(edgeIndex: number, v: VehicleProfile): LaneUse | null {
    const e = this.edge(edgeIndex);
    const order = LANE_FALLBACK[v.lane];
    for (let i = 0; i < order.length; i++) {
      const lane = order[i]!;
      if (e.lanes[lane] > 0) return { lane, fallback: i > 0 };
    }
    return null;
  }

  /** O veículo pode usar esta aresta? */
  canUse(edgeIndex: number, v: VehicleProfile): boolean {
    return Number.isFinite(this.travelTimeMin(edgeIndex, v));
  }

  /**
   * Tempo de percurso atual (com congestionamento BPR) para um veículo, em minutos.
   * Infinity = proibido para este veículo.
   */
  travelTimeMin(edgeIndex: number, v: VehicleProfile): number {
    const e = this.edge(edgeIndex);
    const p = this.params;
    const minutes = (meters: number, mps: number) => meters / mps / 60;

    switch (e.link) {
      case 'road': {
        const use = this.laneFor(edgeIndex, v);
        if (!use) return Infinity;
        let speed = Math.min(v.speedMps, LANE_MAX_SPEED_MPS[use.lane], e.speedLimitMps);
        if (use.fallback) speed *= p.fallbackSpeedFactor;
        const cap = e.lanes[use.lane] * p.laneCapacityVph[use.lane];
        return bpr(minutes(e.lengthM, speed), e.flowVph[use.lane], cap, p.bprAlpha, p.bprBeta);
      }
      case 'radical': {
        if (v.transit || !v.tricks) return Infinity;
        if (v.maxSpeedMps < RADICALS[e.radical!].minSpeedMps) return Infinity;
        return bpr(minutes(e.lengthM, v.speedMps), e.linkFlowVph, p.linkCapacityVph.radical, p.bprAlpha, p.bprBeta);
      }
      case 'lift': {
        if (v.transit) return Infinity;
        const t0 = p.liftWaitMin + minutes(e.lengthM, p.liftSpeedMps);
        return bpr(t0, e.linkFlowVph, p.linkCapacityVph.lift, p.bprAlpha, p.bprBeta);
      }
      case 'walkway': {
        if (v.transit) return Infinity;
        const speed = Math.min(v.speedMps, LANE_MAX_SPEED_MPS.sidewalk);
        return bpr(minutes(e.lengthM, speed), e.linkFlowVph, p.linkCapacityVph.walkway, p.bprAlpha, p.bprBeta);
      }
      case 'transit_only': {
        if (!v.transit) return Infinity;
        return bpr(minutes(e.lengthM, v.speedMps), e.linkFlowVph, p.linkCapacityVph.transit_only, p.bprAlpha, p.bprBeta);
      }
    }
  }

  /** Maior razão fluxo/capacidade entre as faixas (ou da ligação), para o overlay de congestionamento. */
  saturation(edgeIndex: number): number {
    const e = this.edge(edgeIndex);
    if (e.link !== 'road') return e.linkFlowVph / this.params.linkCapacityVph[e.link];
    let max = 0;
    for (const lane of LANE_KINDS) {
      const cap = e.lanes[lane] * this.params.laneCapacityVph[lane];
      if (cap > 0) max = Math.max(max, e.flowVph[lane] / cap);
    }
    return max;
  }

  resetFlows(): void {
    for (const e of this.edges) {
      e.flowVph = zeroLanes();
      e.linkFlowVph = 0;
    }
  }

  private addEdge(
    e: Omit<DirectedEdge, 'index' | 'lengthM' | 'flowVph' | 'linkFlowVph'>,
  ): void {
    const index = this.edges.length;
    this.edges.push({
      ...e,
      lanes: { ...e.lanes },
      index,
      lengthM: this.distanceM(e.from, e.to),
      flowVph: zeroLanes(),
      linkFlowVph: 0,
    });
    this.out[e.from]!.push(index);
  }
}

function normalizeLanes(l: LaneCounts): Record<LaneKind, number> {
  return { sidewalk: l.sidewalk ?? 0, slow: l.slow ?? 0, fast: l.fast ?? 0, transit: l.transit ?? 0 };
}

/** Função BPR: t = t0 · (1 + α · (v/c)^β). */
export function bpr(t0: number, flow: number, capacity: number, alpha = 0.15, beta = 4): number {
  if (capacity <= 0) return Number.POSITIVE_INFINITY;
  return t0 * (1 + alpha * Math.pow(flow / capacity, beta));
}

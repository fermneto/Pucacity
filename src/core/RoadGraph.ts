import type { CityFile, EdgeKind } from './types';

/** 1 tile = 10 metros (ver PLANEJAMENTO.md §0). */
export const METERS_PER_TILE = 10;

export interface TrafficParams {
  /** Capacidade por faixa de carro, veículos/hora. */
  laneCapacityVph: number;
  bprAlpha: number;
  bprBeta: number;
}

export const DEFAULT_TRAFFIC: TrafficParams = {
  laneCapacityVph: 1800,
  bprAlpha: 0.15,
  bprBeta: 4,
};

/** Aresta dirigida. Uma aresta de mão dupla do city.json vira duas destas. */
export interface DirectedEdge {
  /** Índice nesta lista (estável enquanto o grafo não for reconstruído). */
  index: number;
  /** id da aresta original no city.json. */
  cityEdgeId: number;
  /** true se é o sentido to→from de uma via de mão dupla. */
  reversed: boolean;
  from: number; // índice de nó
  to: number; // índice de nó
  kind: EdgeKind;
  lengthM: number;
  speedKmh: number;
  carLanes: number;
  busLane: boolean;
  capacityVph: number;
  /** Tempo em fluxo livre, minutos. */
  freeFlowMin: number;
  /** Fluxo atual atribuído, veículos/hora. Atualizado pela simulação. */
  flowVph: number;
}

export interface GraphNode {
  index: number;
  id: number;
  x: number;
  y: number;
}

/**
 * Grafo viário dirigido derivado do city.json.
 * Nós e arestas são acessados por ÍNDICE (arrays densos) para desempenho;
 * use nodeIndexOf(id) para converter ids do arquivo.
 */
export class RoadGraph {
  readonly nodes: GraphNode[] = [];
  readonly edges: DirectedEdge[] = [];
  /** Arestas que saem de cada nó (por índice de nó). */
  readonly out: number[][] = [];
  /** Maior velocidade da rede em m/min (para heurística admissível do A*). */
  maxSpeedMpm = 1;

  private readonly idToIndex = new Map<number, number>();

  constructor(city: CityFile, readonly params: TrafficParams = DEFAULT_TRAFFIC) {
    // Ordena por id para determinismo independente da ordem do arquivo.
    const nodes = [...city.nodes].sort((a, b) => a.id - b.id);
    for (const n of nodes) {
      const index = this.nodes.length;
      this.nodes.push({ index, id: n.id, x: n.x, y: n.y });
      this.idToIndex.set(n.id, index);
      this.out.push([]);
    }

    const edges = [...city.edges].sort((a, b) => a.id - b.id);
    for (const e of edges) {
      const from = this.nodeIndexOf(e.from);
      const to = this.nodeIndexOf(e.to);
      const reserved = e.lanesReserved ?? [];
      const carLanes = Math.max(1, e.lanes - reserved.length);
      const busLane = reserved.includes('bus');
      // Em mão dupla, as faixas declaradas valem por sentido.
      this.addEdge(e.id, false, from, to, e.kind, e.speed, carLanes, busLane);
      if (!e.oneWay) this.addEdge(e.id, true, to, from, e.kind, e.speed, carLanes, busLane);
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

  /** Tempo de percurso atual (BPR), minutos. Sempre ≥ freeFlowMin. */
  travelTimeMin(edgeIndex: number): number {
    const e = this.edge(edgeIndex);
    return bpr(e.freeFlowMin, e.flowVph, e.capacityVph, this.params.bprAlpha, this.params.bprBeta);
  }

  /** Razão fluxo/capacidade (para overlay de congestionamento). */
  saturation(edgeIndex: number): number {
    const e = this.edge(edgeIndex);
    return e.flowVph / e.capacityVph;
  }

  resetFlows(): void {
    for (const e of this.edges) e.flowVph = 0;
  }

  private addEdge(
    cityEdgeId: number,
    reversed: boolean,
    from: number,
    to: number,
    kind: EdgeKind,
    speedKmh: number,
    carLanes: number,
    busLane: boolean,
  ): void {
    const lengthM = this.distanceM(from, to);
    const speedMpm = (speedKmh * 1000) / 60;
    this.maxSpeedMpm = Math.max(this.maxSpeedMpm, speedMpm);
    const index = this.edges.length;
    this.edges.push({
      index,
      cityEdgeId,
      reversed,
      from,
      to,
      kind,
      lengthM,
      speedKmh,
      carLanes,
      busLane,
      capacityVph: carLanes * this.params.laneCapacityVph,
      freeFlowMin: lengthM / speedMpm,
      flowVph: 0,
    });
    this.out[from]!.push(index);
  }
}

/** Função BPR: t = t0 · (1 + α · (v/c)^β). */
export function bpr(t0: number, flow: number, capacity: number, alpha = 0.15, beta = 4): number {
  if (capacity <= 0) return Number.POSITIVE_INFINITY;
  return t0 * (1 + alpha * Math.pow(flow / capacity, beta));
}

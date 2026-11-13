import type { RoadGraph } from './RoadGraph';
import type { VehicleProfile } from './Vehicles';

export interface Path {
  /** Índices de nós, da origem ao destino (inclusivo). */
  nodes: number[];
  /** Índices de arestas dirigidas percorridas. */
  edges: number[];
  /** Custo total em minutos (se usado o custo padrão). */
  cost: number;
}

export interface PathOptions {
  /** Custo de uma aresta. Padrão: tempo BPR atual do veículo, em minutos (Infinity = proibida). */
  cost?: (edgeIndex: number) => number;
  /**
   * Heurística (limite inferior do custo restante). Padrão: distância reta / maior velocidade possível
   * (do veículo ou da travessia mais rápida), portanto admissível. Passe () => 0 para Dijkstra puro.
   */
  heuristic?: (nodeIndex: number, goalIndex: number) => number;
  /** Arestas proibidas (ex.: obra, via bloqueada). */
  blocked?: ReadonlySet<number>;
}

/** Heap binário mínimo de (prioridade, valor). Desempate por valor para determinismo. */
class MinHeap {
  private pri: number[] = [];
  private val: number[] = [];

  get size(): number {
    return this.val.length;
  }

  push(p: number, v: number): void {
    this.pri.push(p);
    this.val.push(v);
    let i = this.val.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!this.less(i, parent)) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.val[0]!;
    const lastP = this.pri.pop()!;
    const lastV = this.val.pop()!;
    if (this.val.length > 0) {
      this.pri[0] = lastP;
      this.val[0] = lastV;
      let i = 0;
      const n = this.val.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < n && this.less(l, m)) m = l;
        if (r < n && this.less(r, m)) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private less(a: number, b: number): boolean {
    const pa = this.pri[a]!;
    const pb = this.pri[b]!;
    return pa < pb || (pa === pb && this.val[a]! < this.val[b]!);
  }

  private swap(a: number, b: number): void {
    [this.pri[a], this.pri[b]] = [this.pri[b]!, this.pri[a]!];
    [this.val[a], this.val[b]] = [this.val[b]!, this.val[a]!];
  }
}

/**
 * A* POR MODO entre dois nós (por índice): o veículo só usa as faixas e travessias permitidas para ele.
 * Retorna null se não houver caminho (ex.: cadeira de rodas diante de travessia sem rota acessível).
 */
export function findPath(
  graph: RoadGraph,
  vehicle: VehicleProfile,
  start: number,
  goal: number,
  opts: PathOptions = {},
): Path | null {
  const cost = opts.cost ?? ((e: number) => graph.travelTimeMin(e, vehicle));
  // Nenhuma aresta é percorrida acima disto: via ≤ velocidade do veículo; travessia ≤ maxLinkSpeedMps.
  const mpm = Math.max(vehicle.speedMps, graph.maxLinkSpeedMps) * 60;
  const heuristic = opts.heuristic ?? ((n: number, g: number) => graph.distanceM(n, g) / mpm);
  const blocked = opts.blocked;

  const n = graph.nodes.length;
  const g = new Float64Array(n).fill(Number.POSITIVE_INFINITY);
  const cameBy = new Int32Array(n).fill(-1); // aresta que chegou no nó
  const closed = new Uint8Array(n);
  const open = new MinHeap();

  g[start] = 0;
  open.push(heuristic(start, goal), start);

  while (open.size > 0) {
    const cur = open.pop();
    if (closed[cur]) continue; // entrada obsoleta (lazy deletion)
    if (cur === goal) break;
    closed[cur] = 1;

    for (const ei of graph.out[cur]!) {
      if (blocked?.has(ei)) continue;
      const e = graph.edges[ei]!;
      if (closed[e.to]) continue;
      const c = cost(ei);
      if (!Number.isFinite(c)) continue;
      const tentative = g[cur]! + c;
      if (tentative < g[e.to]!) {
        g[e.to] = tentative;
        cameBy[e.to] = ei;
        open.push(tentative + heuristic(e.to, goal), e.to);
      }
    }
  }

  if (!Number.isFinite(g[goal]!)) return null;

  const edges: number[] = [];
  const nodes: number[] = [goal];
  let at = goal;
  while (at !== start) {
    const ei = cameBy[at]!;
    edges.push(ei);
    at = graph.edges[ei]!.from;
    nodes.push(at);
  }
  edges.reverse();
  nodes.reverse();
  return { nodes, edges, cost: g[goal]! };
}

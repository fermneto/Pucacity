import type { RoadGraph } from './RoadGraph';

/** Distância de um ponto P ao segmento AB (mesmas unidades das coordenadas). */
export function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export interface NearestHit {
  /** Índice no grafo (nó ou aresta dirigida). */
  index: number;
  /** Distância em tiles. */
  dist: number;
}

/** Nó mais próximo de (x, y) em coordenadas de tile, até maxDist. */
export function nearestNode(graph: RoadGraph, x: number, y: number, maxDist = Infinity): NearestHit | null {
  let best: NearestHit | null = null;
  for (const n of graph.nodes) {
    const d = Math.hypot(n.x - x, n.y - y);
    if (d <= maxDist && (!best || d < best.dist)) best = { index: n.index, dist: d };
  }
  return best;
}

/** Aresta dirigida mais próxima de (x, y). Em mão dupla devolve o primeiro sentido (reversed = false). */
export function nearestEdge(graph: RoadGraph, x: number, y: number, maxDist = Infinity): NearestHit | null {
  let best: NearestHit | null = null;
  for (const e of graph.edges) {
    if (e.reversed) continue;
    const a = graph.nodes[e.from]!;
    const b = graph.nodes[e.to]!;
    const d = pointSegmentDistance(x, y, a.x, a.y, b.x, b.y);
    if (d <= maxDist && (!best || d < best.dist)) best = { index: e.index, dist: d };
  }
  return best;
}

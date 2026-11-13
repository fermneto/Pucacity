import { describe, expect, it } from 'vitest';
import { bpr, RoadGraph } from '../../src/core/RoadGraph';
import { tinyCity } from './fixtures';

describe('RoadGraph', () => {
  const g = new RoadGraph(tinyCity());

  it('mão dupla vira duas arestas dirigidas; mão única vira uma', () => {
    // 10 mão única (1) + 11, 12, 13 mão dupla (2 cada) = 7
    expect(g.edges.length).toBe(7);
    expect(g.edges.filter((e) => e.cityEdgeId === 10)).toHaveLength(1);
    expect(g.edges.filter((e) => e.cityEdgeId === 12)).toHaveLength(2);
  });

  it('não existe aresta 2→1 (mão única)', () => {
    const n1 = g.nodeIndexOf(1);
    const n2 = g.nodeIndexOf(2);
    expect(g.out[n2]!.some((ei) => g.edges[ei]!.to === n1)).toBe(false);
  });

  it('calcula comprimento (1 tile = 10 m) e tempo em fluxo livre', () => {
    const e = g.edges.find((x) => x.cityEdgeId === 10)!;
    expect(e.lengthM).toBeCloseTo(100);
    // 100 m a 30 km/h = 0,2 min
    expect(e.freeFlowMin).toBeCloseTo(0.2);
  });

  it('faixa reservada reduz capacidade de carros', () => {
    const av = g.edges.find((x) => x.cityEdgeId === 12)!;
    const avBus = g.edges.find((x) => x.cityEdgeId === 13)!;
    expect(av.capacityVph).toBe(3600);
    expect(avBus.capacityVph).toBe(1800);
    expect(avBus.busLane).toBe(true);
  });

  it('tempo de percurso cresce com o fluxo (BPR)', () => {
    const graph = new RoadGraph(tinyCity());
    const e = graph.edges[0]!;
    expect(graph.travelTimeMin(0)).toBeCloseTo(e.freeFlowMin);
    e.flowVph = e.capacityVph; // v/c = 1 → +15%
    expect(graph.travelTimeMin(0)).toBeCloseTo(e.freeFlowMin * 1.15);
    graph.resetFlows();
    expect(graph.travelTimeMin(0)).toBeCloseTo(e.freeFlowMin);
  });
});

describe('bpr', () => {
  it('segue t0·(1 + 0.15·(v/c)^4)', () => {
    expect(bpr(10, 0, 1000)).toBe(10);
    expect(bpr(10, 2000, 1000)).toBeCloseTo(10 * (1 + 0.15 * 16));
  });
  it('capacidade zero é intransitável', () => {
    expect(bpr(10, 0, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

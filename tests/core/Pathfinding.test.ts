import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCity } from '../../src/core/CityLoader';
import { findPath } from '../../src/core/Pathfinding';
import { RoadGraph } from '../../src/core/RoadGraph';
import { Rng } from '../../src/core/Rng';
import { tinyCity } from './fixtures';

const ids = (g: RoadGraph, nodes: number[]) => nodes.map((n) => g.node(n).id);

describe('findPath (A*)', () => {
  it('prefere a avenida rápida em fluxo livre', () => {
    const g = new RoadGraph(tinyCity());
    const p = findPath(g, g.nodeIndexOf(1), g.nodeIndexOf(4))!;
    expect(ids(g, p.nodes)).toEqual([1, 3, 4]);
    // 2 trechos de 100 m a 60 km/h = 0,1 + 0,1 min
    expect(p.cost).toBeCloseTo(0.2);
  });

  it('desvia quando a avenida congestiona', () => {
    const g = new RoadGraph(tinyCity());
    const av = g.edges.find((e) => e.cityEdgeId === 12 && !e.reversed)!;
    av.flowVph = av.capacityVph * 3; // muito acima da capacidade
    const p = findPath(g, g.nodeIndexOf(1), g.nodeIndexOf(4))!;
    expect(ids(g, p.nodes)).toEqual([1, 2, 4]);
  });

  it('respeita mão única (não há 2→1 direto)', () => {
    const g = new RoadGraph(tinyCity());
    const p = findPath(g, g.nodeIndexOf(2), g.nodeIndexOf(1))!;
    expect(ids(g, p.nodes)).toEqual([2, 4, 3, 1]);
  });

  it('retorna null quando bloqueado', () => {
    const g = new RoadGraph(tinyCity());
    const fromTwo = new Set(g.out[g.nodeIndexOf(2)]);
    expect(findPath(g, g.nodeIndexOf(2), g.nodeIndexOf(1), { blocked: fromTwo })).toBeNull();
  });

  it('origem = destino tem custo zero', () => {
    const g = new RoadGraph(tinyCity());
    const p = findPath(g, 0, 0)!;
    expect(p.edges).toEqual([]);
    expect(p.cost).toBe(0);
  });

  it('A* encontra o mesmo custo que Dijkstra na cidade-demo', () => {
    const city = parseCity(JSON.parse(readFileSync('public/cities/demo.json', 'utf8')));
    const g = new RoadGraph(city);
    const rng = new Rng(42);
    // congestiona aleatoriamente para tornar os custos não triviais
    for (const e of g.edges) e.flowVph = rng.next() * e.capacityVph * 1.5;
    for (let k = 0; k < 50; k++) {
      const a = rng.int(0, g.nodes.length - 1);
      const b = rng.int(0, g.nodes.length - 1);
      const astar = findPath(g, a, b);
      const dijkstra = findPath(g, a, b, { heuristic: () => 0 });
      expect(astar?.cost ?? null).toBeCloseTo(dijkstra?.cost ?? NaN, 9);
    }
  });
});

describe('Rng', () => {
  it('é determinístico pela seed', () => {
    const a = new Rng(123);
    const b = new Rng(123);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    expect(new Rng(124).next()).not.toBe(seqA[0]);
  });

  it('int fica no intervalo inclusivo', () => {
    const r = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

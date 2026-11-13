import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCity } from '../../src/core/CityLoader';
import { findPath, type Path } from '../../src/core/Pathfinding';
import { RoadGraph } from '../../src/core/RoadGraph';
import { Rng } from '../../src/core/Rng';
import { MVP_VEHICLES, vehicle } from '../../src/core/Vehicles';
import type { VehicleKind } from '../../src/core/types';
import { tinyCity } from './fixtures';

const route = (g: RoadGraph, kind: VehicleKind, from: number, to: number) =>
  findPath(g, vehicle(kind), g.nodeIndexOf(from), g.nodeIndexOf(to));
const ids = (g: RoadGraph, p: Path) => p.nodes.map((n) => g.node(n).id);
const links = (g: RoadGraph, p: Path) => p.edges.map((e) => g.edge(e).link);

describe('findPath por modo', () => {
  const g = new RoadGraph(tinyCity());

  it('skate atravessa o canal pela Rampa-Ponte', () => {
    const p = route(g, 'skate', 1, 3)!;
    expect(links(g, p)).toEqual(['radical']);
    expect(p.cost).toBeCloseTo(100 / 5.5 / 60);
  });

  it('pedestre não faz manobra: usa o Elevador de Bolha (com espera)', () => {
    const p = route(g, 'pedestrian', 1, 3)!;
    expect(links(g, p)).toEqual(['lift']);
    expect(p.cost).toBeCloseTo(1.5 + 100 / 1 / 60);
  });

  it('cadeira motorizada (sem manobras) também usa o elevador', () => {
    expect(links(g, route(g, 'wheelchair_powered', 1, 3)!)).toEqual(['lift']);
  });

  it('skate pega o Loop Aéreo; patinete (lento demais) dá a volta pela rampa', () => {
    expect(links(g, route(g, 'skate', 2, 4)!)).toEqual(['radical']);
    const kick = route(g, 'kick_scooter', 2, 4)!;
    expect(ids(g, kick)).toEqual([2, 1, 3, 4]);
    expect(links(g, kick)).toEqual(['road', 'radical', 'road']);
  });

  it('tuk-tuk só cruza pela ligação de coletivo', () => {
    const p = route(g, 'tuktuk', 1, 3)!;
    expect(ids(g, p)).toEqual([1, 2, 4, 3]);
    expect(links(g, p)).toEqual(['road', 'transit_only', 'road']);
  });

  it('ninguém fica preso… a menos que falte a rota acessível', () => {
    const city = tinyCity();
    delete city.crossings[0]!.access;
    const graph = new RoadGraph(city);
    expect(route(graph, 'pedestrian', 1, 3)).toBeNull();
    expect(route(graph, 'skate', 1, 3)).not.toBeNull();
  });

  it('desvia quando a faixa congestiona', () => {
    const graph = new RoadGraph(tinyCity());
    // patinete de 2 para 4: normalmente 2→1→(rampa)→3→4. Lotando a rampa, fica sem alternativa melhor,
    // mas o custo sobe — o A* tem que refletir o BPR.
    const before = route(graph, 'kick_scooter', 2, 4)!.cost;
    for (const e of graph.edges) if (e.link === 'radical' && e.sourceId === 20) e.linkFlowVph = 2700; // 3× a capacidade
    const after = route(graph, 'kick_scooter', 2, 4)!.cost;
    expect(after).toBeGreaterThan(before * 2);
  });

  it('origem = destino tem custo zero', () => {
    const p = findPath(g, vehicle('skate'), 0, 0)!;
    expect(p.edges).toEqual([]);
    expect(p.cost).toBe(0);
  });

  it('A* encontra o mesmo custo que Dijkstra na cidade-demo, para cada veículo do MVP', () => {
    const { city } = parseCity(JSON.parse(readFileSync('public/cities/demo.json', 'utf8')));
    const graph = new RoadGraph(city);
    const rng = new Rng(42);
    for (const e of graph.edges) {
      e.flowVph = { sidewalk: rng.next() * 3000, slow: rng.next() * 2000, fast: rng.next() * 2000, transit: rng.next() * 800 };
      e.linkFlowVph = rng.next() * 200;
    }
    for (const kind of MVP_VEHICLES) {
      const v = vehicle(kind);
      for (let k = 0; k < 30; k++) {
        const a = rng.int(0, graph.nodes.length - 1);
        const b = rng.int(0, graph.nodes.length - 1);
        const astar = findPath(graph, v, a, b);
        const dijkstra = findPath(graph, v, a, b, { heuristic: () => 0 });
        expect(astar === null).toBe(dijkstra === null);
        if (astar && dijkstra) expect(astar.cost).toBeCloseTo(dijkstra.cost, 9);
      }
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

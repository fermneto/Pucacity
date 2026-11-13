import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import balance from '../../config/balance.json';
import vitrine from '../../src/assets/cities/vitrine.json';
import { parseCity } from '../../src/core/CityLoader';
import { findPath, type Path } from '../../src/core/Pathfinding';
import { type ClosableLink, RoadGraph } from '../../src/core/RoadGraph';
import { Rng } from '../../src/core/Rng';
import { MVP_VEHICLES, vehicle } from '../../src/core/Vehicles';
import type { VehicleKind } from '../../src/core/types';
import { tinyCity } from './fixtures';

const route = (g: RoadGraph, kind: VehicleKind, from: number, to: number, closedLinks?: ClosableLink[]) =>
  findPath(g, vehicle(kind), g.nodeIndexOf(from), g.nodeIndexOf(to), closedLinks ? { closedLinks } : {});
const ids = (g: RoadGraph, p: Path) => p.nodes.map((n) => g.node(n).id);
const links = (g: RoadGraph, p: Path) => p.edges.map((e) => g.edge(e).link);

describe('findPath por modo', () => {
  const g = new RoadGraph(tinyCity());

  it('skate atravessa o canal pela Rampa-Ponte (tempo fixo do balance)', () => {
    const p = route(g, 'skate', 1, 3)!;
    expect(links(g, p)).toEqual(['radical']);
    expect(p.cost).toBeCloseTo(balance.radical.rampa_ponte.crossSeconds / 60);
  });

  it('pedestre não faz manobra: usa o Elevador de Bolha', () => {
    const p = route(g, 'pedestrian', 1, 3)!;
    expect(links(g, p)).toEqual(['lift']);
    expect(p.cost).toBeCloseTo(balance.radical.elevador_bolha.crossSeconds / 60);
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

  it('Rail-Passarela sem access tem a passarela de vidro implícita', () => {
    const city = tinyCity();
    city.crossings[0] = { id: 20, from: 1, to: 3, over: 'canal', radical: 'rail_walkway' };
    const graph = new RoadGraph(city);
    const p = route(graph, 'pedestrian', 1, 3)!;
    expect(links(graph, p)).toEqual(['walkway']);
    expect(p.cost).toBeCloseTo(100 / 1.4 / 60);
    expect(links(graph, route(graph, 'skate', 1, 3)!)).toEqual(['radical']);
  });

  it('desvia quando a faixa congestiona', () => {
    const graph = new RoadGraph(tinyCity());
    // patinete de 2 para 4: 2→1→(rampa)→3→4. Lotando a rampa (3× a capacidade, ×13 no tempo),
    // o Elevador de Bolha da mesma travessia passa a compensar.
    const before = route(graph, 'kick_scooter', 2, 4)!;
    expect(links(graph, before)).toEqual(['road', 'radical', 'road']);
    for (const e of graph.edges) if (e.link === 'radical' && e.sourceId === 20) e.linkFlowVph = 2700;
    const after = route(graph, 'kick_scooter', 2, 4)!;
    expect(links(graph, after)).toEqual(['road', 'lift', 'road']);
    expect(after.cost).toBeGreaterThan(before.cost);
    expect(after.cost).toBeCloseTo((25 + balance.radical.elevador_bolha.crossSeconds + 25) / 60);
  });

  it('skate troca o loop pela volta quando o loop lota', () => {
    const graph = new RoadGraph(tinyCity());
    for (const e of graph.edges) if (e.link === 'radical' && e.sourceId === 21) e.linkFlowVph = 9000; // 10× a capacidade
    expect(ids(graph, route(graph, 'skate', 2, 4)!)).toEqual([2, 1, 3, 4]);
  });

  it('fecha ligações por evento: vento no loop, elevador quebrado', () => {
    // pelo id da Arte (balance.events.vento_loop.closes), pelo kind do city.json ou pelo tipo de ligação
    for (const closed of [['loop_aereo'], ['air_loop']] as ClosableLink[][]) {
      const p = route(g, 'skate', 2, 4, closed)!;
      expect(ids(g, p)).toEqual([2, 1, 3, 4]);
      expect(links(g, p)).toEqual(['road', 'radical', 'road']);
    }
    // todos os elementos radicais fechados: o skate também pode usar o elevador
    expect(links(g, route(g, 'skate', 2, 4, ['radical'])!)).toEqual(['road', 'lift', 'road']);
    expect(route(g, 'pedestrian', 1, 3, ['elevador_bolha'])).toBeNull();
    expect(route(g, 'pedestrian', 1, 3, ['bubble_lift'])).toBeNull();
    expect(route(g, 'pedestrian', 1, 3, ['passarela_vidro'])).not.toBeNull();
  });

  it('graph.closedLinks fecha para todas as buscas', () => {
    const graph = new RoadGraph(tinyCity());
    graph.closedLinks.add('elevador_bolha');
    expect(route(graph, 'pedestrian', 1, 3)).toBeNull();
    expect(graph.canUse(graph.edges.find((e) => e.link === 'lift')!.index, vehicle('pedestrian'))).toBe(false);
    graph.closedLinks.clear();
    expect(route(graph, 'pedestrian', 1, 3)).not.toBeNull();
  });

  it('origem = destino tem custo zero', () => {
    const p = findPath(g, vehicle('skate'), 0, 0)!;
    expect(p.edges).toEqual([]);
    expect(p.cost).toBe(0);
  });

  it('heurística usa a maior velocidade efetiva (travessias rápidas passam da velocidade de cruzeiro)', () => {
    const skate = vehicle('skate');
    // Loop Aéreo: 100 m em crossSeconds
    expect(g.maxEffectiveSpeedMps(skate)).toBeCloseTo(100 / balance.radical.loop_aereo.crossSeconds);
    expect(g.maxEffectiveSpeedMps(skate)).toBeGreaterThan(skate.speedMps);
  });
});

function randomFlows(graph: RoadGraph, rng: Rng): void {
  for (const e of graph.edges) {
    if (e.link === 'road') {
      const f = (lane: 'sidewalk' | 'slow' | 'fast' | 'transit') => rng.next() * 1.5 * graph.laneCapacityVph(e.index, lane);
      e.flowVph = { sidewalk: f('sidewalk'), slow: f('slow'), fast: f('fast'), transit: f('transit') };
    } else {
      e.linkFlowVph = rng.next() * 2 * graph.linkCapacityVph(e.index);
    }
  }
}

describe('A* = Dijkstra com fluxos aleatórios', () => {
  const cities = {
    'public/cities/demo.json': parseCity(JSON.parse(readFileSync('public/cities/demo.json', 'utf8'))).city,
    'src/assets/cities/vitrine.json': parseCity(vitrine).city,
  };
  const closures: ClosableLink[][] = [[], ['loop_aereo'], ['elevador_bolha'], ['rampa_ponte', 'passarela_vidro']];

  for (const [name, city] of Object.entries(cities)) {
    it(`${name}: mesmo custo para cada veículo do MVP`, () => {
      const graph = new RoadGraph(city);
      const rng = new Rng(42);
      let found = 0;
      for (let round = 0; round < 3; round++) {
        randomFlows(graph, rng);
        for (const kind of MVP_VEHICLES) {
          const v = vehicle(kind);
          for (let k = 0; k < 25; k++) {
            const a = rng.int(0, graph.nodes.length - 1);
            const b = rng.int(0, graph.nodes.length - 1);
            const closedLinks = closures[k % closures.length]!;
            const astar = findPath(graph, v, a, b, { closedLinks });
            const dijkstra = findPath(graph, v, a, b, { closedLinks, heuristic: () => 0 });
            expect(astar === null).toBe(dijkstra === null);
            if (astar && dijkstra) {
              found++;
              expect(astar.cost).toBeCloseTo(dijkstra.cost, 9);
              // o custo do caminho é a soma dos tempos BPR atuais
              const sum = astar.edges.reduce((s, e) => s + graph.travelTimeMin(e, v), 0);
              expect(astar.cost).toBeCloseTo(sum, 9);
            }
          }
        }
      }
      expect(found).toBeGreaterThan(100);
    });
  }
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

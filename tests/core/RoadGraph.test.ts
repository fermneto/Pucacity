import { describe, expect, it } from 'vitest';
import { crossingsWithoutAccess, RADICALS } from '../../src/core/Crossings';
import { bpr, RoadGraph } from '../../src/core/RoadGraph';
import { vehicle, VEHICLES } from '../../src/core/Vehicles';
import { tinyCity } from './fixtures';

const roadEdge = (g: RoadGraph, id: number) => g.edges.find((e) => e.link === 'road' && e.sourceId === id && !e.reversed)!;

describe('Vehicles (data/arte/veiculos.json)', () => {
  it('carrega os 13 veículos com faixa e velocidade', () => {
    expect(VEHICLES.size).toBe(13);
    expect(vehicle('skate')).toMatchObject({ lane: 'fast', speedMps: 5.5, maxSpeedMps: 7, tricks: true, transit: false });
    expect(vehicle('pedestrian')).toMatchObject({ lane: 'sidewalk', tricks: false });
    expect(vehicle('tuktuk')).toMatchObject({ lane: 'transit', transit: true, tricks: false });
  });
});

describe('Crossings (data/arte/elementos-radicais.json)', () => {
  it('lê a velocidade mínima do Loop Aéreo', () => {
    expect(RADICALS.air_loop.minSpeedMps).toBe(7);
    expect(RADICALS.ramp_bridge.minSpeedMps).toBe(0);
  });

  it('lista travessias sem rota acessível', () => {
    const c = tinyCity();
    expect(crossingsWithoutAccess(c)).toEqual([]);
    delete c.crossings[1]!.access;
    expect(crossingsWithoutAccess(c)).toEqual([21]);
  });
});

describe('RoadGraph', () => {
  const g = new RoadGraph(tinyCity());

  it('vias de mão dupla viram 2 arestas; cada travessia vira radical + acessível nos 2 sentidos', () => {
    expect(g.edges.filter((e) => e.link === 'road')).toHaveLength(4);
    expect(g.edges.filter((e) => e.sourceId === 20 && e.link !== 'road').map((e) => e.link).sort()).toEqual([
      'lift', 'lift', 'radical', 'radical',
    ]);
    expect(g.edges.filter((e) => e.link === 'transit_only')).toHaveLength(2);
  });

  it('comprimento em metros (1 tile = 10 m)', () => {
    expect(roadEdge(g, 10).lengthM).toBeCloseTo(100);
  });

  it('cada veículo usa sua faixa; sem ela, a vizinha mais lenta', () => {
    const e10 = roadEdge(g, 10).index;
    const e11 = roadEdge(g, 11).index;
    expect(g.laneFor(e10, vehicle('skate'))).toEqual({ lane: 'fast', fallback: false });
    expect(g.laneFor(e11, vehicle('skate'))).toEqual({ lane: 'slow', fallback: true });
    expect(g.laneFor(e10, vehicle('tuktuk'))).toEqual({ lane: 'slow', fallback: true });
    expect(g.laneFor(e11, vehicle('pedestrian'))).toEqual({ lane: 'sidewalk', fallback: false });
  });

  it('faixa emprestada é mais lenta', () => {
    const skate = vehicle('skate');
    // 100 m a 5,5 m/s na faixa rápida; na lenta: min(5,5; 6) × 0,7
    expect(g.travelTimeMin(roadEdge(g, 10).index, skate)).toBeCloseTo(100 / 5.5 / 60);
    expect(g.travelTimeMin(roadEdge(g, 11).index, skate)).toBeCloseTo(100 / (5.5 * 0.7) / 60);
  });

  it('regras das travessias por veículo', () => {
    const radical20 = g.edges.find((e) => e.sourceId === 20 && e.link === 'radical')!.index;
    const loop21 = g.edges.find((e) => e.sourceId === 21 && e.link === 'radical')!.index;
    const lift20 = g.edges.find((e) => e.sourceId === 20 && e.link === 'lift')!.index;
    const bus21 = g.edges.find((e) => e.sourceId === 21 && e.link === 'transit_only')!.index;

    expect(g.canUse(radical20, vehicle('skate'))).toBe(true);
    expect(g.canUse(radical20, vehicle('pedestrian'))).toBe(false); // sem manobras
    expect(g.canUse(loop21, vehicle('skate'))).toBe(true); // máx 7 m/s ≥ 7
    expect(g.canUse(loop21, vehicle('kick_scooter'))).toBe(false); // máx 5 m/s < 7
    expect(g.canUse(lift20, vehicle('pedestrian'))).toBe(true);
    expect(g.canUse(lift20, vehicle('tuktuk'))).toBe(false);
    expect(g.canUse(bus21, vehicle('tuktuk'))).toBe(true);
    expect(g.canUse(bus21, vehicle('wheelchair'))).toBe(false);
  });

  it('congestionamento é por faixa: lotar a rápida não atrasa o pedestre', () => {
    const graph = new RoadGraph(tinyCity());
    const e = roadEdge(graph, 10);
    const skate = vehicle('skate');
    const ped = vehicle('pedestrian');
    const tSkate = graph.travelTimeMin(e.index, skate);
    const tPed = graph.travelTimeMin(e.index, ped);
    e.flowVph.fast = 1500; // v/c = 1 → +15%
    expect(graph.travelTimeMin(e.index, skate)).toBeCloseTo(tSkate * 1.15);
    expect(graph.travelTimeMin(e.index, ped)).toBeCloseTo(tPed);
    expect(graph.saturation(e.index)).toBeCloseTo(1);
    graph.resetFlows();
    expect(graph.travelTimeMin(e.index, skate)).toBeCloseTo(tSkate);
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

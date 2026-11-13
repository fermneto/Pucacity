import { describe, expect, it } from 'vitest';
import balance from '../../config/balance.json';
import { crossingsWithoutAccess, RADICALS } from '../../src/core/Crossings';
import { bpr, DEFAULT_TRAFFIC, RoadGraph } from '../../src/core/RoadGraph';
import { vehicle, VEHICLES } from '../../src/core/Vehicles';
import { tinyCity } from './fixtures';

const roadEdge = (g: RoadGraph, id: number) => g.edges.find((e) => e.link === 'road' && e.sourceId === id && !e.reversed)!;
const linkEdge = (g: RoadGraph, id: number, link: string) =>
  g.edges.find((e) => e.sourceId === id && e.link === link && !e.reversed)!.index;

const SHARED = balance.lanes._sharedLanePenalty;

describe('Vehicles (data/arte/veiculos.json)', () => {
  it('carrega os 13 veículos com faixa e velocidade', () => {
    expect(VEHICLES.size).toBe(13);
    expect(vehicle('skate')).toMatchObject({ lane: 'fast', speedMps: 5.5, maxSpeedMps: 7, tricks: true, transit: false });
    expect(vehicle('pedestrian')).toMatchObject({ lane: 'sidewalk', tricks: false });
    expect(vehicle('tuktuk')).toMatchObject({ lane: 'transit', transit: true, tricks: false });
  });
});

describe('Crossings (elementos-radicais.json + balance.radical)', () => {
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

  it('faixa emprestada é mais lenta (balance.lanes._sharedLanePenalty.speedFactor)', () => {
    const skate = vehicle('skate');
    // 100 m a 5,5 m/s na faixa rápida; na lenta: min(5,5; 6) × speedFactor
    expect(g.travelTimeMin(roadEdge(g, 10).index, skate)).toBeCloseTo(100 / 5.5 / 60);
    expect(g.travelTimeMin(roadEdge(g, 11).index, skate)).toBeCloseTo(100 / (5.5 * SHARED.speedFactor) / 60);
  });

  it('capacidade por faixa = capacityPerWidth (usuários/min/m) × largura da faixa × 60', () => {
    // via 10: 10 m em mão dupla → 5 m por sentido ÷ 3 faixas
    const e10 = roadEdge(g, 10).index;
    expect(g.laneWidthM(e10)).toBeCloseTo(5 / 3);
    expect(g.laneCapacityVph(e10, 'fast')).toBeCloseTo((5 / 3) * balance.lanes.fast.capacityPerWidth * 60);
    expect(g.laneCapacityVph(e10, 'sidewalk')).toBeCloseTo((5 / 3) * balance.lanes.sidewalk.capacityPerWidth * 60);
    expect(g.laneCapacityVph(e10, 'transit')).toBe(0);
    // via 11: 8 m → 4 m por sentido ÷ 2 faixas = 2 m
    const e11 = roadEdge(g, 11).index;
    expect(g.laneCapacityVph(e11, 'slow')).toBeCloseTo(2 * balance.lanes.slow.capacityPerWidth * 60);
  });

  it('mão única usa a largura toda', () => {
    const city = tinyCity();
    city.edges[0]!.oneWay = true;
    const graph = new RoadGraph(city);
    expect(graph.laneWidthM(roadEdge(graph, 10).index)).toBeCloseTo(10 / 3);
  });

  it('regras das travessias por veículo', () => {
    const radical20 = linkEdge(g, 20, 'radical');
    const loop21 = linkEdge(g, 21, 'radical');
    const lift20 = linkEdge(g, 20, 'lift');
    const bus21 = linkEdge(g, 21, 'transit_only');

    expect(g.canUse(radical20, vehicle('skate'))).toBe(true);
    expect(g.canUse(radical20, vehicle('pedestrian'))).toBe(false); // sem manobras
    expect(g.canUse(radical20, vehicle('wheelchair'))).toBe(true); // veiculos.json: manobras true (questão aberta 1)
    expect(g.canUse(loop21, vehicle('skate'))).toBe(true); // máx 7 m/s ≥ 7
    expect(g.canUse(loop21, vehicle('kick_scooter'))).toBe(false); // máx 5 m/s < 7
    expect(g.canUse(loop21, vehicle('longboard'))).toBe(false); // rápido, mas sem manobras
    expect(g.canUse(lift20, vehicle('pedestrian'))).toBe(true);
    expect(g.canUse(lift20, vehicle('tuktuk'))).toBe(false);
    expect(g.canUse(bus21, vehicle('tuktuk'))).toBe(true);
    expect(g.canUse(bus21, vehicle('wheelchair'))).toBe(false);
  });

  it('travessias têm tempo fixo de balance.radical.*.crossSeconds', () => {
    expect(g.travelTimeMin(linkEdge(g, 20, 'radical'), vehicle('skate'))).toBeCloseTo(balance.radical.rampa_ponte.crossSeconds / 60);
    expect(g.travelTimeMin(linkEdge(g, 21, 'radical'), vehicle('skate'))).toBeCloseTo(balance.radical.loop_aereo.crossSeconds / 60);
    expect(g.travelTimeMin(linkEdge(g, 20, 'lift'), vehicle('pedestrian'))).toBeCloseTo(balance.radical.elevador_bolha.crossSeconds / 60);
  });

  it('Elevador de Bolha forma fila (BPR com capacityPerMinute)', () => {
    const graph = new RoadGraph(tinyCity());
    const lift = linkEdge(graph, 20, 'lift');
    const ped = vehicle('pedestrian');
    const t0 = graph.travelTimeMin(lift, ped);
    expect(graph.linkCapacityVph(lift)).toBe(balance.tools.elevadorBolha.capacityPerMinute * 60);
    graph.edge(lift).linkFlowVph = balance.tools.elevadorBolha.capacityPerMinute * 60 * 2; // v/c = 2
    expect(graph.travelTimeMin(lift, ped)).toBeCloseTo(t0 * (1 + balance.congestion.alpha * 2 ** balance.congestion.beta));
    expect(graph.saturation(lift)).toBeCloseTo(2);
  });

  it('congestionamento é por faixa: lotar a rápida não atrasa o pedestre', () => {
    const graph = new RoadGraph(tinyCity());
    const e = roadEdge(graph, 10);
    const skate = vehicle('skate');
    const ped = vehicle('pedestrian');
    const tSkate = graph.travelTimeMin(e.index, skate);
    const tPed = graph.travelTimeMin(e.index, ped);
    e.flowVph.fast = graph.laneCapacityVph(e.index, 'fast'); // v/c = 1 → +α
    expect(graph.travelTimeMin(e.index, skate)).toBeCloseTo(tSkate * (1 + balance.congestion.alpha));
    expect(graph.travelTimeMin(e.index, ped)).toBeCloseTo(tPed);
    expect(graph.saturation(e.index)).toBeCloseTo(1);
    graph.resetFlows();
    expect(graph.travelTimeMin(e.index, skate)).toBeCloseTo(tSkate);
  });

  it('quem usa faixa emprestada sofre o BPR da faixa emprestada', () => {
    const graph = new RoadGraph(tinyCity());
    const e = roadEdge(graph, 11); // sem faixa rápida: skate vai na lenta
    const skate = vehicle('skate');
    const t0 = graph.travelTimeMin(e.index, skate);
    e.flowVph.slow = graph.laneCapacityVph(e.index, 'slow');
    expect(graph.travelTimeMin(e.index, skate)).toBeCloseTo(t0 * (1 + balance.congestion.alpha));
  });

  it('tempo livre é limite inferior do tempo com fluxo', () => {
    const graph = new RoadGraph(tinyCity());
    for (const e of graph.edges) {
      e.flowVph = { sidewalk: 9000, slow: 9000, fast: 9000, transit: 9000 };
      e.linkFlowVph = 999;
    }
    for (const v of VEHICLES.values()) {
      for (const e of graph.edges) {
        const free = graph.freeFlowTimeMin(e.index, v);
        const now = graph.travelTimeMin(e.index, v);
        if (Number.isFinite(now)) expect(now).toBeGreaterThanOrEqual(free);
        else expect(free).toBe(Infinity);
      }
    }
  });
});

describe('risco de queda (KPI de Segurança)', () => {
  const g = new RoadGraph(tinyCity());
  const V = balance.vehicles;
  const L = balance.lanes;

  it('lê fallRisk de balance.vehicles pelos ids da Arte', () => {
    expect(DEFAULT_TRAFFIC.vehicleFallRisk.skate).toBe(V.skate.fallRisk);
    expect(DEFAULT_TRAFFIC.vehicleFallRisk.kick_scooter).toBe(V.patinete.fallRisk);
    expect(DEFAULT_TRAFFIC.vehicleFallRisk.wheelchair).toBe(V.cadeira_rodas.fallRisk);
    expect(DEFAULT_TRAFFIC.vehicleFallRisk.tuktuk).toBe(V.tuktuk.fallRisk); // balance v0.3 (PC2) passou a definir o tuk-tuk
  });

  it('vias: risco do veículo × multiplicador da faixa × penalidade de faixa compartilhada', () => {
    const skate = vehicle('skate');
    const e10 = roadEdge(g, 10).index;
    const e11 = roadEdge(g, 11).index;
    expect(g.fallRiskMultiplier(e10, skate)).toBeCloseTo(L.fast.fallRiskMultiplier);
    expect(g.fallRisk(e10, skate)).toBeCloseTo(V.skate.fallRisk * L.fast.fallRiskMultiplier);
    expect(g.fallRisk(e11, skate)).toBeCloseTo(V.skate.fallRisk * L.slow.fallRiskMultiplier * SHARED.fallRiskMultiplier);
    expect(g.fallRisk(e10, vehicle('pedestrian'))).toBeCloseTo(V.pedestre.fallRisk * L.sidewalk.fallRiskMultiplier);
  });

  it('travessias: risco fixo do elemento; elevador sem risco; 0 se não pode usar', () => {
    expect(g.fallRisk(linkEdge(g, 20, 'radical'), vehicle('skate'))).toBe(balance.radical.rampa_ponte.fallRisk);
    expect(g.fallRisk(linkEdge(g, 21, 'radical'), vehicle('skate'))).toBe(balance.radical.loop_aereo.fallRisk);
    expect(g.fallRisk(linkEdge(g, 20, 'lift'), vehicle('pedestrian'))).toBe(balance.radical.elevador_bolha.fallRisk);
    expect(g.fallRisk(linkEdge(g, 20, 'radical'), vehicle('pedestrian'))).toBe(0);
  });

  it('tripFallRisk: média ponderada pelo comprimento + travessias', () => {
    const skate = vehicle('skate');
    const trip = [roadEdge(g, 10).index, linkEdge(g, 20, 'radical')];
    expect(g.tripFallRisk(trip, skate)).toBeCloseTo(
      V.skate.fallRisk * L.fast.fallRiskMultiplier + balance.radical.rampa_ponte.fallRisk,
    );
    expect(g.tripFallRisk([], skate)).toBe(0);
  });
});

describe('bpr', () => {
  it('segue t0·(1 + α·(v/c)^β) com α e β de balance.congestion', () => {
    const { alpha, beta } = balance.congestion;
    expect(bpr(10, 0, 1000)).toBe(10);
    expect(bpr(10, 2000, 1000)).toBeCloseTo(10 * (1 + alpha * 2 ** beta));
  });
  it('capacidade zero é intransitável', () => {
    expect(bpr(10, 0, 0)).toBe(Number.POSITIVE_INFINITY);
  });
});

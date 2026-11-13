import { describe, expect, it } from 'vitest';
import { CommandStack } from '../../src/core/Commands';
import {
  computeKpis,
  evaluateGoals,
  goalsFromBalance,
  type GoalSpec,
  type KpiInput,
  type KpiReport,
  starsFor,
} from '../../src/core/Kpis';
import { RoadGraph } from '../../src/core/RoadGraph';
import type { CityFile } from '../../src/core/types';
import { tinyCity } from './fixtures';

function stats(over: Partial<KpiInput> = {}): KpiInput {
  return {
    tripsStarted: 110,
    tripsCompleted: 100,
    tripsFailed: 0,
    tripMinutesTotal: 2000,
    modeTrips: { pedestrian: 50, skate: 30, wheelchair: 20 },
    tripsByDistrict: {},
    wheelchairTrips: { completed: 20, failed: 0 },
    radicalCrossings: 25,
    ...over,
  };
}

function twoDistricts(): CityFile {
  const city = tinyCity();
  city.districts = [
    { id: 1, name: 'Periferia', income: 'low', population: 100, ownership: {}, wheelchairShare: 0.05 },
    { id: 2, name: 'Centro', income: 'high', population: 100, ownership: {}, wheelchairShare: 0.05 },
  ];
  return city;
}

describe('computeKpis', () => {
  it('tempo médio, divisão modal, radicalidade e saldo', () => {
    const r = computeKpis(stats(), { city: tinyCity(), money: 4200 });
    expect(r.avgTripMinutes).toBe(20);
    expect(r.modalSplit).toEqual({ pedestrian: 0.5, skate: 0.3, wheelchair: 0.2 });
    expect(r.radicalityPct).toBe(25);
    expect(r.balance).toBe(4200);
    expect(r.energyKwh).toBeNull();
    expect(r.fallsPer1000Trips).toBeNull();
    expect(r.noiseIndex).toBeNull();
    expect(r.satisfaction).toBeNull();
  });

  it('sem viagens: KPIs de viagem ficam null', () => {
    const r = computeKpis(
      stats({ tripsCompleted: 0, tripMinutesTotal: 0, modeTrips: {}, wheelchairTrips: { completed: 0, failed: 0 } }),
      { city: tinyCity() },
    );
    expect(r.avgTripMinutes).toBeNull();
    expect(r.accessibilityPct).toBeNull();
    expect(r.radicalityPct).toBeNull();
    expect(r.modalSplit).toEqual({});
  });

  it('congestionamento: % das vias com saturação ≥ limiar', () => {
    const city = tinyCity();
    const g = new RoadGraph(city);
    expect(computeKpis(stats(), { city, graph: g }).congestionPct).toBe(0);
    const e = g.edges.find((x) => x.link === 'road')!;
    e.flowVph.fast = 1e6; // muito acima de qualquer capacidade (não depende do formato de graph.params)
    const roads = g.edges.filter((x) => x.link === 'road').length;
    expect(computeKpis(stats(), { city, graph: g }).congestionPct).toBeCloseTo(100 / roads);
  });

  it('acessibilidade: cadeirantes que não chegam e travessia sem rota acessível derrubam o KPI', () => {
    const city = tinyCity();
    expect(computeKpis(stats(), { city }).accessibilityPct).toBe(100);
    const wc = computeKpis(stats({ wheelchairTrips: { completed: 15, failed: 5 } }), { city });
    expect(wc.wheelchairCompletionPct).toBe(75);
    expect(wc.accessibilityPct).toBe(75);

    // Remove a rota acessível de uma das 2 travessias pelo comando: o KPI cai pela metade.
    const stack = new CommandStack(city, { money: 10_000 });
    stack.execute({ type: 'crossing', crossingId: 20, access: null });
    const r = computeKpis(stats(), { city: stack.city });
    expect(r.crossingsWithoutAccess).toEqual([20]);
    expect(r.accessibilityPct).toBe(50);
  });

  it('equidade: tempo médio da renda baixa − da renda alta', () => {
    const r = computeKpis(
      stats({
        tripsByDistrict: {
          1: { completed: 10, minutesTotal: 400, failed: 2 },
          2: { completed: 10, minutesTotal: 150, failed: 0 },
        },
      }),
      { city: twoDistricts() },
    );
    expect(r.equityGapMinutes).toBe(25);
    expect(computeKpis(stats(), { city: twoDistricts() }).equityGapMinutes).toBeNull();
  });
});

describe('metas e estrelas', () => {
  const report = (o: Partial<KpiReport>): KpiReport => ({ ...computeKpis(stats(), { city: tinyCity(), money: 0 }), ...o });

  const goals: GoalSpec[] = [
    { kpi: 'avgTripMinutes', op: 'delta<=', value: -0.2, stars: 1 },
    { kpi: 'accessibilityPct', op: '>=', value: 95, stars: 2 },
    { kpi: 'balance', op: '>=', value: 0, stars: 2 },
    { kpi: 'satisfaction', op: '>=', value: 60, stars: 3 },
  ];

  it('delta relativo contra a linha de base', () => {
    const base = report({ avgTripMinutes: 30 });
    const [g] = evaluateGoals(goals, report({ avgTripMinutes: 24 }), base);
    expect(g!.measured).toBeCloseTo(-0.2);
    expect(g!.met).toBe(true);
    expect(evaluateGoals(goals, report({ avgTripMinutes: 25 }), base)[0]!.met).toBe(false);
    expect(evaluateGoals(goals, report({ avgTripMinutes: 24 }))[0]!.met).toBeNull(); // sem base
  });

  it('estrelas cumulativas; meta sem medida não bloqueia', () => {
    const base = report({ avgTripMinutes: 30 });
    const star = (o: Partial<KpiReport>) => starsFor(evaluateGoals(goals, report(o), base));
    expect(star({ avgTripMinutes: 29 })).toBe(0);
    expect(star({ avgTripMinutes: 20, accessibilityPct: 80 })).toBe(1);
    expect(star({ avgTripMinutes: 20, accessibilityPct: 100, balance: 10, satisfaction: 50 })).toBe(2);
    expect(star({ avgTripMinutes: 20, accessibilityPct: 100, balance: 10, satisfaction: null })).toBe(3);
    expect(star({ avgTripMinutes: 20, accessibilityPct: 100, balance: 10, satisfaction: 70 })).toBe(3);
  });

  it('aceita o Goal do contrato (types.ts)', () => {
    const r = evaluateGoals([{ kpi: 'congestionPct', op: '<=', value: 10, stars: 1 }], report({ congestionPct: 5 }));
    expect(r[0]!.met).toBe(true);
  });

  it('converte as metas de Vila Nova do balance.json', () => {
    const g = goalsFromBalance('vila-nova');
    expect(g).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kpi: 'avgTripMinutes', op: 'delta<=', value: -0.2, stars: 1 }),
        expect.objectContaining({ kpi: 'accessibilityPct', op: '>=', value: 95, stars: 2 }),
        expect.objectContaining({ kpi: 'fallsPer1000Trips', op: 'delta<=', value: 0, stars: 2 }),
        expect.objectContaining({ kpi: 'balance', op: '>=', value: 0, stars: 2 }),
        expect.objectContaining({ kpi: 'satisfaction', op: '>=', value: 60, stars: 3 }),
      ]),
    );
    expect(() => goalsFromBalance('nao-existe')).toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { transitToolCfg } from '../../src/core/Agents';
import { Simulation } from '../../src/core/Simulation';
import type { CityFile } from '../../src/core/types';
import { tinyCity } from './fixtures';

/** tinyCity com moradia perto do nó 1 e comércio perto do nó 4 (o canal fica no meio). */
function commuteCity(population = 300, wheelchairShare = 0.05): CityFile {
  const c = tinyCity();
  c.buildings = [
    { id: 1, x: 0.5, y: 0.5, kind: 'res', capacity: 100, model: 'bld_res_1', rotation: 0, district: 1 },
    { id: 2, x: 9.5, y: 9.5, kind: 'com', capacity: 100, model: 'bld_com_1', rotation: 0, district: 1 },
  ];
  c.districts = [{ id: 1, name: 'Orla Bolha', income: 'mid', population, ownership: { skate: 30, kick_scooter: 20 }, wheelchairShare }];
  return c;
}

describe('TransitSystem.addLine', () => {
  const sim = () => new Simulation(commuteCity(10), { seed: 1 });

  it('valida a definição', () => {
    const s = sim();
    expect(() => s.transit.addLine({ id: 'a', kind: 'tuktuk', stops: [1] })).toThrow();
    expect(() => s.transit.addLine({ id: 'a', kind: 'tuktuk', stops: [1, 99] })).toThrow();
    expect(() => s.transit.addLine({ id: 'a', kind: 'tuktuk', stops: [1, 1, 2] })).toThrow();
    s.transit.addLine({ id: 'a', kind: 'tuktuk', stops: [1, 2] });
    expect(() => s.transit.addLine({ id: 'a', kind: 'tuktuk', stops: [1, 2] })).toThrow(/já existe/);
  });

  it('tuk-tuk cruza o canal pela ligação só-coletivo; capacidade e headway vêm do balance', () => {
    const s = sim();
    const l = s.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [1, 2, 4] });
    expect(l.active).toBe(true);
    expect(l.capacity).toBe(transitToolCfg('tuktuk').capacity);
    expect(l.def.headwayMinutes).toBe(transitToolCfg('tuktuk').headwayMinutes);
    const links = l.segments.flatMap((sg) => sg.edges.map((e) => s.graph.edge(e).link));
    expect(links).toContain('transit_only');
  });

  it('linha sem rota entre paradas fica inativa, com o motivo', () => {
    const c = commuteCity(10);
    c.crossings = c.crossings.filter((x) => x.id !== 21); // tira o Loop + só-coletivo
    const s = new Simulation(c, { seed: 1 });
    const l = s.transit.addLine({ id: 'T', kind: 'tandem', stops: [2, 4] });
    expect(l.active).toBe(false);
    expect(l.problem).toMatch(/sem rota/);
  });

  it('frota ativa = min(frota, ⌈ciclo/headway⌉) e veículos circulam', () => {
    const s = sim();
    const l = s.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [1, 2, 4], headwayMinutes: 1, fleet: 3 });
    expect(l.activeFleet).toBeLessThanOrEqual(3);
    expect(l.activeFleet).toBeGreaterThanOrEqual(1);
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      s.tick();
      for (const v of s.getState().transit) {
        expect(Number.isFinite(v.x) && Number.isFinite(v.y)).toBe(true);
        seen.add(`${v.x.toFixed(1)},${v.y.toFixed(1)}`);
      }
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});

describe('lotação do coletivo', () => {
  it('nunca passa da capacidade; quem não cabe espera ou desiste', () => {
    // Todo mundo a pé (sem veículos próprios) e uma linha fraca: fila no pico da manhã.
    const c = commuteCity(400, 0);
    c.districts[0]!.ownership = {};
    const s = new Simulation(c, { seed: 5, startMinute: 6 * 60 + 30 });
    const l = s.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [1, 2, 4], headwayMinutes: 15, fleet: 1 });
    let maxLoad = 0;
    for (let i = 0; i < 4 * 60; i++) {
      s.tick();
      for (const v of s.getState().transit) {
        expect(v.load).toBeLessThanOrEqual(v.capacity);
        maxLoad = Math.max(maxLoad, v.load);
      }
    }
    const st = s.getState().stats;
    expect(st.modeTrips.tuktuk ?? 0).toBeGreaterThan(0);
    expect(maxLoad).toBe(l.capacity);
    expect(l.denied).toBeGreaterThan(0);
    expect(l.crowding).toBeGreaterThan(0);
    expect(st.transitGaveUp).toBeGreaterThan(0);
  });

  it('melhorar a linha (headway e frota) atrai mais passageiros', () => {
    const run = (headwayMinutes: number, fleet: number) => {
      const c = commuteCity(400, 0);
      c.districts[0]!.ownership = {};
      const s = new Simulation(c, { seed: 9, startMinute: 6 * 60 });
      s.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [1, 2, 4], headwayMinutes, fleet });
      s.step(4 * 60);
      const st = s.getState().stats;
      return (st.modeTrips.tuktuk ?? 0) / st.tripsStarted;
    };
    const weak = run(30, 1);
    const strong = run(2, 8);
    expect(strong).toBeGreaterThan(weak + 0.05);
  });

  it('removeLine devolve passageiros, que seguem a pé', () => {
    const c = commuteCity(300, 0);
    c.districts[0]!.ownership = {};
    const s = new Simulation(c, { seed: 2, startMinute: 7 * 60 });
    const l = s.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [1, 2, 4], headwayMinutes: 5, fleet: 4 });
    s.step(40);
    const onLine = l.waiting.reduce((n, q) => n + q.length, 0) + l.vehicles.reduce((n, v) => n + v.riders.length, 0);
    expect(onLine).toBeGreaterThan(0);
    const gaveUp0 = s.getState().stats.transitGaveUp;
    expect(s.transit.removeLine('T1')).toBe(true);
    expect(s.transit.lines.length).toBe(0);
    s.tick();
    expect(s.getState().stats.transitGaveUp).toBe(gaveUp0 + onLine);
    s.step(180);
    const st = s.getState().stats;
    expect(s.getState().transit.length).toBe(0);
    expect(st.tripsCompleted).toBeGreaterThan(0);
    expect(st.tripsFailed).toBe(0);
  });
});

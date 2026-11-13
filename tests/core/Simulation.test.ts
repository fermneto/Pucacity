import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import vitrineJson from '../../src/assets/cities/vitrine.json';
import { PLACE_HOME, PLACE_WORK } from '../../src/core/Agents';
import { parseCity } from '../../src/core/CityLoader';
import { Simulation } from '../../src/core/Simulation';
import type { CityFile } from '../../src/core/types';
import { tinyCity } from './fixtures';

const vitrine = () => JSON.parse(JSON.stringify(vitrineJson)) as CityFile;
const demo = () => parseCity(JSON.parse(readFileSync('public/cities/demo.json', 'utf8'))).city;
const snap = (s: Simulation) => JSON.stringify(s.serialize());

function commuteCity(population = 300, wheelchairShare = 0.05): CityFile {
  const c = tinyCity();
  c.buildings = [
    { id: 1, x: 0.5, y: 0.5, kind: 'res', capacity: 100, model: 'bld_res_1', rotation: 0, district: 1 },
    { id: 2, x: 9.5, y: 9.5, kind: 'com', capacity: 100, model: 'bld_com_1', rotation: 0, district: 1 },
  ];
  c.districts = [{ id: 1, name: 'Orla Bolha', income: 'mid', population, ownership: { skate: 30, kick_scooter: 20 }, wheelchairShare }];
  return c;
}

describe('rotina casa → trabalho → casa', () => {
  const sim = new Simulation(vitrine(), { seed: 42, scale: 0.25 });
  sim.step(24 * 60 - 6 * 60 - 1); // 06:00 → 23:59
  const st = sim.getState().stats;

  it('picos de manhã e à tarde (balance.time.peaks)', () => {
    const h = st.tripsStartedByHour;
    const am = h[7]! + h[8]!;
    const pm = h[17]! + h[18]!;
    const midday = h[11]! + h[12]!;
    expect(am).toBeGreaterThan(4 * midday);
    expect(pm).toBeGreaterThan(4 * midday);
    expect(h[3]).toBe(0);
  });

  it('quase todos terminam o dia em casa e as viagens se completam', () => {
    const atHome = sim.citizens.filter((c) => c.location === PLACE_HOME).length;
    expect(atHome / sim.citizens.length).toBeGreaterThan(0.97);
    expect(st.tripsCompleted).toBeGreaterThan(1.8 * sim.citizens.length);
    expect(st.tripsCompleted / st.tripsStarted).toBeGreaterThan(0.98);
    expect(st.tripMinutesTotal / st.tripsCompleted).toBeGreaterThan(0.5);
  });

  it('estatísticas por bairro, cadeirantes e travessias radicais', () => {
    const byD = Object.values(st.tripsByDistrict);
    expect(byD.length).toBe(vitrine().districts.length); // a vitrine do PC1 muda; não fixar o número
    expect(byD.reduce((s, d) => s + d.completed, 0)).toBe(st.tripsCompleted);
    expect(st.wheelchairTrips.completed).toBeGreaterThan(0);
    expect(st.radicalCrossings).toBeGreaterThan(0);
    const modes = Object.keys(st.modeTrips);
    expect(modes).toContain('pedestrian');
    expect(modes.length).toBeGreaterThan(3);
  });

  it('virada do dia: statsToday zera, stats acumula e a agenda é refeita', () => {
    const total = st.tripsStarted;
    sim.step(2);
    const s2 = sim.getState();
    expect(s2.day).toBe(1);
    expect(s2.statsToday.tripsStarted).toBe(0);
    expect(s2.stats.tripsStarted).toBe(total);
    sim.step(9 * 60);
    expect(sim.getState().statsToday.tripsStarted).toBeGreaterThan(0);
  });
});

describe('fluxo por faixa → BPR', () => {
  it('o fluxo chega ao grafo (flowVph/linkFlowVph) e à saturação do estado', () => {
    const sim = new Simulation(vitrine(), { seed: 1, startMinute: 7 * 60 + 30 });
    sim.step(30);
    const st = sim.getState();
    expect(st.edgeSaturation.length).toBe(sim.graph.edges.length);
    expect(Math.max(...st.edgeSaturation)).toBeGreaterThan(0);
    const roadFlow = sim.graph.edges.reduce((s, e) => s + e.flowVph.sidewalk + e.flowVph.slow + e.flowVph.fast, 0);
    const linkFlow = sim.graph.edges.reduce((s, e) => s + e.linkFlowVph, 0);
    expect(roadFlow).toBeGreaterThan(0);
    expect(linkFlow).toBeGreaterThan(0);
  });

  it('scale < 1 representa a população inteira no fluxo', () => {
    const full = new Simulation(vitrine(), { seed: 3, startMinute: 7 * 60 + 30 });
    const half = new Simulation(vitrine(), { seed: 3, startMinute: 7 * 60 + 30, scale: 0.5 });
    full.step(30);
    half.step(30);
    const sum = (s: Simulation) => s.getState().edgeSaturation.reduce((a, b) => a + b, 0);
    expect(sum(half) / sum(full)).toBeGreaterThan(0.7);
    expect(sum(half) / sum(full)).toBeLessThan(1.3);
  });
});

describe('getState', () => {
  it('agentes em deslocamento com posição, aresta e faixa coerentes', () => {
    const sim = new Simulation(vitrine(), { seed: 8, startMinute: 7 * 60 + 45 });
    sim.step(5);
    const st = sim.getState();
    expect(st.agents.length).toBeGreaterThan(20);
    expect(sim.getState()).toBe(st); // barato: mesmo objeto até o próximo tick
    for (const a of st.agents) {
      expect(Number.isFinite(a.x) && Number.isFinite(a.y) && Number.isFinite(a.heading)).toBe(true);
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x).toBeLessThanOrEqual(sim.city.size.w);
      if (a.edge >= 0) {
        const e = sim.graph.edge(a.edge);
        if (e.link === 'road') expect(a.lane).not.toBeNull();
      } else expect(a.lane).toBeNull();
    }
    expect(st.minuteOfDay).toBe(7 * 60 + 50);
  });
});

describe('determinismo', () => {
  const run = (seed: number, minutes: number) => {
    const s = new Simulation(vitrine(), { seed, scale: 0.3, startMinute: 6 * 60 + 50 });
    s.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [0, 1, 2, 6, 5, 4], headwayMinutes: 6, fleet: 3 });
    s.step(minutes);
    return s;
  };

  it('mesma seed → mesmo serialize() após N ticks', () => {
    expect(snap(run(123, 240))).toBe(snap(run(123, 240)));
  });

  it('seed diferente → estado diferente', () => {
    expect(snap(run(123, 120))).not.toBe(snap(run(124, 120)));
  });

  it('save/load no meio do caminho continua igual à execução contínua', () => {
    const a = run(77, 97);
    const b = Simulation.deserialize(vitrine(), a.serialize());
    expect(snap(b)).toBe(snap(a));
    a.step(150);
    b.step(150);
    expect(snap(b)).toBe(snap(a));
  });

  it('serialize() é JSON puro', () => {
    const data = run(5, 60).serialize();
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });
});

describe('setCity', () => {
  it('mantém relógio, moradores e rng; reconstrói o grafo e as rotas continuam', () => {
    const sim = new Simulation(vitrine(), { seed: 4, scale: 0.3, startMinute: 7 * 60 });
    sim.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [0, 1, 2, 6], headwayMinutes: 5, fleet: 2 });
    sim.step(60);
    const before = sim.getState();
    const minute = before.minute;
    const started = before.stats.tripsStarted;
    const citizens = sim.citizens.length;
    const oldGraph = sim.graph;
    expect(sim.activeTrips).toBeGreaterThan(0);

    // Comando do jogador: tira a faixa rápida da via 7 e remove a travessia 3 (sem rota acessível).
    const c = vitrine();
    c.edges.find((e) => e.id === 7)!.lanes = { sidewalk: 3, slow: 3, transit: 1 };
    c.crossings = c.crossings.filter((x) => x.id !== 3);
    sim.setCity(c);

    expect(sim.graph).not.toBe(oldGraph);
    expect(sim.city).toBe(c);
    const after = sim.getState();
    expect(after.minute).toBe(minute);
    expect(sim.citizens.length).toBe(citizens);
    expect(after.stats.tripsStarted).toBe(started);
    expect(after.edgeSaturation.length).toBe(sim.graph.edges.length);
    for (const a of after.agents) if (a.edge >= 0) expect(a.edge).toBeLessThan(sim.graph.edges.length);
    expect(sim.transit.getLine('T1')!.active).toBe(true);

    sim.step(120);
    const st = sim.getState().stats;
    expect(st.tripsCompleted).toBeGreaterThan(0);
    // Ninguém usa mais a via 7 pela faixa rápida.
    for (const e of sim.graph.edges) if (e.sourceId === 7 && e.link === 'road') expect(e.flowVph.fast).toBe(0);
  });

  it('setCity é determinístico', () => {
    const go = () => {
      const s = new Simulation(vitrine(), { seed: 10, scale: 0.2, startMinute: 7 * 60 + 30 });
      s.step(30);
      const c = vitrine();
      c.crossings = c.crossings.filter((x) => x.id !== 0);
      s.setCity(c);
      s.step(30);
      return snap(s);
    };
    expect(go()).toBe(go());
  });
});

describe('cadeirantes', () => {
  it('nunca trocam de modo, mesmo com um tuk-tuk ótimo', () => {
    const sim = new Simulation(commuteCity(400, 0.3), { seed: 6, startMinute: 6 * 60 });
    sim.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [1, 2, 4], headwayMinutes: 2, fleet: 8 });
    sim.step(14 * 60);
    const chairs = sim.citizens.filter((c) => c.chair);
    expect(chairs.length).toBeGreaterThan(50);
    for (const c of chairs) if (c.lastMode) expect(c.lastMode).toBe(c.chair);
    const st = sim.getState().stats;
    expect(st.modeTrips.tuktuk ?? 0).toBeGreaterThan(0); // os outros moradores usam
    expect(st.wheelchairTrips.completed).toBeGreaterThan(0);
  });

  it('sem rota acessível, a viagem do cadeirante falha (e conta como falha)', () => {
    const c = commuteCity(200, 1);
    c.districts[0]!.ownership = { wheelchair_powered: 100 }; // cadeira motorizada não faz manobras
    c.crossings = c.crossings.map((x) => ({ ...x, access: undefined }));
    const sim = new Simulation(c, { seed: 1, startMinute: 6 * 60 });
    sim.step(4 * 60);
    const st = sim.getState().stats;
    expect(st.wheelchairTrips.failed).toBeGreaterThan(0);
    expect(st.wheelchairTrips.completed).toBe(0);
    expect(st.tripsByDistrict[1]!.failed).toBe(st.tripsFailed);
  });
});

describe('desempenho', () => {
  it('2.000 agentes por 60 ticks (cidade-demo, pico da manhã)', () => {
    const city = demo();
    const pop = city.districts.reduce((s, d) => s + d.population, 0);
    const sim = new Simulation(city, { seed: 1, scale: 2000 / pop, startMinute: 7 * 60 });
    const line = sim.transit.addLine({ id: 'T1', kind: 'tuktuk', stops: [16, 104, 114, 22], headwayMinutes: 4, fleet: 4 });
    expect(line.active).toBe(true);
    expect(sim.citizens.length).toBeGreaterThanOrEqual(1990);
    // Estresse: todos saem para o trabalho no mesmo minuto e voltam 30 min depois.
    for (const c of sim.citizens) {
      c.agenda = [7 * 60, PLACE_WORK, 7 * 60 + 30, PLACE_HOME];
      c.fired = 0;
      c.next = 0;
    }
    let maxActive = 0;
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      sim.tick();
      sim.getState();
      maxActive = Math.max(maxActive, sim.activeTrips);
    }
    const ms = performance.now() - t0;
    console.log(`[desempenho] ${sim.citizens.length} moradores, até ${maxActive} viagens simultâneas, 60 ticks em ${ms.toFixed(0)} ms (${(ms / 60).toFixed(2)} ms/tick)`);
    expect(maxActive).toBeGreaterThan(1000);
    expect(ms).toBeLessThan(3000);
  });
});

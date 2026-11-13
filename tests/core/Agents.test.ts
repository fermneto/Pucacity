import { describe, expect, it } from 'vitest';
import vitrine from '../../src/assets/cities/vitrine.json';
import {
  BALANCE,
  PLACE_HOME,
  PLACE_WORK,
  chooseLogit,
  createCitizens,
  disutility,
  individualModes,
  planDay,
  type ModeEstimate,
} from '../../src/core/Agents';
import { Rng } from '../../src/core/Rng';
import type { CityFile } from '../../src/core/types';

// Casos escritos a partir de config/balance.json (docs/design/balance-casos.md do PC2 ainda não existe).
const city = vitrine as unknown as CityFile;

describe('createCitizens', () => {
  const cs = createCitizens(city, new Rng(7), 0.5);

  it('cria população × scale por bairro', () => {
    const expected = city.districts.reduce((s, d) => s + Math.round(d.population * 0.5), 0);
    expect(cs.length).toBe(expected);
    for (const d of city.districts) {
      expect(cs.filter((c) => c.district === d.id).length).toBe(Math.round(d.population * 0.5));
    }
  });

  it('veículos próprios só do ownership do bairro; cadeirantes só com a cadeira', () => {
    for (const c of cs) {
      const d = city.districts.find((x) => x.id === c.district)!;
      if (c.chair) {
        expect(c.owned).toEqual([]);
        expect(c.group).toBe('cadeirante');
        expect(individualModes(c)).toEqual([c.chair]);
      } else {
        for (const k of c.owned) expect(d.ownership[k] ?? 0).toBeGreaterThan(0);
        expect(individualModes(c)[0]).toBe('pedestrian');
      }
    }
  });

  it('fração de cadeirantes ≈ wheelchairShare', () => {
    const share = cs.filter((c) => c.chair).length / cs.length;
    const expected = city.districts.reduce((s, d) => s + d.population * d.wheelchairShare, 0) / city.districts.reduce((s, d) => s + d.population, 0);
    expect(Math.abs(share - expected)).toBeLessThan(0.015);
  });

  it('é determinístico pela seed', () => {
    expect(createCitizens(city, new Rng(7), 0.5)).toEqual(cs);
    expect(createCitizens(city, new Rng(8), 0.5)).not.toEqual(cs);
  });
});

describe('planDay (picos de balance.time.peaks)', () => {
  const cs = createCitizens(city, new Rng(3), 0.3);
  const rng = new Rng(4);
  for (const c of cs) planDay(c, rng);
  const [am, pm] = BALANCE.time.peaks;

  it('ida ao trabalho de manhã e volta à tarde, concentradas nos picos', () => {
    let inAm = 0;
    let inPm = 0;
    let n = 0;
    for (const c of cs) {
      expect(c.agenda[1]).toBe(PLACE_WORK);
      expect(c.agenda[3]).toBe(PLACE_HOME);
      const go = c.agenda[0]!;
      const back = c.agenda[2]!;
      expect(back).toBeGreaterThan(go);
      n++;
      if (go >= am!.startHour * 60 && go < am!.endHour * 60) inAm++;
      if (back >= pm!.startHour * 60 && back < pm!.endHour * 60) inPm++;
    }
    expect(inAm / n).toBeGreaterThan(0.75);
    expect(inPm / n).toBeGreaterThan(0.75);
  });

  it('a agenda termina em casa e dentro do dia', () => {
    for (const c of cs) {
      expect(c.agenda[c.agenda.length - 1]).toBe(PLACE_HOME);
      for (let i = 0; i < c.agenda.length; i += 2) expect(c.agenda[i]).toBeLessThan(24 * 60);
    }
  });
});

describe('escolha modal logit', () => {
  const base = (mode: ModeEstimate['mode'], minutes: number, fun = 0): ModeEstimate => ({ mode, minutes, cost: 0, risk: 0, comfort: 0.6, fun });

  const share = (opts: ModeEstimate[], idx: number, n = 4000) => {
    const rng = new Rng(11);
    let k = 0;
    for (let i = 0; i < n; i++) if (chooseLogit(opts, rng) === idx) k++;
    return k / n;
  };

  it('a opção de menor desutilidade é a mais escolhida, mas não sempre (ruído)', () => {
    const s = share([base('pedestrian', 20), base('skate', 10)], 1);
    expect(s).toBeGreaterThan(0.9);
    const close = share([base('pedestrian', 10.5), base('skate', 10)], 1);
    expect(close).toBeGreaterThan(0.5);
    expect(close).toBeLessThan(0.75);
  });

  it('melhorar um modo atrai gente', () => {
    const before = share([base('pedestrian', 12), base('tuktuk', 14)], 1);
    const after = share([base('pedestrian', 12), base('tuktuk', 11)], 1);
    expect(after).toBeGreaterThan(before + 0.2);
  });

  it('diversão reduz a desutilidade (skatista aceita rota um pouco mais longa com loop)', () => {
    const w = BALANCE.modalChoice.weights;
    expect(disutility(base('skate', 10, 1.2))).toBeCloseTo(disutility(base('skate', 10, 0)) - 1.2 * w.diversao);
    expect(share([base('skate', 10, 0), base('skate', 10.3, 1.7)], 1)).toBeGreaterThan(0.5);
  });

  it('custo e risco pesam conforme balance.modalChoice.weights', () => {
    const a = { ...base('tuktuk', 10), cost: 2 };
    expect(disutility(a) - disutility(base('tuktuk', 10))).toBeCloseTo(2 * BALANCE.modalChoice.weights.custo);
  });
});

describe('Rng (extensões)', () => {
  it('weighted respeita os pesos e ignora pesos ≤ 0', () => {
    const r = new Rng(1);
    const hits = [0, 0, 0];
    for (let i = 0; i < 3000; i++) hits[r.weighted([1, 0, 3])]!++;
    expect(hits[1]).toBe(0);
    expect(hits[2]! / hits[0]!).toBeGreaterThan(2.5);
    expect(new Rng(1).weighted([0, -1])).toBe(-1);
  });
});

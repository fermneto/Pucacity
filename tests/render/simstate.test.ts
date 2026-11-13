import { describe, expect, it } from 'vitest';
import vitrine from '../../src/assets/cities/vitrine.json';
import type { CityFile } from '../../src/core/types';
import { VEHICLE_KINDS } from '../../src/core/types';
import { createMockSim, type SimState } from '../../src/render/SimState';

// Mock do estado que o render espera de Simulation.getState() (proposta PC1 → PC3).
const city = vitrine as unknown as CityFile;
const DT = 1 / 30;

function run(seed: number, steps: number): SimState[] {
  const sim = createMockSim(city, seed, { agents: 200 });
  const out: SimState[] = [];
  for (let i = 0; i < steps; i++) {
    sim.step(DT);
    // o estado é reaproveitado entre passos: tira uma cópia
    if (i % 30 === 29) out.push(JSON.parse(JSON.stringify(sim.getState())) as SimState);
  }
  return out;
}

describe('createMockSim (SimState)', () => {
  it('é determinístico: mesma seed → mesmo estado', () => {
    expect(run(7, 300)).toEqual(run(7, 300));
  });

  it('seeds diferentes geram estados diferentes', () => {
    expect(run(7, 60)).not.toEqual(run(8, 60));
  });

  it('mantém os agentes dentro do mapa e com dados válidos', () => {
    const sim = createMockSim(city, 3, { agents: 200 });
    const { w, h } = city.size;
    const edgeIds = new Set(city.edges.map((e) => e.id));
    const kinds = new Set<string>(VEHICLE_KINDS);
    const bad: string[] = [];
    let airborne = 0;
    for (let i = 0; i < 600; i++) {
      sim.step(DT);
      const s = sim.getState();
      airborne += s.airborne;
      for (const a of s.agents) {
        const inside = a.x >= -1 && a.x <= w + 1 && a.y >= -1 && a.y <= h + 1 && a.h >= -0.1;
        const finite = [a.x, a.y, a.h, a.forward.x, a.forward.y, a.forward.h, a.up.x, a.up.y, a.up.h].every(Number.isFinite);
        if (!inside || !finite || !kinds.has(a.kind) || (a.edge !== null && !edgeIds.has(a.edge))) {
          bad.push(`passo ${i}: agente ${a.id} (${a.kind}) em ${a.x.toFixed(2)}, ${a.y.toFixed(2)}, h ${a.h.toFixed(2)}`);
        }
      }
      for (const l of s.lanes) if (!edgeIds.has(l.edge)) bad.push(`passo ${i}: faixa em aresta ${l.edge} inexistente`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(airborne).toBeGreaterThan(0);
  });

  it('expõe ocupação por faixa e por aresta coerentes com os agentes', () => {
    const sim = createMockSim(city, 5, { agents: 300 });
    sim.step(DT);
    const s = sim.getState();
    const onEdges = s.agents.filter((a) => a.edge !== null).length;
    expect(s.lanes.reduce((n, l) => n + l.count, 0)).toBe(onEdges);
    expect(s.edges.reduce((n, e) => n + e.count, 0)).toBe(onEdges);
    expect(s.crossings).toHaveLength(city.crossings.length);
    expect(s.lifts.length).toBe(city.crossings.filter((c) => c.access === 'bubble_lift').length);
    expect(new Set(s.agents.map((a) => a.id)).size).toBe(s.agents.length);
  });
});

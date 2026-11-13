import { describe, expect, it } from 'vitest';
import vitrine from '../../src/assets/cities/vitrine.json';
import { parseCity } from '../../src/core/CityLoader';
import { CommandStack } from '../../src/core/Commands';
import { EventEngine, toMinute } from '../../src/core/Events';
import { loadGame, restoreGame, saveGame, SAVE_VERSION, SaveError, type Serializable } from '../../src/core/Save';
import { Rng } from '../../src/core/Rng';

/** Simulação falsa com estado do tamanho esperado (2.000 agentes com rota), no lugar de Simulation.ts. */
class FakeSim implements Serializable {
  readonly agents: { id: number; kind: string; node: number; route: number[]; t: number; battery: number }[] = [];
  constructor(n: number) {
    const rng = new Rng(7);
    for (let i = 0; i < n; i++) {
      this.agents.push({
        id: i,
        kind: rng.pick(['pedestrian', 'skate', 'kick_scooter', 'wheelchair']),
        node: rng.int(0, 15),
        route: Array.from({ length: 12 }, () => rng.int(0, 40)),
        t: rng.next() * 60,
        battery: rng.int(0, 100),
      });
    }
  }
  serialize(): unknown {
    return { tick: 12345, rng: 987654, agents: this.agents, flows: Array.from({ length: 80 }, (_, i) => i * 1.5) };
  }
}

function setup() {
  const city = parseCity(vitrine).city;
  const commands = new CommandStack(city, { money: 5000 });
  commands.execute({ type: 'lanes', edgeId: city.edges[0]!.id, lanes: { sidewalk: 2, slow: 1, fast: 3 } });
  commands.execute({ type: 'crossing', crossingId: 3, access: 'bubble_lift' }, 2);
  commands.execute({ type: 'addLine', line: { id: 'T1', kind: 'tandem', stops: [0, 1, 2], headwayMinutes: 12, fleet: 2 } });
  commands.undo();
  const events = EventEngine.create({ seed: 9, scenario: { id: 'vila-nova', goals: [], budget: 5000, durationDays: 14 } });
  events.update(toMinute(6, 20));
  return { city: commands.city, commands, events, sim: new FakeSim(2000) };
}

describe('Save', () => {
  it('ida e volta: cidade, pilhas, saldo, eventos e simulação', () => {
    const g = setup();
    const json = saveGame({ ...g, meta: { scenario: 'vila-nova' } });
    const data = loadGame(json);
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.city).toStrictEqual(g.city);
    expect(data.sim).toEqual(JSON.parse(JSON.stringify(g.sim.serialize())));
    expect(data.meta).toEqual({ scenario: 'vila-nova' });

    const r = restoreGame(data);
    expect(r.commands.money).toBe(g.commands.money);
    expect(r.commands.serialize()).toEqual(g.commands.serialize());
    expect(r.events!.serialize()).toEqual(g.events.serialize());

    // Undo depois do load continua devolvendo a cidade original.
    const original = parseCity(vitrine).city;
    while (r.commands.canUndo) r.commands.undo();
    expect(r.commands.city).toStrictEqual(original);
    expect(r.commands.redo()).not.toBeNull();
  });

  it('save + load < 100 ms com a cidade da vitrine e 2.000 agentes', () => {
    const g = setup();
    saveGame(g); // aquecimento
    const t0 = performance.now();
    const json = saveGame(g);
    const t1 = performance.now();
    const r = restoreGame(loadGame(json));
    const t2 = performance.now();
    console.log(`save ${(t1 - t0).toFixed(1)} ms, load ${(t2 - t1).toFixed(1)} ms, ${(json.length / 1024).toFixed(0)} KiB`);
    expect(r.commands.city).toStrictEqual(g.city);
    expect(t1 - t0).toBeLessThan(100);
    expect(t2 - t1).toBeLessThan(100);
  });

  it('erros legíveis para save quebrado', () => {
    expect(() => loadGame('{')).toThrow(SaveError);
    expect(() => loadGame(JSON.stringify({ version: 99 }))).toThrow(/versão 99/);
    const g = setup();
    const bad = JSON.parse(saveGame(g));
    bad.city.edges[0].lanes = {};
    expect(() => loadGame(JSON.stringify(bad))).toThrow(/cidade inválida/);
    const bad2 = JSON.parse(saveGame(g));
    bad2.commands = { money: 'x' };
    expect(() => loadGame(JSON.stringify(bad2))).toThrow(/comandos/);
  });
});

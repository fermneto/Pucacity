import { describe, expect, it } from 'vitest';
import balance from '../../config/balance.json';
import vitrine from '../../src/assets/cities/vitrine.json';
import { Command, CommandStack, type CommandSpec, type GameState, linesOperationPerDay, planCommand } from '../../src/core/Commands';
import { parseCity } from '../../src/core/CityLoader';
import type { CityFile } from '../../src/core/types';
import { tinyCity } from './fixtures';

const state = (city: CityFile = tinyCity()): GameState => ({ city, lines: [] });

const tuk = { id: 'L1', kind: 'tuktuk' as const, stops: [1, 2, 4], headwayMinutes: 10, fleet: 3 };

describe('Commands — cada ferramenta', () => {
  it('divisão de faixas: muda as faixas, custa o do balance e mostra a diferença', () => {
    const p = planCommand(state(), { type: 'lanes', edgeId: 10, lanes: { sidewalk: 1, fast: 2 } });
    expect(p.ok).toBe(true);
    expect(p.cost).toBe(balance.tools.divisaoFaixas.cost);
    expect(p.changes).toEqual([
      { target: 'edge', id: 10, field: 'lanes', before: { sidewalk: 1, slow: 1, fast: 1 }, after: { sidewalk: 1, fast: 2 } },
    ]);
  });

  it('divisão de faixas: não deixa via sem faixa e avisa via sem calçada', () => {
    expect(planCommand(state(), { type: 'lanes', edgeId: 10, lanes: { slow: 0 } }).errors).toContain(
      'a via ficaria sem nenhuma faixa',
    );
    const p = planCommand(state(), { type: 'lanes', edgeId: 10, lanes: { fast: 2 } });
    expect(p.ok).toBe(true);
    expect(p.warnings.join()).toMatch(/sem calçada/);
    expect(planCommand(state(), { type: 'lanes', edgeId: 10, lanes: { bus: 1 } as never }).ok).toBe(false);
    expect(planCommand(state(), { type: 'lanes', edgeId: 99, lanes: { slow: 1 } }).ok).toBe(false);
  });

  it('sentido: mão única, inversão de from/to e mão dupla', () => {
    let s = new Command({ type: 'direction', edgeId: 10, mode: 'oneWay' }).apply(state());
    expect(s.city.edges[0]).toMatchObject({ oneWay: true, from: 1, to: 2 });
    s = new Command({ type: 'direction', edgeId: 10, mode: 'reverse' }).apply(s);
    expect(s.city.edges[0]).toMatchObject({ oneWay: true, from: 2, to: 1 });
    expect(planCommand(state(), { type: 'direction', edgeId: 10, mode: 'reverse' }).ok).toBe(false);
    expect(planCommand(state(), { type: 'direction', edgeId: 10, mode: 'twoWay' }).ok).toBe(false);
  });

  it('limite de velocidade com faixa permitida', () => {
    expect(planCommand(state(), { type: 'speed', edgeId: 10, speed: 20 }).cost).toBe(balance.tools.limiteVelocidade.cost);
    expect(planCommand(state(), { type: 'speed', edgeId: 10, speed: 0 }).ok).toBe(false);
    expect(planCommand(state(), { type: 'speed', edgeId: 10, speed: 30 }).errors.join()).toMatch(/nada muda/);
  });

  it('semáforo: instalação tem obra, valida fases e soma dos verdes; remover é grátis', () => {
    const signal = { cycle: 60, phases: [{ edges: [10], green: 30 }, { edges: [10], green: 20 }] };
    const p = planCommand(state(), { type: 'signal', nodeId: 1, signal });
    expect(p.ok).toBe(true);
    expect(p.cost).toBe(balance.tools.semaforo.cost);
    expect(p.buildDays).toBe(balance.tools.semaforo.buildDays);
    const bad = planCommand(state(), { type: 'signal', nodeId: 1, signal: { cycle: 30, phases: [{ edges: [77], green: 40 }] } });
    expect(bad.errors.length).toBeGreaterThanOrEqual(2);
    const s = new Command({ type: 'signal', nodeId: 1, signal }).apply(state());
    const rm = planCommand(s, { type: 'signal', nodeId: 1, signal: null });
    expect(rm).toMatchObject({ ok: true, cost: 0 });
  });

  it('travessia: troca elemento e rota; sem rota acessível gera aviso; locked bloqueia', () => {
    const p = planCommand(state(), { type: 'crossing', crossingId: 20, radical: 'death_jump' });
    expect(p).toMatchObject({ ok: true, cost: balance.tools.rampaPonte.cost, blocksTraffic: true });
    const noAccess = planCommand(state(), { type: 'crossing', crossingId: 20, access: null });
    expect(noAccess.ok).toBe(true);
    expect(noAccess.warnings.join()).toMatch(/sem rota acessível/);
    const city = tinyCity();
    city.crossings[0]!.locked = true;
    expect(planCommand(state(city), { type: 'crossing', crossingId: 20, radical: 'air_loop' }).errors.join()).toMatch(
      /protegida/,
    );
  });

  it('linhas: cria, edita, remove e valida paradas', () => {
    let s: GameState = state();
    const add = planCommand(s, { type: 'addLine', line: tuk });
    expect(add).toMatchObject({ ok: true, cost: balance.tools.linhaTukTuk.cost });
    s = new Command({ type: 'addLine', line: tuk }).apply(s);
    expect(s.lines).toEqual([tuk]);
    expect(planCommand(s, { type: 'addLine', line: tuk }).ok).toBe(false); // id repetido
    expect(planCommand(s, { type: 'addLine', line: { ...tuk, id: 'L2', stops: [1, 99] } }).ok).toBe(false);
    s = new Command({ type: 'editLine', line: { ...tuk, fleet: 5 } }).apply(s);
    expect(s.lines[0]!.fleet).toBe(5);
    s = new Command({ type: 'removeLine', lineId: 'L1' }).apply(s);
    expect(s.lines).toEqual([]);
    expect(linesOperationPerDay([tuk])).toBe(balance.tools.linhaTukTuk.operationPerDay);
  });

  it('preview não altera o estado e apply não muta a cidade original', () => {
    const s = state();
    const snapshot = structuredClone(s.city);
    const cmd = new Command({ type: 'lanes', edgeId: 10, lanes: { sidewalk: 2, slow: 1 } });
    cmd.preview(s);
    const next = cmd.apply(s);
    expect(s.city).toStrictEqual(snapshot);
    expect(next.city).not.toBe(s.city);
    expect(next.city.crossings).toBe(s.city.crossings); // compartilha o que não mudou
    expect(cmd.revert(next).city).toStrictEqual(snapshot);
  });
});

describe('CommandStack — undo/redo e orçamento', () => {
  const specs: CommandSpec[] = [
    { type: 'lanes', edgeId: 10, lanes: { sidewalk: 1, fast: 2 } },
    { type: 'direction', edgeId: 11, mode: 'oneWay' },
    { type: 'direction', edgeId: 11, mode: 'reverse' },
    { type: 'speed', edgeId: 10, speed: 20 },
    { type: 'signal', nodeId: 2, signal: { cycle: 40, phases: [{ edges: [10], green: 20 }] } },
    { type: 'crossing', crossingId: 21, radical: 'rail_walkway', access: null },
    { type: 'addLine', line: tuk },
  ];

  it('undo de todos os comandos devolve a cidade idêntica (deepEqual) e o dinheiro', () => {
    const original = tinyCity();
    const stack = new CommandStack(structuredClone(original), { money: 100_000 });
    for (const spec of specs) expect(stack.execute(spec, 1).ok).toBe(true);
    expect(stack.city).not.toStrictEqual(original);
    expect(stack.money).toBeLessThan(100_000);
    while (stack.canUndo) stack.undo();
    expect(stack.city).toStrictEqual(original);
    expect(stack.lines).toEqual([]);
    expect(stack.money).toBe(100_000);
  });

  it('undo na vitrine também é idêntico; redo refaz igual', () => {
    const original = parseCity(vitrine).city;
    const stack = new CommandStack(structuredClone(original), { money: 100_000 });
    const e = original.edges[0]!;
    stack.execute({ type: 'lanes', edgeId: e.id, lanes: { sidewalk: 2, slow: 1 } });
    stack.execute({ type: 'crossing', crossingId: original.crossings[0]!.id, access: 'glass_walkway' });
    const after = structuredClone(stack.city);
    stack.undo();
    stack.undo();
    expect(stack.city).toStrictEqual(original);
    stack.redo();
    stack.redo();
    expect(stack.city).toStrictEqual(after);
  });

  it('não aplica sem dinheiro; redo também respeita o saldo', () => {
    const stack = new CommandStack(tinyCity(), { money: 100 });
    const r = stack.execute({ type: 'lanes', edgeId: 10, lanes: { sidewalk: 1, fast: 2 } });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/saldo insuficiente/);
    expect(stack.money).toBe(100);
    expect(stack.canUndo).toBe(false);

    const s2 = new CommandStack(tinyCity(), { money: 150 });
    expect(s2.execute({ type: 'speed', edgeId: 10, speed: 20 }).ok).toBe(true);
    s2.undo();
    expect(s2.spend(120)).toBe(true);
    expect(s2.redo()).toBeNull(); // 30 < 50
  });

  it('novo comando limpa o redo; ferramenta bloqueada não aplica', () => {
    const stack = new CommandStack(tinyCity(), { money: 10_000, lockedTools: ['linha'] });
    stack.execute({ type: 'speed', edgeId: 10, speed: 20 });
    stack.undo();
    stack.execute({ type: 'speed', edgeId: 10, speed: 25 });
    expect(stack.canRedo).toBe(false);
    expect(stack.execute({ type: 'addLine', line: tuk }).errors.join()).toMatch(/bloqueada/);
    stack.unlock('linha');
    expect(stack.execute({ type: 'addLine', line: tuk }).ok).toBe(true);
  });

  it('obras: lista o que ainda está sendo construído', () => {
    const stack = new CommandStack(tinyCity(), { money: 10_000 });
    stack.execute({ type: 'crossing', crossingId: 20, radical: 'death_jump' }, 3);
    const days = balance.tools.rampaPonte.buildDays;
    expect(stack.constructions(3)).toMatchObject([{ target: 'crossing', id: 20, readyDay: 3 + days, blocksTraffic: true }]);
    expect(stack.constructions(3 + days)).toEqual([]);
  });

  it('serialize/deserialize preserva pilhas, saldo e linhas', () => {
    const stack = new CommandStack(tinyCity(), { money: 10_000 });
    stack.execute({ type: 'addLine', line: tuk });
    stack.execute({ type: 'speed', edgeId: 10, speed: 20 });
    stack.undo();
    const data = JSON.parse(JSON.stringify(stack.serialize()));
    const back = CommandStack.deserialize(stack.city, data);
    expect(back.money).toBe(stack.money);
    expect(back.lines).toEqual(stack.lines);
    expect(back.redo()).not.toBeNull();
    while (back.canUndo) back.undo();
    expect(back.city).toStrictEqual(tinyCity());
  });
});

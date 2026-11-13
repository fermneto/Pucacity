import { describe, expect, it } from 'vitest';
import balance from '../../config/balance.json';
import {
  blockedEdges,
  closedLinks,
  type DilemmaDef,
  EventEngine,
  type EventNotice,
  toMinute,
} from '../../src/core/Events';
import { findPath } from '../../src/core/Pathfinding';
import { RoadGraph } from '../../src/core/RoadGraph';
import { vehicle } from '../../src/core/Vehicles';
import { tinyCity } from './fixtures';

/** Dilema de exemplo (o conteúdo real vem do PC2). */
const elementoTravessia: DilemmaDef = {
  id: 'elemento_travessia',
  day: 9,
  hour: 10,
  title: 'Elemento da travessia',
  text: 'Os skatistas querem um Salto Mortal; a Associação de Cadeirantes quer um segundo Elevador de Bolha.',
  options: [
    { id: 'salto', label: 'Salto Mortal', cost: 1200, patience: { estudante: 10, cadeirante: -15 } },
    { id: 'elevador', label: '2º Elevador de Bolha', cost: 900, patience: { cadeirante: 15 } },
    { id: 'manter', label: 'Manter e economizar', cost: 0, patience: { estudante: -5, cadeirante: -5 } },
  ],
  defaultOption: 'manter',
  deadlineHours: 12,
};

const vilaNova = () =>
  EventEngine.create({
    seed: 42,
    scenario: { id: 'vila-nova', goals: [], budget: 5000, durationDays: 14, events: ['vento_loop', 'bairro_novo'], dilemmas: ['elemento_travessia', 'entregas_mercado'] },
    dilemmaCatalog: { elemento_travessia: elementoTravessia },
  });

const kinds = (ns: EventNotice[]) => ns.map((n) => `${n.kind}:${'eventId' in n ? n.eventId : 'dilemmaId' in n ? n.dilemmaId : ''}`);

describe('EventEngine — agenda', () => {
  it('campeonato no dia 7 às 17h com aviso de 24h (do balance.json)', () => {
    const e = vilaNova();
    const camp = e.schedule.find((x) => x.id === 'campeonato_bowl')!;
    expect(camp.startMin).toBe(toMinute(7, 17));
    expect(camp.endMin).toBe(toMinute(7, 22));
    expect(camp.warnMin).toBe(toMinute(6, 17));
    expect(camp.effects.extraTrips).toBe(balance.events.campeonato_bowl.extraTrips);
  });

  it('mesma seed ⇒ mesma agenda; seed diferente pode mudar os sorteados', () => {
    expect(vilaNova().serialize()).toEqual(vilaNova().serialize());
    const days = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const e = EventEngine.create({ seed, scenario: { goals: [], budget: 0, durationDays: 14, events: ['vento_loop'] } });
      const s = e.schedule[0]!;
      expect(s.startMin).toBeGreaterThanOrEqual(toMinute(4));
      days.add(s.startMin);
    }
    expect(days.size).toBeGreaterThan(1);
  });

  it('ids sem definição vão para missing', () => {
    expect(vilaNova().missing).toEqual(['dilema:entregas_mercado']);
  });

  it('aviso → início → fim, mesmo pulando vários estágios', () => {
    const e = vilaNova();
    expect(kinds(e.update(toMinute(6, 18)))).toContain('warning:campeonato_bowl');
    const n = e.update(toMinute(7, 17));
    expect(kinds(n)).toContain('start:campeonato_bowl');
    expect(e.activeEffects().extraTrips).toBe(1500);
    const end = e.update(toMinute(7, 23));
    expect(end).toContainEqual({ kind: 'end', eventId: 'campeonato_bowl', outcome: 'survived' });
    expect(e.activeEffects().extraTrips).toBe(0);

    const jump = EventEngine.create({ seed: 1, scenario: { id: 'vila-nova', goals: [], budget: 0, durationDays: 14 } });
    expect(kinds(jump.update(toMinute(8)))).toEqual(['warning:campeonato_bowl', 'start:campeonato_bowl', 'end:campeonato_bowl']);
  });

  it('evento instantâneo (bairro_novo) inicia e encerra no mesmo instante', () => {
    const e = vilaNova();
    const ev = e.schedule.find((x) => x.id === 'bairro_novo')!;
    const n = e.update(ev.startMin);
    expect(n).toContainEqual(expect.objectContaining({ kind: 'start', eventId: 'bairro_novo', instant: true }));
    expect(n.find((x) => x.kind === 'start' && x.eventId === 'bairro_novo')).toMatchObject({
      effects: { populationGrowth: 0.1 },
    });
  });
});

describe('EventEngine — efeitos', () => {
  it('vento fecha o Loop Aéreo: o pathfinding desvia', () => {
    const city = tinyCity();
    const e = EventEngine.create({ seed: 3, scenario: { goals: [], budget: 0, durationDays: 14, events: ['vento_loop'] } });
    e.update(e.schedule[0]!.startMin);
    const fx = e.activeEffects();
    expect(fx.closes).toEqual(['loop_aereo']);
    const closed = closedLinks(city, fx.closes);
    expect(closed).toEqual([{ crossingId: 21, link: 'radical' }]);

    const g = new RoadGraph(city);
    const blocked = blockedEdges(g, closed);
    expect(blocked.size).toBe(2); // os dois sentidos
    const skate = vehicle('skate');
    const from = g.nodeIndexOf(2);
    const to = g.nodeIndexOf(4);
    const open = findPath(g, skate, from, to)!;
    const viaLoop = open.edges.some((i) => g.edge(i).radical === 'air_loop');
    const shut = findPath(g, skate, from, to, { blocked })!;
    expect(shut.edges.some((i) => blocked.has(i))).toBe(false);
    if (viaLoop) expect(shut.cost).toBeGreaterThan(open.cost);
  });

  it('elevador quebrado fecha a metade acessível', () => {
    expect(closedLinks(tinyCity(), ['elevador_bolha'])).toEqual([{ crossingId: 20, link: 'lift' }]);
  });

  it('multiplicadores combinam (chuva + calor)', () => {
    const e = EventEngine.create({
      seed: 1,
      scenario: { goals: [], budget: 0, durationDays: 2, events: ['chuva_forte', 'onda_de_calor'] },
      catalog: {
        chuva_forte: { day: 1, startHour: 8, durationHours: 6, slipperyFallMultiplier: 2 },
        onda_de_calor: { day: 1, startHour: 7, durationDays: 2, flowPenalty: 0.25, heatBonus: 8 },
      },
    });
    e.update(toMinute(1, 9));
    const fx = e.activeEffects();
    expect(fx.fallRiskMultiplier).toBe(2);
    expect(fx.flowMultiplier).toBe(0.75);
    expect(fx.heatBonus).toBe(8);
  });

  it('campeonato falha com ocupação > 150% por 30 min e pune a paciência', () => {
    const e = vilaNova();
    e.update(toMinute(7, 17));
    const t0 = toMinute(7, 18);
    expect(e.reportOccupation('campeonato_bowl', 1.6, t0)).toBeNull();
    expect(e.reportOccupation('campeonato_bowl', 1.2, t0 + 10)).toBeNull(); // desceu: zera
    expect(e.reportOccupation('campeonato_bowl', 1.6, t0 + 20)).toBeNull();
    const fail = e.reportOccupation('campeonato_bowl', 1.7, t0 + 50);
    expect(fail).toEqual({ kind: 'failed', eventId: 'campeonato_bowl', satisfactionPenalty: 10, extraFalls: 3 });
    expect(e.patience.adulto).toBe(balance.citizens.patience.start - 10);
    e.update(toMinute(8));
    expect(e.outcome('campeonato_bowl')).toBe('failed');
  });
});

describe('EventEngine — dilemas e paciência', () => {
  it('dilema abre no dia/hora, aplica a escolha e devolve o custo', () => {
    const e = vilaNova();
    expect(kinds(e.update(toMinute(9, 10)))).toContain('dilemma:elemento_travessia');
    expect(e.openDilemmas().map((d) => d.id)).toEqual(['elemento_travessia']);
    const r = e.choose('elemento_travessia', 'elevador');
    expect(r).toMatchObject({ kind: 'dilemmaResolved', byTimeout: false, option: { id: 'elevador', cost: 900 } });
    expect(e.patience.cadeirante).toBe(balance.citizens.patience.start + 15);
    expect(e.dilemmaChoice('elemento_travessia')).toBe('elevador');
    expect(() => e.choose('elemento_travessia', 'salto')).toThrow();
  });

  it('prazo vencido aplica a opção padrão', () => {
    const e = vilaNova();
    e.update(toMinute(9, 10));
    const n = e.update(toMinute(9, 22));
    expect(n).toContainEqual(expect.objectContaining({ kind: 'dilemmaResolved', byTimeout: true }));
    expect(e.dilemmaChoice('elemento_travessia')).toBe('manter');
  });

  it('dias ruins esvaziam a paciência e geram protesto uma vez', () => {
    const e = vilaNova();
    const { start, dropPerBadDay, protestThreshold } = balance.citizens.patience;
    const daysToProtest = Math.ceil((start - protestThreshold) / dropPerBadDay);
    const notices: EventNotice[] = [];
    for (let d = 0; d < daysToProtest + 2; d++) notices.push(...e.endOfDay(['idoso']));
    expect(notices).toEqual([{ kind: 'protest', group: 'idoso' }]);
    expect(e.protesting()).toEqual(['idoso']);
    expect(e.satisfaction()).toBeLessThan(start);
  });

  it('serialize/deserialize continua do mesmo ponto', () => {
    const a = vilaNova();
    a.update(toMinute(6, 20));
    const b = EventEngine.deserialize(JSON.parse(JSON.stringify(a.serialize())));
    expect(kinds(b.update(toMinute(7, 17)))).toEqual(kinds(a.update(toMinute(7, 17))));
  });
});

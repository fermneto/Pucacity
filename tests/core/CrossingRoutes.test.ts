import { describe, expect, it } from 'vitest';
import balance from '../../config/balance.json';
import { BUBBLE_LIFT, crossingAccessRoute, crossingsWithoutAccess, RADICALS } from '../../src/core/Crossings';
import { RoadGraph } from '../../src/core/RoadGraph';
import { vehicle } from '../../src/core/Vehicles';
import { tinyCity } from './fixtures';

describe('regras dos elementos radicais (Arte + balance.radical)', () => {
  it('tempo, risco e diversão vêm do balance', () => {
    expect(RADICALS.ramp_bridge).toMatchObject({
      crossSeconds: balance.radical.rampa_ponte.crossSeconds,
      fallRisk: balance.radical.rampa_ponte.fallRisk,
      funBonus: balance.radical.rampa_ponte.funBonus,
      requiresManeuvers: true,
    });
    expect(BUBBLE_LIFT.crossSeconds).toBe(balance.radical.elevador_bolha.crossSeconds);
    expect(BUBBLE_LIFT.capacityPerMinute).toBe(balance.tools.elevadorBolha.capacityPerMinute);
  });

  it('velocidade mínima = maior entre a da Arte e minSpeed do balance', () => {
    expect(RADICALS.air_loop.minSpeedMps).toBe(Math.max(7, balance.radical.loop_aereo.minSpeed));
  });

  it('sem requiresManeuvers no balance, vale a regra da Arte: só quem faz manobras', () => {
    expect(RADICALS.rail_walkway.requiresManeuvers).toBe(true);
    expect(RADICALS.air_loop.requiresManeuvers).toBe(true);
  });

  it('Rail-Passarela sem access ganha a passarela de vidro implícita', () => {
    expect(crossingAccessRoute({ radical: 'rail_walkway' })).toEqual({ kind: 'glass_walkway', implicit: true });
    expect(crossingAccessRoute({ radical: 'ramp_bridge' })).toBeNull();
    expect(crossingAccessRoute({ radical: 'ramp_bridge', access: 'bubble_lift' })).toEqual({ kind: 'bubble_lift', implicit: false });
    const city = tinyCity();
    city.crossings[0] = { id: 20, from: 1, to: 3, over: 'canal', radical: 'rail_walkway' };
    expect(crossingsWithoutAccess(city)).toEqual([]);
  });
});

describe('RoadGraph.crossingRoutes', () => {
  const g = new RoadGraph(tinyCity());

  it('pedestre: rampa bloqueada (sem manobras), elevador liberado', () => {
    const r = g.crossingRoutes(20, vehicle('pedestrian'));
    expect(r.map((x) => [x.kind, x.usable, x.reason])).toEqual([
      ['ramp_bridge', false, 'sem_manobras'],
      ['bubble_lift', true, undefined],
    ]);
    expect(r[1]!.timeMin).toBeCloseTo(balance.radical.elevador_bolha.crossSeconds / 60);
    expect(r[0]!.timeMin).toBe(Infinity);
    expect(g.edge(r[1]!.edges[0]).reversed).toBe(false);
    expect(g.edge(r[1]!.edges[1]).reversed).toBe(true);
  });

  it('patinete no loop: lento demais; ligação de coletivo só para coletivo', () => {
    const r = g.crossingRoutes(21, vehicle('kick_scooter'));
    expect(r.map((x) => x.reason)).toEqual(['abaixo_velocidade_minima', 'so_coletivo']);
  });

  it('tuk-tuk não usa elemento radical nem elevador', () => {
    expect(g.crossingRoutes(20, vehicle('tuktuk')).map((x) => x.reason)).toEqual(['coletivo_nao_usa', 'coletivo_nao_usa']);
    expect(g.crossingRoutes(21, vehicle('tuktuk')).map((x) => x.usable)).toEqual([false, true]);
  });

  it('ligação fechada aparece como fechada', () => {
    const graph = new RoadGraph(tinyCity());
    graph.closedLinks.add('elevador_bolha');
    expect(graph.crossingRoutes(20, vehicle('pedestrian'))[1]).toMatchObject({ usable: false, reason: 'fechada' });
  });

  it('passarela implícita é marcada; travessia inexistente → lista vazia', () => {
    const city = tinyCity();
    city.crossings[0] = { id: 20, from: 1, to: 3, over: 'canal', radical: 'rail_walkway' };
    const graph = new RoadGraph(city);
    const r = graph.crossingRoutes(20, vehicle('wheelchair_powered'));
    expect(r[1]).toMatchObject({ link: 'walkway', kind: 'glass_walkway', implicit: true, usable: true });
    expect(graph.crossingRoutes(999, vehicle('skate'))).toEqual([]);
    expect(graph.crossingIds()).toEqual([20, 21]);
  });
});

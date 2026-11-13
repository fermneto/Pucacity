import type { CityFile } from '../../src/core/CityFile';

/**
 * Cidade mínima cortada por um canal (entre y=0 e y=10):
 *
 *   1 ═══(rua: calçada+lenta+rápida)═══ 2
 *   ║                                    ║
 * (20: Rampa-Ponte                    (21: Loop Aéreo
 *   + Elevador de Bolha)                + só coletivo)
 *   ║                                    ║
 *   3 ───(rua: calçada+lenta)────────── 4
 *
 * Cada trecho tem 100 m (10 tiles).
 */
export function tinyCity(): CityFile {
  return {
    name: 'Tiny',
    size: { w: 10, h: 10 },
    nodes: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 10, y: 0 },
      { id: 3, x: 0, y: 10 },
      { id: 4, x: 10, y: 10 },
    ],
    edges: [
      { id: 10, from: 1, to: 2, width: 10, speed: 30, oneWay: false, kind: 'street', lanes: { sidewalk: 1, slow: 1, fast: 1 } },
      { id: 11, from: 3, to: 4, width: 8, speed: 30, oneWay: false, kind: 'street', lanes: { sidewalk: 1, slow: 1 } },
    ],
    crossings: [
      { id: 20, from: 1, to: 3, over: 'canal', radical: 'ramp_bridge', access: 'bubble_lift' },
      { id: 21, from: 2, to: 4, over: 'canal', radical: 'air_loop', access: 'transit_only' },
    ],
    buildings: [{ id: 1, x: 5, y: 5, kind: 'skatepark', capacity: 40, model: 'bld_skatepark_1', rotation: 0 }],
    districts: [
      { id: 1, name: 'Orla Bolha', income: 'mid', population: 100, ownership: { skate: 30, kick_scooter: 20 }, wheelchairShare: 0.05 },
    ],
  };
}

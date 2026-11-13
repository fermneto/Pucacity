import type { CityFile } from '../../src/core/types';

/**
 * Cidade mínima:
 *
 *   1 ──(rua 30)── 2
 *   │               │
 * (av 60)        (rua 30)
 *   │               │
 *   3 ──(av 60)─── 4      1→2 é mão única; 2→4 rua; 1→3→4 avenida (mais rápida)
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
      { id: 10, from: 1, to: 2, lanes: 1, speed: 30, oneWay: true, kind: 'street' },
      { id: 11, from: 2, to: 4, lanes: 1, speed: 30, oneWay: false, kind: 'street' },
      { id: 12, from: 1, to: 3, lanes: 2, speed: 60, oneWay: false, kind: 'avenue' },
      { id: 13, from: 3, to: 4, lanes: 2, speed: 60, oneWay: false, kind: 'avenue', lanesReserved: ['bus'] },
    ],
    buildings: [
      { id: 1, x: 5, y: 5, kind: 'res', capacity: 40, model: 'bld_res_1', rotation: 0, district: 1 },
    ],
    districts: [{ id: 1, name: 'Centro', income: 'mid', population: 100 }],
  };
}

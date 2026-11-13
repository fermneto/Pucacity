import type { CityFile } from '../core/types';
import { MockSimulation } from './MockSimulation';
import type { SimulationOptions, SimulationPort } from './SimulationPort';

/** Qual implementação está ligada (mostrado no HUD do jogo). */
export const SIMULATION_KIND: 'mock' | 'core' = 'mock';

/**
 * ÚNICO ponto de troca entre a simulação de mentira e a real.
 *
 * TODO(pc3): quando `src/core/Simulation.ts` estiver na `main`, troque o corpo por
 *   `import { Simulation } from '../core/Simulation';`
 *   `return new Simulation(city, opts);`
 * mude `SIMULATION_KIND` para 'core' e, se quiser, apague `MockSimulation.ts`.
 * Se a API real divergir de `SimulationPort`, ajuste a porta (e não o resto de src/game/).
 */
export function createSimulation(city: CityFile, opts: SimulationOptions): SimulationPort {
  return new MockSimulation(city, opts);
}

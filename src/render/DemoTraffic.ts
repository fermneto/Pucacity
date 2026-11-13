import type { InstancedMesh } from 'three';
import type { CityFile, VehicleKind } from '../core/CityFile';
import type { CityView } from './CityView';
import { MEGAPIPE, SPIRAL } from './models/radical';
import { laneOccupancy, type OverlayStrip } from './Overlays';
import { createMockSim, vehicleInfo, type MockSim, type SimState } from './SimState';
import { SimView } from './SimView';

/**
 * Trânsito de DEMONSTRAÇÃO da vitrine: liga o mock de simulação (`createMockSim`, SimState.ts)
 * ao `SimView`. Não tem regra de movimento própria: quando o PC3 entregar
 * `Simulation.getState()`, basta trocar o mock pela simulação real.
 */

export interface TrafficEvents { onTrick?: (text: string) => void }

/** Resumo de um agente para a interface da vitrine (contagem de quem faz manobras). */
export interface DemoAgent {
  id: number;
  kind: VehicleKind;
  /** null para o coletivo (tandem, tuk-tuk). */
  info: { kind: VehicleKind; tricks: boolean } | null;
}

export class DemoTraffic {
  readonly sim: MockSim;
  readonly simView: SimView;
  readonly meshes: Map<string, InstancedMesh>;
  readonly cabins: InstancedMesh;
  readonly agents: DemoAgent[];
  airborneCount = 0;

  constructor(city: CityFile, private view: CityView, total: number, seed = 7, private events: TrafficEvents = {}) {
    this.sim = createMockSim(city, seed, { agents: total, stunts: { spiral: SPIRAL, megapipe: MEGAPIPE } });
    const state = this.sim.getState();
    this.simView = new SimView(state, seed);
    this.meshes = this.simView.meshes;
    this.cabins = this.simView.cabins;
    this.agents = state.agents.map((a) => {
      const info = a.line === undefined ? vehicleInfo(a.kind) : null;
      return { id: a.id, kind: a.kind, info: info ? { kind: info.kind, tricks: info.tricks } : null };
    });
    this.airborneCount = state.airborne;
  }

  /** Estado atual da simulação (mock). */
  get state(): SimState {
    return this.sim.getState();
  }

  /** Malhas de vidro das cápsulas (bolha translúcida). */
  cabinGlass(): InstancedMesh | null {
    return this.simView.cabinGlass();
  }

  update(dt: number) {
    this.sim.step(dt);
    const state = this.sim.getState();
    for (const ev of state.events) {
      if (ev.type === 'trick') this.events.onTrick?.(`${ev.name} NO CANAL! +${ev.points}`);
    }
    this.airborneCount = state.airborne;
    this.simView.update(state);
    this.view.overlays.paintAccess(state);
  }

  /** Ocupação por tira de faixa, para o overlay de tráfego. */
  occupancy(): (s: OverlayStrip) => number {
    return laneOccupancy(this.sim.getState());
  }
}

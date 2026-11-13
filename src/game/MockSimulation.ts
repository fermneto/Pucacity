import { loadBalance } from '../core/CityLoader';
import { RoadGraph } from '../core/RoadGraph';
import { Rng } from '../core/Rng';
import type { CityFile, VehicleKind } from '../core/types';
import { VEHICLES, type VehicleProfile } from '../core/Vehicles';
import {
  emptyStats,
  type AgentView,
  type SimState,
  type SimStats,
  type SimulationOptions,
  type SimulationPort,
  type TransitVehicleView,
} from './SimulationPort';

/**
 * Simulação DE MENTIRA que satisfaz `SimulationPort`, só para ligar o loop e o render
 * enquanto `src/core/Simulation.ts` não chega na `main`.
 *
 * - Agentes passeiam ao acaso pelas arestas do `RoadGraph` (respeitando `canUse` do veículo),
 *   sem rotina, sem A* e sem escolha modal. "Viagens" são sequências de 3–12 arestas.
 * - Distância por tick: o agente anda `velocidade × MOCK_SECONDS_PER_TICK` metros. Isso NÃO é físico
 *   (1 tick = 1 min de jogo andaria 60×), é só para o movimento ficar legível na tela, como na vitrine.
 * - Determinística pela seed (usa `core/Rng`).
 */
export const MOCK_SECONDS_PER_TICK = 1.5;
const MIN_AGENTS = 40;
const MAX_AGENTS = 1500;
const MINUTES_PER_DAY = 1440;

interface MockAgent {
  id: number;
  kind: VehicleKind;
  profile: VehicleProfile;
  group: string;
  speedFactor: number;
  district: number;
  edge: number;
  posM: number;
  edgesLeft: number;
  tripStart: number;
}

interface MockTransit {
  lineId: string;
  kind: 'tuktuk' | 'tandem';
  profile: VehicleProfile;
  edge: number;
  posM: number;
  load: number;
  capacity: number;
}

export class MockSimulation implements SimulationPort {
  graph: RoadGraph;
  city: CityFile;
  private rng: Rng;
  private minute: number;
  private agents: MockAgent[] = [];
  private transitVehicles: MockTransit[] = [];
  private stats: SimStats = emptyStats();
  private statsToday: SimStats = emptyStats();
  private saturation: Float32Array;
  private readonly groups: { name: string; share: number; speedFactor: number }[];

  constructor(city: CityFile, private readonly opts: SimulationOptions) {
    this.city = city;
    this.rng = new Rng(opts.seed);
    this.minute = opts.startMinute;
    const { balance } = loadBalance();
    this.groups = Object.entries(balance.citizens.groups)
      .filter(([name]) => name !== 'cadeirante')
      .map(([name, g]) => ({ name, share: g.share, speedFactor: g.speedFactor }));
    this.graph = new RoadGraph(city);
    this.saturation = new Float32Array(this.graph.edges.length);
    this.spawnAll();
  }

  setCity(city: CityFile): void {
    this.city = city;
    this.graph = new RoadGraph(city);
    this.saturation = new Float32Array(this.graph.edges.length);
    this.spawnAll();
  }

  tick(): void {
    const dayBefore = Math.floor(this.minute / MINUTES_PER_DAY);
    this.minute++;
    if (Math.floor(this.minute / MINUTES_PER_DAY) !== dayBefore) this.statsToday = emptyStats();

    for (const a of this.agents) this.moveAgent(a);
    for (const t of this.transitVehicles) this.moveTransit(t);
    this.updateSaturation();
  }

  step(minutes: number): void {
    for (let i = 0; i < minutes; i++) this.tick();
  }

  getState(): SimState {
    const agents: AgentView[] = this.agents.map((a) => {
      const p = this.pose(a.edge, a.posM);
      const lane = this.graph.edge(a.edge).link === 'road' ? (this.graph.laneFor(a.edge, a.profile)?.lane ?? null) : null;
      return { id: a.id, vehicle: a.kind, x: p.x, y: p.y, heading: p.heading, edge: a.edge, lane, group: a.group };
    });
    const transit: TransitVehicleView[] = this.transitVehicles.map((t) => {
      const p = this.pose(t.edge, t.posM);
      return { lineId: t.lineId, kind: t.kind, x: p.x, y: p.y, heading: p.heading, load: t.load, capacity: t.capacity };
    });
    return {
      minute: this.minute,
      day: Math.floor(this.minute / MINUTES_PER_DAY),
      minuteOfDay: this.minute % MINUTES_PER_DAY,
      agents,
      transit,
      edgeSaturation: this.saturation,
      stats: this.stats,
      statsToday: this.statsToday,
    };
  }

  serialize(): unknown {
    return {
      kind: 'mock',
      seed: this.opts.seed,
      minute: this.minute,
      rng: this.rng.state,
      agents: this.agents.map((a) => ({ id: a.id, kind: a.kind, edge: a.edge, posM: a.posM })),
    };
  }

  // ---------------------------------------------------------------- criação

  private spawnAll(): void {
    this.agents = [];
    this.transitVehicles = [];
    const rng = this.rng;
    const districts = [...this.city.districts].sort((a, b) => a.id - b.id);
    const totalPop = districts.reduce((s, d) => s + d.population, 0);
    const n = Math.max(MIN_AGENTS, Math.min(MAX_AGENTS, Math.round(totalPop * this.opts.scale)));

    for (let id = 0; id < n; id++) {
      const district = districts.length ? weighted(rng, districts, (d) => Math.max(1, d.population)) : null;
      let kind: VehicleKind = 'pedestrian';
      let group = 'adulto';
      let speedFactor = 1;
      if (district && rng.next() < district.wheelchairShare) {
        kind = 'wheelchair';
        group = 'cadeirante';
      } else {
        const owned = Object.entries(district?.ownership ?? {}).filter(
          ([k, v]) => (v ?? 0) > 0 && VEHICLES.get(k as VehicleKind)?.transit === false,
        );
        if (owned.length && rng.next() < 0.75) kind = weighted(rng, owned, ([, v]) => v ?? 0)[0] as VehicleKind;
        if (this.groups.length) {
          const g = weighted(rng, this.groups, (x) => x.share);
          group = g.name;
          speedFactor = g.speedFactor;
        }
      }
      const profile = VEHICLES.get(kind);
      if (!profile) continue;
      const start = this.randomEdge(profile, (i) => this.graph.edge(i).link === 'road');
      if (start < 0) continue;
      const a: MockAgent = {
        id, kind, profile, group, speedFactor, district: district?.id ?? -1,
        edge: start, posM: rng.next() * this.graph.edge(start).lengthM, edgesLeft: 0, tripStart: this.minute,
      };
      this.startTrip(a);
      this.agents.push(a);
    }

    // Coletivo de mentira: alguns tuk-tuks e tandens nas vias com faixa coletiva.
    const transitEdges = this.graph.edges.filter((e) => e.link === 'road' && e.lanes.transit > 0).map((e) => e.index);
    const fleet = Math.min(8, Math.ceil(transitEdges.length / 3));
    for (let i = 0; i < fleet; i++) {
      const kind = i % 2 === 0 ? 'tuktuk' : 'tandem';
      const profile = VEHICLES.get(kind);
      if (!profile) continue;
      const edge = rng.pick(transitEdges);
      this.transitVehicles.push({
        lineId: `mock-${i % 2}`, kind, profile, edge, posM: rng.next() * this.graph.edge(edge).lengthM,
        load: rng.int(0, 3), capacity: 3,
      });
    }
    this.updateSaturation();
  }

  private randomEdge(profile: VehicleProfile, filter: (i: number) => boolean): number {
    const ok = this.graph.edges.filter((e) => filter(e.index) && this.graph.canUse(e.index, profile));
    return ok.length ? this.rng.pick(ok).index : -1;
  }

  private startTrip(a: MockAgent): void {
    a.edgesLeft = this.rng.int(3, 12);
    a.tripStart = this.minute;
    this.stats.tripsStarted++;
    this.statsToday.tripsStarted++;
  }

  // ---------------------------------------------------------------- movimento

  private moveAgent(a: MockAgent): void {
    let dist = a.profile.speedMps * a.speedFactor * MOCK_SECONDS_PER_TICK;
    for (let guard = 0; guard < 16 && dist > 0; guard++) {
      const e = this.graph.edge(a.edge);
      const speedFactor = this.edgeSpeedFactor(a.edge, a.profile);
      const remaining = (e.lengthM - a.posM) / speedFactor;
      if (dist < remaining) {
        a.posM += dist * speedFactor;
        return;
      }
      dist -= remaining;
      const next = this.nextEdge(a.edge, a.profile, false);
      if (next < 0) {
        this.finishTrip(a, false);
        const again = this.randomEdge(a.profile, (i) => this.graph.edge(i).link === 'road');
        if (again < 0) return;
        a.edge = again;
        a.posM = 0;
        this.startTrip(a);
        return;
      }
      a.edge = next;
      a.posM = 0;
      if (this.graph.edge(next).link === 'radical') {
        this.stats.radicalCrossings++;
        this.statsToday.radicalCrossings++;
      }
      if (--a.edgesLeft <= 0) {
        this.finishTrip(a, true);
        this.startTrip(a);
      }
    }
  }

  private moveTransit(t: MockTransit): void {
    let dist = t.profile.speedMps * MOCK_SECONDS_PER_TICK;
    for (let guard = 0; guard < 16 && dist > 0; guard++) {
      const e = this.graph.edge(t.edge);
      const remaining = e.lengthM - t.posM;
      if (dist < remaining) {
        t.posM += dist;
        return;
      }
      dist -= remaining;
      const next = this.nextEdge(t.edge, t.profile, true);
      if (next < 0) return;
      t.edge = next;
      t.posM = 0;
      t.load = Math.max(0, Math.min(t.capacity, t.load + this.rng.int(-1, 1)));
    }
  }

  /** Elevador e passarela são mais lentos que o veículo; o resto anda na velocidade do perfil. */
  private edgeSpeedFactor(edge: number, profile: VehicleProfile): number {
    const e = this.graph.edge(edge);
    if (e.link === 'lift') return Math.min(1, this.graph.params.liftSpeedMps / profile.speedMps);
    if (e.link === 'road' && e.speedLimitMps < profile.speedMps) return e.speedLimitMps / profile.speedMps;
    return 1;
  }

  private nextEdge(current: number, profile: VehicleProfile, transitOnly: boolean): number {
    const e = this.graph.edge(current);
    const isReverse = (i: number) => {
      const o = this.graph.edge(i);
      return o.sourceId === e.sourceId && o.link === e.link && o.to === e.from;
    };
    const usable = (this.graph.out[e.to] ?? []).filter(
      (i) => this.graph.canUse(i, profile) && (!transitOnly || this.graph.edge(i).lanes.transit > 0 || this.graph.edge(i).link === 'transit_only'),
    );
    const forward = usable.filter((i) => !isReverse(i));
    const pool = forward.length ? forward : usable;
    return pool.length ? this.rng.pick(pool) : -1;
  }

  private finishTrip(a: MockAgent, ok: boolean): void {
    const minutes = this.minute - a.tripStart + 1;
    for (const s of [this.stats, this.statsToday]) {
      const d = (s.tripsByDistrict[a.district] ??= { completed: 0, minutesTotal: 0, failed: 0 });
      if (ok) {
        s.tripsCompleted++;
        s.tripMinutesTotal += minutes;
        s.modeTrips[a.kind] = (s.modeTrips[a.kind] ?? 0) + 1;
        d.completed++;
        d.minutesTotal += minutes;
        if (a.group === 'cadeirante') s.wheelchairTrips.completed++;
      } else {
        s.tripsFailed++;
        d.failed++;
        if (a.group === 'cadeirante') s.wheelchairTrips.failed++;
      }
    }
  }

  // ---------------------------------------------------------------- leitura

  private pose(edge: number, posM: number): { x: number; y: number; heading: number } {
    const e = this.graph.edge(edge);
    const A = this.graph.node(e.from);
    const B = this.graph.node(e.to);
    const t = e.lengthM > 0 ? Math.min(1, posM / e.lengthM) : 0;
    return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, heading: Math.atan2(B.y - A.y, B.x - A.x) };
  }

  /** Saturação de mentira: agentes na aresta ÷ capacidade aproximada (comprimento × faixas). */
  private updateSaturation(): void {
    const sat = this.saturation;
    sat.fill(0);
    for (const a of this.agents) sat[a.edge] = (sat[a.edge] ?? 0) + 1;
    for (const t of this.transitVehicles) sat[t.edge] = (sat[t.edge] ?? 0) + 2;
    for (const e of this.graph.edges) {
      const lanes = e.link === 'road' ? Math.max(1, e.lanes.sidewalk + e.lanes.slow + e.lanes.fast + e.lanes.transit) : 1;
      const cap = Math.max(1, (e.lengthM / 10) * lanes * 0.6);
      sat[e.index] = (sat[e.index] ?? 0) / cap;
    }
  }
}

function weighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, i) => s + weight(i), 0);
  let r = rng.next() * total;
  for (const i of items) {
    r -= weight(i);
    if (r <= 0) return i;
  }
  return items[items.length - 1] as T;
}

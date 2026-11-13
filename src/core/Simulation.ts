/**
 * Simulação de deslocamento (SPEC §4.3–4.8): relógio de passo fixo (1 tick = 1 minuto), moradores com rotina,
 * escolha modal, coletivo e fluxo por faixa alimentando o BPR do RoadGraph.
 *
 * Determinismo: toda aleatoriedade sai de um único Rng com seed; listas são iteradas sempre na mesma ordem;
 * o grafo só recebe os fluxos (e o cache de rotas só é limpo) em minutos múltiplos de ROUTE_REFRESH_MIN.
 * Assim, `serialize()` → `deserialize()` continua exatamente igual à execução sem interrupção.
 */
import {
  BALANCE,
  MODE_COMFORT,
  chooseLogit,
  createCitizens,
  fallRiskOf,
  individualModes,
  modeCostOf,
  planDay,
  routeRiskFun,
  type Citizen,
  type ModeEstimate,
} from './Agents';
import { findPath, type Path } from './Pathfinding';
import { RoadGraph } from './RoadGraph';
import { Rng } from './Rng';
import { TransitSystem, type TransitHost, type TransitVehicleView } from './Transit';
import type { CityFile, LaneKind, VehicleKind } from './types';
import { VEHICLE_KINDS } from './types';
import { vehicle } from './Vehicles';

export type { TransitVehicleView, TransitLineDef, TransitKind } from './Transit';

export interface SimOptions {
  seed?: number;
  /** fração da população simulada (padrão 1) */
  scale?: number;
  /** minuto inicial do dia (padrão 6*60) */
  startMinute?: number;
}

export interface AgentView {
  /** id do morador */
  id: number;
  vehicle: VehicleKind;
  /** posição em tiles (x,y do city.json) */
  x: number;
  y: number;
  /** radianos, 0 = +x */
  heading: number;
  /** índice da aresta dirigida no RoadGraph, ou -1 se parado */
  edge: number;
  lane: LaneKind | null;
  group: string;
}

export interface SimStats {
  tripsStarted: number;
  tripsCompleted: number;
  /** sem rota possível */
  tripsFailed: number;
  tripMinutesTotal: number;
  modeTrips: Partial<Record<VehicleKind, number>>;
  tripsByDistrict: Record<number, { completed: number; minutesTotal: number; failed: number }>;
  wheelchairTrips: { completed: number; failed: number };
  radicalCrossings: number;
  /** viagens iniciadas por hora do dia (24 posições) */
  tripsStartedByHour: number[];
  /** passageiros que desistiram da fila do coletivo (lotação/espera) */
  transitGaveUp: number;
}

export interface SimState {
  minute: number;
  day: number;
  minuteOfDay: number;
  /** só os em deslocamento (quem está a bordo do coletivo aparece em `transit.load`) */
  agents: readonly AgentView[];
  transit: readonly TransitVehicleView[];
  /** saturação (fluxo/capacidade, maior faixa) por índice de aresta dirigida do RoadGraph */
  edgeSaturation: Float32Array;
  stats: SimStats;
  statsToday: SimStats;
}

export const MINUTES_PER_DAY = BALANCE.time.minutesPerDay;
/** Janela da média móvel do fluxo, minutos. */
export const FLOW_WINDOW_MIN = 10;
/** A cada quantos minutos o fluxo vai para o grafo (BPR) e o cache de rotas é limpo. */
export const ROUTE_REFRESH_MIN = 5;

const SAVE_VERSION = 1;
const LANE_SLOT: Record<LaneKind, number> = { sidewalk: 0, slow: 1, fast: 2, transit: 3 };
const LINK_SLOT = 4;
const SLOTS = 5;

const PHASE_MOVE = 0;
const PHASE_WAIT = 1;
const PHASE_RIDE = 2;

interface MoveLeg {
  kind: 'move';
  mode: VehicleKind;
  edges: number[];
}
interface TransitLeg {
  kind: 'transit';
  line: string;
  boardPos: number;
  alightPos: number;
}
type Leg = MoveLeg | TransitLeg;

interface Trip {
  id: number;
  citizen: number;
  /** modo escolhido (tuktuk/tandem se coletivo) */
  mode: VehicleKind;
  start: number;
  /** lugar de destino (PLACE_*) */
  to: number;
  /** nó de destino (índice no grafo atual) */
  dest: number;
  legs: Leg[];
  leg: number;
  edge: number;
  progressM: number;
  entered: boolean;
  /** último nó alcançado */
  node: number;
  phase: number;
  done: boolean;
}

interface Plan {
  est: ModeEstimate;
  legs: Leg[];
}

interface SavedSim {
  v: number;
  seed: number;
  scale: number;
  minute: number;
  plannedDay: number;
  rng: number;
  nextTripId: number;
  citizens: Citizen[];
  trips: Trip[];
  ema: number[];
  graphFlows: number[];
  transit: unknown;
  stats: SimStats;
  statsToday: SimStats;
}

function emptyStats(city: CityFile): SimStats {
  const tripsByDistrict: SimStats['tripsByDistrict'] = {};
  for (const d of [...city.districts].sort((a, b) => a.id - b.id)) tripsByDistrict[d.id] = { completed: 0, minutesTotal: 0, failed: 0 };
  return {
    tripsStarted: 0,
    tripsCompleted: 0,
    tripsFailed: 0,
    tripMinutesTotal: 0,
    modeTrips: {},
    tripsByDistrict,
    wheelchairTrips: { completed: 0, failed: 0 },
    radicalCrossings: 0,
    tripsStartedByHour: new Array<number>(24).fill(0),
    transitGaveUp: 0,
  };
}

const districtStats = (s: SimStats, id: number) => (s.tripsByDistrict[id] ??= { completed: 0, minutesTotal: 0, failed: 0 });

const EMPTY_PATH = (n: number): Path => ({ nodes: [n], edges: [], cost: 0 });

/** Ponte entre o coletivo e a simulação (mantém os métodos internos fora da API pública). */
class Host implements TransitHost {
  constructor(private readonly sim: Simulation, private readonly internals: SimInternals) {}
  get graph() {
    return this.sim.graph;
  }
  get scale() {
    return this.sim.scale;
  }
  get minute() {
    return this.sim.minute;
  }
  countEntry(edge: number, lane: LaneKind | null, weight: number) {
    this.internals.countEntry(edge, lane, weight);
  }
  onAlight(trip: number, node: number) {
    this.internals.onAlight(trip, node);
  }
  onGiveUp(trip: number, node: number) {
    this.internals.onGiveUp(trip, node);
  }
}

interface SimInternals {
  countEntry(edge: number, lane: LaneKind | null, weight: number): void;
  onAlight(trip: number, node: number): void;
  onGiveUp(trip: number, node: number): void;
}

export class Simulation {
  readonly seed: number;
  readonly scale: number;
  readonly transit: TransitSystem;

  private _city: CityFile;
  private _graph: RoadGraph;
  private _minute: number;
  private plannedDay: number;
  private readonly rng: Rng;
  private _citizens: Citizen[] = [];
  private trips: Trip[] = [];
  private readonly tripById = new Map<number, Trip>();
  private nextTripId = 0;
  private counts: Float64Array;
  private ema: Float64Array;
  private saturation: Float32Array;
  private readonly routeCache = new Map<number, Path | null>();
  private stats: SimStats;
  private statsToday: SimStats;
  private stateCache: SimState | null = null;
  /** Durante setCity: coleta passageiros devolvidos pelo coletivo (trip, id do nó). */
  private stranding: [number, number][] | null = null;

  constructor(city: CityFile, opts: SimOptions = {}, restore?: unknown) {
    this._city = city;
    this._graph = new RoadGraph(city);
    this.seed = opts.seed ?? 1;
    this.scale = opts.scale ?? 1;
    if (!(this.scale > 0)) throw new Error('Simulation: scale precisa ser > 0');
    this._minute = Math.floor(opts.startMinute ?? 6 * 60);
    this.rng = new Rng(this.seed);
    const nE = this._graph.edges.length;
    this.counts = new Float64Array(nE * SLOTS);
    this.ema = new Float64Array(nE * SLOTS);
    this.saturation = new Float32Array(nE);
    this.stats = emptyStats(city);
    this.statsToday = emptyStats(city);
    const internals: SimInternals = {
      countEntry: (e, l, w) => this.countEntry(e, l, w),
      onAlight: (t, n) => this.onAlight(t, n),
      onGiveUp: (t, n) => this.onGiveUp(t, n),
    };
    this.transit = new TransitSystem(new Host(this, internals));
    this.plannedDay = this.day;

    if (restore !== undefined) {
      this.load(restore as SavedSim);
      return;
    }
    this._citizens = createCitizens(city, this.rng, this.scale);
    const mod = this.minuteOfDay;
    for (const c of this._citizens) {
      planDay(c, this.rng);
      // Viagens anteriores ao minuto inicial não acontecem: todos começam em casa.
      while (c.fired * 2 < c.agenda.length && c.agenda[c.fired * 2]! < mod) c.fired++;
      c.next = c.fired;
    }
  }

  get city(): CityFile {
    return this._city;
  }
  get graph(): RoadGraph {
    return this._graph;
  }
  get minute(): number {
    return this._minute;
  }
  get day(): number {
    return Math.floor(this._minute / MINUTES_PER_DAY);
  }
  get minuteOfDay(): number {
    return this._minute % MINUTES_PER_DAY;
  }
  get citizens(): readonly Citizen[] {
    return this._citizens;
  }
  /** Viagens em andamento. */
  get activeTrips(): number {
    return this.trips.length;
  }

  /** Avança 1 minuto de jogo. */
  tick(): void {
    if (this.day !== this.plannedDay) this.newDay();
    this.startTrips();
    this.transit.tick();
    this.moveTrips();
    this.flushFlows();
    this._minute++;
    if (this._minute % ROUTE_REFRESH_MIN === 0) this.refreshRoutes();
    this.stateCache = null;
  }

  step(minutes: number): void {
    for (let i = 0; i < minutes; i++) this.tick();
  }

  /** Estado para o render. O objeto é reaproveitado até o próximo tick (não modifique). */
  getState(): SimState {
    if (this.stateCache) return this.stateCache;
    const g = this._graph;
    const agents: AgentView[] = [];
    for (const t of this.trips) {
      if (t.phase === PHASE_RIDE) continue;
      const c = this._citizens[t.citizen]!;
      const leg = t.legs[t.leg];
      const walkMode = c.chair ?? 'pedestrian';
      const mode = leg?.kind === 'move' ? leg.mode : walkMode;
      const ei = t.phase === PHASE_MOVE && leg?.kind === 'move' ? leg.edges[t.edge] : undefined;
      if (ei === undefined) {
        const n = g.node(t.node);
        agents.push({ id: c.id, vehicle: mode, x: n.x, y: n.y, heading: 0, edge: -1, lane: null, group: c.group });
        continue;
      }
      const e = g.edge(ei);
      const a = g.node(e.from);
      const b = g.node(e.to);
      const f = e.lengthM > 0 ? Math.min(1, t.progressM / e.lengthM) : 0;
      agents.push({
        id: c.id,
        vehicle: mode,
        x: a.x + (b.x - a.x) * f,
        y: a.y + (b.y - a.y) * f,
        heading: Math.atan2(b.y - a.y, b.x - a.x),
        edge: ei,
        lane: e.link === 'road' ? (g.laneFor(ei, vehicle(mode))?.lane ?? null) : null,
        group: c.group,
      });
    }
    this.stateCache = {
      minute: this._minute,
      day: this.day,
      minuteOfDay: this.minuteOfDay,
      agents,
      transit: this.transit.views(),
      edgeSaturation: this.saturation,
      stats: this.stats,
      statsToday: this.statsToday,
    };
    return this.stateCache;
  }

  /**
   * Troca a cidade após um comando do jogador: reconstrói o grafo, mantém relógio, moradores e rng.
   * Viagens em andamento são replanejadas a partir do fim da aresta em que estavam (pequeno salto visual);
   * passageiros do coletivo descem e replanejam; linhas recalculam os trechos e relançam a frota.
   */
  setCity(city: CityFile): void {
    const old = this._graph;
    // 1. Passageiros do coletivo voltam para a rua (ids de nós do grafo antigo).
    this.stranding = [];
    this.transit.strandAll();
    const anchors = new Map<number, { id: number; x: number; y: number }>();
    const anchorOf = (idx: number) => {
      const n = old.node(idx);
      return { id: n.id, x: n.x, y: n.y };
    };
    for (const [trip, nodeId] of this.stranding) anchors.set(trip, anchorOf(old.nodeIndexOf(nodeId)));
    this.stranding = null;
    for (const t of this.trips) {
      if (anchors.has(t.id)) continue;
      const leg = t.legs[t.leg];
      const ei = leg?.kind === 'move' ? leg.edges[t.edge] : undefined;
      anchors.set(t.id, anchorOf(ei !== undefined && t.entered ? old.edge(ei).to : t.node));
    }

    // 2. Novo grafo, migrando o fluxo das arestas que continuam existindo.
    const graph = new RoadGraph(city);
    const key = (e: { link: string; sourceId: number; reversed: boolean }) => `${e.link}:${e.sourceId}:${e.reversed ? 1 : 0}`;
    const oldByKey = new Map<string, number>();
    for (const e of old.edges) oldByKey.set(key(e), e.index);
    const nE = graph.edges.length;
    const ema = new Float64Array(nE * SLOTS);
    for (const e of graph.edges) {
      const oi = oldByKey.get(key(e));
      if (oi === undefined) continue;
      for (let s = 0; s < SLOTS; s++) ema[e.index * SLOTS + s] = this.ema[oi * SLOTS + s]!;
      const oe = old.edge(oi);
      e.flowVph = { ...oe.flowVph };
      e.linkFlowVph = oe.linkFlowVph;
      // Faixa que deixou de existir não carrega fluxo.
      for (const lane of ['sidewalk', 'slow', 'fast', 'transit'] as const) {
        if (e.link === 'road' && e.lanes[lane] === 0) {
          ema[e.index * SLOTS + LANE_SLOT[lane]] = 0;
          e.flowVph[lane] = 0;
        }
      }
    }
    this._city = city;
    this._graph = graph;
    this.ema = ema;
    this.counts = new Float64Array(nE * SLOTS);
    this.saturation = new Float32Array(nE);
    this.routeCache.clear();
    for (const d of city.districts) {
      districtStats(this.stats, d.id);
      districtStats(this.statsToday, d.id);
    }

    // 3. Coletivo no grafo novo.
    this.transit.rebuild();

    // 4. Replaneja as viagens em andamento.
    for (const t of this.trips) {
      const a = anchors.get(t.id)!;
      let node: number;
      try {
        node = graph.nodeIndexOf(a.id);
      } catch {
        node = this.nearestNode(a.x, a.y);
      }
      const c = this._citizens[t.citizen]!;
      t.dest = this.placeNode(c, t.to);
      const transitTrip = t.mode === 'tuktuk' || t.mode === 'tandem';
      const modes: VehicleKind[] = c.chair ? [c.chair] : transitTrip ? ['pedestrian'] : [t.mode];
      this.replan(t, node, modes, transitTrip);
    }
    this.trips = this.trips.filter((t) => !t.done);
    this.computeSaturation();
    this.stateCache = null;
  }

  /** JSON puro para o Save (inclui o estado do rng). */
  serialize(): unknown {
    const g = this._graph;
    const graphFlows: number[] = [];
    for (const e of g.edges) graphFlows.push(e.flowVph.sidewalk, e.flowVph.slow, e.flowVph.fast, e.flowVph.transit, e.linkFlowVph);
    const data: SavedSim = {
      v: SAVE_VERSION,
      seed: this.seed,
      scale: this.scale,
      minute: this._minute,
      plannedDay: this.plannedDay,
      rng: this.rng.state,
      nextTripId: this.nextTripId,
      citizens: this._citizens,
      trips: this.trips,
      ema: Array.from(this.ema),
      graphFlows,
      transit: this.transit.serialize(),
      stats: this.stats,
      statsToday: this.statsToday,
    };
    return JSON.parse(JSON.stringify(data)) as unknown;
  }

  static deserialize(city: CityFile, data: unknown): Simulation {
    const d = data as Partial<SavedSim> | null;
    if (!d || typeof d !== 'object' || d.v !== SAVE_VERSION) throw new Error('Simulation.deserialize: save incompatível');
    return new Simulation(city, { seed: d.seed, scale: d.scale, startMinute: d.minute }, d);
  }

  // ------------------------------------------------------------------------------------------
  // Rotina
  // ------------------------------------------------------------------------------------------

  private newDay(): void {
    this.plannedDay = this.day;
    this.statsToday = emptyStats(this._city);
    for (const c of this._citizens) planDay(c, this.rng);
  }

  private startTrips(): void {
    const mod = this.minuteOfDay;
    for (const c of this._citizens) {
      const n = c.agenda.length / 2;
      while (c.fired < n && c.agenda[c.fired * 2]! <= mod) c.fired++;
      while (c.tripId < 0 && c.next < c.fired) {
        const to = c.agenda[c.next * 2 + 1]!;
        c.next++;
        if (to !== c.location) this.startTrip(c, to);
      }
    }
  }

  private startTrip(c: Citizen, to: number): void {
    const from = this.placeNode(c, c.location);
    const dest = this.placeNode(c, to);
    const hour = Math.floor(this.minuteOfDay / 60);
    if (from === dest) {
      // Mesmo cruzamento: caminhada curta, concluída na hora.
      const mode = c.chair ?? 'pedestrian';
      const dx = c.placeXY[to * 2]! - c.placeXY[c.location * 2]!;
      const dy = c.placeXY[to * 2 + 1]! - c.placeXY[c.location * 2 + 1]!;
      const minutes = Math.max(1, (Math.hypot(dx, dy) * 10) / (vehicle(mode).speedMps * c.speedFactor) / 60);
      this.bump((s) => {
        s.tripsStarted++;
        s.tripsStartedByHour[hour] = (s.tripsStartedByHour[hour] ?? 0) + 1;
        s.modeTrips[mode] = (s.modeTrips[mode] ?? 0) + 1;
      });
      c.lastMode = mode;
      c.location = to;
      this.bumpDone(c, minutes);
      return;
    }
    const plan = this.plan(c, from, dest, individualModes(c), true);
    if (!plan) {
      this.bumpFail(c);
      return;
    }
    const t: Trip = {
      id: this.nextTripId++,
      citizen: c.id,
      mode: plan.est.mode,
      start: this._minute,
      to,
      dest,
      legs: plan.legs,
      leg: 0,
      edge: 0,
      progressM: 0,
      entered: false,
      node: from,
      phase: PHASE_MOVE,
      done: false,
    };
    this.trips.push(t);
    this.tripById.set(t.id, t);
    c.tripId = t.id;
    c.lastMode = plan.est.mode;
    this.bump((s) => {
      s.tripsStarted++;
      s.tripsStartedByHour[hour] = (s.tripsStartedByHour[hour] ?? 0) + 1;
      s.modeTrips[plan.est.mode] = (s.modeTrips[plan.est.mode] ?? 0) + 1;
    });
  }

  // ------------------------------------------------------------------------------------------
  // Escolha modal e rotas
  // ------------------------------------------------------------------------------------------

  /** Rota por modo, com cache (limpo a cada ROUTE_REFRESH_MIN). */
  private route(kind: VehicleKind, from: number, to: number): Path | null {
    if (from === to) return EMPTY_PATH(from);
    const n = this._graph.nodes.length;
    const k = (VEHICLE_KINDS.indexOf(kind) * n + from) * n + to;
    let p = this.routeCache.get(k);
    if (p === undefined) {
      p = findPath(this._graph, vehicle(kind), from, to);
      this.routeCache.set(k, p);
    }
    return p;
  }

  /**
   * Opções: modos individuais dados + (se allowTransit) linhas de coletivo.
   * Cadeirante: usa a cadeira sempre que houver rota (nunca troca); só sem rota recorre ao tuk-tuk acessível.
   */
  private plan(c: Citizen, from: number, dest: number, modes: readonly VehicleKind[], allowTransit: boolean): Plan | null {
    const g = this._graph;
    const opts: Plan[] = [];
    for (const kind of modes) {
      const path = this.route(kind, from, dest);
      if (!path) continue;
      const rf = routeRiskFun(g, path, kind, vehicle(kind));
      opts.push({
        est: { mode: kind, minutes: path.cost / c.speedFactor, cost: modeCostOf(kind), risk: rf.risk, comfort: MODE_COMFORT[kind], fun: rf.fun },
        legs: [{ kind: 'move', mode: kind, edges: path.edges }],
      });
    }
    if (c.chair && opts.length > 0) return opts[0]!;

    if (allowTransit) {
      const access: VehicleKind = c.chair ?? 'pedestrian';
      for (const line of this.transit.lines) {
        if (!line.active) continue;
        if (c.chair && line.def.kind !== 'tuktuk') continue; // tandem não é acessível
        const b = this.nearestStop(line.stopNodes, from);
        const a = this.nearestStop(line.stopNodes, dest);
        if (a === b || line.stopNodes[a] === line.stopNodes[b]) continue;
        const { boardPos, alightPos } = line.positions(b, a);
        const w1 = this.route(access, from, line.stopNodes[b]!);
        const w2 = this.route(access, line.stopNodes[a]!, dest);
        if (!w1 || !w2) continue;
        const ride = line.rideMinutes(boardPos, alightPos);
        if (!Number.isFinite(ride)) continue;
        const kind = line.def.kind;
        opts.push({
          est: {
            mode: kind,
            minutes: (w1.cost + w2.cost) / c.speedFactor + line.expectedWait() + ride,
            cost: modeCostOf(kind),
            risk: fallRiskOf(kind),
            comfort: MODE_COMFORT[kind] * (1 - 0.5 * line.crowding),
            fun: 0,
          },
          legs: [
            { kind: 'move', mode: access, edges: w1.edges },
            { kind: 'transit', line: line.def.id, boardPos, alightPos },
            { kind: 'move', mode: access, edges: w2.edges },
          ],
        });
      }
    }
    if (opts.length === 0) return null;
    if (opts.length === 1) return opts[0]!;
    const i = chooseLogit(
      opts.map((o) => o.est),
      this.rng,
    );
    return opts[Math.max(0, i)]!;
  }

  private nearestStop(stops: readonly number[], node: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < stops.length; i++) {
      const d = this._graph.distanceM(node, stops[i]!);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  private nearestNode(x: number, y: number): number {
    let best = 0;
    let bestD = Infinity;
    for (const n of this._graph.nodes) {
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = n.index;
      }
    }
    return best;
  }

  private placeNode(c: Citizen, place: number): number {
    return this.nearestNode(c.placeXY[place * 2]!, c.placeXY[place * 2 + 1]!);
  }

  // ------------------------------------------------------------------------------------------
  // Movimento
  // ------------------------------------------------------------------------------------------

  private moveTrips(): void {
    for (const t of this.trips) {
      if (!t.done && t.phase === PHASE_MOVE) this.advance(t, 1);
    }
    if (this.trips.some((t) => t.done)) {
      this.trips = this.trips.filter((t) => !t.done);
    }
  }

  private advance(t: Trip, minutes: number): void {
    const g = this._graph;
    const c = this._citizens[t.citizen]!;
    let budget = minutes;
    for (let guard = 0; guard < 10_000; guard++) {
      const leg = t.legs[t.leg];
      if (!leg) {
        this.complete(t, this._minute + (minutes - budget));
        return;
      }
      if (leg.kind === 'transit') {
        if (this.transit.enqueue(leg.line, leg.boardPos, leg.alightPos, t.id)) {
          t.phase = PHASE_WAIT;
          return;
        }
        // A linha sumiu ou parou: segue a pé (ou de cadeira).
        this.replan(t, t.node, [c.chair ?? 'pedestrian'], false);
        if (t.done) return;
        continue;
      }
      const ei = leg.edges[t.edge];
      if (ei === undefined) {
        t.leg++;
        t.edge = 0;
        t.progressM = 0;
        t.entered = false;
        continue;
      }
      if (budget <= 1e-9) return;
      const e = g.edge(ei);
      const prof = vehicle(leg.mode);
      if (!t.entered) {
        t.entered = true;
        this.countEntry(ei, e.link === 'road' ? (g.laneFor(ei, prof)?.lane ?? null) : null, 1 / this.scale);
        if (e.link === 'radical') this.bump((s) => s.radicalCrossings++);
      }
      let tt = g.travelTimeMin(ei, prof) / c.speedFactor;
      if (!Number.isFinite(tt) || tt <= 0) tt = Math.max(1e-6, e.lengthM / prof.speedMps / 60);
      const remaining = (1 - t.progressM / e.lengthM) * tt;
      if (remaining <= budget) {
        budget -= remaining;
        t.edge++;
        t.progressM = 0;
        t.entered = false;
        t.node = e.to;
      } else {
        t.progressM += (e.lengthM * budget) / tt;
        return;
      }
    }
  }

  private onAlight(tripId: number, node: number): void {
    const t = this.tripById.get(tripId);
    if (!t || t.done) return;
    t.phase = PHASE_MOVE;
    t.leg++;
    t.edge = 0;
    t.progressM = 0;
    t.entered = false;
    t.node = node;
  }

  private onGiveUp(tripId: number, node: number): void {
    if (this.stranding) {
      this.stranding.push([tripId, this._graph.node(node).id]);
      return;
    }
    const t = this.tripById.get(tripId);
    if (!t || t.done) return;
    this.bump((s) => s.transitGaveUp++);
    const c = this._citizens[t.citizen]!;
    this.replan(t, node, [c.chair ?? 'pedestrian'], false);
  }

  /** Refaz a viagem a partir de `node`; sem rota possível, a viagem falha. */
  private replan(t: Trip, node: number, modes: readonly VehicleKind[], allowTransit: boolean): void {
    const c = this._citizens[t.citizen]!;
    t.node = node;
    const plan = node === t.dest ? { legs: [] as Leg[] } : this.plan(c, node, t.dest, modes, allowTransit);
    if (!plan) {
      t.done = true;
      c.tripId = -1;
      this.tripById.delete(t.id);
      this.bumpFail(c);
      return;
    }
    t.legs = plan.legs;
    t.leg = 0;
    t.edge = 0;
    t.progressM = 0;
    t.entered = false;
    t.phase = PHASE_MOVE;
  }

  private complete(t: Trip, endMinute: number): void {
    const c = this._citizens[t.citizen]!;
    t.done = true;
    this.tripById.delete(t.id);
    c.tripId = -1;
    c.location = t.to;
    this.bumpDone(c, endMinute - t.start);
  }

  // ------------------------------------------------------------------------------------------
  // Estatísticas
  // ------------------------------------------------------------------------------------------

  private bump(f: (s: SimStats) => void): void {
    f(this.stats);
    f(this.statsToday);
  }

  private bumpDone(c: Citizen, minutes: number): void {
    this.bump((s) => {
      s.tripsCompleted++;
      s.tripMinutesTotal += minutes;
      const d = districtStats(s, c.district);
      d.completed++;
      d.minutesTotal += minutes;
      if (c.chair) s.wheelchairTrips.completed++;
    });
  }

  private bumpFail(c: Citizen): void {
    this.bump((s) => {
      s.tripsFailed++;
      districtStats(s, c.district).failed++;
      if (c.chair) s.wheelchairTrips.failed++;
    });
  }

  // ------------------------------------------------------------------------------------------
  // Fluxo por faixa → BPR
  // ------------------------------------------------------------------------------------------

  private countEntry(edge: number, lane: LaneKind | null, weight: number): void {
    const e = this._graph.edges[edge];
    if (!e) return;
    let i: number;
    if (e.link === 'road') {
      if (!lane) return;
      i = edge * SLOTS + LANE_SLOT[lane];
    } else {
      i = edge * SLOTS + LINK_SLOT;
    }
    this.counts[i] = this.counts[i]! + weight;
  }

  /** Média móvel exponencial das entradas por minuto, convertida em usuários/hora. */
  private flushFlows(): void {
    const a = 1 / FLOW_WINDOW_MIN;
    for (let i = 0; i < this.ema.length; i++) {
      this.ema[i] = this.ema[i]! * (1 - a) + this.counts[i]! * 60 * a;
      this.counts[i] = 0;
    }
    this.computeSaturation();
  }

  /**
   * Saturação "ao vivo" (média móvel atual) para o overlay, sem esperar o próximo refresh do grafo.
   * Usa só a API pública do RoadGraph: põe o fluxo ao vivo na aresta, lê saturation() e restaura o snapshot.
   * TODO(pc3-eng-rede): trocar por um `graph.saturationFor(e, flows)` se a API ganhar algo assim.
   */
  private computeSaturation(): void {
    const g = this._graph;
    for (const e of g.edges) {
      const base = e.index * SLOTS;
      const keepLanes = e.flowVph;
      const keepLink = e.linkFlowVph;
      e.flowVph = {
        sidewalk: this.ema[base]!,
        slow: this.ema[base + 1]!,
        fast: this.ema[base + 2]!,
        transit: this.ema[base + 3]!,
      };
      e.linkFlowVph = this.ema[base + LINK_SLOT]!;
      const sat = g.saturation(e.index);
      this.saturation[e.index] = Number.isFinite(sat) ? sat : 0;
      e.flowVph = keepLanes;
      e.linkFlowVph = keepLink;
    }
  }

  /** Passa o fluxo médio para o grafo (BPR) e invalida as rotas. */
  private refreshRoutes(): void {
    for (const e of this._graph.edges) {
      const base = e.index * SLOTS;
      e.flowVph = {
        sidewalk: this.ema[base]!,
        slow: this.ema[base + 1]!,
        fast: this.ema[base + 2]!,
        transit: this.ema[base + 3]!,
      };
      e.linkFlowVph = this.ema[base + LINK_SLOT]!;
    }
    this.routeCache.clear();
    this.transit.refreshTimes();
  }

  // ------------------------------------------------------------------------------------------
  // Save
  // ------------------------------------------------------------------------------------------

  private load(d: SavedSim): void {
    this.rng.state = d.rng;
    this.plannedDay = d.plannedDay;
    this.nextTripId = d.nextTripId;
    this._citizens = d.citizens.map((c) => ({ ...c, owned: [...c.owned], places: [...c.places], placeXY: [...c.placeXY], agenda: [...c.agenda] }));
    this.trips = d.trips.map((t) => ({ ...t, legs: t.legs.map((l) => (l.kind === 'move' ? { ...l, edges: [...l.edges] } : { ...l })) }));
    for (const t of this.trips) this.tripById.set(t.id, t);
    this.ema.set(d.ema.slice(0, this.ema.length));
    const g = this._graph;
    for (const e of g.edges) {
      const b = e.index * SLOTS;
      const f = (i: number) => d.graphFlows[b + i] ?? 0;
      e.flowVph = { sidewalk: f(0), slow: f(1), fast: f(2), transit: f(3) };
      e.linkFlowVph = f(4);
    }
    this.stats = d.stats;
    this.statsToday = d.statsToday;
    this.transit.restore(d.transit);
    this.computeSaturation();
  }
}

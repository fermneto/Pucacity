/**
 * Transporte coletivo (SPEC §4.6): linhas de tuk-tuk e tandem com paradas, headway, frota e lotação.
 *
 * Modelo:
 * - Linha = paradas (ids de nós do city.json). Se a primeira parada repete no fim, a linha é circular;
 *   senão é vai-e-volta (0 → n-1 → 0). O ciclo é uma lista de "posições" (parada + sentido).
 * - Cada trecho entre paradas é uma rota A* do próprio veículo (faixa coletiva; sem ela, faixa lenta).
 * - Frota ativa = min(frota, ⌈ciclo / headway⌉), lançada em intervalos iguais (spacing = ciclo / frota ativa).
 *   O resto da frota fica na garagem.
 * - Lotação: capacidade por veículo de balance.tools.linhaTukTuk/linhaTandem (escalada pela amostra da simulação).
 *   Quem não cabe continua na fila; quem espera além da paciência desiste (o host decide o que fazer).
 */
import { transitToolCfg } from './Agents';
import { findPath } from './Pathfinding';
import type { RoadGraph } from './RoadGraph';
import type { LaneKind } from './types';
import { vehicle, type VehicleProfile } from './Vehicles';

export type TransitKind = 'tuktuk' | 'tandem';

export interface TransitLineDef {
  id: string;
  kind: TransitKind;
  /** Ids de nós do city.json, na ordem. */
  stops: number[];
  /** Intervalo desejado entre veículos, minutos (padrão: balance.tools). */
  headwayMinutes?: number;
  /** Veículos disponíveis (padrão 1). */
  fleet?: number;
}

export interface TransitVehicleView {
  lineId: string;
  kind: TransitKind;
  x: number;
  y: number;
  heading: number;
  load: number;
  capacity: number;
}

/** O que o coletivo precisa da simulação. */
export interface TransitHost {
  readonly graph: RoadGraph;
  /** Fração da população simulada. */
  readonly scale: number;
  /** Minuto absoluto atual. */
  readonly minute: number;
  /** Veículo entrou numa aresta (para o fluxo por faixa/ligação). */
  countEntry(edge: number, lane: LaneKind | null, weight: number): void;
  /** Passageiro desceu na parada (índice de nó do grafo atual). */
  onAlight(trip: number, node: number): void;
  /** Passageiro desistiu (ou a linha deixou de existir) no nó dado. */
  onGiveUp(trip: number, node: number): void;
}

/** Tempo parado em cada parada, minutos. PROVISÓRIO. */
export const DWELL_MIN = 0.25;
/** Paciência na fila: max(PATIENCE_MIN, PATIENCE_HEADWAYS × spacing). PROVISÓRIO. */
export const PATIENCE_MIN = 20;
export const PATIENCE_HEADWAYS = 3;

interface Segment {
  edges: number[];
  minutes: number;
}

interface Waiting {
  trip: number;
  alightPos: number;
  since: number;
}

interface TVehicle {
  launch: number;
  active: boolean;
  /** Posição do ciclo de onde partiu (o trecho atual é segments[pos]). */
  pos: number;
  /** Índice da aresta dentro do trecho. */
  edge: number;
  progressM: number;
  entered: boolean;
  dwell: number;
  heading: number;
  riders: number[];
  alightAt: number[];
}

export class TransitLine {
  readonly def: Required<TransitLineDef>;
  /** Posição do ciclo → índice da parada em def.stops. */
  seq: number[] = [];
  /** Índice de nó do grafo de cada parada (def.stops). */
  stopNodes: number[] = [];
  segments: Segment[] = [];
  active = false;
  problem: string | null = null;
  capacity = 1;
  activeFleet = 0;
  spacing = Infinity;
  created = 0;
  waiting: Waiting[][] = [];
  vehicles: TVehicle[] = [];
  /** Média móvel da fração de passageiros que não couberam no veículo (0–1). */
  crowding = 0;
  boarded = 0;
  denied = 0;

  constructor(def: TransitLineDef) {
    const cfg = transitToolCfg(def.kind);
    this.def = {
      id: def.id,
      kind: def.kind,
      stops: [...def.stops],
      headwayMinutes: def.headwayMinutes ?? cfg.headwayMinutes,
      fleet: def.fleet ?? 1,
    };
  }

  get loop(): boolean {
    const s = this.def.stops;
    return s.length >= 3 && s[0] === s[s.length - 1];
  }

  /** Posições de embarque e desembarque no ciclo para ir da parada b à parada a (índices de def.stops). */
  positions(b: number, a: number): { boardPos: number; alightPos: number } {
    const n = this.def.stops.length;
    if (this.loop) {
      const L = n - 1;
      return { boardPos: b % L, alightPos: a % L };
    }
    if (a > b) return { boardPos: b, alightPos: a };
    return { boardPos: b === n - 1 ? n - 1 : 2 * (n - 1) - b, alightPos: a === 0 ? 0 : 2 * (n - 1) - a };
  }

  /** Tempo a bordo entre duas posições do ciclo, minutos. */
  rideMinutes(boardPos: number, alightPos: number): number {
    const L = this.segments.length;
    if (L === 0) return Infinity;
    let t = 0;
    let p = boardPos;
    let hops = 0;
    do {
      t += this.segments[p]!.minutes;
      p = (p + 1) % L;
      hops++;
    } while (p !== alightPos && hops <= L);
    return t + DWELL_MIN * (hops - 1);
  }

  /** Espera média na parada, minutos (meio intervalo + penalidade de lotação). */
  expectedWait(): number {
    return this.spacing / 2 + this.spacing * this.crowding * 2;
  }

  get patience(): number {
    return Math.max(PATIENCE_MIN, PATIENCE_HEADWAYS * this.spacing);
  }

  cycleMinutes(): number {
    let t = 0;
    for (const s of this.segments) t += s.minutes + DWELL_MIN;
    return t;
  }
}

const stopNodeOf = (line: TransitLine, pos: number) => line.stopNodes[line.seq[pos]!]!;

export class TransitSystem {
  private readonly list: TransitLine[] = [];

  constructor(private readonly host: TransitHost) {}

  get lines(): readonly TransitLine[] {
    return this.list;
  }

  getLine(id: string): TransitLine | undefined {
    return this.list.find((l) => l.def.id === id);
  }

  profile(kind: TransitKind): VehicleProfile {
    return vehicle(kind);
  }

  /**
   * Cria uma linha. Lança erro se a definição for inválida (id repetido, < 2 paradas, nó inexistente).
   * Se não houver rota entre duas paradas, a linha fica inativa com `problem` explicando.
   */
  addLine(def: TransitLineDef): TransitLine {
    if (this.getLine(def.id)) throw new Error(`Transit: linha '${def.id}' já existe`);
    if (def.kind !== 'tuktuk' && def.kind !== 'tandem') throw new Error(`Transit: tipo '${String(def.kind)}' inválido`);
    if (!Array.isArray(def.stops) || def.stops.length < 2) throw new Error(`Transit: linha '${def.id}' precisa de 2+ paradas`);
    for (let i = 1; i < def.stops.length; i++) {
      if (def.stops[i] === def.stops[i - 1]) throw new Error(`Transit: paradas repetidas em sequência na linha '${def.id}'`);
    }
    if (def.headwayMinutes !== undefined && !(def.headwayMinutes > 0)) throw new Error('Transit: headway > 0');
    if (def.fleet !== undefined && !(def.fleet >= 1)) throw new Error('Transit: frota ≥ 1');
    const line = new TransitLine(def);
    for (const id of line.def.stops) this.host.graph.nodeIndexOf(id); // lança se não existir
    this.build(line);
    this.list.push(line);
    return line;
  }

  /** Remove a linha; quem esperava ou estava a bordo é devolvido ao host (onGiveUp). */
  removeLine(id: string): boolean {
    const i = this.list.findIndex((l) => l.def.id === id);
    if (i < 0) return false;
    const line = this.list[i]!;
    this.strand(line);
    this.list.splice(i, 1);
    return true;
  }

  /** Devolve todos os passageiros de todas as linhas ao host (antes de trocar a cidade). */
  strandAll(): void {
    for (const l of this.list) this.strand(l);
  }

  /** Recalcula paradas e trechos no grafo atual (após setCity) e relança a frota a partir de agora. */
  rebuild(): void {
    for (const l of this.list) this.build(l);
  }

  /** Atualiza o tempo estimado de cada trecho com o congestionamento atual. */
  refreshTimes(): void {
    for (const l of this.list) {
      if (!l.active) continue;
      const p = this.profile(l.def.kind);
      for (const s of l.segments) {
        let t = 0;
        for (const e of s.edges) t += this.host.graph.travelTimeMin(e, p);
        s.minutes = t;
      }
    }
  }

  /** Coloca um passageiro na fila de uma posição do ciclo. */
  enqueue(lineId: string, boardPos: number, alightPos: number, trip: number): boolean {
    const l = this.getLine(lineId);
    if (!l || !l.active) return false;
    l.waiting[boardPos]!.push({ trip, alightPos, since: this.host.minute });
    return true;
  }

  /** Avança 1 minuto: frota, embarques/desembarques e desistências. */
  tick(): void {
    const minute = this.host.minute;
    for (const l of this.list) {
      if (!l.active) continue;
      for (const v of l.vehicles) {
        if (!v.active) {
          if (minute < v.launch) continue;
          v.active = true;
          this.serve(l, v);
        }
        this.advance(l, v, 1);
      }
      // Desistências (FIFO preservado).
      const patience = l.patience;
      for (let pos = 0; pos < l.waiting.length; pos++) {
        const q = l.waiting[pos]!;
        if (q.length === 0) continue;
        const keep: Waiting[] = [];
        for (const w of q) {
          if (minute - w.since >= patience) this.host.onGiveUp(w.trip, stopNodeOf(l, pos));
          else keep.push(w);
        }
        l.waiting[pos] = keep;
      }
    }
  }

  views(): TransitVehicleView[] {
    const out: TransitVehicleView[] = [];
    const g = this.host.graph;
    for (const l of this.list) {
      if (!l.active) continue;
      for (const v of l.vehicles) {
        if (!v.active) continue;
        const seg = l.segments[v.pos]!;
        let x: number;
        let y: number;
        const ei = seg.edges[v.edge];
        if (ei === undefined) {
          const n = g.node(stopNodeOf(l, (v.pos + 1) % l.segments.length));
          x = n.x;
          y = n.y;
        } else {
          const e = g.edge(ei);
          const a = g.node(e.from);
          const b = g.node(e.to);
          const f = e.lengthM > 0 ? Math.min(1, v.progressM / e.lengthM) : 0;
          x = a.x + (b.x - a.x) * f;
          y = a.y + (b.y - a.y) * f;
        }
        out.push({ lineId: l.def.id, kind: l.def.kind, x, y, heading: v.heading, load: v.riders.length, capacity: l.capacity });
      }
    }
    return out;
  }

  serialize(): unknown {
    return this.list.map((l) => ({
      def: l.def,
      seq: l.seq,
      stopNodes: l.stopNodes,
      segments: l.segments,
      active: l.active,
      problem: l.problem,
      capacity: l.capacity,
      activeFleet: l.activeFleet,
      spacing: Number.isFinite(l.spacing) ? l.spacing : null,
      created: l.created,
      waiting: l.waiting,
      vehicles: l.vehicles,
      crowding: l.crowding,
      boarded: l.boarded,
      denied: l.denied,
    }));
  }

  restore(data: unknown): void {
    this.list.length = 0;
    for (const raw of data as Record<string, unknown>[]) {
      const l = new TransitLine(raw.def as TransitLineDef);
      Object.assign(l, raw, { def: l.def });
      if (raw.spacing === null) l.spacing = Infinity;
      this.list.push(l);
    }
  }

  // -------------------------------------------------------------------------------------------

  private build(l: TransitLine): void {
    const g = this.host.graph;
    const n = l.def.stops.length;
    l.seq = l.loop ? Array.from({ length: n - 1 }, (_, i) => i) : [...Array.from({ length: n }, (_, i) => i), ...Array.from({ length: n - 2 }, (_, i) => n - 2 - i)];
    l.active = false;
    l.problem = null;
    l.segments = [];
    l.vehicles = [];
    l.waiting = l.seq.map(() => []);
    l.crowding = 0;
    l.created = this.host.minute;
    l.capacity = Math.max(1, Math.round(transitToolCfg(l.def.kind).capacity * this.host.scale));
    l.stopNodes = [];
    for (const id of l.def.stops) {
      try {
        l.stopNodes.push(g.nodeIndexOf(id));
      } catch {
        l.problem = `parada ${id} não existe mais`;
        return;
      }
    }
    const p = this.profile(l.def.kind);
    for (let pos = 0; pos < l.seq.length; pos++) {
      const a = stopNodeOf(l, pos);
      const b = stopNodeOf(l, (pos + 1) % l.seq.length);
      const path = findPath(g, p, a, b);
      if (!path) {
        l.problem = `sem rota de ${g.node(a).id} para ${g.node(b).id}`;
        l.segments = [];
        return;
      }
      l.segments.push({ edges: path.edges, minutes: path.cost });
    }
    const cycle = l.cycleMinutes();
    l.activeFleet = Math.max(1, Math.min(l.def.fleet, Math.ceil(cycle / l.def.headwayMinutes)));
    l.spacing = Math.max(cycle / l.activeFleet, 1);
    for (let k = 0; k < l.activeFleet; k++) {
      l.vehicles.push({
        launch: l.created + Math.round(k * l.spacing),
        active: false,
        pos: 0,
        edge: 0,
        progressM: 0,
        entered: false,
        dwell: 0,
        heading: 0,
        riders: [],
        alightAt: [],
      });
    }
    l.active = true;
  }

  private strand(l: TransitLine): void {
    const g = this.host.graph;
    for (let pos = 0; pos < l.waiting.length; pos++) {
      for (const w of l.waiting[pos]!) this.host.onGiveUp(w.trip, stopNodeOf(l, pos));
      l.waiting[pos] = [];
    }
    for (const v of l.vehicles) {
      if (v.riders.length === 0) continue;
      const ei = l.segments[v.pos]?.edges[v.edge];
      const node = ei === undefined ? stopNodeOf(l, (v.pos + 1) % l.seq.length) : v.entered ? g.edge(ei).to : g.edge(ei).from;
      for (const t of v.riders) this.host.onGiveUp(t, node);
      v.riders = [];
      v.alightAt = [];
    }
  }

  /** Desembarque e embarque na posição atual do veículo. */
  private serve(l: TransitLine, v: TVehicle): void {
    const node = stopNodeOf(l, v.pos);
    if (v.riders.length > 0) {
      const riders: number[] = [];
      const alight: number[] = [];
      for (let i = 0; i < v.riders.length; i++) {
        if (v.alightAt[i] === v.pos) this.host.onAlight(v.riders[i]!, node);
        else {
          riders.push(v.riders[i]!);
          alight.push(v.alightAt[i]!);
        }
      }
      v.riders = riders;
      v.alightAt = alight;
    }
    const q = l.waiting[v.pos]!;
    if (q.length === 0) return;
    let boarded = 0;
    while (q.length > 0 && v.riders.length < l.capacity) {
      const w = q.shift()!;
      v.riders.push(w.trip);
      v.alightAt.push(w.alightPos);
      boarded++;
    }
    const left = q.length;
    l.boarded += boarded;
    l.denied += left;
    l.crowding = l.crowding * 0.8 + 0.2 * (left / (boarded + left));
  }

  private advance(l: TransitLine, v: TVehicle, minutes: number): void {
    const g = this.host.graph;
    const p = this.profile(l.def.kind);
    const L = l.segments.length;
    let budget = minutes;
    let guard = 0;
    while (budget > 1e-9 && guard++ < 10_000) {
      if (v.dwell > 0) {
        const d = Math.min(v.dwell, budget);
        v.dwell -= d;
        budget -= d;
        continue;
      }
      const seg = l.segments[v.pos]!;
      const ei = seg.edges[v.edge];
      if (ei === undefined) {
        v.pos = (v.pos + 1) % L;
        v.edge = 0;
        v.progressM = 0;
        v.entered = false;
        this.serve(l, v);
        v.dwell = DWELL_MIN;
        continue;
      }
      const e = g.edge(ei);
      if (!v.entered) {
        v.entered = true;
        v.heading = Math.atan2(g.node(e.to).y - g.node(e.from).y, g.node(e.to).x - g.node(e.from).x);
        this.host.countEntry(ei, e.link === 'road' ? (g.laneFor(ei, p)?.lane ?? null) : null, 1);
      }
      let t = g.travelTimeMin(ei, p);
      if (!Number.isFinite(t) || t <= 0) t = Math.max(1e-6, e.lengthM / p.speedMps / 60);
      const remaining = (1 - v.progressM / e.lengthM) * t;
      if (remaining <= budget) {
        budget -= remaining;
        v.edge++;
        v.progressM = 0;
        v.entered = false;
      } else {
        v.progressM += (e.lengthM * budget) / t;
        budget = 0;
      }
    }
  }
}

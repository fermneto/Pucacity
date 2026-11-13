import balance from '../../config/balance.json';
import veiculos from '../../data/arte/veiculos.json';
import { ACCESS_ART_ID, ART_ID, BUBBLE_LIFT, crossingAccessRoute, RADICALS, type RadicalInfo } from './Crossings';
import type { AccessKind, CityFile, EdgeKind, LaneCounts, LaneKind, RadicalKind, VehicleKind } from './types';
import { LANE_KINDS } from './types';
import type { VehicleProfile } from './Vehicles';

/** 1 tile = 10 metros (ver docs/engineering.md §0). */
export const METERS_PER_TILE = 10;

/** Velocidade máxima típica de cada faixa, m/s (SPEC §4.2). */
export const LANE_MAX_SPEED_MPS: Record<LaneKind, number> = {
  sidewalk: 3,
  slow: 6,
  fast: 8.5,
  transit: 9,
};

/**
 * Sem a faixa própria, o veículo usa a vizinha mais lenta (SPEC §4.2).
 * Ordem de tentativa por faixa preferida.
 */
export const LANE_FALLBACK: Record<LaneKind, readonly LaneKind[]> = {
  sidewalk: ['sidewalk', 'slow', 'fast'],
  slow: ['slow', 'sidewalk'],
  fast: ['fast', 'slow', 'sidewalk'],
  transit: ['transit', 'slow'],
};

/**
 * Tipo de ligação de uma aresta dirigida:
 * - road: trecho de via com faixas;
 * - radical / lift / walkway / transit_only: as duas metades de uma travessia (elemento radical + rota acessível).
 */
export type LinkKind = 'road' | 'radical' | 'lift' | 'walkway' | 'transit_only';

/**
 * Como fechar ligações (eventos como `vento_loop` → `closes: ['loop_aereo']`, `elevador_quebrado` → `['elevador_bolha']`).
 * Aceita o tipo de ligação ('radical', 'lift'…), o kind do city.json ('air_loop', 'bubble_lift'…)
 * ou o id da Arte/balance ('loop_aereo', 'elevador_bolha', 'passarela_vidro'…).
 */
export type ClosableLink = LinkKind | RadicalKind | AccessKind | string;

/**
 * Números de balanceamento usados pela rede. Padrão: `trafficParamsFromBalance(config/balance.json)`.
 *
 * SUPOSIÇÃO DE UNIDADE: `balance.lanes.<faixa>.capacityPerWidth` não tem unidade documentada;
 * aqui ela vale **usuários por minuto por metro de largura da faixa**. Ex.: calçada de 2 m × 60 = 120 usuários/min
 * = 7200 usuários/h. Fluxos (`flowVph`, `linkFlowVph`) continuam em usuários/hora.
 */
export interface TrafficParams {
  bprAlpha: number;
  bprBeta: number;
  /** Capacidade por metro de largura de cada tipo de faixa, usuários/min/m (balance.lanes.<faixa>.capacityPerWidth). */
  laneCapacityPerWidth: Record<LaneKind, number>;
  /** Multiplicador de risco de queda de cada faixa (balance.lanes.<faixa>.fallRiskMultiplier). */
  laneFallRiskMultiplier: Record<LaneKind, number>;
  /** Multiplicador de velocidade ao usar faixa que não é a sua (balance.lanes._sharedLanePenalty.speedFactor). */
  fallbackSpeedFactor: number;
  /** Multiplicador de risco ao usar faixa que não é a sua (balance.lanes._sharedLanePenalty.fallRiskMultiplier). */
  fallbackFallRiskMultiplier: number;
  /**
   * Capacidade das ligações de travessia, usuários/hora.
   * lift = balance.tools.elevadorBolha.capacityPerMinute × 60; radical, walkway e transit_only ainda são
   * placeholders da Engenharia (o balance.json não tem esses números).
   */
  linkCapacityVph: Record<Exclude<LinkKind, 'road'>, number>;
  /** Regras de cada elemento radical (Arte + balance.radical). */
  radical: Record<RadicalKind, RadicalInfo>;
  /** Travessia do Elevador de Bolha, segundos (balance.radical.elevador_bolha.crossSeconds). */
  liftCrossSeconds: number;
  /** Risco de queda no elevador (balance.radical.elevador_bolha.fallRisk). */
  liftFallRisk: number;
  /** Chance base de queda por viagem de cada veículo (balance.vehicles.<id da Arte>.fallRisk). Ausente = 0. */
  vehicleFallRisk: Partial<Record<VehicleKind, number>>;
}

interface BalanceLane {
  capacityPerWidth: number;
  fallRiskMultiplier: number;
}

/** Placeholders sem número no balance.json (pendência para o Design), usuários/hora. */
const PLACEHOLDER_LINK_CAPACITY_VPH = { radical: 900, walkway: 2400, transit_only: 600 } as const;

/** Monta os parâmetros da rede a partir do balance.json (exportado para recarregar em tempo de execução). */
export function trafficParamsFromBalance(b: unknown = balance): TrafficParams {
  const bal = b as {
    congestion: { alpha: number; beta: number };
    lanes: Record<string, BalanceLane | { speedFactor: number; fallRiskMultiplier: number }>;
    vehicles: Record<string, { fallRisk?: number } | unknown>;
    tools: { elevadorBolha: { capacityPerMinute: number } };
  };
  const lane = (k: LaneKind): BalanceLane => {
    const l = bal.lanes[k] as BalanceLane | undefined;
    if (!l || typeof l.capacityPerWidth !== 'number' || typeof l.fallRiskMultiplier !== 'number') {
      throw new Error(`config/balance.json: falta lanes.${k} com capacityPerWidth e fallRiskMultiplier`);
    }
    return l;
  };
  const shared = bal.lanes._sharedLanePenalty as { speedFactor: number; fallRiskMultiplier: number } | undefined;
  if (!shared) throw new Error('config/balance.json: falta lanes._sharedLanePenalty');

  const vehicleFallRisk: Partial<Record<VehicleKind, number>> = {};
  const artVehicles = [...veiculos.individuais, ...veiculos.transporte_publico] as { id: string; kind: string }[];
  for (const v of artVehicles) {
    const entry = bal.vehicles[v.id] as { fallRisk?: number } | undefined;
    if (entry && typeof entry === 'object' && typeof entry.fallRisk === 'number') {
      vehicleFallRisk[v.kind as VehicleKind] = entry.fallRisk;
    }
  }

  return {
    bprAlpha: bal.congestion.alpha,
    bprBeta: bal.congestion.beta,
    laneCapacityPerWidth: {
      sidewalk: lane('sidewalk').capacityPerWidth,
      slow: lane('slow').capacityPerWidth,
      fast: lane('fast').capacityPerWidth,
      transit: lane('transit').capacityPerWidth,
    },
    laneFallRiskMultiplier: {
      sidewalk: lane('sidewalk').fallRiskMultiplier,
      slow: lane('slow').fallRiskMultiplier,
      fast: lane('fast').fallRiskMultiplier,
      transit: lane('transit').fallRiskMultiplier,
    },
    fallbackSpeedFactor: shared.speedFactor,
    fallbackFallRiskMultiplier: shared.fallRiskMultiplier,
    linkCapacityVph: { ...PLACEHOLDER_LINK_CAPACITY_VPH, lift: bal.tools.elevadorBolha.capacityPerMinute * 60 },
    radical: RADICALS,
    liftCrossSeconds: BUBBLE_LIFT.crossSeconds,
    liftFallRisk: BUBBLE_LIFT.fallRisk,
    vehicleFallRisk,
  };
}

export const DEFAULT_TRAFFIC: TrafficParams = trafficParamsFromBalance();

const ACCESS_LINK: Record<AccessKind, LinkKind> = {
  bubble_lift: 'lift',
  glass_walkway: 'walkway',
  transit_only: 'transit_only',
};

export interface DirectedEdge {
  /** Índice nesta lista (estável enquanto o grafo não for reconstruído). */
  index: number;
  link: LinkKind;
  /** id da aresta (road) ou da travessia (demais) no city.json. */
  sourceId: number;
  /** true se é o sentido to→from. */
  reversed: boolean;
  from: number; // índice de nó
  to: number; // índice de nó
  lengthM: number;
  /** Só em vias. */
  roadKind?: EdgeKind;
  /** Só em travessias radicais. */
  radical?: RadicalKind;
  /** Só nas rotas acessíveis: qual é (lift/walkway/transit_only vêm de bubble_lift/glass_walkway/transit_only). */
  access?: AccessKind;
  /** true na passarela de vidro implícita da Rail-Passarela sem `access`. */
  implicitAccess?: boolean;
  /**
   * Largura deste SENTIDO da via, metros (edge.width; metade dele em mão dupla). 0 em travessias.
   * A largura é dividida igualmente entre as faixas do sentido.
   */
  widthM: number;
  /** Limite da via em m/s (Infinity em travessias). */
  speedLimitMps: number;
  /** Faixas por sentido (só em vias). */
  lanes: Record<LaneKind, number>;
  /** Fluxo por faixa, usuários/hora (só em vias). Atualizado pela simulação. */
  flowVph: Record<LaneKind, number>;
  /** Fluxo na ligação de travessia, usuários/hora. */
  linkFlowVph: number;
}

export interface GraphNode {
  index: number;
  id: number;
  x: number;
  y: number;
}

export interface LaneUse {
  lane: LaneKind;
  /** true se não é a faixa preferida do veículo (mais lento e mais arriscado). */
  fallback: boolean;
}

/** Por que o veículo não pode usar uma ligação de travessia. */
export type CrossingBlockReason =
  | 'sem_manobras'
  | 'abaixo_velocidade_minima'
  | 'so_coletivo'
  | 'coletivo_nao_usa'
  | 'fechada';

/** Uma ligação de travessia vista por um veículo (overlay de acessibilidade, painel da travessia). */
export interface CrossingRoute {
  link: Exclude<LinkKind, 'road'>;
  /** Elemento radical ou rota acessível. */
  kind: RadicalKind | AccessKind;
  /** true na passarela de vidro implícita da Rail-Passarela. */
  implicit: boolean;
  usable: boolean;
  /** Presente quando `usable` é false. */
  reason?: CrossingBlockReason;
  /** Tempo atual (BPR) no sentido from→to, minutos; Infinity se não pode usar. */
  timeMin: number;
  /** Arestas dirigidas [from→to, to→from]. */
  edges: [number, number];
}

const zeroLanes = (): Record<LaneKind, number> => ({ sidewalk: 0, slow: 0, fast: 0, transit: 0 });

/**
 * Grafo dirigido derivado do city.json: vias (com faixas por tipo) + travessias (radical + rota acessível).
 * Nós e arestas são acessados por ÍNDICE (arrays densos); use nodeIndexOf(id) para converter ids do arquivo.
 */
export class RoadGraph {
  readonly nodes: GraphNode[] = [];
  readonly edges: DirectedEdge[] = [];
  /** Arestas que saem de cada nó (por índice de nó). */
  readonly out: number[][] = [];
  /**
   * Ligações fechadas por evento, valendo para todo o grafo (travelTimeMin devolve Infinity).
   * Mesmos valores de `ClosableLink`, ex.: graph.closedLinks.add('loop_aereo').
   */
  readonly closedLinks = new Set<ClosableLink>();

  private readonly idToIndex = new Map<number, number>();
  /** id da travessia → arestas dirigidas (radical e acessível, nos 2 sentidos). */
  private readonly crossingEdges = new Map<number, number[]>();

  constructor(city: CityFile, readonly params: TrafficParams = DEFAULT_TRAFFIC) {
    // Ordena por id para determinismo independente da ordem do arquivo.
    for (const n of [...city.nodes].sort((a, b) => a.id - b.id)) {
      const index = this.nodes.length;
      this.nodes.push({ index, id: n.id, x: n.x, y: n.y });
      this.idToIndex.set(n.id, index);
      this.out.push([]);
    }

    for (const e of [...city.edges].sort((a, b) => a.id - b.id)) {
      const lanes = normalizeLanes(e.lanes);
      const base = {
        link: 'road' as const,
        sourceId: e.id,
        roadKind: e.kind,
        speedLimitMps: e.speed / 3.6,
        lanes,
        widthM: e.oneWay ? e.width : e.width / 2,
      };
      const from = this.nodeIndexOf(e.from);
      const to = this.nodeIndexOf(e.to);
      this.addEdge({ ...base, from, to, reversed: false });
      if (!e.oneWay) this.addEdge({ ...base, from: to, to: from, reversed: true });
    }

    for (const c of [...city.crossings].sort((a, b) => a.id - b.id)) {
      const from = this.nodeIndexOf(c.from);
      const to = this.nodeIndexOf(c.to);
      const links: Pick<DirectedEdge, 'link' | 'radical' | 'access' | 'implicitAccess'>[] = [{ link: 'radical', radical: c.radical }];
      const acc = crossingAccessRoute(c);
      if (acc) links.push({ link: ACCESS_LINK[acc.kind], access: acc.kind, ...(acc.implicit ? { implicitAccess: true } : {}) });
      const list: number[] = [];
      for (const l of links) {
        const base = { ...l, sourceId: c.id, speedLimitMps: Infinity, lanes: zeroLanes(), widthM: 0 };
        list.push(this.addEdge({ ...base, from, to, reversed: false }));
        list.push(this.addEdge({ ...base, from: to, to: from, reversed: true }));
      }
      this.crossingEdges.set(c.id, list);
    }
  }

  nodeIndexOf(id: number): number {
    const i = this.idToIndex.get(id);
    if (i === undefined) throw new Error(`RoadGraph: nó ${id} não existe`);
    return i;
  }

  node(index: number): GraphNode {
    const n = this.nodes[index];
    if (!n) throw new Error(`RoadGraph: índice de nó ${index} inválido`);
    return n;
  }

  edge(index: number): DirectedEdge {
    const e = this.edges[index];
    if (!e) throw new Error(`RoadGraph: índice de aresta ${index} inválido`);
    return e;
  }

  /** Distância em linha reta entre dois nós, em metros. */
  distanceM(a: number, b: number): number {
    const na = this.node(a);
    const nb = this.node(b);
    return Math.hypot(na.x - nb.x, na.y - nb.y) * METERS_PER_TILE;
  }

  /** Qual faixa o veículo usa nesta via (ou null se nenhuma serve). */
  laneFor(edgeIndex: number, v: VehicleProfile): LaneUse | null {
    const e = this.edge(edgeIndex);
    const order = LANE_FALLBACK[v.lane];
    for (let i = 0; i < order.length; i++) {
      const lane = order[i]!;
      if (e.lanes[lane] > 0) return { lane, fallback: i > 0 };
    }
    return null;
  }

  /** Largura de UMA faixa neste sentido da via, metros (largura do sentido ÷ número de faixas). */
  laneWidthM(edgeIndex: number): number {
    const e = this.edge(edgeIndex);
    const n = e.lanes.sidewalk + e.lanes.slow + e.lanes.fast + e.lanes.transit;
    return n > 0 ? e.widthM / n : 0;
  }

  /**
   * Capacidade de todas as faixas de um tipo neste sentido, usuários/hora:
   * nº de faixas × largura da faixa (m) × capacityPerWidth (usuários/min/m) × 60.
   */
  laneCapacityVph(edgeIndex: number, lane: LaneKind): number {
    const e = this.edge(edgeIndex);
    return e.lanes[lane] * this.laneWidthM(edgeIndex) * this.params.laneCapacityPerWidth[lane] * 60;
  }

  /** Capacidade de uma ligação de travessia, usuários/hora (0 em vias: use laneCapacityVph). */
  linkCapacityVph(edgeIndex: number): number {
    const e = this.edge(edgeIndex);
    return e.link === 'road' ? 0 : this.params.linkCapacityVph[e.link];
  }

  /** O veículo pode usar esta aresta? */
  canUse(edgeIndex: number, v: VehicleProfile): boolean {
    return Number.isFinite(this.travelTimeMin(edgeIndex, v));
  }

  /** A aresta está fechada por `closed` (ou por `graph.closedLinks`, se `closed` for omitido)? */
  isClosed(edgeIndex: number, closed: ReadonlySet<ClosableLink> = this.closedLinks): boolean {
    if (closed.size === 0) return false;
    const e = this.edge(edgeIndex);
    if (closed.has(e.link)) return true;
    if (e.radical) return closed.has(e.radical) || closed.has(ART_ID[e.radical]);
    if (e.access) return closed.has(e.access) || closed.has(ACCESS_ART_ID[e.access]);
    return false;
  }

  /**
   * Tempo de percurso atual (com congestionamento BPR) para um veículo, em minutos.
   * Infinity = proibido para este veículo (ou ligação fechada em `graph.closedLinks`).
   */
  travelTimeMin(edgeIndex: number, v: VehicleProfile): number {
    if (this.isClosed(edgeIndex)) return Infinity;
    return this.timeWithFlow(edgeIndex, v, true);
  }

  /** Tempo sem congestionamento (fluxo 0), minutos. Ignora fechamentos. Limite inferior de travelTimeMin. */
  freeFlowTimeMin(edgeIndex: number, v: VehicleProfile): number {
    return this.timeWithFlow(edgeIndex, v, false);
  }

  /**
   * Maior velocidade efetiva (comprimento ÷ tempo livre) entre as arestas que o veículo pode usar, m/s.
   * Travessias de tempo fixo (ex.: Rampa-Ponte de 100 m em 6 s) podem passar da velocidade de cruzeiro,
   * por isso a heurística do A* usa este valor. Recalculado a cada chamada (faixas podem mudar por comando).
   */
  maxEffectiveSpeedMps(v: VehicleProfile): number {
    let max = 0;
    for (const e of this.edges) {
      if (e.lengthM <= 0) continue;
      const t = this.freeFlowTimeMin(e.index, v);
      if (!Number.isFinite(t)) continue;
      if (t <= 0) return Infinity;
      max = Math.max(max, e.lengthM / (t * 60));
    }
    return max;
  }

  /** Motivo de o veículo não poder usar uma ligação de travessia (null = pode; ignora fechamentos). */
  crossingBlockReason(edgeIndex: number, v: VehicleProfile): CrossingBlockReason | null {
    const e = this.edge(edgeIndex);
    switch (e.link) {
      case 'road':
        return null;
      case 'radical': {
        if (v.transit) return 'coletivo_nao_usa';
        const r = this.params.radical[e.radical!];
        if (r.requiresManeuvers && !v.tricks) return 'sem_manobras';
        if (v.maxSpeedMps < r.minSpeedMps) return 'abaixo_velocidade_minima';
        return null;
      }
      case 'lift':
      case 'walkway':
        return v.transit ? 'coletivo_nao_usa' : null;
      case 'transit_only':
        return v.transit ? null : 'so_coletivo';
    }
  }

  /**
   * Ligações de uma travessia (id do city.json) para um veículo: o elemento radical e a rota acessível
   * (declarada ou a passarela implícita da Rail-Passarela), com quem pode usar e o tempo atual.
   * Útil para o overlay de acessibilidade. Lista vazia se a travessia não existe.
   */
  crossingRoutes(crossingId: number, v: VehicleProfile): CrossingRoute[] {
    const list = this.crossingEdges.get(crossingId) ?? [];
    const routes: CrossingRoute[] = [];
    for (let i = 0; i + 1 < list.length; i += 2) {
      const fwd = this.edge(list[i]!);
      const reason = this.isClosed(fwd.index) ? 'fechada' : this.crossingBlockReason(fwd.index, v);
      routes.push({
        link: fwd.link as Exclude<LinkKind, 'road'>,
        kind: (fwd.radical ?? fwd.access)!,
        implicit: fwd.implicitAccess === true,
        usable: reason === null,
        ...(reason !== null ? { reason } : {}),
        timeMin: reason === null ? this.travelTimeMin(fwd.index, v) : Infinity,
        edges: [list[i]!, list[i + 1]!],
      });
    }
    return routes;
  }

  /** Ids das travessias do grafo, em ordem. */
  crossingIds(): number[] {
    return [...this.crossingEdges.keys()];
  }

  /** Multiplicador relativo de risco de queda do veículo nesta aresta (faixa × penalidade de faixa compartilhada). */
  fallRiskMultiplier(edgeIndex: number, v: VehicleProfile): number {
    const e = this.edge(edgeIndex);
    const p = this.params;
    const shared = (own: boolean) => (own ? 1 : p.fallbackFallRiskMultiplier);
    switch (e.link) {
      case 'road': {
        const use = this.laneFor(edgeIndex, v);
        if (!use) return 0;
        return p.laneFallRiskMultiplier[use.lane] * shared(!use.fallback);
      }
      case 'walkway':
        return p.laneFallRiskMultiplier.sidewalk * shared(v.lane === 'sidewalk');
      case 'transit_only':
        return p.laneFallRiskMultiplier.transit;
      case 'radical':
      case 'lift':
        return 1;
    }
  }

  /**
   * Risco de queda do veículo nesta aresta, para o KPI de Segurança:
   * - vias, passarela e ligação de coletivo: chance base por viagem do veículo (balance.vehicles) × fallRiskMultiplier
   *   (taxa "como se a viagem inteira fosse assim"; pondere pelo comprimento — ver tripFallRisk);
   * - elemento radical: chance por travessia (balance.radical.<id>.fallRisk);
   * - Elevador de Bolha: balance.radical.elevador_bolha.fallRisk.
   * 0 se o veículo não pode usar a aresta.
   */
  fallRisk(edgeIndex: number, v: VehicleProfile): number {
    const e = this.edge(edgeIndex);
    if (this.crossingBlockReason(edgeIndex, v) !== null) return 0;
    switch (e.link) {
      case 'radical':
        return this.params.radical[e.radical!].fallRisk;
      case 'lift':
        return this.params.liftFallRisk;
      default:
        return (this.params.vehicleFallRisk[v.kind] ?? 0) * this.fallRiskMultiplier(edgeIndex, v);
    }
  }

  /**
   * Chance de queda de uma viagem inteira: risco base do veículo × média dos multiplicadores ponderada
   * pelo comprimento das vias/passarelas, + soma dos riscos fixos das travessias radicais e do elevador.
   */
  tripFallRisk(edges: readonly number[], v: VehicleProfile): number {
    let fixed = 0;
    let weighted = 0;
    let length = 0;
    for (const ei of edges) {
      const e = this.edge(ei);
      if (e.link === 'radical' || e.link === 'lift') {
        fixed += this.fallRisk(ei, v);
      } else {
        weighted += this.fallRiskMultiplier(ei, v) * e.lengthM;
        length += e.lengthM;
      }
    }
    const base = this.params.vehicleFallRisk[v.kind] ?? 0;
    return (length > 0 ? base * (weighted / length) : 0) + fixed;
  }

  /** Maior razão fluxo/capacidade entre as faixas (ou da ligação), para o overlay de congestionamento. */
  saturation(edgeIndex: number): number {
    const e = this.edge(edgeIndex);
    if (e.link !== 'road') return e.linkFlowVph / this.params.linkCapacityVph[e.link];
    let max = 0;
    for (const lane of LANE_KINDS) {
      const cap = this.laneCapacityVph(edgeIndex, lane);
      if (cap > 0) max = Math.max(max, e.flowVph[lane] / cap);
    }
    return max;
  }

  resetFlows(): void {
    for (const e of this.edges) {
      e.flowVph = zeroLanes();
      e.linkFlowVph = 0;
    }
  }

  private timeWithFlow(edgeIndex: number, v: VehicleProfile, withFlow: boolean): number {
    const e = this.edge(edgeIndex);
    const p = this.params;
    const minutes = (meters: number, mps: number) => meters / mps / 60;
    const flowOf = (f: number) => (withFlow ? f : 0);
    const link = (t0: number) => bpr(t0, flowOf(e.linkFlowVph), this.linkCapacityVph(edgeIndex), p.bprAlpha, p.bprBeta);

    if (this.crossingBlockReason(edgeIndex, v) !== null) return Infinity;
    switch (e.link) {
      case 'road': {
        const use = this.laneFor(edgeIndex, v);
        if (!use) return Infinity;
        let speed = Math.min(v.speedMps, LANE_MAX_SPEED_MPS[use.lane], e.speedLimitMps);
        if (use.fallback) speed *= p.fallbackSpeedFactor;
        const cap = this.laneCapacityVph(edgeIndex, use.lane);
        return bpr(minutes(e.lengthM, speed), flowOf(e.flowVph[use.lane]), cap, p.bprAlpha, p.bprBeta);
      }
      case 'radical':
        return link(p.radical[e.radical!].crossSeconds / 60);
      case 'lift':
        // Fila: tempo fixo da cápsula + BPR com a capacidade do elevador.
        return link(p.liftCrossSeconds / 60);
      case 'walkway': {
        let speed = Math.min(v.speedMps, LANE_MAX_SPEED_MPS.sidewalk);
        if (v.lane !== 'sidewalk') speed *= p.fallbackSpeedFactor; // rodinhas dividem a passarela com pedestres
        return link(minutes(e.lengthM, speed));
      }
      case 'transit_only':
        return link(minutes(e.lengthM, Math.min(v.speedMps, LANE_MAX_SPEED_MPS.transit)));
    }
  }

  private addEdge(e: Omit<DirectedEdge, 'index' | 'lengthM' | 'flowVph' | 'linkFlowVph'>): number {
    const index = this.edges.length;
    this.edges.push({
      ...e,
      lanes: { ...e.lanes },
      index,
      lengthM: this.distanceM(e.from, e.to),
      flowVph: zeroLanes(),
      linkFlowVph: 0,
    });
    this.out[e.from]!.push(index);
    return index;
  }
}

function normalizeLanes(l: LaneCounts): Record<LaneKind, number> {
  return { sidewalk: l.sidewalk ?? 0, slow: l.slow ?? 0, fast: l.fast ?? 0, transit: l.transit ?? 0 };
}

/** Função BPR: t = t0 · (1 + α · (v/c)^β). Padrão: α e β de balance.congestion. */
export function bpr(
  t0: number,
  flow: number,
  capacity: number,
  alpha = DEFAULT_TRAFFIC.bprAlpha,
  beta = DEFAULT_TRAFFIC.bprBeta,
): number {
  if (capacity <= 0) return Number.POSITIVE_INFINITY;
  return t0 * (1 + alpha * Math.pow(flow / capacity, beta));
}

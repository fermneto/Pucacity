/**
 * Eventos, dilemas e paciência por grupo (SPEC §2.2).
 *
 * - Eventos vêm de config/balance.json → events (+ ids em scenario.events). Os que não têm `day`
 *   são sorteados com seed (mesmo cenário diário para todos).
 * - Efeitos são DECLARATIVOS: o motor só diz o que está ativo (`activeEffects()`); o jogo repassa
 *   ligações fechadas ao pathfinding (`blockedEdges`), viagens extras aos agentes, multiplicadores etc.
 * - Dilemas: estrutura com opções e custo; o conteúdo (textos) vem do PC2.
 * - Tempo: minutos absolutos desde o dia 1 às 00:00 (`toMinute(dia, hora)`). Dias começam em 1.
 */
import balance from '../../config/balance.json';
import type { LinkKind } from './RoadGraph';
import { Rng } from './Rng';
import type { AccessKind, CityFile, RadicalKind, Scenario } from './types';

export const MINUTES_PER_DAY = 1440;

export const toMinute = (day: number, hour = 0): number => (day - 1) * MINUTES_PER_DAY + hour * 60;
export const dayOf = (minute: number): number => Math.floor(minute / MINUTES_PER_DAY) + 1;

// ---------------------------------------------------------------------------
// Definições (formato do balance.json)
// ---------------------------------------------------------------------------

/** Evento como está em balance.json → events. Todos os campos são opcionais. */
export interface RawEventDef {
  scenario?: string;
  day?: number;
  startHour?: number;
  endHour?: number;
  durationHours?: number;
  durationDays?: number;
  warningHoursBefore?: number;
  extraTrips?: number;
  closes?: string[];
  slipperyFallMultiplier?: number;
  floodedLaneShare?: number;
  affectedShare?: number;
  heatBonus?: number;
  flowPenalty?: number;
  lineShutdown?: string;
  populationGrowth?: number;
  fail?: { occupationOver: number; forMinutes: number; satisfactionPenalty?: number; extraFalls?: number };
  [extra: string]: unknown;
}

/** Efeitos agregados dos eventos ativos. Valores neutros quando nada está ativo. */
export interface EventEffects {
  /** Ids de elementos (balance.radical / Arte) fechados: 'loop_aereo', 'elevador_bolha'… */
  closes: string[];
  /** Viagens extras no período do evento (total). */
  extraTrips: number;
  fallRiskMultiplier: number;
  /** Multiplicador de fluxo/velocidade (1 − flowPenalty). */
  flowMultiplier: number;
  floodedLaneShare: number;
  /** Fração da rede sem energia (apagão). */
  powerOutageShare: number;
  heatBonus: number;
  /** Crescimento de população (evento instantâneo; o jogo aplica uma vez no início). */
  populationGrowth: number;
  /** Linhas paradas: 'principais', ids de linha… */
  lineShutdown: string[];
}

export const NO_EFFECTS: EventEffects = {
  closes: [],
  extraTrips: 0,
  fallRiskMultiplier: 1,
  flowMultiplier: 1,
  floodedLaneShare: 0,
  powerOutageShare: 0,
  heatBonus: 0,
  populationGrowth: 0,
  lineShutdown: [],
};

function effectsOf(d: RawEventDef): EventEffects {
  return {
    closes: [...(d.closes ?? [])],
    extraTrips: d.extraTrips ?? 0,
    fallRiskMultiplier: d.slipperyFallMultiplier ?? 1,
    flowMultiplier: 1 - (d.flowPenalty ?? 0),
    floodedLaneShare: d.floodedLaneShare ?? 0,
    powerOutageShare: d.affectedShare ?? 0,
    heatBonus: d.heatBonus ?? 0,
    populationGrowth: d.populationGrowth ?? 0,
    lineShutdown: d.lineShutdown ? [d.lineShutdown] : [],
  };
}

export function combineEffects(list: readonly EventEffects[]): EventEffects {
  const uniq = (xs: string[]) => [...new Set(xs)].sort();
  return list.reduce<EventEffects>(
    (a, e) => ({
      closes: uniq([...a.closes, ...e.closes]),
      extraTrips: a.extraTrips + e.extraTrips,
      fallRiskMultiplier: a.fallRiskMultiplier * e.fallRiskMultiplier,
      flowMultiplier: a.flowMultiplier * e.flowMultiplier,
      floodedLaneShare: Math.max(a.floodedLaneShare, e.floodedLaneShare),
      powerOutageShare: Math.max(a.powerOutageShare, e.powerOutageShare),
      heatBonus: a.heatBonus + e.heatBonus,
      populationGrowth: a.populationGrowth + e.populationGrowth,
      lineShutdown: uniq([...a.lineShutdown, ...e.lineShutdown]),
    }),
    { ...NO_EFFECTS, closes: [], lineShutdown: [] },
  );
}

// ---------------------------------------------------------------------------
// Ligações fechadas → pathfinding
// ---------------------------------------------------------------------------

/** Ids da Arte/balance → elemento radical do city.json. */
const RADICAL_BY_ID: Record<string, RadicalKind> = {
  rampa_ponte: 'ramp_bridge',
  loop_aereo: 'air_loop',
  salto_mortal: 'death_jump',
  rail_passarela: 'rail_walkway',
};
/** Ids da Arte/balance → rota acessível do city.json. */
const ACCESS_BY_ID: Record<string, AccessKind> = {
  elevador_bolha: 'bubble_lift',
  passarela_vidro: 'glass_walkway',
  tuktuk: 'transit_only',
};
const ACCESS_LINK: Record<AccessKind, LinkKind> = {
  bubble_lift: 'lift',
  glass_walkway: 'walkway',
  transit_only: 'transit_only',
};

export interface ClosedLink {
  crossingId: number;
  link: Exclude<LinkKind, 'road'>;
}

/** Quais metades de travessia ficam fechadas para os ids de `closes`. */
export function closedLinks(city: CityFile, closes: readonly string[]): ClosedLink[] {
  const out: ClosedLink[] = [];
  for (const c of [...city.crossings].sort((a, b) => a.id - b.id)) {
    for (const id of closes) {
      if (RADICAL_BY_ID[id] === c.radical) out.push({ crossingId: c.id, link: 'radical' });
      const acc = ACCESS_BY_ID[id];
      if (acc && acc === c.access) out.push({ crossingId: c.id, link: ACCESS_LINK[acc] as ClosedLink['link'] });
    }
  }
  return out;
}

/** Índices de arestas dirigidas (RoadGraph) para `findPath(..., { blocked })`. */
export function blockedEdges(
  graph: { readonly edges: readonly { index: number; link: LinkKind; sourceId: number }[] },
  closed: readonly ClosedLink[],
): Set<number> {
  const key = new Set(closed.map((c) => `${c.link}:${c.crossingId}`));
  return new Set(graph.edges.filter((e) => e.link !== 'road' && key.has(`${e.link}:${e.sourceId}`)).map((e) => e.index));
}

// ---------------------------------------------------------------------------
// Dilemas (conteúdo do PC2)
// ---------------------------------------------------------------------------

export interface DilemmaOption {
  id: string;
  label: string;
  /** Custo em dinheiro (o jogo cobra via CommandStack.spend). */
  cost: number;
  /** Variação de paciência por grupo (ex.: { comerciante: -10 }). */
  patience?: Record<string, number>;
  /** Efeitos livres para o jogo interpretar (desbloqueios, comandos, flags). */
  effects?: Record<string, unknown>;
}

export interface DilemmaDef {
  id: string;
  /** Dia em que aparece; sem dia, é sorteado como os eventos. */
  day?: number;
  hour?: number;
  title: string;
  text: string;
  options: DilemmaOption[];
  /** Opção aplicada se o prazo vencer ("não decidir"). */
  defaultOption: string;
  /** Prazo para escolher, em horas de jogo. Sem prazo = espera o jogador. */
  deadlineHours?: number;
}

// ---------------------------------------------------------------------------
// Motor
// ---------------------------------------------------------------------------

export interface PatienceCfg {
  start: number;
  dropPerBadDay: number;
  protestThreshold: number;
  /** Recuperação por dia bom. PROVISÓRIO: não existe no balance.json (padrão 0). */
  risePerGoodDay?: number;
}

export type EventStatus = 'scheduled' | 'warned' | 'active' | 'ended';

export interface ScheduledEvent {
  id: string;
  startMin: number;
  /** Igual a startMin para eventos instantâneos (ex.: bairro_novo). */
  endMin: number;
  warnMin: number;
  status: EventStatus;
  effects: EventEffects;
  fail?: RawEventDef['fail'];
  /** Desde quando a ocupação está acima do limite de falha (null = abaixo). */
  overSinceMin: number | null;
  outcome: 'pending' | 'survived' | 'failed';
}

export interface ScheduledDilemma {
  def: DilemmaDef;
  openMin: number;
  deadlineMin: number | null;
  status: 'scheduled' | 'open' | 'resolved';
  choice: string | null;
}

export type EventNotice =
  | { kind: 'warning'; eventId: string; startsAtMin: number }
  | { kind: 'start'; eventId: string; effects: EventEffects; instant: boolean }
  | { kind: 'end'; eventId: string; outcome: ScheduledEvent['outcome'] }
  | { kind: 'failed'; eventId: string; satisfactionPenalty: number; extraFalls: number }
  | { kind: 'dilemma'; dilemmaId: string }
  | { kind: 'dilemmaResolved'; dilemmaId: string; option: DilemmaOption; byTimeout: boolean }
  | { kind: 'protest'; group: string };

export interface EventEngineState {
  nowMin: number;
  events: ScheduledEvent[];
  dilemmas: ScheduledDilemma[];
  patience: Record<string, number>;
  patienceCfg: PatienceCfg;
  /** Ids de evento/dilema pedidos mas sem definição (para o Design corrigir). */
  missing: string[];
}

export interface EventEngineOptions {
  seed: number;
  /** Cenário do city.json (events/dilemmas/durationDays/id). */
  scenario?: Scenario;
  /** Duração (dias) para sortear eventos; padrão scenario.durationDays ou 14. */
  durationDays?: number;
  /** Catálogo de eventos; padrão balance.events. */
  catalog?: Record<string, RawEventDef>;
  /** Catálogo de dilemas (conteúdo do PC2). */
  dilemmaCatalog?: Record<string, DilemmaDef>;
  /** Ids de dilemas além de scenario.dilemmas. */
  dilemmaIds?: string[];
  /** Grupos com barra de paciência; padrão balance.citizens.groups. */
  groups?: string[];
  patience?: PatienceCfg;
  /** Primeiro dia possível para eventos sorteados (dias 1–3 do tutorial são calmos). Padrão 4. */
  firstRandomDay?: number;
  /** Hora de início sorteada entre [min, max]. Padrão [6, 18]. */
  randomHours?: [number, number];
}

const BALANCE_EVENTS = balance.events as unknown as Record<string, RawEventDef>;

export class EventEngine {
  private constructor(private s: EventEngineState) {}

  static create(opts: EventEngineOptions): EventEngine {
    const catalog = opts.catalog ?? BALANCE_EVENTS;
    const sc = opts.scenario;
    const durationDays = opts.durationDays ?? sc?.durationDays ?? 14;
    const firstDay = Math.min(opts.firstRandomDay ?? 4, durationDays);
    const [h0, h1] = opts.randomHours ?? [6, 18];
    const rng = new Rng(opts.seed);
    const missing: string[] = [];

    // Eventos do cenário: os listados em scenario.events + os do catálogo marcados com scenario = id.
    const ids = new Set(sc?.events ?? []);
    if (sc?.id) for (const [id, d] of Object.entries(catalog)) if (d.scenario === sc.id) ids.add(id);

    const events: ScheduledEvent[] = [];
    for (const id of [...ids].sort()) {
      const d = catalog[id];
      if (!d) {
        missing.push(`evento:${id}`);
        continue;
      }
      // Sorteia sempre (mesmo com dia fixo) para a sequência não depender de quais eventos têm dia.
      const rDay = rng.int(firstDay, durationDays);
      const rHour = rng.int(h0, h1);
      const startMin = toMinute(d.day ?? rDay, d.startHour ?? rHour);
      let durMin = 0;
      if (d.endHour !== undefined && d.startHour !== undefined) durMin = (d.endHour - d.startHour) * 60;
      else if (d.durationHours !== undefined) durMin = d.durationHours * 60;
      else if (d.durationDays !== undefined) durMin = d.durationDays * MINUTES_PER_DAY;
      events.push({
        id,
        startMin,
        endMin: startMin + Math.max(0, durMin),
        warnMin: startMin - (d.warningHoursBefore ?? 0) * 60,
        status: 'scheduled',
        effects: effectsOf(d),
        ...(d.fail ? { fail: { ...d.fail } } : {}),
        overSinceMin: null,
        outcome: 'pending',
      });
    }
    events.sort((a, b) => a.startMin - b.startMin || a.id.localeCompare(b.id));

    const dilemmas: ScheduledDilemma[] = [];
    const dIds = [...new Set([...(sc?.dilemmas ?? []), ...(opts.dilemmaIds ?? [])])].sort();
    for (const id of dIds) {
      const def = opts.dilemmaCatalog?.[id];
      if (!def) {
        missing.push(`dilema:${id}`);
        continue;
      }
      if (!def.options.some((o) => o.id === def.defaultOption)) {
        throw new Error(`dilema ${id}: defaultOption '${def.defaultOption}' não está nas opções`);
      }
      const rDay = rng.int(firstDay, durationDays);
      const openMin = toMinute(def.day ?? rDay, def.hour ?? 9);
      dilemmas.push({
        def: structuredClone(def),
        openMin,
        deadlineMin: def.deadlineHours !== undefined ? openMin + def.deadlineHours * 60 : null,
        status: 'scheduled',
        choice: null,
      });
    }
    dilemmas.sort((a, b) => a.openMin - b.openMin || a.def.id.localeCompare(b.def.id));

    const patienceCfg = opts.patience ?? balance.citizens.patience;
    const groups = opts.groups ?? Object.keys(balance.citizens.groups);
    const patience: Record<string, number> = {};
    for (const g of [...groups].sort()) patience[g] = patienceCfg.start;

    return new EventEngine({ nowMin: 0, events, dilemmas, patience, patienceCfg: { ...patienceCfg }, missing });
  }

  static deserialize(state: EventEngineState): EventEngine {
    return new EventEngine(structuredClone(state));
  }

  serialize(): EventEngineState {
    return structuredClone(this.s);
  }

  get nowMin(): number {
    return this.s.nowMin;
  }

  get schedule(): readonly ScheduledEvent[] {
    return this.s.events;
  }

  get missing(): readonly string[] {
    return this.s.missing;
  }

  /**
   * Avança o relógio até `nowMin` e devolve os avisos na ordem (aviso → início → fim; dilemas).
   * Pode pular vários estágios numa chamada (velocidade alta).
   */
  update(nowMin: number): EventNotice[] {
    const out: EventNotice[] = [];
    this.s.nowMin = Math.max(this.s.nowMin, nowMin);
    const t = this.s.nowMin;
    for (const e of this.s.events) {
      if (e.status === 'scheduled' && t >= e.warnMin && e.warnMin < e.startMin) {
        e.status = 'warned';
        out.push({ kind: 'warning', eventId: e.id, startsAtMin: e.startMin });
      }
      if ((e.status === 'scheduled' || e.status === 'warned') && t >= e.startMin) {
        const instant = e.endMin <= e.startMin;
        e.status = 'active';
        out.push({ kind: 'start', eventId: e.id, effects: structuredClone(e.effects), instant });
      }
      if (e.status === 'active' && t >= e.endMin) {
        e.status = 'ended';
        if (e.outcome === 'pending') e.outcome = 'survived';
        out.push({ kind: 'end', eventId: e.id, outcome: e.outcome });
      }
    }
    for (const d of this.s.dilemmas) {
      if (d.status === 'scheduled' && t >= d.openMin) {
        d.status = 'open';
        out.push({ kind: 'dilemma', dilemmaId: d.def.id });
      }
      if (d.status === 'open' && d.deadlineMin !== null && t >= d.deadlineMin) {
        out.push(this.resolve(d, d.def.defaultOption, true));
      }
    }
    return out;
  }

  /** Eventos ativos agora (não inclui instantâneos já encerrados). */
  active(): ScheduledEvent[] {
    return this.s.events.filter((e) => e.status === 'active');
  }

  /** Eventos avisados que ainda não começaram (contador regressivo na UI). */
  upcoming(): ScheduledEvent[] {
    return this.s.events.filter((e) => e.status === 'warned');
  }

  activeEffects(): EventEffects {
    return combineEffects(this.active().map((e) => e.effects));
  }

  /**
   * Informa a ocupação (fluxo/capacidade) do ponto crítico durante um evento com condição de falha
   * (ex.: campeonato: > 150% por 30 min = "multidão parada"). Devolve o aviso de falha, se ocorrer.
   */
  reportOccupation(eventId: string, occupation: number, nowMin = this.s.nowMin): EventNotice | null {
    const e = this.s.events.find((x) => x.id === eventId);
    if (!e || !e.fail || e.status !== 'active' || e.outcome !== 'pending') return null;
    if (occupation <= e.fail.occupationOver) {
      e.overSinceMin = null;
      return null;
    }
    e.overSinceMin ??= nowMin;
    if (nowMin - e.overSinceMin < e.fail.forMinutes) return null;
    e.outcome = 'failed';
    const penalty = e.fail.satisfactionPenalty ?? 0;
    for (const g of Object.keys(this.s.patience)) this.adjustPatience(g, -penalty);
    return { kind: 'failed', eventId, satisfactionPenalty: penalty, extraFalls: e.fail.extraFalls ?? 0 };
  }

  outcome(eventId: string): ScheduledEvent['outcome'] | null {
    return this.s.events.find((e) => e.id === eventId)?.outcome ?? null;
  }

  // --- dilemas ---

  openDilemmas(): DilemmaDef[] {
    return this.s.dilemmas.filter((d) => d.status === 'open').map((d) => d.def);
  }

  dilemmaChoice(id: string): string | null {
    return this.s.dilemmas.find((d) => d.def.id === id)?.choice ?? null;
  }

  /** O jogador escolhe uma opção. Devolve o aviso (com a opção, para o jogo cobrar o custo e aplicar efeitos). */
  choose(dilemmaId: string, optionId: string): EventNotice {
    const d = this.s.dilemmas.find((x) => x.def.id === dilemmaId);
    if (!d) throw new Error(`dilema ${dilemmaId} não existe`);
    if (d.status !== 'open') throw new Error(`dilema ${dilemmaId} não está aberto`);
    return this.resolve(d, optionId, false);
  }

  // --- paciência ---

  get patience(): Readonly<Record<string, number>> {
    return this.s.patience;
  }

  /** Média da paciência (0–100), usada como satisfação geral nos KPIs. */
  satisfaction(): number | null {
    const v = Object.values(this.s.patience);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  adjustPatience(group: string, delta: number): EventNotice | null {
    const before = this.s.patience[group];
    if (before === undefined) return null;
    const after = Math.min(100, Math.max(0, before + delta));
    this.s.patience[group] = after;
    const th = this.s.patienceCfg.protestThreshold;
    return before > th && after <= th ? { kind: 'protest', group } : null;
  }

  /** Fim do dia: grupos em `badGroups` perdem dropPerBadDay; os outros recuperam risePerGoodDay. */
  endOfDay(badGroups: readonly string[]): EventNotice[] {
    const cfg = this.s.patienceCfg;
    const bad = new Set(badGroups);
    const out: EventNotice[] = [];
    for (const g of Object.keys(this.s.patience)) {
      const n = this.adjustPatience(g, bad.has(g) ? -cfg.dropPerBadDay : (cfg.risePerGoodDay ?? 0));
      if (n) out.push(n);
    }
    return out;
  }

  /** Grupos em protesto (paciência ≤ limiar). */
  protesting(): string[] {
    const th = this.s.patienceCfg.protestThreshold;
    return Object.keys(this.s.patience).filter((g) => (this.s.patience[g] ?? 0) <= th);
  }

  private resolve(d: ScheduledDilemma, optionId: string, byTimeout: boolean): EventNotice {
    const option = d.def.options.find((o) => o.id === optionId);
    if (!option) throw new Error(`dilema ${d.def.id}: opção ${optionId} não existe`);
    d.status = 'resolved';
    d.choice = optionId;
    for (const [g, delta] of Object.entries(option.patience ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      this.adjustPatience(g, delta);
    }
    return { kind: 'dilemmaResolved', dilemmaId: d.def.id, option: structuredClone(option), byTimeout };
  }
}

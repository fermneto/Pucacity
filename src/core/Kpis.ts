/**
 * KPIs dos 8 problemas (SPEC §2, docs/design/problemas.md), metas do cenário e estrelas.
 *
 * Lê as estatísticas da simulação pela interface `KpiInput` (sem importar Simulation.ts) e o estado
 * da cidade. KPIs que dependem de sistemas que ainda não existem ficam `null`:
 * - energyKwh (P3, energia/bateria), fallsPer1000Trips (P2, quedas), noiseIndex (P4, ruído/calor);
 * - satisfaction só existe se o jogo informar (média da paciência dos grupos, Events.ts).
 */
import balance from '../../config/balance.json';
import { crossingsWithoutAccess } from './Crossings';
import type { DirectedEdge } from './RoadGraph';
import type { CityFile, Goal, Income, KpiId, VehicleKind } from './types';
import { INCOMES } from './types';

// espelha SimStats de Simulation.ts
export interface KpiInput {
  tripsStarted: number;
  tripsCompleted: number;
  tripsFailed: number;
  tripMinutesTotal: number;
  modeTrips: Partial<Record<VehicleKind, number>>;
  tripsByDistrict: Record<number, { completed: number; minutesTotal: number; failed: number }>;
  wheelchairTrips: { completed: number; failed: number };
  radicalCrossings: number;
}

/** O que os KPIs usam do grafo (RoadGraph serve). */
export interface KpiGraph {
  readonly edges: readonly DirectedEdge[];
  saturation(edgeIndex: number): number;
}

export interface KpiContext {
  city: CityFile;
  /** Sem grafo, congestionPct fica null. */
  graph?: KpiGraph;
  /** Saldo atual (CommandStack.money). */
  money?: number;
  /** Satisfação 0–100 (ex.: EventEngine.satisfaction()). */
  satisfaction?: number;
  /** Padrão: balance.congestion.saturatedThreshold. */
  saturatedThreshold?: number;
}

export interface KpiReport {
  /** P1 — minutos por viagem concluída. */
  avgTripMinutes: number | null;
  /** P1 — % das vias (arestas dirigidas de rua) com saturação ≥ limiar. */
  congestionPct: number | null;
  /** Divisão modal: fração (0–1) das viagens por veículo. */
  modalSplit: Partial<Record<VehicleKind, number>>;
  /**
   * P6 — % (0–100): menor taxa de chegada entre todos e cadeirantes × fração de travessias com rota acessível.
   * Uma travessia sem rota acessível derruba o KPI mesmo se ninguém tentou cruzá-la (regra "ninguém fica preso").
   */
  accessibilityPct: number | null;
  /** % de viagens concluídas (todos). */
  completionPct: number | null;
  /** % de viagens de cadeirantes concluídas. */
  wheelchairCompletionPct: number | null;
  /** Ids das travessias sem rota acessível (overlay A). */
  crossingsWithoutAccess: number[];
  /** P5 — tempo médio do bairro mais pobre − do mais rico (minutos; positivo = pobre leva mais). */
  equityGapMinutes: number | null;
  /** P8 — travessias radicais por 100 viagens concluídas (limitado a 100). */
  radicalityPct: number | null;
  /** Saldo do orçamento. */
  balance: number | null;
  /** 0–100. */
  satisfaction: number | null;
  /** P3 — ainda sem sistema de energia. */
  energyKwh: null;
  /** P2 — ainda sem sistema de quedas. */
  fallsPer1000Trips: null;
  /** P4 — ainda sem sistema de ruído/calor. */
  noiseIndex: null;
  tripsCompleted: number;
  tripsFailed: number;
}

const pct = (part: number, total: number): number | null => (total > 0 ? (100 * part) / total : null);

export function computeKpis(stats: KpiInput, ctx: KpiContext): KpiReport {
  const { city } = ctx;
  const finished = stats.tripsCompleted + stats.tripsFailed;

  // Divisão modal
  const modeTotal = Object.values(stats.modeTrips).reduce((s, n) => s + (n ?? 0), 0);
  const modalSplit: Partial<Record<VehicleKind, number>> = {};
  if (modeTotal > 0) {
    for (const [k, n] of Object.entries(stats.modeTrips).sort(([a], [b]) => a.localeCompare(b))) {
      if (n) modalSplit[k as VehicleKind] = n / modeTotal;
    }
  }

  // Congestionamento
  let congestionPct: number | null = null;
  if (ctx.graph) {
    const threshold = ctx.saturatedThreshold ?? balance.congestion.saturatedThreshold;
    let roads = 0;
    let saturated = 0;
    for (const e of ctx.graph.edges) {
      if (e.link !== 'road') continue;
      roads++;
      if (ctx.graph.saturation(e.index) >= threshold) saturated++;
    }
    congestionPct = pct(saturated, roads) ?? 0;
  }

  // Acessibilidade
  const missing = crossingsWithoutAccess(city);
  const accessibleShare = city.crossings.length > 0 ? 1 - missing.length / city.crossings.length : 1;
  const completionPct = pct(stats.tripsCompleted, finished);
  const wc = stats.wheelchairTrips;
  const wheelchairCompletionPct = pct(wc.completed, wc.completed + wc.failed);
  const rates = [completionPct, wheelchairCompletionPct].filter((v): v is number => v !== null);
  const accessibilityPct = rates.length > 0 ? Math.min(...rates) * accessibleShare : null;

  return {
    avgTripMinutes: stats.tripsCompleted > 0 ? stats.tripMinutesTotal / stats.tripsCompleted : null,
    congestionPct,
    modalSplit,
    accessibilityPct,
    completionPct,
    wheelchairCompletionPct,
    crossingsWithoutAccess: missing,
    equityGapMinutes: equityGap(stats, city),
    radicalityPct: stats.tripsCompleted > 0 ? Math.min(100, (100 * stats.radicalCrossings) / stats.tripsCompleted) : null,
    balance: ctx.money ?? null,
    satisfaction: ctx.satisfaction ?? null,
    energyKwh: null,
    fallsPer1000Trips: null,
    noiseIndex: null,
    tripsCompleted: stats.tripsCompleted,
    tripsFailed: stats.tripsFailed,
  };
}

/** Tempo médio por renda; compara a renda mais baixa com a mais alta que tenham viagens. */
function equityGap(stats: KpiInput, city: CityFile): number | null {
  const byIncome = new Map<Income, { minutes: number; trips: number }>();
  for (const d of city.districts) {
    const t = stats.tripsByDistrict[d.id];
    if (!t || t.completed <= 0) continue;
    const acc = byIncome.get(d.income) ?? { minutes: 0, trips: 0 };
    acc.minutes += t.minutesTotal;
    acc.trips += t.completed;
    byIncome.set(d.income, acc);
  }
  const present = INCOMES.filter((i) => byIncome.has(i));
  if (present.length < 2) return present.length === 1 ? 0 : null;
  const avg = (i: Income) => {
    const a = byIncome.get(i)!;
    return a.minutes / a.trips;
  };
  return avg(present[0]!) - avg(present[present.length - 1]!);
}

// ---------------------------------------------------------------------------
// Metas e estrelas
// ---------------------------------------------------------------------------

/** KPIs que podem virar meta: os do contrato + quedas (P2, ainda null). */
export type GoalKpi = KpiId | 'fallsPer1000Trips';

/**
 * Operadores de meta:
 * - `<=` / `>=`: valor absoluto;
 * - `delta<=` / `delta>=`: variação RELATIVA à linha de base, (atual − base) / |base|
 *   (ex.: tempo −20% → `{ op: 'delta<=', value: -0.2 }`; "não aumenta" → `delta<= 0`).
 *   Se a base for 0, usa a diferença absoluta.
 */
export type GoalOp = Goal['op'] | 'delta<=' | 'delta>=';

/** Extensão de `Goal` (types.ts) com metas relativas. Mudança de contrato proposta: ver relatório. */
export interface GoalSpec {
  id?: string;
  label?: string;
  kpi: GoalKpi;
  op: GoalOp;
  value: number;
  stars: 1 | 2 | 3;
}

export interface GoalResult {
  goal: GoalSpec;
  current: number | null;
  baseline: number | null;
  /** Valor comparado com goal.value (absoluto ou delta). */
  measured: number | null;
  /** null = não dá para medir ainda (KPI null ou sem linha de base). */
  met: boolean | null;
}

export function kpiValue(r: KpiReport, kpi: GoalKpi): number | null {
  return r[kpi];
}

export function evaluateGoals(
  goals: readonly (GoalSpec | Goal)[],
  current: KpiReport,
  baseline?: KpiReport,
): GoalResult[] {
  return goals.map((goal) => {
    const cur = kpiValue(current, goal.kpi);
    const base = baseline ? kpiValue(baseline, goal.kpi) : null;
    let measured: number | null = null;
    if (cur !== null) {
      if (goal.op === '<=' || goal.op === '>=') measured = cur;
      else if (base !== null) measured = base === 0 ? cur - base : (cur - base) / Math.abs(base);
    }
    const EPS = 1e-9;
    let met: boolean | null = null;
    if (measured !== null) met = goal.op.endsWith('<=') ? measured <= goal.value + EPS : measured >= goal.value - EPS;
    return { goal, current: cur, baseline: base, measured, met };
  });
}

/**
 * Estrelas (problemas.md §5): nível N conquistado se todas as metas com `stars ≤ N` forem cumpridas.
 * Metas que ainda não dá para medir (met = null) não bloqueiam, exceto se TODAS as de nível 1 forem null.
 */
export function starsFor(results: readonly GoalResult[]): 0 | 1 | 2 | 3 {
  const level1 = results.filter((r) => r.goal.stars === 1);
  if (level1.length === 0 || level1.every((r) => r.met === null)) return 0;
  let stars: 0 | 1 | 2 | 3 = 0;
  for (const n of [1, 2, 3] as const) {
    if (results.some((r) => r.goal.stars <= n && r.met === false)) break;
    stars = n;
  }
  return stars;
}

// ---------------------------------------------------------------------------
// Metas no formato do balance.json (scenarios.<id>.goals)
// ---------------------------------------------------------------------------

/** Métricas do balance.json → KPI. */
const METRIC_KPI: Record<string, GoalKpi> = {
  tempoMedioViagem: 'avgTripMinutes',
  acessibilidade: 'accessibilityPct',
  quedasPor1000Viagens: 'fallsPer1000Trips',
  saldo: 'balance',
  saldoOrcamento: 'balance',
  satisfacao: 'satisfaction',
  radicalidade: 'radicalityPct',
  congestionamento: 'congestionPct',
  equidade: 'equityGapMinutes',
};

/** KPIs em % (0–100) recebem `min`/`max` do balance como fração (0–1). */
const PCT_KPIS = new Set<GoalKpi>(['accessibilityPct', 'radicalityPct', 'congestionPct', 'satisfaction']);

type RawMetricRule = number | string | { min?: number; max?: number; improvement?: number };
interface RawGoal {
  metric?: string;
  metrics?: Record<string, RawMetricRule>;
  improvement?: number;
  min?: number;
  max?: number;
}

/**
 * Converte `scenarios.<id>.goals` do balance.json em GoalSpec: `principal` = 1 estrela, `equilibrio*` = 2.
 * Regras: improvement → delta (tempo/quedas/congestionamento caem; o resto sobe); min/max → absoluto;
 * "naoAumenta" → delta<= 0. `threeStars` vira satisfação ≥ (PROVISÓRIO: média geral, não por personagem).
 */
export function goalsFromBalance(scenarioId: string, b: unknown = balance): GoalSpec[] {
  const sc = (b as { scenarios?: Record<string, { goals?: Record<string, RawGoal>; threeStars?: Record<string, number> }> })
    .scenarios?.[scenarioId];
  if (!sc) throw new Error(`balance.json: cenário '${scenarioId}' não existe`);
  const out: GoalSpec[] = [];
  const lowerIsBetter = new Set<GoalKpi>(['avgTripMinutes', 'fallsPer1000Trips', 'congestionPct', 'equityGapMinutes']);

  const add = (id: string, metric: string, rule: RawMetricRule, stars: 1 | 2 | 3) => {
    const kpi = METRIC_KPI[metric];
    if (!kpi) throw new Error(`balance.json: métrica desconhecida '${metric}' em ${scenarioId}.${id}`);
    const scale = PCT_KPIS.has(kpi) ? 100 : 1;
    const base = { id: `${id}.${metric}`, kpi, stars };
    if (rule === 'naoAumenta') out.push({ ...base, op: 'delta<=', value: 0 });
    else if (rule === 'naoDiminui') out.push({ ...base, op: 'delta>=', value: 0 });
    else if (typeof rule === 'object') {
      if (rule.improvement !== undefined) {
        out.push(
          lowerIsBetter.has(kpi)
            ? { ...base, op: 'delta<=', value: -rule.improvement }
            : { ...base, op: 'delta>=', value: rule.improvement },
        );
      }
      if (rule.min !== undefined) out.push({ ...base, op: '>=', value: rule.min * scale });
      if (rule.max !== undefined) out.push({ ...base, op: '<=', value: rule.max * scale });
    } else {
      throw new Error(`balance.json: regra inválida para '${metric}' em ${scenarioId}.${id}`);
    }
  };

  for (const [id, g] of Object.entries(sc.goals ?? {})) {
    const stars = id === 'principal' ? 1 : 2;
    if (g.metric) add(id, g.metric, { improvement: g.improvement, min: g.min, max: g.max }, stars);
    for (const [metric, rule] of Object.entries(g.metrics ?? {})) add(id, metric, rule, stars);
  }
  for (const [key, v] of Object.entries(sc.threeStars ?? {})) {
    if (key.startsWith('satisfacao')) out.push({ id: `threeStars.${key}`, kpi: 'satisfaction', op: '>=', value: v * 100, stars: 3 });
  }
  return out;
}

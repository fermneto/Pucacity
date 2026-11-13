/**
 * Ferramentas do jogador como Commands (SPEC §4.7): custo, prazo de obra, validação, pré-visualização,
 * apply/revert e pilhas de undo/redo com orçamento.
 *
 * Os comandos operam sobre DADOS PUROS (CityFile + linhas de coletivo) e devolvem um estado NOVO
 * (a cidade antiga nunca é alterada; só os objetos mexidos são copiados). O jogo repassa o resultado
 * à simulação: `sim.setCity(stack.city)` e, para as linhas, `sim.transit.addLine/removeLine`.
 *
 * Tudo aqui é serializável em JSON (comandos são descritos por `CommandSpec` e desfeitos por `PatchOp`),
 * para o Save guardar as pilhas de undo/redo.
 */
import balance from '../../config/balance.json';
import type {
  AccessKind,
  CityCrossing,
  CityEdge,
  CityFile,
  CityNode,
  LaneCounts,
  RadicalKind,
  SignalCfg,
} from './types';
import { ACCESS_KINDS, LANE_KINDS, RADICAL_KINDS } from './types';

// ---------------------------------------------------------------------------
// Ferramentas e custos (config/balance.json → tools)
// ---------------------------------------------------------------------------

export interface ToolCfg {
  cost: number;
  buildDays?: number;
  blocksTrafficWhileBuilding?: boolean;
  operationPerDay?: number;
  headwayMinutes?: number;
  capacityPerVehicle?: number;
}

/** Ferramentas do balance.json usadas pelos comandos. As demais chaves são ignoradas aqui. */
export type ToolsCfg = Record<string, ToolCfg | undefined>;

export const TOOLS: ToolsCfg = balance.tools as unknown as ToolsCfg;

/** Ferramenta da UI (o que a cena pode bloquear/liberar). */
export const TOOL_IDS = ['divisaoFaixas', 'sentidoVia', 'limiteVelocidade', 'semaforo', 'travessia', 'linha'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

/** Largura mínima confortável de uma faixa, m (abaixo disso o comando avisa). */
export const MIN_LANE_WIDTH_M = 1.5;
/** Limite de velocidade aceito pela ferramenta, km/h. */
export const SPEED_RANGE_KMH = { min: 5, max: 60 } as const;

// ---------------------------------------------------------------------------
// Linhas de coletivo (ainda não existem no city.json: ficam no CommandStack)
// ---------------------------------------------------------------------------

export const LINE_KINDS = ['tuktuk', 'tandem'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

/** Linha de coletivo, no formato que o jogo repassa a `sim.transit.addLine`. */
export interface TransitLineSpec {
  id: string;
  kind: LineKind;
  /** Ids de nós do city.json, na ordem do percurso. */
  stops: number[];
  headwayMinutes: number;
  fleet: number;
}

const LINE_TOOL: Record<LineKind, string> = { tuktuk: 'linhaTukTuk', tandem: 'linhaTandem' };

/** Custo de operação diário das linhas (balance.tools.linhaTukTuk/linhaTandem.operationPerDay, por linha). */
export function linesOperationPerDay(lines: readonly TransitLineSpec[], tools: ToolsCfg = TOOLS): number {
  return lines.reduce((sum, l) => sum + (tools[LINE_TOOL[l.kind]]?.operationPerDay ?? 0), 0);
}

// ---------------------------------------------------------------------------
// Estado e descrição dos comandos
// ---------------------------------------------------------------------------

/** Estado que os comandos alteram. */
export interface GameState {
  city: CityFile;
  lines: readonly TransitLineSpec[];
}

/** Descrição serializável de um comando. */
export type CommandSpec =
  | { type: 'lanes'; edgeId: number; lanes: LaneCounts }
  /** oneWay: mão única no sentido from→to; twoWay: mão dupla; reverse: inverte from/to de uma via de mão única. */
  | { type: 'direction'; edgeId: number; mode: 'oneWay' | 'twoWay' | 'reverse' }
  | { type: 'speed'; edgeId: number; speed: number }
  /** signal null remove o semáforo. */
  | { type: 'signal'; nodeId: number; signal: SignalCfg | null }
  /** Campos omitidos não mudam; access null remove a rota acessível (gera aviso). */
  | { type: 'crossing'; crossingId: number; radical?: RadicalKind; access?: AccessKind | null }
  | { type: 'addLine'; line: TransitLineSpec }
  | { type: 'editLine'; line: TransitLineSpec }
  | { type: 'removeLine'; lineId: string };

export const TOOL_OF: Record<CommandSpec['type'], ToolId> = {
  lanes: 'divisaoFaixas',
  direction: 'sentidoVia',
  speed: 'limiteVelocidade',
  signal: 'semaforo',
  crossing: 'travessia',
  addLine: 'linha',
  editLine: 'linha',
  removeLine: 'linha',
};

/** Uma troca de objeto (antes → depois). Desfazer = aplicar ao contrário. */
export type PatchOp =
  | { target: 'edge'; id: number; before: CityEdge; after: CityEdge }
  | { target: 'node'; id: number; before: CityNode; after: CityNode }
  | { target: 'crossing'; id: number; before: CityCrossing; after: CityCrossing }
  /** before null = linha criada; after null = linha removida; index = posição na lista. */
  | { target: 'line'; id: string; index: number; before: TransitLineSpec | null; after: TransitLineSpec | null };

/** Um campo que muda, para a pré-visualização ("faixa rápida: 1 → 2"). */
export interface Change {
  target: PatchOp['target'];
  id: number | string;
  field: string;
  before: unknown;
  after: unknown;
}

export interface Preview {
  /** true = pode aplicar (sem erros). */
  ok: boolean;
  tool: ToolId;
  label: string;
  cost: number;
  buildDays: number;
  /** Obra que fecha a ligação enquanto é construída (rampaPonte). */
  blocksTraffic: boolean;
  errors: string[];
  warnings: string[];
  changes: Change[];
}

interface Plan extends Preview {
  patch: PatchOp[];
}

function stripPatch(plan: Plan): Preview {
  const out: Partial<Plan> = { ...plan };
  delete out.patch;
  return out as Preview;
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const clone = <T>(v: T): T => structuredClone(v);

function findById<T extends { id: number }>(list: readonly T[], id: number): T | undefined {
  return list.find((x) => x.id === id);
}

function replaceById<T extends { id: number }>(list: readonly T[], id: number, next: T): T[] {
  const i = list.findIndex((x) => x.id === id);
  if (i < 0) throw new Error(`Commands: id ${id} não existe`);
  const out = list.slice();
  out[i] = next;
  return out;
}

function toolCost(tools: ToolsCfg, key: string): { cost: number; buildDays: number; blocksTraffic: boolean } {
  const t = tools[key];
  if (!t) throw new Error(`balance.json: falta tools.${key}`);
  return { cost: t.cost, buildDays: t.buildDays ?? 0, blocksTraffic: t.blocksTrafficWhileBuilding ?? false };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function laneTotal(l: LaneCounts): number {
  return LANE_KINDS.reduce((s, k) => s + (l[k] ?? 0), 0);
}

/** Campos alterados entre dois objetos (rasos), para a pré-visualização. */
function diffChanges(op: PatchOp): Change[] {
  const before = (op.before ?? {}) as unknown as Record<string, unknown>;
  const after = (op.after ?? {}) as unknown as Record<string, unknown>;
  if (op.target === 'line' && (op.before === null || op.after === null)) {
    return [{ target: 'line', id: op.id, field: 'line', before: op.before, after: op.after }];
  }
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys
    .filter((k) => !sameJson(before[k], after[k]))
    .map((k) => ({ target: op.target, id: op.id, field: k, before: before[k], after: after[k] }));
}

// ---------------------------------------------------------------------------
// Planejamento (validação + custo + patch) de cada comando
// ---------------------------------------------------------------------------

/** Calcula o que o comando faria, sem aplicar. */
export function planCommand(state: GameState, spec: CommandSpec, tools: ToolsCfg = TOOLS): Plan {
  const errors: string[] = [];
  const warnings: string[] = [];
  const patch: PatchOp[] = [];
  let cost = 0;
  let buildDays = 0;
  let blocksTraffic = false;
  let label = '';
  const { city } = state;

  switch (spec.type) {
    case 'lanes': {
      label = `Divisão de faixas da via ${spec.edgeId}`;
      ({ cost, buildDays, blocksTraffic } = toolCost(tools, 'divisaoFaixas'));
      const edge = findById(city.edges, spec.edgeId);
      if (!edge) {
        errors.push(`via ${spec.edgeId} não existe`);
        break;
      }
      const lanes: LaneCounts = {};
      for (const [k, v] of Object.entries(spec.lanes)) {
        if (!(LANE_KINDS as readonly string[]).includes(k)) {
          errors.push(`faixa desconhecida: ${k}`);
          continue;
        }
        if (!Number.isInteger(v) || (v as number) < 0) {
          errors.push(`faixa ${k}: quantidade inválida (${String(v)})`);
          continue;
        }
        if ((v as number) > 0) lanes[k as keyof LaneCounts] = v as number;
      }
      const total = laneTotal(lanes);
      if (total < 1) errors.push('a via ficaria sem nenhuma faixa');
      if (errors.length) break;
      if (!lanes.sidewalk) warnings.push('via sem calçada: quem anda a pé ou de cadeira divide a faixa lenta');
      const perLane = edge.width / (total * (edge.oneWay ? 1 : 2));
      if (perLane < MIN_LANE_WIDTH_M) {
        warnings.push(`faixas estreitas: ${perLane.toFixed(1)} m cada (mínimo confortável ${MIN_LANE_WIDTH_M} m)`);
      }
      if (sameJson(normalizeLanes(edge.lanes), normalizeLanes(lanes))) {
        errors.push('nada muda: a divisão é igual à atual');
        break;
      }
      patch.push({ target: 'edge', id: edge.id, before: clone(edge), after: { ...clone(edge), lanes } });
      break;
    }

    case 'direction': {
      label = `Sentido da via ${spec.edgeId}`;
      ({ cost, buildDays, blocksTraffic } = toolCost(tools, 'sentidoVia'));
      const edge = findById(city.edges, spec.edgeId);
      if (!edge) {
        errors.push(`via ${spec.edgeId} não existe`);
        break;
      }
      const after = clone(edge);
      if (spec.mode === 'oneWay') {
        if (edge.oneWay) errors.push('nada muda: a via já é de mão única');
        after.oneWay = true;
        warnings.push('mão única: quem vai no sentido contrário precisa dar a volta');
      } else if (spec.mode === 'twoWay') {
        if (!edge.oneWay) errors.push('nada muda: a via já é de mão dupla');
        after.oneWay = false;
      } else {
        if (!edge.oneWay) errors.push('via de mão dupla: inverter o sentido não muda nada');
        after.from = edge.to;
        after.to = edge.from;
      }
      if (!errors.length) patch.push({ target: 'edge', id: edge.id, before: clone(edge), after });
      break;
    }

    case 'speed': {
      label = `Limite de velocidade da via ${spec.edgeId}`;
      ({ cost, buildDays, blocksTraffic } = toolCost(tools, 'limiteVelocidade'));
      const edge = findById(city.edges, spec.edgeId);
      if (!edge) {
        errors.push(`via ${spec.edgeId} não existe`);
        break;
      }
      if (!Number.isFinite(spec.speed) || spec.speed < SPEED_RANGE_KMH.min || spec.speed > SPEED_RANGE_KMH.max) {
        errors.push(`limite fora da faixa permitida (${SPEED_RANGE_KMH.min}–${SPEED_RANGE_KMH.max} km/h)`);
        break;
      }
      if (spec.speed === edge.speed) {
        errors.push('nada muda: o limite é igual ao atual');
        break;
      }
      if (spec.speed > edge.speed) warnings.push('limite maior: viagens mais rápidas, mais risco de queda');
      patch.push({ target: 'edge', id: edge.id, before: clone(edge), after: { ...clone(edge), speed: spec.speed } });
      break;
    }

    case 'signal': {
      label = `Semáforo do cruzamento ${spec.nodeId}`;
      const node = findById(city.nodes, spec.nodeId);
      if (!node) {
        errors.push(`cruzamento ${spec.nodeId} não existe`);
        break;
      }
      const after = clone(node);
      if (spec.signal === null) {
        // Retirar o semáforo não custa nada.
        if (!node.signal) errors.push('não há semáforo para remover');
        delete after.signal;
      } else {
        const t = toolCost(tools, 'semaforo');
        cost = t.cost;
        // Só a instalação tem obra; reprogramar é imediato.
        buildDays = node.signal ? 0 : t.buildDays;
        validateSignal(city, node, spec.signal, errors, warnings);
        if (node.signal && sameJson(node.signal, spec.signal)) errors.push('nada muda: o semáforo já está assim');
        after.signal = clone(spec.signal);
      }
      if (!errors.length) patch.push({ target: 'node', id: node.id, before: clone(node), after });
      break;
    }

    case 'crossing': {
      label = `Travessia ${spec.crossingId}`;
      const c = findById(city.crossings, spec.crossingId);
      if (!c) {
        errors.push(`travessia ${spec.crossingId} não existe`);
        break;
      }
      if (c.locked) {
        errors.push('travessia protegida: o elemento não pode ser trocado');
        break;
      }
      const after = clone(c);
      if (spec.radical !== undefined && spec.radical !== c.radical) {
        if (!(RADICAL_KINDS as readonly string[]).includes(spec.radical)) {
          errors.push(`elemento radical desconhecido: ${spec.radical}`);
        } else {
          const t = toolCost(tools, 'rampaPonte');
          cost += t.cost;
          buildDays = Math.max(buildDays, t.buildDays);
          blocksTraffic ||= t.blocksTraffic;
          after.radical = spec.radical;
        }
      }
      if (spec.access !== undefined && spec.access !== (c.access ?? null)) {
        if (spec.access === null) {
          delete after.access;
        } else if (!(ACCESS_KINDS as readonly string[]).includes(spec.access)) {
          errors.push(`rota acessível desconhecida: ${spec.access}`);
        } else {
          const key = ACCESS_TOOL[spec.access];
          const t = key ? toolCost(tools, key) : { cost: 0, buildDays: 0, blocksTraffic: false };
          cost += t.cost;
          buildDays = Math.max(buildDays, t.buildDays);
          blocksTraffic ||= t.blocksTraffic;
          after.access = spec.access;
        }
      }
      if (after.access === undefined) {
        warnings.push('travessia sem rota acessível: cadeirantes ficam presos e a Acessibilidade cai');
      } else if (after.access === 'transit_only' && !state.lines.some((l) => l.kind === 'tuktuk')) {
        warnings.push('rota só de coletivo: precisa de uma linha de tuk-tuk passando pela travessia');
      }
      if (!errors.length && sameJson(c, after)) errors.push('nada muda: a travessia já está assim');
      if (!errors.length) patch.push({ target: 'crossing', id: c.id, before: clone(c), after });
      break;
    }

    case 'addLine':
    case 'editLine': {
      const { line } = spec;
      const index = state.lines.findIndex((l) => l.id === line.id);
      const existing = state.lines[index];
      label = spec.type === 'addLine' ? `Nova linha ${line.id}` : `Linha ${line.id}`;
      if (spec.type === 'addLine') {
        if (existing) errors.push(`já existe uma linha com id ${line.id}`);
        if ((LINE_KINDS as readonly string[]).includes(line.kind)) {
          ({ cost, buildDays, blocksTraffic } = toolCost(tools, LINE_TOOL[line.kind]));
        }
      } else if (!existing) {
        errors.push(`linha ${line.id} não existe`);
      } else if (existing.kind !== line.kind) {
        errors.push('não dá para trocar o tipo de uma linha: remova e crie outra');
      } else if (sameJson(existing, line)) {
        errors.push('nada muda: a linha já está assim');
      }
      validateLine(city, line, errors, warnings);
      if (errors.length) break;
      patch.push(
        spec.type === 'addLine'
          ? { target: 'line', id: line.id, index: state.lines.length, before: null, after: clone(line) }
          : { target: 'line', id: line.id, index, before: clone(existing!), after: clone(line) },
      );
      break;
    }

    case 'removeLine': {
      label = `Remover linha ${spec.lineId}`;
      const index = state.lines.findIndex((l) => l.id === spec.lineId);
      const existing = state.lines[index];
      if (!existing) {
        errors.push(`linha ${spec.lineId} não existe`);
        break;
      }
      if (existing.kind === 'tuktuk' && city.crossings.some((c) => c.access === 'transit_only')) {
        warnings.push('travessias só de coletivo perdem a rota acessível se nenhuma linha de tuk-tuk passar por elas');
      }
      patch.push({ target: 'line', id: existing.id, index, before: clone(existing), after: null });
      break;
    }
  }

  return {
    ok: errors.length === 0,
    tool: TOOL_OF[spec.type],
    label,
    cost,
    buildDays,
    blocksTraffic,
    errors,
    warnings,
    changes: patch.flatMap(diffChanges),
    patch,
  };
}

/**
 * Ferramenta (custo) de cada rota acessível. PROVISÓRIO: balance.json só tem elevadorBolha;
 * a passarela de vidro usa travessiaPedestre e a rota só de coletivo não tem obra (depende da linha).
 */
const ACCESS_TOOL: Record<AccessKind, string | null> = {
  bubble_lift: 'elevadorBolha',
  glass_walkway: 'travessiaPedestre',
  transit_only: null,
};

function normalizeLanes(l: LaneCounts): number[] {
  return LANE_KINDS.map((k) => l[k] ?? 0);
}

function validateSignal(city: CityFile, node: CityNode, s: SignalCfg, errors: string[], warnings: string[]): void {
  if (!Number.isFinite(s.cycle) || s.cycle <= 0) errors.push('ciclo do semáforo deve ser > 0 s');
  if (!Array.isArray(s.phases) || s.phases.length === 0) {
    errors.push('o semáforo precisa de pelo menos uma fase');
    return;
  }
  if (s.phases.length === 1) warnings.push('semáforo com uma fase só: as outras vias nunca têm verde');
  let greens = 0;
  s.phases.forEach((p, i) => {
    if (!Number.isFinite(p.green) || p.green <= 0) errors.push(`fase ${i + 1}: verde deve ser > 0 s`);
    greens += p.green;
    for (const id of p.edges) {
      const e = findById(city.edges, id);
      if (!e) errors.push(`fase ${i + 1}: via ${id} não existe`);
      else if (e.from !== node.id && e.to !== node.id) warnings.push(`fase ${i + 1}: via ${id} não chega neste cruzamento`);
    }
  });
  if (greens > s.cycle) errors.push(`soma dos verdes (${greens} s) maior que o ciclo (${s.cycle} s)`);
}

function validateLine(city: CityFile, l: TransitLineSpec, errors: string[], warnings: string[]): void {
  if (typeof l.id !== 'string' || l.id === '') errors.push('a linha precisa de um id');
  if (!(LINE_KINDS as readonly string[]).includes(l.kind)) errors.push(`tipo de linha desconhecido: ${String(l.kind)}`);
  if (!Array.isArray(l.stops) || l.stops.length < 2) errors.push('a linha precisa de pelo menos 2 paradas');
  else {
    l.stops.forEach((s, i) => {
      if (!findById(city.nodes, s)) errors.push(`parada ${i + 1}: cruzamento ${s} não existe`);
      if (i > 0 && l.stops[i - 1] === s) errors.push(`parada ${i + 1}: repetida em seguida`);
    });
  }
  if (!Number.isFinite(l.headwayMinutes) || l.headwayMinutes <= 0) errors.push('intervalo entre veículos deve ser > 0 min');
  if (!Number.isInteger(l.fleet) || l.fleet < 1) errors.push('a frota precisa de pelo menos 1 veículo');
  if (!city.edges.some((e) => (e.lanes.transit ?? 0) > 0)) warnings.push('a cidade não tem faixa coletiva: o coletivo divide a faixa lenta');
}

// ---------------------------------------------------------------------------
// Aplicar / desfazer patches
// ---------------------------------------------------------------------------

function applyOp(state: GameState, op: PatchOp, forward: boolean): GameState {
  const next = forward ? op.after : op.before;
  switch (op.target) {
    case 'edge':
      return { ...state, city: { ...state.city, edges: replaceById(state.city.edges, op.id, clone(next as CityEdge)) } };
    case 'node':
      return { ...state, city: { ...state.city, nodes: replaceById(state.city.nodes, op.id, clone(next as CityNode)) } };
    case 'crossing':
      return {
        ...state,
        city: { ...state.city, crossings: replaceById(state.city.crossings, op.id, clone(next as CityCrossing)) },
      };
    case 'line': {
      const lines = state.lines.slice();
      const prev = forward ? op.before : op.after;
      if (prev === null) lines.splice(op.index, 0, clone(next as TransitLineSpec));
      else if (next === null) lines.splice(op.index, 1);
      else lines[op.index] = clone(next as TransitLineSpec);
      return { ...state, lines };
    }
  }
}

export function applyPatch(state: GameState, patch: readonly PatchOp[]): GameState {
  return patch.reduce((s, op) => applyOp(s, op, true), state);
}

export function revertPatch(state: GameState, patch: readonly PatchOp[]): GameState {
  return [...patch].reverse().reduce((s, op) => applyOp(s, op, false), state);
}

// ---------------------------------------------------------------------------
// Command (interface orientada a objeto sobre o spec)
// ---------------------------------------------------------------------------

export class Command {
  /** Preenchido em apply(); usado por revert(). */
  private patch: PatchOp[] | null = null;

  constructor(
    readonly spec: CommandSpec,
    private readonly tools: ToolsCfg = TOOLS,
  ) {}

  get tool(): ToolId {
    return TOOL_OF[this.spec.type];
  }

  /** O que muda, quanto custa, erros e avisos; nada é aplicado. */
  preview(state: GameState): Preview {
    return stripPatch(planCommand(state, this.spec, this.tools));
  }

  validate(state: GameState): { errors: string[]; warnings: string[] } {
    const p = planCommand(state, this.spec, this.tools);
    return { errors: p.errors, warnings: p.warnings };
  }

  cost(state: GameState): number {
    return planCommand(state, this.spec, this.tools).cost;
  }

  buildDays(state: GameState): number {
    return planCommand(state, this.spec, this.tools).buildDays;
  }

  /** Devolve o novo estado (o antigo não é alterado). Lança erro se o comando for inválido. */
  apply(state: GameState): GameState {
    const plan = planCommand(state, this.spec, this.tools);
    if (!plan.ok) throw new Error(`${plan.label}: ${plan.errors.join('; ')}`);
    this.patch = plan.patch;
    return applyPatch(state, plan.patch);
  }

  revert(state: GameState): GameState {
    if (!this.patch) throw new Error('Command.revert: o comando não foi aplicado');
    const s = revertPatch(state, this.patch);
    this.patch = null;
    return s;
  }
}

// ---------------------------------------------------------------------------
// Pilha de comandos com undo/redo e orçamento
// ---------------------------------------------------------------------------

export interface StackEntry {
  spec: CommandSpec;
  patch: PatchOp[];
  label: string;
  cost: number;
  buildDays: number;
  blocksTraffic: boolean;
  /** Dia do jogo em que o comando foi aplicado. */
  day: number;
}

/** Obra em andamento (o jogo mostra o canteiro e, se blocksTraffic, fecha a ligação). */
export interface Construction {
  label: string;
  tool: ToolId;
  target: PatchOp['target'];
  id: number | string;
  readyDay: number;
  blocksTraffic: boolean;
}

/** Estado serializável do CommandStack (vai para o Save). */
export interface CommandStackState {
  money: number;
  lines: TransitLineSpec[];
  undo: StackEntry[];
  redo: StackEntry[];
  lockedTools: ToolId[];
}

export interface CommandStackOptions {
  /** Dinheiro inicial (scenario.budget). */
  money: number;
  lines?: TransitLineSpec[];
  /** Ferramentas bloqueadas no cenário (ex.: linha antes do campeonato). */
  lockedTools?: ToolId[];
  tools?: ToolsCfg;
  /** Tamanho máximo da pilha de undo (padrão 200). */
  limit?: number;
}

export type ExecuteResult = Preview & { entry?: StackEntry };

/**
 * Pilha de comandos: aplica com orçamento, desfaz devolvendo o dinheiro e refaz cobrando de novo.
 * PROVISÓRIO: o undo devolve 100% do custo (ferramenta de planejamento); o Design pode decidir outra regra.
 */
export class CommandStack {
  private state: GameState;
  private _money: number;
  private undoStack: StackEntry[] = [];
  private redoStack: StackEntry[] = [];
  private readonly locked: Set<ToolId>;
  private readonly tools: ToolsCfg;
  private readonly limit: number;

  constructor(city: CityFile, opts: CommandStackOptions) {
    this.state = { city, lines: (opts.lines ?? []).map(clone) };
    this._money = opts.money;
    this.locked = new Set(opts.lockedTools ?? []);
    this.tools = opts.tools ?? TOOLS;
    this.limit = opts.limit ?? 200;
  }

  get city(): CityFile {
    return this.state.city;
  }

  get lines(): readonly TransitLineSpec[] {
    return this.state.lines;
  }

  get money(): number {
    return this._money;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get history(): readonly StackEntry[] {
    return this.undoStack;
  }

  isLocked(tool: ToolId): boolean {
    return this.locked.has(tool);
  }

  lock(tool: ToolId): void {
    this.locked.add(tool);
  }

  unlock(tool: ToolId): void {
    this.locked.delete(tool);
  }

  /** Pré-visualização incluindo orçamento e ferramentas bloqueadas. */
  preview(spec: CommandSpec): Preview {
    return stripPatch(this.plan(spec));
  }

  /** Aplica se for válido e houver dinheiro. Retorna a pré-visualização (ok=false explica por quê). */
  execute(spec: CommandSpec, day = 0): ExecuteResult {
    const plan = this.plan(spec);
    const preview = stripPatch(plan);
    const patch = plan.patch;
    if (!plan.ok) return preview;
    const entry: StackEntry = {
      spec: clone(spec),
      patch,
      label: plan.label,
      cost: plan.cost,
      buildDays: plan.buildDays,
      blocksTraffic: plan.blocksTraffic,
      day,
    };
    this.state = applyPatch(this.state, patch);
    this._money -= plan.cost;
    this.undoStack.push(entry);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    return { ...preview, entry };
  }

  /** Desfaz o último comando (devolve o custo). */
  undo(): StackEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.state = revertPatch(this.state, entry.patch);
    this._money += entry.cost;
    this.redoStack.push(entry);
    return entry;
  }

  /** Refaz (cobra de novo; não refaz sem dinheiro). */
  redo(): StackEntry | null {
    const entry = this.redoStack[this.redoStack.length - 1];
    if (!entry || entry.cost > this._money) return null;
    this.redoStack.pop();
    this.state = applyPatch(this.state, entry.patch);
    this._money -= entry.cost;
    this.undoStack.push(entry);
    return entry;
  }

  /** Gasto fora dos comandos (dilema, operação de linhas). Retorna false sem dinheiro suficiente. */
  spend(amount: number): boolean {
    if (amount > this._money) return false;
    this._money -= amount;
    return true;
  }

  /** Receita (tarifas, eventos) ou débito forçado (amount negativo, ex.: operação diária). */
  earn(amount: number): void {
    this._money += amount;
  }

  /** Obras ainda não concluídas no dia informado. */
  constructions(day: number): Construction[] {
    return this.undoStack
      .filter((e) => e.buildDays > 0 && e.day + e.buildDays > day)
      .flatMap((e) =>
        e.patch.map((op) => ({
          label: e.label,
          tool: TOOL_OF[e.spec.type],
          target: op.target,
          id: op.id,
          readyDay: e.day + e.buildDays,
          blocksTraffic: e.blocksTraffic,
        })),
      );
  }

  serialize(): CommandStackState {
    return clone({
      money: this._money,
      lines: [...this.state.lines],
      undo: this.undoStack,
      redo: this.redoStack,
      lockedTools: [...this.locked].sort(),
    });
  }

  static deserialize(city: CityFile, data: CommandStackState, tools?: ToolsCfg): CommandStack {
    const s = new CommandStack(city, { money: data.money, lines: data.lines, lockedTools: data.lockedTools, tools });
    s.undoStack = clone(data.undo);
    s.redoStack = clone(data.redo);
    return s;
  }

  private plan(spec: CommandSpec): Plan {
    const plan = planCommand(this.state, spec, this.tools);
    if (this.locked.has(plan.tool)) plan.errors.push('ferramenta bloqueada neste cenário');
    if (plan.cost > this._money) plan.errors.push(`saldo insuficiente: custa ${plan.cost}, há ${this._money}`);
    plan.ok = plan.errors.length === 0;
    return plan;
  }
}

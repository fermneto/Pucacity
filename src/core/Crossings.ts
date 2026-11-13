import balance from '../../config/balance.json';
import radicais from '../../data/arte/elementos-radicais.json';
import type { AccessKind, CityCrossing, CityFile, RadicalKind } from './types';

/** Correspondência entre o id do city.json (SPEC §6) e o id do arquivo da Arte / do balance.json. */
export const ART_ID: Record<RadicalKind, string> = {
  ramp_bridge: 'rampa_ponte',
  air_loop: 'loop_aereo',
  death_jump: 'salto_mortal',
  rail_walkway: 'rail_passarela',
};

/** Ids da Arte/balance para as rotas acessíveis (eventos usam esses ids em `closes`). */
export const ACCESS_ART_ID: Record<AccessKind, string> = {
  bubble_lift: 'elevador_bolha',
  glass_walkway: 'passarela_vidro',
  transit_only: 'tuktuk',
};

export interface RadicalInfo {
  kind: RadicalKind;
  name: string;
  /**
   * Velocidade mínima do veículo para usar o elemento, m/s (0 = sem mínimo).
   * Maior valor entre `velocidade_minima` (elementos-radicais.json) e `minSpeed` (balance.radical).
   */
  minSpeedMps: number;
  gapPoints: number;
  /**
   * Só veículos com `manobras: true` (veiculos.json) usam o elemento.
   * `balance.radical.<id>.requiresManeuvers`; se a chave faltar, vale a regra geral da Arte
   * (`regras_de_posicionamento.cidadaos_npc_usam_elementos`: só quem faz manobras usa elementos) → true.
   */
  requiresManeuvers: boolean;
  /** Tempo fixo de travessia, segundos (balance.radical.<id>.crossSeconds). */
  crossSeconds: number;
  /** Chance de queda por travessia (balance.radical.<id>.fallRisk). */
  fallRisk: number;
  /** Bônus de diversão (balance.radical.<id>.funBonus), para a escolha modal. */
  funBonus: number;
  /** Rota acessível sugerida pelo Design (balance.radical.<id>.accessRoute), só informativo. */
  accessRoute?: string;
}

interface RawRadical {
  id: string;
  nome: string;
  velocidade_minima?: number;
  pontos_gap?: number;
}

/** Entrada de balance.radical.<id>. */
export interface BalanceRadical {
  crossSeconds: number;
  fallRisk: number;
  funBonus?: number;
  requiresManeuvers?: boolean;
  minSpeed?: number;
  accessRoute?: string;
  queue?: boolean;
}

const byArtId = new Map((radicais.elementos as unknown as RawRadical[]).map((e) => [e.id, e]));
const balanceRadical = balance.radical as unknown as Record<string, BalanceRadical | string>;

function balanceEntry(artId: string): BalanceRadical {
  const b = balanceRadical[artId];
  if (!b || typeof b !== 'object' || typeof b.crossSeconds !== 'number' || typeof b.fallRisk !== 'number') {
    throw new Error(`config/balance.json: falta radical.${artId} com crossSeconds e fallRisk`);
  }
  return b;
}

export const RADICALS: Record<RadicalKind, RadicalInfo> = Object.fromEntries(
  (Object.keys(ART_ID) as RadicalKind[]).map((kind) => {
    const raw = byArtId.get(ART_ID[kind]);
    if (!raw) throw new Error(`elementos-radicais.json: falta o elemento '${ART_ID[kind]}' (${kind})`);
    const b = balanceEntry(ART_ID[kind]);
    const info: RadicalInfo = {
      kind,
      name: raw.nome,
      minSpeedMps: Math.max(raw.velocidade_minima ?? 0, b.minSpeed ?? 0),
      gapPoints: raw.pontos_gap ?? 0,
      requiresManeuvers: b.requiresManeuvers ?? true,
      crossSeconds: b.crossSeconds,
      fallRisk: b.fallRisk,
      funBonus: b.funBonus ?? 0,
      ...(b.accessRoute !== undefined ? { accessRoute: b.accessRoute } : {}),
    };
    return [kind, info];
  }),
) as Record<RadicalKind, RadicalInfo>;

/** Elevador de Bolha (balance.radical.elevador_bolha + balance.tools.elevadorBolha). */
export const BUBBLE_LIFT = {
  crossSeconds: balanceEntry('elevador_bolha').crossSeconds,
  fallRisk: balanceEntry('elevador_bolha').fallRisk,
  funBonus: balanceEntry('elevador_bolha').funBonus ?? 0,
  /** Usuários por minuto (balance.tools.elevadorBolha.capacityPerMinute). */
  capacityPerMinute: balance.tools.elevadorBolha.capacityPerMinute,
};

/**
 * Rota acessível efetiva da travessia: a declarada em `access` ou, para a Rail-Passarela sem `access`,
 * a passarela de vidro implícita (a Arte descreve a passarela paralela como parte do elemento).
 * null = ninguém sem manobras atravessa aqui.
 */
export function crossingAccessRoute(c: Pick<CityCrossing, 'radical' | 'access'>): { kind: AccessKind; implicit: boolean } | null {
  if (c.access) return { kind: c.access, implicit: false };
  if (c.radical === 'rail_walkway') return { kind: 'glass_walkway', implicit: true };
  return null;
}

/** IDs das travessias sem rota acessível (regra "ninguém fica preso", SPEC §4.5). Rail-Passarela conta como acessível. */
export function crossingsWithoutAccess(city: CityFile): number[] {
  return city.crossings.filter((c) => crossingAccessRoute(c) === null).map((c) => c.id);
}

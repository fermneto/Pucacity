/**
 * Save/load em JSON (meta: < 100 ms com a cidade da vitrine).
 *
 * Não importa Simulation.ts: a simulação entra como `Serializable` e volta como dado cru
 * para o jogo reconstruir com `Simulation.deserialize(data.city, data.sim)`.
 */
import { validateCity } from './CityLoader';
import { CommandStack, type CommandStackState, type ToolsCfg } from './Commands';
import { EventEngine, type EventEngineState } from './Events';
import type { CityFile } from './types';

export const SAVE_VERSION = 1;

export interface Serializable {
  serialize(): unknown;
}

export interface SaveInput {
  city: CityFile;
  sim: Serializable;
  commands: { serialize(): CommandStackState };
  events?: { serialize(): EventEngineState } | null;
  /** Dados livres do jogo (nome do cenário, seed, velocidade…). */
  meta?: Record<string, unknown>;
}

export interface SaveData {
  version: number;
  city: CityFile;
  sim: unknown;
  commands: CommandStackState;
  events: EventEngineState | null;
  meta: Record<string, unknown>;
}

export class SaveError extends Error {
  constructor(message: string) {
    super(`Save: ${message}`);
    this.name = 'SaveError';
  }
}

export function saveGame(input: SaveInput): string {
  const data: SaveData = {
    version: SAVE_VERSION,
    city: input.city,
    sim: input.sim.serialize(),
    commands: input.commands.serialize(),
    events: input.events ? input.events.serialize() : null,
    meta: input.meta ?? {},
  };
  return JSON.stringify(data);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Lê e valida o JSON do save. Lança SaveError com mensagem legível. */
export function loadGame(json: string): SaveData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new SaveError(`JSON inválido (${(e as Error).message})`);
  }
  if (!isObj(raw)) throw new SaveError('formato inválido');
  if (raw.version !== SAVE_VERSION) throw new SaveError(`versão ${String(raw.version)} não suportada (esperada ${SAVE_VERSION})`);

  const v = validateCity(raw.city);
  if (!v.ok) throw new SaveError(`cidade inválida:\n${v.errors.join('\n')}`);

  const c = raw.commands;
  if (!isObj(c) || typeof c.money !== 'number' || !Array.isArray(c.undo) || !Array.isArray(c.redo) || !Array.isArray(c.lines)) {
    throw new SaveError('pilha de comandos inválida');
  }
  if (raw.events !== null && raw.events !== undefined) {
    const e = raw.events;
    if (!isObj(e) || !Array.isArray(e.events) || !Array.isArray(e.dilemmas) || !isObj(e.patience)) {
      throw new SaveError('estado de eventos inválido');
    }
  }
  if (!('sim' in raw)) throw new SaveError('falta o estado da simulação');

  return {
    version: SAVE_VERSION,
    city: v.city,
    sim: raw.sim,
    commands: { ...(c as unknown as CommandStackState), lockedTools: Array.isArray(c.lockedTools) ? (c.lockedTools as CommandStackState['lockedTools']) : [] },
    events: (raw.events as EventEngineState | null | undefined) ?? null,
    meta: isObj(raw.meta) ? raw.meta : {},
  };
}

/** Reconstrói o que é deste módulo; a simulação fica com o jogo (`Simulation.deserialize(city, sim)`). */
export function restoreGame(
  data: SaveData,
  tools?: ToolsCfg,
): { city: CityFile; sim: unknown; commands: CommandStack; events: EventEngine | null; meta: Record<string, unknown> } {
  return {
    city: data.city,
    sim: data.sim,
    commands: CommandStack.deserialize(data.city, data.commands, tools),
    events: data.events ? EventEngine.deserialize(data.events) : null,
    meta: data.meta,
  };
}

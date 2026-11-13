import radicais from '../../data/arte/elementos-radicais.json';
import type { CityFile, RadicalKind } from './types';

/** Correspondência entre o id do city.json (SPEC §6) e o id do arquivo da Arte. */
const ART_ID: Record<RadicalKind, string> = {
  ramp_bridge: 'rampa_ponte',
  air_loop: 'loop_aereo',
  death_jump: 'salto_mortal',
  rail_walkway: 'rail_passarela',
};

export interface RadicalInfo {
  kind: RadicalKind;
  name: string;
  /** Velocidade mínima do veículo para usar o elemento, m/s (0 = sem mínimo). */
  minSpeedMps: number;
  gapPoints: number;
}

interface RawRadical {
  id: string;
  nome: string;
  velocidade_minima?: number;
  pontos_gap?: number;
}

const byArtId = new Map((radicais.elementos as unknown as RawRadical[]).map((e) => [e.id, e]));

export const RADICALS: Record<RadicalKind, RadicalInfo> = Object.fromEntries(
  (Object.keys(ART_ID) as RadicalKind[]).map((kind) => {
    const raw = byArtId.get(ART_ID[kind]);
    if (!raw) throw new Error(`elementos-radicais.json: falta o elemento '${ART_ID[kind]}' (${kind})`);
    return [kind, { kind, name: raw.nome, minSpeedMps: raw.velocidade_minima ?? 0, gapPoints: raw.pontos_gap ?? 0 }];
  }),
) as Record<RadicalKind, RadicalInfo>;

/** IDs das travessias sem rota acessível (regra "ninguém fica preso", SPEC §4.5). */
export function crossingsWithoutAccess(city: CityFile): number[] {
  return city.crossings.filter((c) => c.access === undefined).map((c) => c.id);
}

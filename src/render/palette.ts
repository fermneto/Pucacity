import { Color } from 'three';
import paleta from '../../data/arte/paleta.json';
import { type Rng, pickWeighted, pick } from './util';

export type Family = 'aero' | 'neon' | 'rua' | 'base';

export interface PaletteColor {
  id: string;
  nome: string;
  hex: string;
  familia: Family;
}

export const WORLD = paleta.mundo;
export const COLORS = paleta.veiculos_moda as PaletteColor[];
const WEIGHTS = paleta.regras_combinacao.peso_familias as Record<Family, number>;

export function hex(c: string): Color {
  return new Color(c);
}

/** Tons de pele: variedade é obrigatória numa cidade cheia de gente. */
export const SKIN_TONES = ['#F3D2B8', '#E5B48F', '#C98E62', '#A86B44', '#7C4A2D', '#563220'];

export interface Look {
  vehicle: PaletteColor;
  outfit: PaletteColor;
  skin: string;
}

/**
 * Sorteia um visual seguindo `regras_combinacao` da paleta:
 * no máximo 1 neon por cidadão, e roupa nunca neon se o veículo já for.
 */
export function pickLook(rng: Rng): Look {
  const vehicle = pickWeighted(rng, COLORS, (c) => WEIGHTS[c.familia]);
  const outfitPool = COLORS.filter((c) => c.familia !== 'neon' || vehicle.familia !== 'neon');
  const outfit = pickWeighted(rng, outfitPool, (c) => (c.familia === 'neon' ? WEIGHTS.neon * 0.5 : WEIGHTS[c.familia]));
  return { vehicle, outfit, skin: pick(rng, SKIN_TONES) };
}

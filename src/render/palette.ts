import paleta from '../../data/arte/paleta.json';
import type { LaneKind } from '../core/types';

/** Cores-base do cenário, direto de data/arte/paleta.json (contrato Arte → Engenharia). */
export const WORLD = paleta.mundo;

export const hex = (s: string): number => parseInt(s.replace('#', ''), 16);

/**
 * Cor do piso de cada faixa.
 * PLACEHOLDER da Engenharia: o style guide pede "cor de piso e marcação diferentes" por faixa,
 * mas a paleta ainda não define quais. Trocar quando a Arte publicar em paleta.json.
 */
export const LANE_COLOR: Record<LaneKind, number> = {
  sidewalk: hex(WORLD.concreto),
  slow: 0xc9a4f2, // Lilás Gloss
  fast: 0x2e8bea, // Azul Céu XP
  transit: 0xff7a1a, // Laranja Cone
};

/** Cor da rota desenhada para cada modo (só no protótipo). */
export const ROUTE_COLOR = 0x00e5ff; // Ciano CRT

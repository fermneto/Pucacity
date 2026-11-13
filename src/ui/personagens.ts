import type { Speaker } from './speech';

/**
 * Personagens recorrentes (docs/design/problemas.md §3 e cenario-01-vila-nova.md §1)
 * com os parâmetros do retrato pixelado. Só aparência: falas e humor vêm do conteúdo.
 */
export const PERSONAGENS = {
  rita: {
    id: 'rita', name: 'Dona Rita', role: '68 · cadeira motorizada · Zona Leste', tone: 'aqua',
    portrait: { seed: 'rita', skin: '#c98e62', hair: '#d9dde6', shirt: '#7d5bd6', accent: '#ff5fa8', bg: '#b2f0fa', hairStyle: 'coque', glasses: true, outfit: 'gola' },
  },
  bia: {
    id: 'bia', name: 'Bia', role: '13 · skate', tone: 'rosa',
    portrait: { seed: 'bia', skin: '#f0c49a', hair: '#3a2416', shirt: '#2fbf71', accent: '#ff5fa8', bg: '#ffd7ec', hairStyle: 'bone', freckles: true },
  },
  osvaldo: {
    id: 'osvaldo', name: 'Seu Osvaldo', role: 'comerciante do Mercado', tone: 'lime',
    portrait: { seed: 'osvaldo', skin: '#e2a878', hair: '#5a4a3a', shirt: '#f2f8fc', accent: '#e8322c', bg: '#d6ff96', hairStyle: 'careca', mustache: true, outfit: 'avental' },
  },
  tuco: {
    id: 'tuco', name: 'Tuco', role: 'entregador de BMX', tone: 'aqua',
    portrait: { seed: 'tuco', skin: '#8a5a3c', hair: '#1a1410', shirt: '#ff8a1f', accent: '#ffe23a', bg: '#9fd4ff', hairStyle: 'capacete', outfit: 'bolsa' },
  },
} satisfies Record<string, Speaker>;

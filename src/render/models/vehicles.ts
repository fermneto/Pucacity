import { MeshBuilder } from './MeshBuilder';
import { WORLD } from '../palette';

/**
 * Cidadãos + veículo como UMA malha (SPEC: 20–60 tris por veículo/cidadão).
 * Tints por instância: 1 = cor do veículo, 2 = roupa, 3 = pele (variedade sem custo de malha).
 * Frente = +z. Medidas em metros (o catálogo converte para tiles e aplica AGENT_SCALE).
 */
const JEANS = '#3E5E8E';
const CHROME = WORLD.cromo;
const RUBBER = '#1A1B1E';

type B = MeshBuilder;

/** Pessoa em pé (28 tris; +10 com boné). */
function standing(b: B, cap = false, legH = 0.8) {
  b.box(0.34, legH, 0.2, { color: JEANS, omit: ['top', 'bottom'] });
  b.at(0, legH, 0, 0, (b) => b.box(0.5, 0.6, 0.28, { tint: 2, omit: ['bottom'] }));
  b.at(0, legH + 0.6, 0, 0, (b) => b.box(0.24, 0.27, 0.25, { tint: 3, omit: ['bottom'] }));
  if (cap) b.at(0, legH + 0.84, 0.04, 0, (b) => b.box(0.27, 0.06, 0.34, { tint: 1, omit: ['bottom'] }));
}

/** Pessoa sentada (28 tris), assento na altura y. */
function seated(b: B, y: number) {
  b.at(0, y, 0.14, 0, (b) => b.box(0.34, 0.16, 0.42, { color: JEANS, omit: ['bottom', 'nz'] }));
  b.at(0, y, -0.06, 0, (b) => b.box(0.46, 0.58, 0.26, { tint: 2, omit: ['bottom'] }));
  b.at(0, y + 0.58, -0.06, 0, (b) => b.box(0.24, 0.27, 0.25, { tint: 3, omit: ['bottom'] }));
}

/** Passageiro compacto da tandem (10 tris). */
function rider(b: B, y: number, compact: boolean) {
  b.at(0, y, 0, 0, (b) => b.box(0.44, 0.58, 0.26, { tint: 2, omit: compact ? ['bottom', 'nz'] : ['bottom'] }));
  b.at(0, y + 0.58, 0, 0, (b) =>
    compact ? b.prism(0.15, 0.28, 3, { tint: 3, radiusTop: 0 }) : b.box(0.24, 0.27, 0.25, { tint: 3, omit: ['bottom', 'nz'] }));
}

function wheel(b: B, x: number, z: number, r: number, sides = 6, color = RUBBER) {
  b.at(x, 0, z, 0, (b) => b.disc(r, sides, { color }));
}

export const VEHICLE_BUILDERS: Record<string, (b: B) => void> = {
  pedestrian: (b) => standing(b, true),

  skate: (b) => {
    b.at(0, 0.06, 0, 0, (b) => b.box(0.24, 0.05, 0.82, { tint: 1, omit: ['bottom'] }));
    b.at(0, 0.11, 0, Math.PI / 2, (b) => standing(b, false, 0.74));
  },

  longboard: (b) => {
    b.at(0, 0.06, 0, 0, (b) => b.box(0.27, 0.05, 1.15, { tint: 1, omit: ['bottom'] }));
    b.at(0, 0.11, 0, Math.PI / 2, (b) => standing(b, true, 0.66));
  },

  kick_scooter: (b) => {
    b.at(0, 0.05, 0, 0, (b) => b.box(0.14, 0.05, 0.62, { tint: 1, omit: ['bottom'] }));
    b.at(0, 0.05, 0.3, 0, (b) => b.box(0.04, 0.88, 0.04, { color: CHROME, gloss: 1, omit: ['top', 'bottom'] }));
    b.at(0, 0.92, 0.3, 0, (b) => b.box(0.46, 0.04, 0.05, { color: CHROME, gloss: 1, omit: ['bottom'] }));
    b.at(0, 0.1, -0.08, 0, (b) => standing(b));
  },

  e_scooter: (b) => {
    b.at(0, 0.04, 0, 0, (b) => b.box(0.2, 0.09, 0.72, { color: RUBBER, omit: ['bottom'] }));
    b.at(0, 0.13, 0.33, 0, (b) => b.box(0.06, 0.82, 0.06, { tint: 1, omit: ['top', 'bottom'] }));
    b.at(0, 0.95, 0.33, 0, (b) => b.box(0.5, 0.05, 0.06, { tint: 1, gloss: 0.6, omit: ['bottom'] }));
    b.at(0, 0.13, -0.1, 0, (b) => standing(b));
  },

  skates: (b) => {
    b.at(-0.1, 0, 0.02, 0, (b) => b.box(0.13, 0.14, 0.32, { tint: 1, omit: ['bottom'] }));
    b.at(0.1, 0, -0.04, 0, (b) => b.box(0.13, 0.14, 0.32, { tint: 1, omit: ['bottom'] }));
    b.at(0, 0.14, 0, 0, (b) => standing(b, false, 0.72));
  },

  wheelchair: (b) => {
    b.at(0, 0.4, 0, 0, (b) => b.box(0.5, 0.08, 0.46, { tint: 1, omit: ['bottom'] }));
    wheel(b, 0.3, -0.04, 0.3, 6, CHROME);
    wheel(b, -0.3, -0.04, 0.3, 6, CHROME);
    seated(b, 0.48);
  },

  wheelchair_powered: (b) => {
    b.at(0, 0.1, 0, 0, (b) => b.box(0.56, 0.36, 0.72, { tint: 1, gloss: 0.4, omit: ['bottom'] }));
    wheel(b, 0.31, -0.12, 0.17);
    wheel(b, -0.31, -0.12, 0.17);
    seated(b, 0.46);
  },

  hoverboard: (b) => {
    b.at(0, 0.04, 0, 0, (b) => b.box(0.68, 0.12, 0.22, { tint: 1, gloss: 0.8, omit: ['bottom'] }));
    b.at(0, 0.16, 0, 0, (b) => standing(b, true));
  },

  e_unicycle: (b) => {
    wheel(b, 0, 0, 0.24);
    b.at(0, 0.02, 0, 0, (b) => b.box(0.16, 0.52, 0.44, { tint: 1, gloss: 0.6, omit: ['bottom'] }));
    b.at(0, 0.3, 0, 0, (b) => standing(b, true, 0.7));
  },

  bmx: (b) => {
    wheel(b, 0, 0.45, 0.26);
    wheel(b, 0, -0.45, 0.26);
    b.at(0, 0.42, 0, 0, (b) => b.box(0.07, 0.07, 0.92, { tint: 1, omit: ['bottom'] }));
    seated(b, 0.62);
  },

  tandem: (b) => {
    wheel(b, 0, 0.85, 0.3);
    wheel(b, 0, -0.85, 0.3);
    b.at(0, 0.5, 0, 0, (b) => b.box(0.08, 0.08, 1.9, { color: CHROME, gloss: 1, omit: ['bottom', 'nz', 'pz'] }));
    b.at(0, 0, 0.42, 0, (b) => rider(b, 0.62, false));
    b.at(0, 0, -0.42, 0, (b) => rider(b, 0.62, false));
  },

  tandem_4: (b) => {
    wheel(b, 0, 1.5, 0.3, 4);
    wheel(b, 0, -1.5, 0.3, 4);
    b.at(0, 0.5, 0, 0, (b) => b.box(0.08, 0.08, 3.2, { color: CHROME, gloss: 1, omit: ['bottom', 'nz', 'pz'] }));
    for (const z of [-1.05, -0.35, 0.35, 1.05]) b.at(0, 0, z, 0, (b) => rider(b, 0.62, true));
  },

  tuktuk: (b) => {
    b.at(0, 0.22, 0, 0, (b) => b.box(1.3, 0.62, 2.3, { tint: 1, gloss: 0.5, omit: ['bottom'] }));
    b.at(0, 0.84, -0.15, 0, (b) => b.prism(0.68, 0.78, 6, { color: WORLD.vidro, gloss: 1, radiusTop: 0.42 }));
    b.at(0, 1.62, -0.15, 0, (b) => b.box(0.62, 0.14, 0.1, { color: '#FFE23A', omit: ['bottom'] }));
    wheel(b, 0, 0.85, 0.22);
    wheel(b, 0.62, -0.75, 0.22);
    wheel(b, -0.62, -0.75, 0.22);
  },
};

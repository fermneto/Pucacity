import { MeshBuilder } from './MeshBuilder';
import { WORLD } from '../palette';

/**
 * Prédios (SPEC: 12–200 tris). Base de concreto cru + topo Aero (vidro, gel, cromo).
 * Pegada de até 7,5 m para caber num tile de 8 m. Frente = +z.
 */
type B = MeshBuilder;
const CHROME = WORLD.cromo;
const GEL = ['#3FD0E8', '#6CCB3F', '#FF5FA8', '#FFE23A', '#7B4FD6'];

export function tree(b: B) {
  b.prism(0.25, 1.6, 4, { color: '#8E5E33', top: false });
  b.at(0, 1.3, 0, 0, (b) => b.sphere(1.4, 6, 4, { color: '#6CCB3F', gloss: 0.45 }));
}

export const BUILDING_BUILDERS: Record<string, (b: B) => void> = {
  /** Vila Concreto: bloco de 3 andares, térreo pichado, varandas em gel. */
  bld_res_1: (b) => {
    b.box(7, 3.2, 6, { tile: 'graffiti', omit: ['top', 'bottom'] });
    b.at(0, 3.2, 0, 0, (b) => b.box(7, 6, 6, { tile: 'facade', faces: { top: { tile: 'concrete' } }, omit: ['bottom'] }));
    b.at(0, 4.6, 3.3, 0, (b) => b.box(6.6, 0.25, 0.8, { color: GEL[0], gloss: 0.7, omit: ['bottom'] }));
    b.at(0, 7.4, 3.3, 0, (b) => b.box(6.6, 0.25, 0.8, { color: GEL[2], gloss: 0.7, omit: ['bottom'] }));
    b.at(-1.8, 9.2, -1, 0, (b) => b.prism(0.9, 1.4, 6, { color: CHROME, gloss: 0.9 }));
    b.at(1.8, 9.2, 0.8, 0, (b) => b.box(1.2, 0.7, 1, { color: '#BDB4A4', omit: ['bottom'] }));
  },

  /** Conjunto alto (5 andares) com parabólica. */
  bld_res_2: (b) => {
    b.box(6.5, 3.2, 6.5, { tile: 'graffiti', omit: ['top', 'bottom'] });
    b.at(0, 3.2, 0, 0, (b) => b.box(6.5, 12, 6.5, { tile: 'facade', faces: { top: { tile: 'concrete' } }, omit: ['bottom'] }));
    b.at(0, 15.2, -1.5, 0, (b) => b.box(2.2, 2, 2, { tile: 'concrete', omit: ['bottom'] }));
    b.at(1.8, 15.2, 1.6, 0, (b) => b.prism(0.6, 0.5, 6, { color: '#F2F8FC', gloss: 0.6, radiusTop: 0.1 }));
  },

  /** Centro Gel: torre octogonal de vidro com coroa cromada e letreiro. */
  bld_com_1: (b) => {
    b.box(7.2, 4, 7.2, { tile: 'concrete', omit: ['top', 'bottom'] });
    b.at(0, 4, 0, 0, (b) => b.prism(3.4, 14, 8, { tile: 'glass', gloss: 0.9, uvScale: 0.125, topPaint: { color: CHROME, gloss: 1 } }));
    b.at(0, 18, 0, 0, (b) => b.prism(2.6, 3, 8, { color: CHROME, gloss: 1, radiusTop: 1.2 }));
    b.at(0, 21, 0, 0, (b) => b.prism(0.12, 4, 3, { color: CHROME, radiusTop: 0 }));
    b.at(0, 4.4, 3.7, 0, (b) => b.box(4.4, 1.1, 0.3, { color: GEL[0], gloss: 1, omit: ['bottom'] }));
  },

  /** Shopping bolha: cilindro de vidro com cúpula. */
  bld_com_2: (b) => {
    b.prism(3.6, 7, 10, { tile: 'glass', gloss: 0.9, uvScale: 0.125, top: false });
    b.at(0, 3.4, 0, 0, (b) => b.sphere(3.6, 10, 4, { color: WORLD.vidro, gloss: 1 }));
    b.at(0, 0, 3.7, 0, (b) => b.box(3, 2.8, 0.5, { color: GEL[1], gloss: 0.8, omit: ['bottom', 'nz'] }));
  },

  /** Torre Bolha: esferas de vidro empilhadas (Aero no talo). */
  bld_com_3: (b) => {
    b.prism(3, 3, 8, { tile: 'concrete', topPaint: { color: CHROME, gloss: 1 } });
    b.at(0, 2.4, 0, 0, (b) => b.sphere(3.2, 8, 4, { tile: 'glass', gloss: 1, uvScale: 0.2 }));
    b.at(0, 8.2, 0, 0, (b) => b.sphere(2.6, 8, 4, { color: '#A6F0D2', gloss: 1 }));
    b.at(0, 13, 0, 0, (b) => b.sphere(1.9, 8, 4, { color: '#C9A4F2', gloss: 1 }));
    b.at(0, 16.6, 0, 0, (b) => b.prism(0.1, 3, 3, { color: CHROME, radiusTop: 0 }));
  },

  /** Conjunto com pista no telhado: quarter-pipe e rail lá em cima. */
  bld_res_3: (b) => {
    b.box(7, 3.2, 6.5, { tile: 'graffiti', omit: ['top', 'bottom'] });
    b.at(0, 3.2, 0, 0, (b) => b.box(7, 7, 6.5, { tile: 'facade', faces: { top: { tile: 'concrete' } }, omit: ['bottom'] }));
    b.at(0, 10.2, -1.6, Math.PI, (b) => quarterPipe(b, 6, 1.4, 3));
    b.at(0, 10.2, 2.2, 0, (b) => b.box(5, 0.35, 0.1, { color: CHROME, gloss: 1, omit: ['bottom'] }));
    b.at(-3.2, 5, 3.3, 0, (b) => b.box(0.3, 4.5, 0.2, { color: '#FF7A1A', gloss: 0.8, omit: ['bottom'] }));
  },

  /** Pátio Industrial: galpão de tijolo com telhado dente-de-serra e chaminé. */
  bld_ind_1: (b) => {
    b.box(7.5, 5, 7, { tile: 'brick', omit: ['top', 'bottom'], faces: { pz: { tile: 'graffiti' } } });
    for (const z of [-2.33, 0, 2.33]) {
      b.at(0, 5, z, 0, (b) => b.wedge(7.5, 1.6, 2.33, { tile: 'concrete', faces: { pz: { tile: 'glass', gloss: 0.6 } } }));
    }
    b.at(2.6, 5, -2.4, 0, (b) => b.prism(0.45, 5, 6, { tile: 'brick', top: false }));
  },

  /** Escola: concreto, faixas em gel e quadra no telhado. */
  bld_school: (b) => {
    b.box(7.2, 7, 6, { tile: 'facade', faces: { top: { color: '#1E8E5A' } }, omit: ['bottom'] });
    for (const [i, y] of [2.2, 4.6].entries()) {
      b.at(0, y, 3.05, 0, (b) => b.box(7.3, 0.4, 0.15, { color: GEL[i + 3], gloss: 0.8, omit: ['bottom'] }));
    }
    b.at(0, 7, 0, 0, (b) => b.box(4, 0.08, 3, { color: '#F2F8FC', omit: ['bottom'] }));
  },

  /** Clínica: branca, cruz verde (não usar cruz vermelha, símbolo protegido). */
  bld_hospital: (b) => {
    b.box(7, 10, 6.4, { tile: 'facade', color: '#F2F8FC', faces: { top: { tile: 'concrete' } }, omit: ['bottom'] });
    b.at(0, 7.4, 3.25, 0, (b) => {
      b.box(2.2, 0.7, 0.2, { color: '#39FF6A', gloss: 0.8, omit: ['bottom'] });
      b.at(0, -0.75, 0, 0, (b) => b.box(0.7, 2.2, 0.2, { color: '#39FF6A', gloss: 0.8, omit: ['bottom'] }));
    });
    b.at(1.5, 10, -0.8, 0, (b) => b.prism(2, 0.1, 8, { color: '#3A3F47' }));
  },

  /** Parque Aero: gramado, árvores lustrosas e fonte. */
  bld_park: (b) => {
    b.box(7.8, 0.12, 7.8, { tile: 'grass', omit: ['bottom'] });
    for (const [x, z] of [[-2.4, -2.2], [2.5, -1.8], [-1.8, 2.6]]) b.at(x, 0.12, z, 0, tree);
    b.at(1.6, 0.12, 1.8, 0, (b) => b.prism(1.5, 0.5, 8, { tile: 'azulejo', topPaint: { tile: 'water', gloss: 0.5 } }));
  },

  /** Skatepark de bairro: piso pichado, quarter, funbox e rail. */
  bld_skatepark: (b) => {
    b.box(7.8, 0.15, 7.8, { tile: 'concrete', omit: ['bottom'] });
    b.at(0, 0.15, -2.6, Math.PI, (b) => quarterPipe(b, 6, 1.8));
    b.at(0, 0.15, 1.2, 0, (b) => {
      b.box(2.4, 0.6, 1.6, { tile: 'graffiti', omit: ['bottom'] });
      b.at(0, 0, -1.6, Math.PI, (b) => b.wedge(2.4, 0.6, 1.6, { tile: 'maple', omit: ['pz'] }));
      b.at(0, 0, 1.6, 0, (b) => b.wedge(2.4, 0.6, 1.6, { tile: 'maple', omit: ['pz'] }));
    });
    b.at(-3, 0.15, 2.4, 0, (b) => b.box(0.1, 0.5, 3.2, { color: WORLD.cromo, gloss: 1, omit: ['bottom'] }));
  },
};

/** Quarter-pipe: curva côncava subindo em +z (reaproveitado em esquinas e skateparks). */
export function quarterPipe(b: B, w: number, r: number, segs = 4) {
  const pts: [number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * (Math.PI / 2);
    pts.push([r * Math.sin(a) - r, r - r * Math.cos(a)]); // [z, y]
  }
  const x = w / 2;
  for (let i = 0; i < segs; i++) {
    const [z0, y0] = pts[i], [z1, y1] = pts[i + 1];
    b.quadXYZ([-x, y0, z0], [x, y0, z0], [x, y1, z1], [-x, y1, z1], { tile: 'concrete' }, [0, r - (y0 + y1) / 2, -r - (z0 + z1) / 2]);
    for (const sx of [-x, x]) b.triXYZ([sx, 0, 0], [sx, y0, z0], [sx, y1, z1], { tile: 'concrete' }, [Math.sign(sx), 0, 0]);
  }
  b.quadXYZ([-x, 0, 0], [x, 0, 0], [x, r, 0], [-x, r, 0], { tile: 'graffiti' }, [0, 0, 1]);
  b.at(0, r, 0.25, 0, (b) => b.box(w, 0.08, 0.5, { tile: 'concrete', omit: ['bottom', 'nz'] }));
  b.at(0, r, -0.03, 0, (b) => b.box(w, 0.08, 0.08, { color: WORLD.cromo, gloss: 1, omit: ['bottom'] }));
}

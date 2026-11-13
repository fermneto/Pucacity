import { MeshBuilder } from './MeshBuilder';
import { tree } from './buildings';
import { WORLD } from '../palette';

/** Props urbanos. Tudo "grindável" sempre que der. Frente = +z. */
type B = MeshBuilder;
const CHROME = WORLD.cromo;

export const PROP_BUILDERS: Record<string, (o: B, g: B) => void> = {
  prop_tree_aero: (o) => tree(o),

  prop_lamp: (o) => {
    o.prism(0.08, 4.5, 4, { color: CHROME, gloss: 1, top: false });
    o.at(0, 4.4, 0.45, 0, (b) => b.box(0.08, 0.08, 1, { color: CHROME, omit: ['bottom'] }));
    o.at(0, 4.1, 0.95, 0, (b) => b.sphere(0.25, 4, 3, { color: '#B8F02A', gloss: 1 }));
  },

  prop_bench: (o) => {
    o.box(1.8, 0.45, 0.5, { tile: 'concrete', omit: ['bottom'] });
    o.at(0, 0.45, 0.22, 0, (b) => b.box(1.8, 0.05, 0.06, { color: CHROME, gloss: 1, omit: ['bottom'] }));
  },

  /** Parada Aero: abrigo de vidro verde-água, banco de concreto grindável e pílula da linha. */
  prop_stop_shelter: (o, g) => {
    o.box(4, 0.15, 1.6, { tile: 'concrete', omit: ['bottom'] });
    for (const x of [-1.8, 1.8]) o.at(x, 0.15, -0.6, 0, (b) => b.prism(0.06, 2.5, 4, { color: CHROME, top: false }));
    o.at(0, 2.6, 0, 0, (b) => b.box(4.2, 0.12, 1.9, { color: '#7FD8C8', gloss: 1, omit: [] }));
    o.at(0, 0.15, -0.3, 0, (b) => b.box(2.6, 0.45, 0.45, { tile: 'concrete', omit: ['bottom'] }));
    o.at(1.4, 2.0, 0.85, 0, (b) => b.box(1.2, 0.5, 0.12, { color: '#7B4FD6', gloss: 1, omit: ['bottom'] }));
    g.at(0, 0.15, -0.75, 0, (b) => b.box(4, 2.45, 0.06, { color: '#9FE8E0', gloss: 1, omit: ['bottom', 'top'] }));
  },

  /** Estação de compartilhamento de patinetes/hoverboards. */
  prop_share_station: (o) => {
    o.box(3.2, 0.12, 1, { tile: 'concrete', omit: ['bottom'] });
    for (const x of [-1, 0, 1]) {
      o.at(x, 0.12, 0, 0, (b) => {
        b.box(0.16, 0.06, 0.6, { color: '#FF7A1A', omit: ['bottom'] });
        b.at(0, 0.06, 0.26, 0, (b) => b.box(0.05, 0.9, 0.05, { color: '#FF7A1A', omit: ['bottom', 'top'] }));
      });
    }
    o.at(1.9, 0, 0, 0, (b) => b.box(0.5, 1.8, 0.4, { color: '#F2F8FC', faces: { pz: { color: '#3FD0E8', gloss: 1 } }, gloss: 0.5, omit: ['bottom'] }));
  },

  /** Telão CRT com moldura de plástico cinza dos anos 2000. */
  prop_crt_billboard: (o) => {
    o.prism(0.12, 3.2, 4, { color: CHROME, top: false });
    o.at(0, 3, 0, 0, (b) => b.box(3.2, 2.2, 0.8, { color: '#C9D3DC', faces: { pz: { color: '#00E5FF', gloss: 0.7 } }, omit: ['bottom'] }));
  },

  /** Nuvem cúmulo fofa (céu Aero). */
  prop_cloud: (o) => {
    for (const [x, y, r] of [[0, 0, 2.4], [2.4, -0.5, 1.8], [-2.3, -0.4, 1.7], [0.8, 1.2, 1.6]]) {
      o.at(x, y, 0, 0, (b) => b.sphere(r, 6, 4, { color: '#FFFFFF' }));
    }
  },
};

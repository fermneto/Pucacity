import { MeshBuilder } from './MeshBuilder';
import { tree } from './buildings';
import { DINO_BUILDERS } from './dinos';
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

  /** Estação de carga de patinetes e hoverboards: totem em gel com tomadas, rack cromado e cobertura solar de vidro. */
  prop_charge_station: (o, g) => {
    o.box(3.4, 0.12, 1.2, { tile: 'concrete', omit: ['bottom'] });
    // totem em gel: corpo verde-água, tela ciano, três tomadas com LED verde e luz no topo
    o.at(1.35, 0.12, 0, 0, (b) => {
      b.box(0.6, 1.8, 0.45, { color: '#1FB5A6', gloss: 1, faces: { pz: { color: '#7FD8C8', gloss: 1 } }, omit: ['bottom'] });
      b.at(0, 1.2, 0.23, 0, (b) => b.box(0.42, 0.4, 0.04, { color: '#00E5FF', gloss: 0.8, omit: ['bottom', 'nz'] }));
      for (const y of [0.45, 0.7, 0.95]) b.at(0, y, 0.23, 0, (b) => b.box(0.22, 0.14, 0.05, { color: '#39FF6A', gloss: 1, omit: ['bottom', 'nz'] }));
      b.at(0, 1.8, 0, 0, (b) => b.prism(0.22, 0.22, 6, { color: '#B8F02A', gloss: 1, radiusTop: 0.12 }));
    });
    // rack: barra cromada para encostar/travar, três vagas com plug laranja
    for (const x of [-1.5, 0.6]) o.at(x, 0.12, -0.25, 0, (b) => b.prism(0.05, 0.8, 4, { color: CHROME, gloss: 1, top: false }));
    o.at(-0.45, 0.88, -0.25, 0, (b) => b.box(2.15, 0.08, 0.08, { color: CHROME, gloss: 1, omit: ['bottom'] }));
    for (const x of [-1.1, -0.45, 0.2]) o.at(x, 0.12, 0.1, 0, (b) => b.box(0.18, 0.06, 0.7, { color: '#FF7A1A', gloss: 0.7, omit: ['bottom'] }));
    // cobertura solar: dois postes e placa de vidro azul
    for (const x of [-1.55, 1.55]) o.at(x, 0.12, -0.5, 0, (b) => b.prism(0.05, 2.3, 4, { color: CHROME, top: false }));
    g.at(0, 2.42, -0.15, 0, (b) => b.box(3.5, 0.08, 1.3, { color: '#2E8BEA', gloss: 1 }));
  },

  /** Telão CRT com moldura de plástico cinza dos anos 2000. */
  prop_crt_billboard: (o) => {
    o.prism(0.12, 3.2, 4, { color: CHROME, top: false });
    o.at(0, 3, 0, 0, (b) => b.box(3.2, 2.2, 0.8, { color: '#C9D3DC', faces: { pz: { color: '#00E5FF', gloss: 0.7 } }, omit: ['bottom'] }));
  },

  /** Nuvem cúmulo fofa (céu Aero). */
  prop_cloud: (o) => {
    for (const [x, y, r] of [[0, 0, 2.4], [2.4, -0.5, 1.8], [-2.3, -0.4, 1.7], [0.8, 1.2, 1.6]] as const) {
      o.at(x, y, 0, 0, (b) => b.sphere(r, 6, 4, { color: '#FFFFFF' }));
    }
  },

  ...DINO_BUILDERS,
};

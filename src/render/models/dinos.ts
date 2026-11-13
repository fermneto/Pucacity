import type { MeshBuilder, Paint } from './MeshBuilder';

/**
 * Dinossauros Frutiger Aero (props, até 200 tris cada). Design original do Pucacity:
 * bichos de gel lustroso, formas arredondadas e olhos de desenho, como brinquedos de vinil
 * de 2005. Nada copiado de filme, jogo ou marca. Frente = +z, base em y = 0, medidas em metros.
 * As cores são fixas no modelo (uma por espécie, da paleta) para a espécie ser reconhecida de cima.
 */
type B = MeshBuilder;
type V3 = [number, number, number];

const WHITE = '#F2F8FC';
const PUPIL = '#1A1B1E';
/** Gloss do corpo: lustroso, mas sem o reflexo do céu apagar a cor da espécie (o shader mistura o céu). */
const GEL = 0.5;

/** Olho simples: esclera branca lustrosa com pupila preta saltada para o lado `side` (±1 em x). */
function eye(b: B, at: V3, side: number) {
  const [x, y, z] = at;
  b.at(x, y - 0.09, z, 0, (b) => b.box(0.1, 0.18, 0.2, { color: WHITE, gloss: 0.8, omit: ['bottom'] }));
  b.at(x + side * 0.04, y - 0.05, z + 0.04, 0, (b) => b.box(0.06, 0.1, 0.1, { color: PUPIL, omit: ['bottom'] }));
}

export const DINO_BUILDERS: Record<string, (o: B, g: B) => void> = {
  /** Pescoçudo: quadrúpede de pescoço longo, azul-bolha com bolinhas brancas no lombo. */
  prop_dino_neck: (o) => {
    const gel: Paint = { color: '#3FD0E8', gloss: GEL };
    o.ellipsoid([0, 2.3, 0], [1.1, 0.95, 1.9], 6, 4, gel);
    for (const x of [-0.6, 0.6]) for (const z of [-1.1, 1.1]) o.limb([x, 0, z], [x, 2, z * 0.9], 0.34, 0.38, 5, gel);
    o.limb([0, 2.7, 1.4], [0, 5.4, 3.2], 0.45, 0.26, 5, gel);
    o.ellipsoid([0, 5.55, 3.45], [0.34, 0.28, 0.55], 5, 3, gel);
    o.limb([0, 2.3, -1.6], [0, 1.0, -4.6], 0.45, 0, 5, gel);
    for (const z of [-0.5, 0.5]) o.at(0, 2.95, z, 0, (b) => b.sphere(0.24, 4, 3, { color: WHITE, gloss: 0.5 }));
    for (const s of [-1, 1]) eye(o, [s * 0.3, 5.68, 3.62], s);
  },

  /** Corredor: bípede de cauda longa, verde-lima com crista de espinhos laranja. */
  prop_dino_runner: (o) => {
    const gel: Paint = { color: '#B8F02A', gloss: GEL };
    o.ellipsoid([0, 1.7, 0], [0.6, 0.65, 1.1], 6, 4, gel);
    o.limb([0, 2.0, 0.8], [0, 2.6, 1.35], 0.3, 0.25, 4, gel);
    o.ellipsoid([0, 2.75, 1.65], [0.32, 0.3, 0.55], 5, 3, gel);
    o.limb([0, 1.8, -0.9], [0, 1.7, -2.4], 0.4, 0.22, 4, gel);
    o.limb([0, 1.7, -2.4], [0, 1.95, -3.9], 0.22, 0, 4, gel);
    for (const s of [-1, 1]) {
      o.limb([s * 0.35, 1.5, 0], [s * 0.42, 0.8, -0.2], 0.25, 0.15, 4, gel);
      o.limb([s * 0.42, 0.8, -0.2], [s * 0.42, 0.1, 0.15], 0.15, 0.1, 4, gel);
      o.at(s * 0.42, 0, 0.3, 0, (b) => b.box(0.3, 0.12, 0.5, { color: '#1E8E5A', gloss: 0.6, omit: ['bottom'] }));
      o.limb([s * 0.45, 1.8, 0.7], [s * 0.5, 1.4, 1.05], 0.1, 0.06, 4, gel);
      eye(o, [s * 0.3, 2.86, 1.78], s);
    }
    const crest: Paint = { color: '#FF7A1A', gloss: 0.4 };
    for (const z of [0.5, -0.1, -0.7]) {
      for (const sx of [1, -1]) o.triXYZ([0, 2.2, z + 0.3], [0, 2.2, z - 0.3], [0, 2.65, z - 0.15], crest, [sx, 0, 0]);
    }
  },

  /** Chifrudo: quadrúpede rosa-chiclete com três chifres brancos e babado amarelo. */
  prop_dino_horns: (o) => {
    const gel: Paint = { color: '#FF5FA8', gloss: GEL };
    const horn: Paint = { color: WHITE, gloss: 0.5 };
    const frill: Paint = { color: '#FFE23A', gloss: 0.4 };
    o.ellipsoid([0, 1.6, -0.2], [1.2, 1.0, 1.7], 6, 4, gel);
    for (const x of [-0.75, 0.75]) for (const z of [-1.0, 1.0]) o.limb([x, 0, z - 0.2], [x * 0.93, 1.3, z * 0.9 - 0.2], 0.38, 0.4, 5, gel);
    o.ellipsoid([0, 1.6, 1.9], [0.6, 0.55, 0.75], 5, 3, gel);
    o.limb([0, 1.45, 2.45], [0, 1.2, 3.0], 0.3, 0, 4, horn); // bico
    // babado: leque atrás da cabeça, inclinado para trás, nas duas faces
    const n = 6, R = 1.35, c: V3 = [0, 1.85, 1.45];
    const rim: V3[] = Array.from({ length: n }, (_, i) => {
      const a = -0.2 + (i / (n - 1)) * (Math.PI + 0.4);
      return [Math.cos(a) * R, c[1] + Math.sin(a) * R * 0.9, c[2] - Math.sin(a) * 0.45];
    });
    for (let i = 0; i < n - 1; i++) {
      const a = rim[i]!, b = rim[i + 1]!;
      o.triXYZ(c, a, b, frill, [0, 0.3, 1]);
      o.triXYZ(c, a, b, frill, [0, -0.3, -1]);
      // espinho de borda (aponta para fora do leque)
      const m: V3 = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5];
      const tip: V3 = [c[0] + (m[0] - c[0]) * 1.3, c[1] + (m[1] - c[1]) * 1.3, c[2] + (m[2] - c[2]) * 1.3];
      for (const s of [1, -1]) o.triXYZ(a, b, tip, gel, [0, 0.3 * s, s]);
    }
    for (const s of [-1, 1]) {
      o.limb([s * 0.3, 2.0, 2.1], [s * 0.42, 2.85, 2.85], 0.11, 0, 4, horn);
      eye(o, [s * 0.52, 1.85, 2.15], s);
    }
    o.limb([0, 1.85, 2.5], [0, 2.3, 2.85], 0.1, 0, 4, horn);
    o.limb([0, 1.5, -1.8], [0, 0.8, -3.4], 0.5, 0, 5, gel);
  },
};

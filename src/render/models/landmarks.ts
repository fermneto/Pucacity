import type { MeshBuilder, Paint } from './MeshBuilder';

/**
 * MARCOS (estruturas gigantes Frutiger Aero) — categoria `marco` do catálogo.
 *
 * São a EXCEÇÃO ao orçamento de prédios (≤ 200 tris): cada marco pode ter até 400 tris
 * (BUDGET.marco em catalog.ts), porque aparece poucas vezes no mapa, mede 40–120 m e
 * precisa de silhueta própria no skyline. Designs originais do Pucacity (nada copiado):
 * vidro e gel lustrosos, cromo, água turquesa, verde-limão e bolhas, com curvas suaves.
 *
 * Convenções: metros, base em y = 0, frente = +z. `o` recebe as peças opacas e `g` o vidro
 * translúcido. O gloss fica entre 0,5 e 0,8 nas partes coloridas (gloss alto mistura o céu e
 * desbota a cor); só o cromo vai a 0,8–0,9.
 *
 * PEGADA (footprint) = meia-extensão local [x-, z-, x+, z+] em TILES (1 tile = 10 m), já com
 * as partes que se projetam no chão (rotores, rodas, piscinas). `scripts/gen-vitrine.mjs`
 * copia estes números para reservar espaço e checar sobreposição. Mudou a geometria? Atualize
 * a pegada aqui e lá.
 */
type B = MeshBuilder;
type V3 = [number, number, number];

const CHROME: Paint = { color: '#D6DEE6', gloss: 0.85 };
const WHITE_GEL: Paint = { color: '#F2F8FC', gloss: 0.6 };
const LIME: Paint = { color: '#B8F02A', gloss: 0.6 };
const AQUA: Paint = { color: '#3FD0E8', gloss: 0.65 };
const WATER: Paint = { tile: 'water', gloss: 0.5, uvScale: 0.1 };
const GLASS = (color: string): Paint => ({ color, gloss: 0.7 });

/**
 * Sólido de revolução em volta do eixo Y. `profile` = [raio, y] de baixo para cima;
 * raio 0 fecha o polo com um leque de triângulos.
 */
function lathe(b: B, profile: [number, number][], sides: number, p: Paint) {
  const P = (r: number, y: number, a: number): V3 => [Math.cos(a) * r, y, Math.sin(a) * r];
  for (let k = 0; k + 1 < profile.length; k++) {
    const [r0, y0] = profile[k]!, [r1, y1] = profile[k + 1]!;
    // normal do perfil (aponta para fora): tangente (dr, dy) → (dy, -dr)
    const nr = y1 - y0, ny = -(r1 - r0);
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2, am = (a0 + a1) / 2;
      const out: V3 = [Math.cos(am) * nr, ny, Math.sin(am) * nr];
      if (r0 === 0) b.triXYZ(P(0, y0, 0), P(r1, y1, a0), P(r1, y1, a1), p, out);
      else if (r1 === 0) b.triXYZ(P(r0, y0, a0), P(r0, y0, a1), P(0, y1, 0), p, out);
      else b.quadXYZ(P(r0, y0, a0), P(r0, y0, a1), P(r1, y1, a1), P(r1, y1, a0), p, out);
    }
  }
}

/** Raio do perfil de revolução na altura y (interpolação linear). */
function radiusAt(profile: [number, number][], y: number): number {
  for (let k = 0; k + 1 < profile.length; k++) {
    const [r0, y0] = profile[k]!, [r1, y1] = profile[k + 1]!;
    if (y >= y0 && y <= y1) return r0 + ((y - y0) / (y1 - y0)) * (r1 - r0);
  }
  return 0;
}

/** Árvore lustrosa gigante (tronco + copa em gel). 32 tris. */
function bigTree(b: B, x: number, z: number, h: number, r: number, color: string) {
  b.at(x, 0, z, 0, (b) => {
    b.prism(r * 0.14, h * 0.6, 4, { color: '#8E5E33', top: false });
    b.ellipsoid([0, h * 0.62, 0], [r, r * 0.85, r], 6, 3, { color, gloss: 0.55 });
  });
}

/** Folha gigante ao longo de +z: nervura central arqueada, bordas em concha. 40 tris. */
function leaf(b: B, L: number, W: number, color: string) {
  const n = 6;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const y = 4 * Math.sin(Math.PI * t) - 3 * t * t;
    const w = (W / 2) * Math.pow(Math.sin(Math.PI * Math.min(t, 0.97)), 0.7) * (i === 0 || i === n ? 0 : 1);
    return { z: t * L, y, w };
  });
  const top: Paint = { color, gloss: 0.65 };
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, c = pts[i + 1]!;
    const cupA = a.w * 0.28, cupC = c.w * 0.28;
    for (const s of [-1, 1]) {
      const mA: V3 = [0, a.y, a.z], mC: V3 = [0, c.y, c.z];
      const eA: V3 = [s * a.w, a.y - cupA, a.z], eC: V3 = [s * c.w, c.y - cupC, c.z];
      for (const up of [1, -1]) {
        const out: V3 = [0, up, 0];
        if (a.w === 0) b.triXYZ(mA, mC, eC, top, out);
        else if (c.w === 0) b.triXYZ(mA, mC, eA, top, out);
        else b.quadXYZ(mA, mC, eC, eA, top, out);
      }
    }
  }
}

export const LANDMARK_BUILDERS: Record<string, (o: B, g: B) => void> = {
  /**
   * Torre Orbe (~112 m): três esferas de vidro enormes empilhadas num fuste de concreto, cada
   * uma com um núcleo em gel colorido dentro e um anel cromado no equador; no alto, uma bolha
   * menor e a antena com ponta verde-limão.
   * Pegada: [-1.6, -1.6, 1.6, 1.6] (orbe de baixo com 30 m de diâmetro).
   */
  lmk_orb_tower: (o, g) => {
    o.prism(14, 3, 8, { tile: 'concrete', topPaint: CHROME });
    o.at(0, 3, 0, 0, (b) => b.prism(2.5, 90, 6, { tile: 'concrete', color: '#E6EEF4', top: false }));
    const orbs: [number, number, string, string][] = [
      [3, 15, '#7FE8F8', '#1FB5A6'], [34, 12, '#A6F0D2', '#6CCB3F'], [59, 9, '#D8C4FF', '#7B4FD6'],
    ];
    for (const [y, r, glass, core] of orbs) {
      g.at(0, y, 0, 0, (b) => b.sphere(r, 8, 5, GLASS(glass)));
      o.ellipsoid([0, y + r, 0], [r * 0.55, r * 0.5, r * 0.55], 6, 3, { color: core, gloss: 0.6 });
      o.at(0, y + r - 0.5, 0, 0, (b) => b.prism(r + 0.35, 1, 8, { ...CHROME, top: false }));
    }
    g.at(0, 78, 0, 0, (b) => b.sphere(4.5, 6, 3, GLASS('#BFF6FF')));
    o.at(0, 86, 0, 0, (b) => b.prism(0.7, 24, 4, { ...CHROME, radiusTop: 0 }));
    o.at(0, 108.5, 0, 0, (b) => b.sphere(1.5, 4, 3, LIME));
  },

  /**
   * Biosfera (60 m de diâmetro, ~28 m de altura): cúpula de vidro com nervuras cromadas sobre
   * um anel de concreto gramado; dentro, árvores lustrosas e uma cascata caindo num lago.
   * Pegada: [-3.2, -3.2, 3.2, 3.2].
   */
  lmk_biodome: (o, g) => {
    const R = 30, H = 26, base = 2;
    o.prism(R + 1, base, 12, { tile: 'concrete', topPaint: { tile: 'grass', uvScale: 0.15 } });
    const lat = 4;
    const prof: [number, number][] = Array.from({ length: lat + 1 }, (_, k) => {
      const a = (k / lat) * (Math.PI / 2);
      return [k === lat ? 0 : R * Math.cos(a), base + H * Math.sin(a)];
    });
    lathe(g, prof, 12, GLASS('#BFF6FF'));
    // nervuras cromadas (6 meridianos) e anel do equador
    for (let m = 0; m < 6; m++) {
      const a = (m / 6) * Math.PI * 2 + Math.PI / 12, da = 0.035;
      for (let k = 0; k < lat; k++) {
        const [r0, y0] = prof[k]!, [r1, y1] = prof[k + 1]!;
        const p = (r: number, y: number, aa: number): V3 => [Math.cos(aa) * (r + 0.3), y + 0.15, Math.sin(aa) * (r + 0.3)];
        o.quadXYZ(p(r0, y0, a - da), p(r0, y0, a + da), p(r1, y1, a + da), p(r1, y1, a - da), CHROME, [Math.cos(a) * (y1 - y0), r0 - r1, Math.sin(a) * (y1 - y0)]);
      }
    }
    o.at(0, base, 0, 0, (b) => b.prism(R + 0.4, 1.2, 12, { ...AQUA, top: false }));
    // floresta interna
    for (const [x, z, h, r, c] of [[-12, 8, 16, 5.5, '#6CCB3F'], [10, 10, 14, 5, '#B8F02A'], [12, -8, 18, 6, '#1E8E5A'], [-3, -2, 12, 4.5, '#7BD13A']] as const) {
      o.at(0, base, 0, 0, (b) => bigTree(b, x, z, h, r, c));
    }
    // cascata: penhasco, véu d'água e lago
    o.at(-9, base, -14, 0, (b) => {
      b.box(11, 17, 7, { tile: 'concrete', color: '#BDB4A4', omit: ['bottom'] });
      b.quadXYZ([-3, 0.4, 3.6], [3, 0.4, 3.6], [3, 17, 3.6], [-3, 17, 3.6], { ...WATER, color: '#BFF6FF', uvScale: 0.2 }, [0, 0, 1]);
      b.at(0, 0, 6, 0, (b) => b.prism(6, 0.6, 8, { tile: 'azulejo', topPaint: WATER }));
    });
    // portal de entrada em gel (frente)
    o.at(0, 0, R + 0.5, 0, (b) => b.box(9, 6, 2.5, { ...AQUA, faces: { top: LIME }, omit: ['bottom'] }));
  },

  /**
   * Roda-Gigante de Bolhas (~72 m): aro largo em gel ciano com raios cromados, cubo verde-limão
   * e oito cabines-bolha de vidro penduradas; a de baixo encosta na plataforma de embarque.
   * A roda fica no plano XY (de frente para +z). Pegada: [-3.55, -0.55, 3.55, 0.55].
   */
  lmk_bubble_wheel: (o, g) => {
    const R = 32, hub = 40, segs = 12, rim = 3, zr = 1.6, cab = 3.5;
    o.box(16, 1, 10, { tile: 'concrete', faces: { top: { tile: 'maple' } }, omit: ['bottom'] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) o.limb([sx * 12, 1, sz * 4], [0, hub, sz * 2.2], 1.2, 0.8, 4, WHITE_GEL);
    o.limb([0, hub, -3], [0, hub, 3], 1.4, 1.4, 6, CHROME);
    o.ellipsoid([0, hub, 0], [3.6, 3.6, 2.4], 6, 3, LIME);
    const rp = (r: number, a: number, z: number): V3 => [Math.cos(a) * r, hub + Math.sin(a) * r, z];
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, am = (a0 + a1) / 2;
      for (const z of [zr, -zr]) o.quadXYZ(rp(R - rim, a0, z), rp(R, a0, z), rp(R, a1, z), rp(R - rim, a1, z), AQUA, [0, 0, z]);
      o.quadXYZ(rp(R, a0, -zr), rp(R, a0, zr), rp(R, a1, zr), rp(R, a1, -zr), { ...CHROME, gloss: 0.7 }, [Math.cos(am), Math.sin(am), 0]);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI + Math.PI / 12;
      o.limb(rp(R - 1.5, a + Math.PI, 0), rp(R - 1.5, a, 0), 0.75, 0.75, 3, CHROME);
    }
    const tints = ['#7FE8F8', '#FF9FD0', '#C8FF6A', '#9FC4FF'];
    for (let k = 0; k < 8; k++) {
      const a = -Math.PI / 2 + (k / 8) * Math.PI * 2;
      const [x, y] = rp(R, a, 0);
      g.at(x, y - 0.4 - 2 * cab, 0, 0, (b) => b.sphere(cab, 6, 3, GLASS(tints[k % tints.length]!)));
    }
  },

  /**
   * Aqueduto Aero: arco de vidro translúcido com 80 m de vão entre dois pilares, levando um
   * canal de água turquesa a 22 m de altura; a água cai em cascata em duas piscinas na frente
   * dos pilares e bolhas flutuam sobre o canal. Atravessa ao longo de x.
   * Pegada: [-4.75, -0.4, 4.75, 0.95].
   */
  lmk_aqueduct: (o, g) => {
    const half = 40, top = 22, Z = 3;
    for (const s of [-1, 1]) {
      o.at(s * 43, 0, 0, 0, (b) => {
        b.box(6, top, 6, { tile: 'concrete', color: '#F2F8FC', faces: { pz: { tile: 'azulejo' } }, omit: ['bottom', 'top'] });
        b.at(0, top - 1.5, 0, 0, (b) => b.prism(4.2, 1.5, 6, LIME));
        // véu d'água caindo do canal na piscina da frente
        b.quadXYZ([-2, top, 3.6], [2, top, 3.6], [2, 0.6, 6.5], [-2, 0.6, 6.5], { ...WATER, color: '#BFF6FF' }, [0, 0.3, 1]);
        b.quadXYZ([-2, top, 3.6], [2, top, 3.6], [2, 0.6, 6.5], [-2, 0.6, 6.5], { ...WATER, color: '#BFF6FF' }, [0, -0.3, -1]);
        b.at(0, 0, 5.5, 0, (b) => b.prism(4, 0.6, 8, { tile: 'azulejo', topPaint: WATER }));
      });
    }
    // arco de vidro (intradorso + tímpanos dos dois lados)
    const n = 10, arch = (x: number) => (top - 2) * (1 - (x / half) ** 2);
    for (let i = 0; i < n; i++) {
      const x0 = -half + (i / n) * 2 * half, x1 = -half + ((i + 1) / n) * 2 * half;
      const y0 = arch(x0), y1 = arch(x1);
      g.quadXYZ([x0, y0, -Z], [x1, y1, -Z], [x1, y1, Z], [x0, y0, Z], GLASS('#9FE8F8'), [0, -1, 0]);
      for (const z of [-Z, Z]) g.quadXYZ([x0, y0, z], [x1, y1, z], [x1, top, z], [x0, top, z], GLASS('#7FE8F8'), [0, 0, z]);
    }
    // canal elevado: laje branca, muretas em gel e lâmina d'água
    o.at(0, top, 0, 0, (b) => {
      b.box(92, 1, 7, { ...WHITE_GEL, omit: ['bottom'] });
      for (const z of [-3.2, 3.2]) b.at(0, 1, z, 0, (b) => b.box(92, 1.6, 0.6, { ...AQUA, omit: ['bottom'] }));
      for (let i = 0; i < 4; i++) {
        const x0 = -46 + i * 23, x1 = x0 + 23;
        b.quadXYZ([x0, 2.2, -2.9], [x1, 2.2, -2.9], [x1, 2.2, 2.9], [x0, 2.2, 2.9], WATER, [0, 1, 0]);
      }
    });
    for (const [x, y, r] of [[-22, 29, 2.6], [-6, 33, 3.4], [12, 30, 2.2], [27, 35, 3]] as const) {
      g.at(x, y, 0, 0, (b) => b.sphere(r, 6, 3, GLASS('#E8FFFF')));
    }
  },

  /**
   * Turbina Aero (~66 m): torre branca lustrosa e afunilada com faixa verde-limão, nacele em
   * cápsula, cubo em gel ciano e três pás curvas com ponta em gel. O rotor gira no plano XY
   * (de frente para +z). Pegada: [-1.65, -0.45, 1.65, 0.75].
   */
  lmk_wind_turbine: (o) => {
    const hubY = 47, L = 15.5;
    o.prism(4.5, 1.2, 8, { tile: 'concrete', topPaint: LIME });
    o.at(0, 1.2, 0, 0, (b) => b.prism(2.6, 45, 8, { ...WHITE_GEL, radiusTop: 1.5, top: false }));
    o.at(0, 8, 0, 0, (b) => b.prism(2.55, 3, 8, { ...LIME, radiusTop: 2.48, top: false }));
    o.ellipsoid([0, hubY, 0.4], [2.2, 2.2, 4.6], 6, 3, WHITE_GEL);
    o.ellipsoid([0, hubY, 5.2], [1.9, 1.9, 2.3], 6, 3, AQUA);
    const z = 5.8;
    for (let k = 0; k < 3; k++) {
      const th = Math.PI / 2 + (k / 3) * Math.PI * 2;
      const u = [Math.cos(th), Math.sin(th)], v = [-Math.sin(th), Math.cos(th)];
      const n = 4;
      const P = (t: number, side: number): V3 => {
        const r = 1.6 + t * L, sweep = 2.4 * t * t, c = (3.6 * (1 - t) + 0.9) / 2;
        const off = sweep + side * c;
        return [u[0]! * r + v[0]! * off, hubY + u[1]! * r + v[1]! * off, z + side * 0.35];
      };
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        const paint = i === n - 1 ? LIME : WHITE_GEL;
        for (const s of [1, -1]) o.quadXYZ(P(t0, -1), P(t1, -1), P(t1, 1), P(t0, 1), paint, [0, 0, s]);
      }
    }
  },

  /**
   * Torre Gota (~100 m com a antena): arranha-céu em forma de gota d'água de vidro azul-piscina,
   * com cintas cromadas, sobre um pedestal em gel e um espelho d'água redondo.
   * Pegada: [-2.45, -2.45, 2.45, 2.45].
   */
  lmk_drop_tower: (o, g) => {
    o.prism(24, 1.5, 12, { tile: 'concrete', topPaint: WATER });
    o.at(0, 1.5, 0, 0, (b) => b.prism(14, 1.5, 10, LIME));
    const prof: [number, number][] = [[0, 3], [14, 4], [21, 9], [24, 17], [23.5, 26], [20, 35], [14, 46], [8.5, 58], [4.5, 70], [1.8, 82], [0, 92]];
    lathe(o, prof, 12, { tile: 'glass', color: '#A8F0FF', gloss: 0.7, uvScale: 0.12 });
    for (const y of [17, 33, 50]) {
      o.at(0, y, 0, 0, (b) => b.prism(radiusAt(prof, y) + 0.5, 1.2, 12, { ...CHROME, radiusTop: radiusAt(prof, y + 1.2) + 0.5, top: false }));
    }
    g.at(0, 88, 0, 0, (b) => b.sphere(2.2, 6, 3, GLASS('#E8FFFF')));
    o.at(0, 91, 0, 0, (b) => b.prism(0.5, 10, 4, { ...CHROME, radiusTop: 0 }));
  },

  /**
   * Pavilhão Folha: quatro folhas gigantes verdes e lustrosas, em concha, servindo de cobertura
   * sobre colunas cromadas; embaixo, praça de azulejo, fonte e gotas de orvalho em gel.
   * Pegada: [-2.1, -2.1, 2.1, 2.1].
   */
  lmk_leaf_pavilion: (o) => {
    o.prism(18, 1, 10, { tile: 'concrete', topPaint: { tile: 'azulejo', uvScale: 0.2 } });
    o.at(0, 1, 0, 0, (b) => b.prism(3, 0.8, 8, { tile: 'azulejo', topPaint: WATER }));
    const leaves: [number, number, string][] = [[0.3, 14, '#6CCB3F'], [1.9, 11, '#B8F02A'], [3.5, 16, '#1E8E5A'], [5.0, 12, '#7BD13A']];
    for (const [rot, h, c] of leaves) {
      o.at(0, 0, 0, rot, (b) => {
        b.at(0, h, 1, 0, (b) => leaf(b, 20, 11, c));
        // coluna cromada até o meio da folha
        const t = 0.4, yl = h + 4 * Math.sin(Math.PI * t) - 3 * t * t;
        b.limb([0, 1, 1 + 20 * t], [0, yl - 0.2, 1 + 20 * t], 0.55, 0.4, 6, CHROME);
      });
    }
    o.limb([0, 1.8, 0], [0, 12, 0], 0.7, 0.5, 6, CHROME);
    for (const [x, y, z] of [[4, 16.5, 6], [-6, 14.6, 3], [2, 18.5, -7]] as const) o.ellipsoid([x, y, z], [0.9, 1.1, 0.9], 4, 3, { color: '#BFF6FF', gloss: 0.8 });
  },

  /**
   * Rampa Arco-Íris: rampa de skate gigante em arco (pico a 21 m) com seis faixas de gel nas
   * cores do arco-íris, ligando dois platôs de concreto com coping cromado e rampas de acesso;
   * nuvens fofas escondem as pontas do arco. Atravessa ao longo de x.
   * Pegada: [-4.25, -0.75, 4.25, 0.75].
   */
  lmk_rainbow_ramp: (o) => {
    const span = 20, base = 8, peak = 21, Wz = 12, n = 10;
    const colors = ['#E8322C', '#FF9F1C', '#FFE23A', '#6CCB3F', '#2E8BEA', '#7B4FD6'];
    const yAt = (x: number) => base + (peak - base) * (1 - (x / span) ** 2);
    for (let i = 0; i < n; i++) {
      const x0 = -span + (i / n) * 2 * span, x1 = -span + ((i + 1) / n) * 2 * span;
      const y0 = yAt(x0), y1 = yAt(x1);
      colors.forEach((c, k) => {
        const z0 = -Wz / 2 + (k * Wz) / colors.length, z1 = z0 + Wz / colors.length;
        o.quadXYZ([x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1], { color: c, gloss: 0.6 }, [0, 1, 0]);
      });
      o.quadXYZ([x0, y0 - 0.9, -Wz / 2], [x1, y1 - 0.9, -Wz / 2], [x1, y1 - 0.9, Wz / 2], [x0, y0 - 0.9, Wz / 2], WHITE_GEL, [0, -1, 0]);
      for (const z of [-Wz / 2, Wz / 2]) o.quadXYZ([x0, y0 - 0.9, z], [x1, y1 - 0.9, z], [x1, y1, z], [x0, y0, z], WHITE_GEL, [0, 0, z]);
    }
    for (const s of [-1, 1]) {
      o.at(s * 25, 0, 0, 0, (b) => {
        b.box(10, base, 14, { tile: 'graffiti', faces: { top: { tile: 'maple' } }, omit: ['bottom'] });
        b.at(-s * 5, base, 0, 0, (b) => b.box(0.4, 0.4, 14, { ...CHROME, omit: ['bottom'] }));
        // rampa de acesso descendo para fora do platô
        b.at(s * 11, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, (b) => b.wedge(12, base, 12, { tile: 'maple', faces: { pz: { tile: 'concrete' } } }));
      });
      o.limb([s * 10, 0, 0], [s * 10, yAt(10) - 0.9, 0], 0.9, 0.7, 4, CHROME);
      o.ellipsoid([s * 19, base + 0.5, 0], [4.5, 3, 7], 6, 3, { color: '#FFFFFF', gloss: 0.5 });
    }
  },

  /**
   * Gramado Aero: chão de grama verde-limão de 60 × 60 m (subdividido de 10 em 10 m, contra o
   * affine do PS1) que serve de base aos marcos, dinossauros e árvores dos parques.
   * Não ocupa espaço de outros objetos: só não pode ficar em cima de vias e canais.
   * Os vértices precisam cair nos mesmos pontos da malha do chão do CityView (senão o vertex
   * snapping do PS1 faz o gramado "brigar" com a calçada): o gerador alinha o centro.
   * Pegada: [-3, -3, 3, 3].
   */
  lmk_lawn: (o) => {
    const S = 60, step = 10, y = 0.25, h = S / 2;
    const grass: Paint = { tile: 'grass', uvScale: 0.1 };
    for (let x = -h; x < h; x += step) for (let z = -h; z < h; z += step) {
      o.quadXYZ([x, y, z], [x + step, y, z], [x + step, y, z + step], [x, y, z + step], grass, [0, 1, 0]);
    }
    o.box(S, y, S, { color: '#4FA82A', omit: ['top', 'bottom'] });
  },
};

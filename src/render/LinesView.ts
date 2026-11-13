import { Group, Mesh, Vector3 } from 'three';
import type { CityFile } from '../core/types';
import type { TransitLineSpec } from '../core/Commands';
import { MeshBuilder } from './models/MeshBuilder';
import { createPs1Material } from './ps1/Ps1Material';
import { getAtlas } from './textures/Atlas';

/** Linhas de coletivo criadas pelo jogador: faixa colorida sobre o percurso e um totem em gel em cada parada. */
const LINE_COLOR: Record<TransitLineSpec['kind'], string> = { tuktuk: '#3FD0E8', tandem: '#FF5FA8' };

export class LinesView {
  readonly group = new Group();
  private material = createPs1Material({ map: getAtlas().texture });

  update(city: CityFile, lines: readonly TransitLineSpec[]) {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      (c as Mesh).geometry.dispose();
    }
    if (!lines.length) return;
    const b = new MeshBuilder();
    const node = (id: number) => city.nodes.find((n) => n.id === id);
    lines.forEach((line, li) => {
      const color = LINE_COLOR[line.kind];
      const off = 0.05 + li * 0.03; // linhas paralelas não se sobrepõem
      for (let i = 0; i + 1 < line.stops.length; i++) {
        const a = node(line.stops[i]!), z = node(line.stops[i + 1]!);
        if (!a || !z) continue;
        const A = new Vector3(a.x, 0.09, a.y), B = new Vector3(z.x, 0.09, z.y);
        const d = B.clone().sub(A).normalize();
        const side = new Vector3(-d.z, 0, d.x).multiplyScalar(0.05);
        const o = new Vector3(-d.z, 0, d.x).multiplyScalar(off);
        b.quad(A.clone().add(o).sub(side), A.clone().add(o).add(side), B.clone().add(o).add(side), B.clone().add(o).sub(side),
          { color, gloss: 0.6 }, new Vector3(0, 1, 0));
      }
      for (const id of line.stops) {
        const n = node(id);
        if (!n) continue;
        b.at(n.x + 0.35, 0, n.y + 0.35, 0, (s) => {
          s.prism(0.03, 0.32, 4, { color: '#D6DEE6', top: false });
          s.at(0, 0.32, 0, 0, (t) => t.sphere(0.06, 6, 4, { color, gloss: 0.8 }));
        });
      }
    });
    this.group.add(new Mesh(b.build(), this.material));
  }
}

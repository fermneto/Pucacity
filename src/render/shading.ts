import * as THREE from 'three';

/**
 * Cor de vértice por direção da face, imitando luz "pintada" no vértice (sem luz dinâmica).
 * A geometria precisa ser não indexada ou ter normais por face (BoxGeometry já tem).
 */
export function bakeFaceShading(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const normal = geo.getAttribute('normal') as THREE.BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < normal.count; i++) {
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);
    let s = 0.6;
    if (ny > 0.5) s = 1.0;
    else if (nx > 0.5) s = 0.85;
    else if (nz > 0.5) s = 0.75;
    else if (nx < -0.5) s = 0.62;
    else if (nz < -0.5) s = 0.55;
    else if (ny < -0.5) s = 0.4;
    colors.push(s, s, s);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

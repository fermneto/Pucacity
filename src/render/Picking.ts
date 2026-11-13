import * as THREE from 'three';

const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hit = new THREE.Vector3();

/**
 * Converte a posição do mouse em coordenadas de tile (city.x, city.y) intersectando o plano y = 0.
 * Retorna null se o raio não atinge o chão.
 */
export function screenToTile(clientX: number, clientY: number, dom: HTMLElement, camera: THREE.Camera): { x: number; y: number } | null {
  const rect = dom.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return { x: hit.x, y: hit.z };
}

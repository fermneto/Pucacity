import type { BufferGeometry } from 'three';
import veiculos from '../../../data/arte/veiculos.json';
import elementos from '../../../data/arte/elementos-radicais.json';
import { MeshBuilder, triCount } from './MeshBuilder';
import { VEHICLE_BUILDERS } from './vehicles';
import { BUILDING_BUILDERS } from './buildings';
import { RADICAL_BUILDERS } from './radical';
import { PROP_BUILDERS } from './props';
import { AGENT_SCALE, TILE_M } from '../util';

/**
 * Catálogo de todos os modelos do jogo, com orçamento de polígonos do SPEC (§5).
 * Os ids seguem a convenção de nomes do contrato Arte → Engenharia (SPEC §11.4):
 * veh_*, bld_*, rad_*, prop_*. Quando os .glb do Blender chegarem, substituem estes.
 */
export type Category = 'veiculo' | 'predio' | 'radical' | 'prop';

export interface ModelGeo {
  opaque: BufferGeometry;
  glass?: BufferGeometry;
  tris: number;
}

export interface ModelDef {
  id: string;
  nome: string;
  categoria: Category;
  /** Máximo de triângulos permitido (SPEC). */
  budget: number;
  /** Para veículos: o `kind` do city.json. */
  kind?: string;
  lane?: string;
  /** Vão padrão (m) das travessias. */
  span?: number;
}

export const BUDGET: Record<Category, number> = { veiculo: 60, predio: 200, radical: 300, prop: 200 };

const VEH_LANE: Record<string, string> = Object.fromEntries(
  Object.entries(veiculos.faixas).map(([k, v]) => [k, (v as { lane: string }).lane]),
);

const vehicleDefs: ModelDef[] = [
  ...veiculos.individuais.map((v) => ({ id: `veh_${v.kind}`, nome: v.nome, kind: v.kind, lane: VEH_LANE[v.faixa] })),
  { id: 'veh_tandem', nome: 'Bicicleta Tandem (2)', kind: 'tandem', lane: 'transit' },
  { id: 'veh_tandem_4', nome: 'Bicicleta Tandem (4)', kind: 'tandem', lane: 'transit' },
  { id: 'veh_tuktuk', nome: 'Tuk-tuk', kind: 'tuktuk', lane: 'transit' },
].map((d) => ({ ...d, categoria: 'veiculo' as const, budget: BUDGET.veiculo }));

const NOMES_PREDIO: Record<string, string> = {
  bld_res_1: 'Residencial (Vila Concreto)',
  bld_res_2: 'Conjunto alto',
  bld_com_1: 'Torre de vidro (Centro Gel)',
  bld_com_2: 'Shopping bolha',
  bld_ind_1: 'Galpão (Pátio Industrial)',
  bld_school: 'Escola',
  bld_hospital: 'Clínica',
  bld_park: 'Parque Aero',
  bld_skatepark: 'Skatepark de bairro',
};

const RAD_ID: Record<string, string> = {
  rampa_ponte: 'rad_ramp_bridge', loop_aereo: 'rad_air_loop', salto_mortal: 'rad_death_jump',
  rail_passarela: 'rad_rail_walkway', wallride_tubular: 'rad_wallride', quarter_esquina: 'rad_quarter',
  funil_bowl: 'rad_bowl', elevador_bolha: 'rad_bubble_lift',
};

const radicalDefs: ModelDef[] = [
  ...elementos.elementos.map((e) => ({ id: RAD_ID[e.id], nome: e.nome })),
  { id: 'rad_bubble_cabin', nome: 'Cápsula do Elevador' },
].map((d) => ({ ...d, categoria: 'radical' as const, budget: BUDGET.radical, span: 24 }));

const NOMES_PROP: Record<string, string> = {
  prop_tree_aero: 'Árvore Aero', prop_lamp: 'Poste gel', prop_bench: 'Banco grindável',
  prop_stop_shelter: 'Parada Aero', prop_share_station: 'Estação de compartilhamento',
  prop_crt_billboard: 'Telão CRT', prop_cloud: 'Nuvem',
};

export const CATALOG: ModelDef[] = [
  ...vehicleDefs,
  ...Object.keys(BUILDING_BUILDERS).map((id) => ({ id, nome: NOMES_PREDIO[id] ?? id, categoria: 'predio' as const, budget: BUDGET.predio })),
  ...radicalDefs,
  ...Object.keys(PROP_BUILDERS).map((id) => ({ id, nome: NOMES_PROP[id] ?? id, categoria: 'prop' as const, budget: BUDGET.prop })),
];

/** Escala metros → tiles. Veículos ganham o exagero de legibilidade. */
export function scaleOf(def: ModelDef): number {
  return (def.categoria === 'veiculo' ? AGENT_SCALE : 1) / TILE_M;
}

const cache = new Map<string, ModelGeo>();

export function buildModel(id: string, span?: number): ModelGeo {
  const key = `${id}@${span ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = CATALOG.find((d) => d.id === id);
  if (!def) throw new Error(`Modelo desconhecido: ${id}`);
  const o = new MeshBuilder(), g = new MeshBuilder();
  if (def.categoria === 'veiculo') VEHICLE_BUILDERS[id.slice(4)](o);
  else if (def.categoria === 'predio') BUILDING_BUILDERS[id](o);
  else if (def.categoria === 'radical') RADICAL_BUILDERS[id](o, g, span ?? def.span ?? 24);
  else PROP_BUILDERS[id](o, g);
  const s = scaleOf(def);
  const geo: ModelGeo = {
    opaque: o.build(s),
    glass: g.triCount ? g.build(s) : undefined,
    tris: o.triCount + g.triCount,
  };
  cache.set(key, geo);
  return geo;
}

export function vehicleModelForKind(kind: string): string {
  return kind === 'tandem' ? 'veh_tandem' : `veh_${kind}`;
}

export { triCount };

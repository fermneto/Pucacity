/** Contrato do city.json (SPEC §6). Lógica pura: sem Three.js aqui. */

export type LaneKind = 'sidewalk' | 'slow' | 'fast' | 'transit';
export type VehicleKind =
  | 'pedestrian' | 'wheelchair' | 'wheelchair_powered' | 'skate' | 'longboard'
  | 'kick_scooter' | 'e_scooter' | 'skates' | 'hoverboard' | 'e_unicycle' | 'bmx'
  | 'tandem' | 'tuktuk';
export type RadicalKind = 'ramp_bridge' | 'air_loop' | 'death_jump' | 'rail_walkway';
export type AccessKind = 'bubble_lift' | 'glass_walkway' | 'transit_only';
export type FeatureKind =
  | 'air_loop' | 'wallride' | 'quarter' | 'bowl'
  | 'stop_shelter' | 'share_station' | 'crt_billboard' | 'tree' | 'lamp' | 'bench';

export interface CityNode { id: number; x: number; y: number; signal?: { cycle: number; phases: number } }
export interface CityEdge {
  id: number; from: number; to: number; width: number; speed: number; oneWay: boolean;
  kind: 'street' | 'avenue' | 'boulevard';
  lanes: Partial<Record<LaneKind, number>>;
}
export interface CityCrossing {
  id: number; from: number; to: number; over: 'river' | 'canal' | 'expressway';
  radical: RadicalKind; access?: AccessKind; locked?: boolean;
}
export interface CityBuilding {
  id: number; x: number; y: number;
  kind: 'res' | 'com' | 'ind' | 'school' | 'hospital' | 'park' | 'skatepark';
  capacity: number; model: string; rotation: 0 | 1 | 2 | 3;
}
export interface CityDistrict {
  id: number; name: string; income: 'low' | 'mid' | 'high'; population: number;
  ownership: Partial<Record<VehicleKind, number>>; wheelchairShare: number;
}
/** Extensão proposta: elementos radicais urbanos e props posicionados (rot em quartos de volta). */
export interface CityFeature { kind: FeatureKind; x: number; y: number; rot: number }

export interface CityFile {
  name: string;
  size: { w: number; h: number };
  /** Extensão usada pela vitrine: faixa de água horizontal. */
  canal?: { y0: number; y1: number };
  nodes: CityNode[];
  edges: CityEdge[];
  crossings: CityCrossing[];
  buildings: CityBuilding[];
  districts: CityDistrict[];
  features?: CityFeature[];
}

/** Toda travessia precisa de rota acessível (SPEC §4.5). */
export function crossingIsAccessible(c: CityCrossing): boolean {
  return c.access !== undefined || c.radical === 'rail_walkway';
}

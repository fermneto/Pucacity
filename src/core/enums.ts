/**
 * Listas de valores válidos do contrato (src/core/CityFile.ts), para o validador.
 * `exhaustive` quebra a compilação se CityFile.ts ganhar ou perder um valor sem atualizar aqui.
 */
import type { AccessKind, CityBuilding, CityCrossing, CityDistrict, CityEdge, FeatureKind, LaneKind, RadicalKind, VehicleKind } from './CityFile';

/** Garante que a lista tem exatamente os valores do tipo T (nem mais, nem menos). */
const exhaustive =
  <T extends string>() =>
  <const L extends readonly T[]>(l: L & ([T] extends [L[number]] ? unknown : { faltando: Exclude<T, L[number]> })): L =>
    l;

export const LANE_KINDS = exhaustive<LaneKind>()(['sidewalk', 'slow', 'fast', 'transit']);
export const VEHICLE_KINDS = exhaustive<VehicleKind>()([
  'pedestrian', 'wheelchair', 'wheelchair_powered', 'skate', 'longboard', 'kick_scooter', 'e_scooter',
  'skates', 'hoverboard', 'e_unicycle', 'bmx', 'tandem', 'tuktuk',
]);
export const RADICAL_KINDS = exhaustive<RadicalKind>()(['ramp_bridge', 'air_loop', 'death_jump', 'rail_walkway']);
export const ACCESS_KINDS = exhaustive<AccessKind>()(['bubble_lift', 'glass_walkway', 'transit_only']);
export const EDGE_KINDS = exhaustive<CityEdge['kind']>()(['street', 'avenue', 'boulevard']);
export const CROSSING_OVER = exhaustive<CityCrossing['over']>()(['river', 'canal', 'expressway']);
export const BUILDING_KINDS = exhaustive<CityBuilding['kind']>()(['res', 'com', 'ind', 'school', 'hospital', 'park', 'skatepark']);
export const INCOMES = exhaustive<CityDistrict['income']>()(['low', 'mid', 'high']);
export const FEATURE_KINDS = exhaustive<FeatureKind>()([
  'air_loop', 'wallride', 'quarter', 'bowl', 'spiral_tower', 'megapipe', 'orb',
  'stop_shelter', 'share_station', 'crt_billboard', 'tree', 'lamp', 'bench',
]);
export const GOAL_OPS = ['<=', '>=', 'delta<=', 'delta>='] as const;

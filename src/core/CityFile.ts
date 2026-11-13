/**
 * Compatibilidade: o contrato oficial do city.json é src/core/types.ts (dono: PC3 Engenharia).
 * Este módulo só reexporta os tipos e oferece utilidades usadas pelo render/vitrine.
 */
export * from './types';
import type { CityCrossing, CityFile } from './types';

/** Travessia com rota acessível declarada (mesma regra de Crossings.crossingsWithoutAccess). */
export function crossingIsAccessible(c: CityCrossing): boolean {
  return c.access !== undefined;
}

/** Faixas de água horizontais derivadas de `areas` (kind 'water'), em tiles, ordenadas de norte a sul. */
export function waterBands(city: CityFile): { y0: number; y1: number }[] {
  return (city.areas ?? [])
    .filter((a) => a.kind === 'water')
    .map((a) => ({ y0: a.y, y1: a.y + a.h }))
    .sort((a, b) => a.y0 - b.y0);
}

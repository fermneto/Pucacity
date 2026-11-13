import veiculos from '../../data/arte/veiculos.json';
import type { LaneKind, VehicleKind } from './CityFile';

/** Perfil de deslocamento de um tipo de veículo, derivado de data/arte/veiculos.json. */
export interface VehicleProfile {
  kind: VehicleKind;
  /** Nome para a interface (campo "nome" da Arte). */
  name: string;
  /** Faixa preferida. */
  lane: LaneKind;
  /** Velocidade de cruzeiro (média da faixa do arquivo), m/s. */
  speedMps: number;
  /** Velocidade máxima, m/s (usada para velocidade mínima de elementos radicais). */
  maxSpeedMps: number;
  /** Faz manobras (pode usar elementos radicais). */
  tricks: boolean;
  /** Veículo de transporte coletivo (tandem, tuk-tuk). */
  transit: boolean;
}

interface RawVehicle {
  kind: string;
  nome?: string;
  faixa: string;
  velocidade: number[];
  manobras?: boolean;
}

interface RawVehiclesFile {
  faixas: Record<string, { lane: string }>;
  individuais: RawVehicle[];
  transporte_publico: RawVehicle[];
}

/** Converte o JSON da Arte em perfis. Exportado para testes e para recarregar dados em tempo de execução. */
export function buildProfiles(file: RawVehiclesFile): Map<VehicleKind, VehicleProfile> {
  const map = new Map<VehicleKind, VehicleProfile>();
  const add = (v: RawVehicle, transit: boolean) => {
    const lane = file.faixas[v.faixa]?.lane;
    if (!lane) throw new Error(`veiculos.json: faixa '${v.faixa}' de '${v.kind}' não existe em 'faixas'`);
    const [min = 1, max = min] = v.velocidade;
    map.set(v.kind as VehicleKind, {
      kind: v.kind as VehicleKind,
      name: v.nome ?? v.kind,
      lane: lane as LaneKind,
      speedMps: (min + max) / 2,
      maxSpeedMps: max,
      tricks: v.manobras === true,
      transit,
    });
  };
  file.individuais.forEach((v) => add(v, false));
  file.transporte_publico.forEach((v) => add(v, true));
  return map;
}

export const VEHICLES: ReadonlyMap<VehicleKind, VehicleProfile> = buildProfiles(veiculos as unknown as RawVehiclesFile);

export function vehicle(kind: VehicleKind): VehicleProfile {
  const v = VEHICLES.get(kind);
  if (!v) throw new Error(`Veículo '${kind}' não está em data/arte/veiculos.json`);
  return v;
}

/** Tipos do MVP (SPEC §3): os representantes de cada faixa + tuk-tuk. */
export const MVP_VEHICLES: readonly VehicleKind[] = ['pedestrian', 'wheelchair', 'skate', 'kick_scooter', 'tuktuk'];

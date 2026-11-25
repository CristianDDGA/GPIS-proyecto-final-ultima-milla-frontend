import type { Zone, ZoneCoverage, CreateZoneInput } from './zone.js';

export interface ZoneRepository {
  getAll(): Promise<Zone[]>;
  getById(id: string): Promise<Zone | null>;
  create(input: CreateZoneInput): Promise<Zone>;
  /** Fija la cobertura de una zona, o la quita con `null`. */
  setCoverage(id: string, coverage: ZoneCoverage | null): Promise<Zone>;
  /** Activa o desactiva la zona. El servidor rechaza (409) desactivar con rutas o pedidos abiertos. */
  setActive(id: string, isActive: boolean): Promise<Zone>;
}

import type { Zone, CreateZoneInput } from './zone.js';

export interface ZoneRepository {
  getAll(): Promise<Zone[]>;
  getById(id: string): Promise<Zone | null>;
  create(input: CreateZoneInput): Promise<Zone>;
}

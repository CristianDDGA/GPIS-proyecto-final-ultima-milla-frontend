import {
  isZoneId,
  validateCoverage,
  type Zone,
  type ZoneCoverage,
  type ZoneRepository,
} from '../domain/index.js';

export class SetZoneCoverageUseCase {
  constructor(private readonly zoneRepository: ZoneRepository) {}

  /** Valida y guarda la cobertura; `null` la quita. El radio se redondea a 2 decimales como en el backend. */
  public execute(zoneId: string, coverage: ZoneCoverage | null): Promise<Zone> {
    if (!isZoneId(zoneId)) {
      throw new Error('Identificador de zona inválido.');
    }
    if (coverage === null) {
      return this.zoneRepository.setCoverage(zoneId, null);
    }
    const validation = validateCoverage(coverage);
    if (!validation.isValid) {
      throw new Error(validation.error ?? 'Cobertura inválida.');
    }
    return this.zoneRepository.setCoverage(zoneId, {
      latitude: coverage.latitude,
      longitude: coverage.longitude,
      radiusKm: Math.round(coverage.radiusKm * 100) / 100,
    });
  }
}

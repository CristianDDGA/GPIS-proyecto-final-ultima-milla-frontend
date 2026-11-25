import { isZoneId, type Zone, type ZoneRepository } from '../domain/index.js';

export class SetZoneActiveUseCase {
  constructor(private readonly zoneRepository: ZoneRepository) {}

  /** Valida el identificador y el valor antes de pedir el cambio al servidor. */
  public execute(zoneId: string, isActive: boolean): Promise<Zone> {
    if (!isZoneId(zoneId)) {
      throw new Error('Identificador de zona inválido.');
    }
    if (typeof isActive !== 'boolean') {
      throw new Error('El estado de la zona debe ser activa o inactiva.');
    }
    return this.zoneRepository.setActive(zoneId, isActive);
  }
}

import { isZoneId, type Zone, type ZoneRepository } from '../domain/index.js';

export class GetZoneByIdUseCase {
  constructor(private readonly zoneRepository: ZoneRepository) {}

  /**
   * Consulta una zona por su identificador.
   * Si el identificador no tiene formato UUID se retorna `null` sin llamar al
   * repositorio: la UI lo interpreta como "zona no encontrada".
   */
  public async execute(id: string): Promise<Zone | null> {
    if (!isZoneId(id)) {
      return null;
    }

    return this.zoneRepository.getById(id.trim());
  }
}

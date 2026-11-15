import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import type { Zone, ZoneRepository, CreateZoneInput } from '../../../zones/domain/index.js';
import { HttpZoneRepository } from '../../../zones/infrastructure/http/index.js';

/**
 * Adaptador de catálogo de zonas para el feature de pedidos.
 * Reutiliza el repositorio HTTP de zonas (con sus guardas de contrato en
 * tiempo de ejecución) para exponer el puerto `ZoneRepository` completo.
 */
export class HttpOrderZoneCatalog implements ZoneRepository {
  private readonly zoneRepository: HttpZoneRepository;

  constructor(client: HttpClient) {
    this.zoneRepository = new HttpZoneRepository(client);
  }

  public getAll(): Promise<Zone[]> {
    return this.zoneRepository.getAll();
  }

  public getById(id: string): Promise<Zone | null> {
    return this.zoneRepository.getById(id);
  }

  public create(input: CreateZoneInput): Promise<Zone> {
    return this.zoneRepository.create(input);
  }
}

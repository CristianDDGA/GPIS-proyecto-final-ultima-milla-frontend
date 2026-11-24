import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Zone, ZoneCoverage, ZoneRepository } from '../../domain/index.js';
import {
  CreateZoneUseCase,
  GetZoneByIdUseCase,
  GetZonesUseCase,
  SetZoneCoverageUseCase,
} from '../../application/index.js';
import { defaultZoneRepository } from '../../infrastructure/http/index.js';

export function useZones(repository: ZoneRepository = defaultZoneRepository) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const detailRequest = useRef(0);

  const getZonesUseCase = useMemo(() => new GetZonesUseCase(repository), [repository]);
  const getZoneByIdUseCase = useMemo(() => new GetZoneByIdUseCase(repository), [repository]);
  const createZoneUseCase = useMemo(() => new CreateZoneUseCase(repository), [repository]);
  const setCoverageUseCase = useMemo(() => new SetZoneCoverageUseCase(repository), [repository]);

  const loadZones = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getZonesUseCase.execute();
      setZones(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido al cargar las zonas';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [getZonesUseCase]);

  const inspectZone = useCallback(
    async (id: string): Promise<void> => {
      const request = ++detailRequest.current;
      setIsLoadingDetail(true);
      setDetailError(null);
      setSelectedZone(null);
      try {
        const zone = await getZoneByIdUseCase.execute(id);
        if (request !== detailRequest.current) return;
        if (zone === null) {
          setDetailError('No se encontró la zona solicitada.');
          return;
        }
        setSelectedZone(zone);
      } catch (err) {
        if (request !== detailRequest.current) return;
        const message = err instanceof Error ? err.message : 'Error desconocido al cargar el detalle de la zona';
        setDetailError(message);
      } finally {
        if (request === detailRequest.current) {
          setIsLoadingDetail(false);
        }
      }
    },
    [getZoneByIdUseCase],
  );

  const clearSelectedZone = useCallback(() => {
    detailRequest.current += 1;
    setSelectedZone(null);
    setDetailError(null);
    setIsLoadingDetail(false);
  }, []);

  /** Crea la zona y enseguida le fija la cobertura: una zona sin cobertura no recibe pedidos. */
  const createZone = useCallback(
    async (name: string, coverage: ZoneCoverage): Promise<boolean> => {
      setIsCreating(true);
      setError(null);
      setSuccessMessage(null);
      try {
        let newZone: Zone;
        try {
          newZone = await createZoneUseCase.execute({ name });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Error al crear la zona');
          return false;
        }
        try {
          const covered = await setCoverageUseCase.execute(newZone.id, coverage);
          setZones((prev) => [covered, ...prev.filter((z) => z.id !== covered.id)]);
          setSuccessMessage(`Zona "${covered.name}" creada con su cobertura.`);
        } catch (err) {
          // La zona ya existe: se muestra para que el admin le defina la cobertura con "Cobertura".
          setZones((prev) => [newZone, ...prev.filter((z) => z.id !== newZone.id)]);
          const reason = err instanceof Error ? err.message : 'error desconocido';
          setError(`La zona "${newZone.name}" se creó, pero no se pudo guardar su cobertura (${reason}). Defínela con el botón "Cobertura".`);
        }
        return true;
      } finally {
        setIsCreating(false);
      }
    },
    [createZoneUseCase, setCoverageUseCase],
  );

  /** Guarda (o quita con `null`) la cobertura y refresca la zona en la lista y en el detalle. */
  const setCoverage = useCallback(
    async (zoneId: string, coverage: ZoneCoverage | null): Promise<boolean> => {
      setError(null);
      setSuccessMessage(null);
      try {
        const updated = await setCoverageUseCase.execute(zoneId, coverage);
        setZones((prev) => prev.map((zone) => (zone.id === updated.id ? updated : zone)));
        setSelectedZone((prev) => (prev?.id === updated.id ? updated : prev));
        setSuccessMessage(
          coverage === null
            ? `Se quitó la cobertura de "${updated.name}".`
            : `Cobertura de "${updated.name}" guardada.`,
        );
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo guardar la cobertura.');
        return false;
      }
    },
    [setCoverageUseCase],
  );

  const clearFeedback = useCallback(() => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  return {
    zones,
    isLoading,
    isCreating,
    error,
    successMessage,
    selectedZone,
    isLoadingDetail,
    detailError,
    loadZones,
    inspectZone,
    clearSelectedZone,
    createZone,
    setCoverage,
    clearFeedback,
  };
}

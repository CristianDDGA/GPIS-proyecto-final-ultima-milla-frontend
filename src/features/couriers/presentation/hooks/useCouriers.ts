import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActiveCourierRoute,
  AssignCourierResult,
  Courier,
  CourierFilters,
} from '../../domain/index.js';
import type { CourierUseCases } from '../../application/courierUseCases.js';

export type CourierAvailabilityFilter = 'all' | 'available' | 'unavailable';

export interface UseCouriersResult {
  couriers: readonly Courier[];
  isLoadingCouriers: boolean;
  couriersError: string | null;
  /**
   * Catálogo reducido a repartidores habilitados y disponibles, obtenido con
   * `GET /couriers?available=true`. Es la fuente del selector de asignación:
   * el catálogo visible sí depende del filtro elegido por el usuario, pero la
   * asignación (`POST /courier-assignments`) exige disponibilidad real.
   */
  assignableCouriers: readonly Courier[];
  isLoadingAssignableCouriers: boolean;
  assignableCouriersError: string | null;
  refreshCouriers: (filters?: CourierFilters) => Promise<void>;
  availabilityFilter: CourierAvailabilityFilter;
  setAvailabilityFilter: (filter: CourierAvailabilityFilter) => void;
  updatingCourierId: string | null;
  toggleAvailability: (courier: Courier) => Promise<void>;
  isAssigning: boolean;
  assignRoute: (routeId: string, courierId: string) => Promise<AssignCourierResult | null>;
  activeRoute: ActiveCourierRoute | null;
  isLoadingActiveRoute: boolean;
  activeRouteError: string | null;
  loadActiveRoute: (courierId: string) => Promise<void>;
  selectedCourierId: string;
  successMessage: string | null;
  error: string | null;
  clearFeedback: () => void;
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function filtersForFilter(filter: CourierAvailabilityFilter): CourierFilters {
  if (filter === 'available') return { available: true };
  if (filter === 'unavailable') return { available: false };
  return {};
}

export function useCouriers(useCases: CourierUseCases): UseCouriersResult {
  const [couriers, setCouriers] = useState<readonly Courier[]>([]);
  const [isLoadingCouriers, setIsLoadingCouriers] = useState(false);
  const [couriersError, setCouriersError] = useState<string | null>(null);
  const [assignableCouriers, setAssignableCouriers] = useState<readonly Courier[]>([]);
  const [isLoadingAssignableCouriers, setIsLoadingAssignableCouriers] = useState(false);
  const [assignableCouriersError, setAssignableCouriersError] = useState<string | null>(null);
  const [availabilityFilter, setAvailabilityFilterState] =
    useState<CourierAvailabilityFilter>('all');
  const [updatingCourierId, setUpdatingCourierId] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);
  const [activeRoute, setActiveRoute] = useState<ActiveCourierRoute | null>(null);
  const [isLoadingActiveRoute, setIsLoadingActiveRoute] = useState(false);
  const [activeRouteError, setActiveRouteError] = useState<string | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(false);
  const couriersRequest = useRef(0);
  const assignableRequest = useRef(0);
  const activeRouteRequest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      couriersRequest.current += 1;
      assignableRequest.current += 1;
      activeRouteRequest.current += 1;
    };
  }, []);

  const { getCouriers, updateAvailability, assignRoute, getActiveRoute } = useCases;

  const refreshCouriers = useCallback(
    async (filters?: CourierFilters): Promise<void> => {
      const request = ++couriersRequest.current;
      const effectiveFilters = filters ?? filtersForFilter(availabilityFilter);

      setIsLoadingCouriers(true);
      setCouriersError(null);

      try {
        const page = await getCouriers.execute(effectiveFilters);
        if (mounted.current && request === couriersRequest.current) {
          setCouriers(page.items);
        }
      } catch (error_) {
        if (mounted.current && request === couriersRequest.current) {
          setCouriers([]);
          setCouriersError(toMessage(error_, 'No se pudo recuperar el catálogo de repartidores.'));
        }
      } finally {
        if (mounted.current && request === couriersRequest.current) {
          setIsLoadingCouriers(false);
        }
      }
    },
    [availabilityFilter, getCouriers],
  );

  // The assignment selector never depends on the catalog filter: it always asks the
  // backend for couriers that are really available (`?available=true`).
  const refreshAssignableCouriers = useCallback(async (): Promise<void> => {
    const request = ++assignableRequest.current;

    setIsLoadingAssignableCouriers(true);
    setAssignableCouriersError(null);

    try {
      const page = await getCouriers.execute({ available: true });
      if (mounted.current && request === assignableRequest.current) {
        setAssignableCouriers(page.items.filter((courier) => courier.isEnabled));
      }
    } catch (error_) {
      if (mounted.current && request === assignableRequest.current) {
        setAssignableCouriers([]);
        setAssignableCouriersError(
          toMessage(error_, 'No se pudo recuperar la lista de repartidores asignables.'),
        );
      }
    } finally {
      if (mounted.current && request === assignableRequest.current) {
        setIsLoadingAssignableCouriers(false);
      }
    }
  }, [getCouriers]);

  useEffect(() => {
    void refreshCouriers();
    void refreshAssignableCouriers();
  }, [refreshCouriers, refreshAssignableCouriers]);

  const setAvailabilityFilter = useCallback((filter: CourierAvailabilityFilter): void => {
    setAvailabilityFilterState(filter);
  }, []);

  const toggleAvailability = useCallback(
    async (courier: Courier): Promise<void> => {
      setUpdatingCourierId(courier.id);
      setError(null);
      setSuccessMessage(null);

      try {
        const updated = await updateAvailability.execute(courier.id, !courier.isAvailable);
        setCouriers((previous) =>
          previous.map((item) => (item.id === updated.id ? updated : item)),
        );
        setSuccessMessage(
          `Disponibilidad de "${updated.displayName}" actualizada a ${
            updated.isAvailable ? 'disponible' : 'no disponible'
          }.`,
        );

        if (availabilityFilter !== 'all') {
          await refreshCouriers();
        }
        await refreshAssignableCouriers();
      } catch (error_) {
        setError(toMessage(error_, 'No se pudo actualizar la disponibilidad del repartidor.'));
      } finally {
        setUpdatingCourierId(null);
      }
    },
    [updateAvailability, availabilityFilter, refreshCouriers, refreshAssignableCouriers],
  );

  const loadActiveRoute = useCallback(
    async (courierId: string): Promise<void> => {
      const request = ++activeRouteRequest.current;
      setSelectedCourierId(courierId);
      setActiveRouteError(null);

      if (courierId.trim().length === 0) {
        setActiveRoute(null);
        setIsLoadingActiveRoute(false);
        return;
      }

      setIsLoadingActiveRoute(true);
      setActiveRoute(null);

      try {
        const route = await getActiveRoute.execute(courierId);
        if (mounted.current && request === activeRouteRequest.current) {
          setActiveRoute(route);
        }
      } catch (error_) {
        if (mounted.current && request === activeRouteRequest.current) {
          setActiveRouteError(
            toMessage(error_, 'No se pudo consultar la hoja de ruta activa del repartidor.'),
          );
        }
      } finally {
        if (mounted.current && request === activeRouteRequest.current) {
          setIsLoadingActiveRoute(false);
        }
      }
    },
    [getActiveRoute],
  );

  const assignRouteHandler = useCallback(
    async (routeId: string, courierId: string): Promise<AssignCourierResult | null> => {
      setIsAssigning(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const result = await assignRoute.execute({ routeId, courierId });
        setSuccessMessage(
          `Ruta ${result.routeId} asignada al repartidor ${result.courierId} correctamente.`,
        );
        await refreshCouriers();
        await refreshAssignableCouriers();
        await loadActiveRoute(courierId);
        return result;
      } catch (error_) {
        setError(toMessage(error_, 'No se pudo asignar la ruta al repartidor.'));
        return null;
      } finally {
        setIsAssigning(false);
      }
    },
    [assignRoute, refreshCouriers, refreshAssignableCouriers, loadActiveRoute],
  );

  const clearFeedback = useCallback((): void => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    couriers,
    isLoadingCouriers,
    couriersError,
    assignableCouriers,
    isLoadingAssignableCouriers,
    assignableCouriersError,
    refreshCouriers,
    availabilityFilter,
    setAvailabilityFilter,
    updatingCourierId,
    toggleAvailability,
    isAssigning,
    assignRoute: assignRouteHandler,
    activeRoute,
    isLoadingActiveRoute,
    activeRouteError,
    loadActiveRoute,
    selectedCourierId,
    successMessage,
    error,
    clearFeedback,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  LateOrderPlacementResult,
  PlanRoutesInput,
  PlanRoutesResult,
  RouteDetail,
  RouteFilters,
  RouteSummary,
} from '../../domain/index.js';
import type { RouteUseCases } from '../../application/routeUseCases.js';

export const DEFAULT_ROUTE_LIMIT = 25;

export const DEFAULT_ROUTE_FILTERS: RouteFilters = { limit: DEFAULT_ROUTE_LIMIT };

function readInitialRouteFilters(): RouteFilters {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('deliveryDate');
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
      return { ...DEFAULT_ROUTE_FILTERS, serviceDate: param };
    }
  }
  return { ...DEFAULT_ROUTE_FILTERS };
}

const ADMIN_REQUIRED_MESSAGE = 'Solo el personal administrativo puede ejecutar esta operación.';

function describeError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export interface UseRoutesResult {
  readonly routes: RouteSummary[];
  readonly isLoadingRoutes: boolean;
  readonly routesError: string | null;
  readonly loadRoutes: (filters?: RouteFilters) => Promise<void>;
  readonly filters: RouteFilters;
  readonly setFilters: (filters: RouteFilters) => void;
  readonly applyFilters: (filters?: RouteFilters) => Promise<void>;
  readonly selectedRoute: RouteDetail | null;
  readonly isLoadingDetail: boolean;
  readonly detailError: string | null;
  readonly inspectRoute: (routeId: string) => Promise<void>;
  readonly reloadSelectedRoute: () => Promise<void>;
  readonly clearSelectedRoute: () => void;
  readonly planRoutes: (input: PlanRoutesInput) => Promise<PlanRoutesResult | null>;
  readonly isPlanning: boolean;
  readonly planError: string | null;
  readonly planSuccess: string | null;
  readonly planResult: PlanRoutesResult | null;
  readonly clearPlanFeedback: () => void;
  readonly reorderStops: (orderIds: string[]) => Promise<boolean>;
  readonly isReordering: boolean;
  readonly cancelRoute: () => Promise<boolean>;
  readonly isCancelling: boolean;
  readonly moveOrder: (orderId: string, destinationRouteId: string) => Promise<boolean>;
  readonly isMovingOrder: boolean;
  readonly placeLateOrder: (orderId: string, capacityLimit: number) => Promise<LateOrderPlacementResult | null>;
  readonly isPlacingLate: boolean;
  readonly error: string | null;
  readonly successMessage: string | null;
  readonly clearFeedback: () => void;
}

/**
 * Orquesta el estado de la feature de rutas: listado con filtros, detalle
 * seleccionado y las operaciones de planificación/paradas. Protege el estado
 * contra respuestas obsoletas con un contador de versión y un flag de montaje.
 */
export function useRoutes(
  useCases: RouteUseCases,
  options?: { readonly isAdmin: boolean | undefined },
): UseRoutesResult {
  const isAdmin = options?.isAdmin ?? false;
  const getRoutes = useCases.getRoutes;
  const getRouteById = useCases.getRouteById;
  const planRoutesUseCase = useCases.planRoutes;
  const reorderStopsUseCase = useCases.reorderStops;
  const cancelRouteUseCase = useCases.cancelRoute;
  const moveOrderUseCase = useCases.moveOrder;
  const placeLateOrderUseCase = useCases.placeLateOrder;

  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);

  const [filters, setFiltersState] = useState<RouteFilters>(readInitialRouteFilters);

  const [selectedRoute, setSelectedRoute] = useState<RouteDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [isPlanning, setIsPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planSuccess, setPlanSuccess] = useState<string | null>(null);
  const [planResult, setPlanResult] = useState<PlanRoutesResult | null>(null);

  const [isReordering, setIsReordering] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMovingOrder, setIsMovingOrder] = useState(false);
  const [isPlacingLate, setIsPlacingLate] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const filtersRef = useRef<RouteFilters>(readInitialRouteFilters());
  const selectedRouteRef = useRef<RouteDetail | null>(null);
  const routesVersion = useRef(0);
  const detailVersion = useRef(0);
  const mounted = useRef(false);

  const storeSelectedRoute = useCallback((detail: RouteDetail | null) => {
    selectedRouteRef.current = detail;
    setSelectedRoute(detail);
  }, []);

  const loadRoutes = useCallback(
    async (nextFilters?: RouteFilters): Promise<void> => {
      const target = nextFilters ?? filtersRef.current;
      const request = ++routesVersion.current;
      setIsLoadingRoutes(true);
      setRoutesError(null);

      try {
        const data = await getRoutes.execute(target);
        if (mounted.current && request === routesVersion.current) {
          setRoutes(data);
        }
      } catch (error_) {
        if (mounted.current && request === routesVersion.current) {
          setRoutesError(describeError(error_, 'No se pudo recuperar el listado de rutas.'));
        }
      } finally {
        if (mounted.current && request === routesVersion.current) {
          setIsLoadingRoutes(false);
        }
      }
    },
    [getRoutes],
  );

  const setFilters = useCallback((next: RouteFilters) => {
    filtersRef.current = next;
    setFiltersState(next);
  }, []);

  const applyFilters = useCallback(
    async (next?: RouteFilters): Promise<void> => {
      const target = next ?? filtersRef.current;
      filtersRef.current = target;
      setFiltersState(target);
      await loadRoutes(target);
    },
    [loadRoutes],
  );

  const inspectRoute = useCallback(
    async (routeId: string): Promise<void> => {
      const request = ++detailVersion.current;
      if (selectedRouteRef.current?.id !== routeId) {
        storeSelectedRoute(null);
      }
      setIsLoadingDetail(true);
      setDetailError(null);

      try {
        const detail = await getRouteById.execute(routeId);
        if (mounted.current && request === detailVersion.current) {
          storeSelectedRoute(detail);
        }
      } catch (error_) {
        if (mounted.current && request === detailVersion.current) {
          storeSelectedRoute(null);
          setDetailError(describeError(error_, 'No se pudo recuperar el detalle de la ruta.'));
        }
      } finally {
        if (mounted.current && request === detailVersion.current) {
          setIsLoadingDetail(false);
        }
      }
    },
    [getRouteById, storeSelectedRoute],
  );

  const reloadSelectedRoute = useCallback(async (): Promise<void> => {
    const current = selectedRouteRef.current;
    if (current) {
      await inspectRoute(current.id);
    }
  }, [inspectRoute]);

  const clearSelectedRoute = useCallback((): void => {
    ++detailVersion.current;
    storeSelectedRoute(null);
    setIsLoadingDetail(false);
    setDetailError(null);
  }, [storeSelectedRoute]);

  const clearPlanFeedback = useCallback((): void => {
    setPlanError(null);
    setPlanSuccess(null);
    setPlanResult(null);
  }, []);

  const planRoutes = useCallback(
    async (input: PlanRoutesInput): Promise<PlanRoutesResult | null> => {
      setError(null);
      clearPlanFeedback();

      if (!isAdmin) {
        setPlanError(ADMIN_REQUIRED_MESSAGE);
        return null;
      }

      setIsPlanning(true);
      try {
        const result = await planRoutesUseCase.execute(input);
        if (mounted.current) {
          setPlanResult(result);
          setPlanSuccess('Las rutas se generaron correctamente');
        }
        await loadRoutes();
        return result;
      } catch (error_) {
        const message = describeError(error_, 'No se pudo generar la planificación de rutas.');
        if (mounted.current) {
          setPlanError(message);
        }
        return null;
      } finally {
        if (mounted.current) {
          setIsPlanning(false);
        }
      }
    },
    [clearPlanFeedback, isAdmin, loadRoutes, planRoutesUseCase],
  );

  const reorderStops = useCallback(
    async (orderIds: string[]): Promise<boolean> => {
      setError(null);
      setSuccessMessage(null);

      const current = selectedRouteRef.current;
      if (!isAdmin) {
        setError(ADMIN_REQUIRED_MESSAGE);
        return false;
      }
      if (!current) {
        setError('Primero debes inspeccionar una ruta para reordenar sus paradas.');
        return false;
      }

      setIsReordering(true);
      try {
        await reorderStopsUseCase.execute({ routeId: current.id, orderIds });
        if (mounted.current) {
          setSuccessMessage('Se actualizó el orden de las paradas de la ruta.');
        }
        await inspectRoute(current.id);
        await loadRoutes();
        return true;
      } catch (error_) {
        if (mounted.current) {
          setError(describeError(error_, 'No se pudo reordenar las paradas de la ruta.'));
        }
        return false;
      } finally {
        if (mounted.current) {
          setIsReordering(false);
        }
      }
    },
    [inspectRoute, isAdmin, loadRoutes, reorderStopsUseCase],
  );

  const cancelRoute = useCallback(async (): Promise<boolean> => {
    setError(null);
    setSuccessMessage(null);

    const current = selectedRouteRef.current;
    if (!isAdmin) {
      setError(ADMIN_REQUIRED_MESSAGE);
      return false;
    }
    if (!current) {
      setError('Primero debes inspeccionar una ruta para cancelarla.');
      return false;
    }

    setIsCancelling(true);
    try {
      await cancelRouteUseCase.execute(current.id);
      if (mounted.current) {
        setSuccessMessage('La ruta se canceló correctamente.');
      }
      await inspectRoute(current.id);
      await loadRoutes();
      return true;
    } catch (error_) {
      if (mounted.current) {
        setError(describeError(error_, 'No se pudo cancelar la ruta.'));
      }
      return false;
    } finally {
      if (mounted.current) {
        setIsCancelling(false);
      }
    }
  }, [cancelRouteUseCase, inspectRoute, isAdmin, loadRoutes]);

  const moveOrder = useCallback(
    async (orderId: string, destinationRouteId: string): Promise<boolean> => {
      setError(null);
      setSuccessMessage(null);

      const current = selectedRouteRef.current;
      if (!isAdmin) {
        setError(ADMIN_REQUIRED_MESSAGE);
        return false;
      }
      if (!current) {
        setError('Primero debes inspeccionar una ruta para reubicar una de sus paradas.');
        return false;
      }

      setIsMovingOrder(true);
      try {
        await moveOrderUseCase.execute({ orderId, destinationRouteId });
        if (mounted.current) {
          setSuccessMessage('El pedido se movió a la ruta destino seleccionada.');
        }
        await inspectRoute(current.id);
        await loadRoutes();
        return true;
      } catch (error_) {
        if (mounted.current) {
          setError(describeError(error_, 'No se pudo reubicar el pedido en la ruta destino.'));
        }
        return false;
      } finally {
        if (mounted.current) {
          setIsMovingOrder(false);
        }
      }
    },
    [inspectRoute, isAdmin, loadRoutes, moveOrderUseCase],
  );

  const placeLateOrder = useCallback(
    async (orderId: string, capacityLimit: number): Promise<LateOrderPlacementResult | null> => {
      setError(null);

      if (!isAdmin) {
        setError(ADMIN_REQUIRED_MESSAGE);
        return null;
      }

      setIsPlacingLate(true);
      try {
        const result = await placeLateOrderUseCase.execute({ orderId, capacityLimit });
        await loadRoutes();
        return result;
      } catch (error_) {
        if (mounted.current) {
          setError(describeError(error_, 'No se pudo insertar el pedido tardío.'));
        }
        return null;
      } finally {
        if (mounted.current) {
          setIsPlacingLate(false);
        }
      }
    },
    [isAdmin, loadRoutes, placeLateOrderUseCase],
  );

  const clearFeedback = useCallback((): void => {
    setError(null);
    setSuccessMessage(null);
    setPlanError(null);
    setPlanSuccess(null);
    setPlanResult(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      ++routesVersion.current;
      ++detailVersion.current;
    };
  }, []);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  return {
    routes,
    isLoadingRoutes,
    routesError,
    loadRoutes,
    filters,
    setFilters,
    applyFilters,
    selectedRoute,
    isLoadingDetail,
    detailError,
    inspectRoute,
    reloadSelectedRoute,
    clearSelectedRoute,
    planRoutes,
    isPlanning,
    planError,
    planSuccess,
    planResult,
    clearPlanFeedback,
    reorderStops,
    isReordering,
    cancelRoute,
    isCancelling,
    moveOrder,
    isMovingOrder,
    placeLateOrder,
    isPlacingLate,
    error,
    successMessage,
    clearFeedback,
  };
}

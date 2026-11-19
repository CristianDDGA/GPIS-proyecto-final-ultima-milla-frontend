import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ActiveCourierRoute,
  Courier,
} from '../../../couriers/domain/index.js';
import type { CourierUseCases } from '../../../couriers/application/courierUseCases.js';
import type { DeliveryUseCases } from '../../application/deliveryUseCases.js';
import {
  getNextAllowedDeliveryStatus,
  orderStatusLabel,
  type DeliveryOrder,
} from '../../domain/index.js';
import type { DeliveryActor } from '../components/DeliveryExecutionView.js';
import { HttpError } from '../../../../shared/infrastructure/http/index.js';

export interface UseDeliveriesOptions {
  readonly onDeliveryChanged?: (() => void) | undefined;
}

export interface UseDeliveriesResult {
  selectedCourierId: string;
  setSelectedCourierId: (courierId: string) => void;
  effectiveCourierId: string;
  couriers: readonly Courier[];
  isLoadingCouriers: boolean;
  couriersError: string | null;
  refreshCouriers: () => Promise<void>;
  activeRoute: ActiveCourierRoute | null;
  isLoadingRoute: boolean;
  routeError: string | null;
  loadActiveRoute: () => Promise<void>;
  courierAvailability: boolean | null;
  isUpdatingAvailability: boolean;
  setAvailability: (available: boolean) => Promise<void>;
  toggleAvailability: () => Promise<void>;
  deliveryRecords: Record<string, DeliveryOrder>;
  isLoadingDeliveryRecords: boolean;
  syncingOrderIds: readonly string[];
  syncDeliveryRecord: (orderId: string) => Promise<void>;
  syncAllDeliveryRecords: () => Promise<void>;
  advancingOrderId: string | null;
  advanceStop: (orderId: string) => Promise<void>;
  isCompletingRoute: boolean;
  completeActiveRoute: () => Promise<void>;
  inspectorOrderId: string;
  setInspectorOrderId: (orderId: string) => void;
  inspectOrder: (orderId: string) => Promise<void>;
  inspectedOrder: DeliveryOrder | null;
  isLoadingInspector: boolean;
  inspectorError: string | null;
  error: string | null;
  successMessage: string | null;
  clearFeedback: () => void;
}

function shortCode(id: string): string {
  const compact = id.replace(/[^0-9a-z]/gi, '').toUpperCase();
  return compact.length === 0 ? 'SIN-ID' : compact.slice(0, 4);
}

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

function isDataConflict(error: unknown): boolean {
  return (
    error instanceof HttpError && (error.status === 409 || error.code === 'DATA_CONFLICT')
  );
}

export function useDeliveries(
  useCases: DeliveryUseCases,
  courierUseCases: CourierUseCases,
  actor: DeliveryActor,
  options?: UseDeliveriesOptions,
): UseDeliveriesResult {
  const onDeliveryChanged = options?.onDeliveryChanged;
  const [selectedCourierId, setSelectedCourierIdState] = useState(
    actor.role === 'repartidor' ? actor.courierId ?? '' : '',
  );
  const [couriers, setCouriers] = useState<readonly Courier[]>([]);
  const [isLoadingCouriers, setIsLoadingCouriers] = useState(false);
  const [couriersError, setCouriersError] = useState<string | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveCourierRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [courierAvailability, setCourierAvailability] = useState<boolean | null>(null);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [deliveryRecords, setDeliveryRecords] = useState<Record<string, DeliveryOrder>>({});
  const [syncingOrderIds, setSyncingOrderIds] = useState<readonly string[]>([]);
  const [advancingOrderId, setAdvancingOrderId] = useState<string | null>(null);
  const [isCompletingRoute, setIsCompletingRoute] = useState(false);
  const [inspectorOrderId, setInspectorOrderIdState] = useState('');
  const [inspectedOrder, setInspectedOrder] = useState<DeliveryOrder | null>(null);
  const [isLoadingInspector, setIsLoadingInspector] = useState(false);
  const [inspectorError, setInspectorError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mounted = useRef(false);
  const couriersRequest = useRef(0);
  const routeRequest = useRef(0);
  const inspectorRequest = useRef(0);
  const recordSequence = useRef(0);
  const recordRequests = useRef(new Map<string, number>());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      couriersRequest.current += 1;
      routeRequest.current += 1;
      inspectorRequest.current += 1;
    };
  }, []);

  const effectiveCourierId =
    actor.role === 'repartidor' ? actor.courierId ?? '' : selectedCourierId;

  const setSelectedCourierId = useCallback((courierId: string): void => {
    setSelectedCourierIdState(courierId);
    setDeliveryRecords({});
    setInspectedOrder(null);
    setInspectorOrderIdState('');
    setInspectorError(null);
    setError(null);
    setSuccessMessage(null);
  }, []);

  const setInspectorOrderId = useCallback((orderId: string): void => {
    setInspectorOrderIdState(orderId);
  }, []);

  const clearFeedback = useCallback((): void => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  const refreshCouriers = useCallback(async (): Promise<void> => {
    if (actor.role !== 'personal') return;

    const request = ++couriersRequest.current;
    setIsLoadingCouriers(true);
    setCouriersError(null);

    try {
      const page = await courierUseCases.getCouriers.execute({});
      if (mounted.current && request === couriersRequest.current) {
        setCouriers(page.items);
      }
    } catch (error_) {
      if (mounted.current && request === couriersRequest.current) {
        setCouriersError(toMessage(error_, 'No se pudo recuperar el catálogo de repartidores.'));
      }
    } finally {
      if (mounted.current && request === couriersRequest.current) {
        setIsLoadingCouriers(false);
      }
    }
  }, [actor.role, courierUseCases.getCouriers]);

  useEffect(() => {
    void refreshCouriers();
  }, [refreshCouriers]);

  useEffect(() => {
    if (actor.role !== 'personal') return;
    const match = couriers.find((courier) => courier.id === effectiveCourierId);
    setCourierAvailability(match ? match.isAvailable : null);
  }, [actor.role, couriers, effectiveCourierId]);

  const preloadRouteRecords = useCallback(
    async (stops: readonly ActiveCourierRoute['stops'][number][], expectedRouteRequest: number): Promise<void> => {
      if (stops.length === 0) return;

      const settled = await Promise.allSettled(
        stops.map((stop) => useCases.getDeliveryOrder.execute(stop.orderId)),
      );

      if (!mounted.current || routeRequest.current !== expectedRouteRequest) {
        return;
      }

      const nextRecords: Record<string, DeliveryOrder> = {};
      for (const result of settled) {
        if (result.status === 'fulfilled') {
          nextRecords[result.value.orderId] = result.value;
        }
      }

      if (Object.keys(nextRecords).length > 0) {
        setDeliveryRecords((previous) => ({ ...previous, ...nextRecords }));
      }
    },
    [useCases.getDeliveryOrder],
  );

  const loadActiveRoute = useCallback(async (): Promise<void> => {
    const courierId = effectiveCourierId;
    const request = ++routeRequest.current;
    setRouteError(null);

    if (courierId.length === 0) {
      setActiveRoute(null);
      setIsLoadingRoute(false);
      return;
    }

    setIsLoadingRoute(true);
    setActiveRoute(null);

    try {
      const route = await courierUseCases.getActiveRoute.execute(courierId);
      if (mounted.current && request === routeRequest.current) {
        setActiveRoute(route);
        if (route !== null && route.stops.length > 0) {
          void preloadRouteRecords(route.stops, request);
        }
      }
    } catch (error_) {
      if (mounted.current && request === routeRequest.current) {
        setRouteError(toMessage(error_, 'No se pudo cargar la hoja de ruta activa del repartidor.'));
      }
    } finally {
      if (mounted.current && request === routeRequest.current) {
        setIsLoadingRoute(false);
      }
    }
  }, [effectiveCourierId, courierUseCases.getActiveRoute, preloadRouteRecords]);

  useEffect(() => {
    if (effectiveCourierId.length === 0) {
      setActiveRoute(null);
      return;
    }
    void loadActiveRoute();
  }, [effectiveCourierId, loadActiveRoute]);

  const setAvailability = useCallback(
    async (targetAvailable: boolean): Promise<void> => {
      const courierId = effectiveCourierId;
      if (courierId.length === 0) {
        setError('Selecciona un repartidor para actualizar su disponibilidad.');
        return;
      }

      setIsUpdatingAvailability(true);
      setError(null);
      setSuccessMessage(null);

      try {
        const updated = await courierUseCases.updateAvailability.execute(courierId, targetAvailable);

        if (mounted.current) {
          setCourierAvailability(updated.isAvailable);
          setCouriers((previous) =>
            previous.map((courier) => (courier.id === updated.id ? updated : courier)),
          );
          setSuccessMessage(
            `Disponibilidad actualizada: ${
              updated.isAvailable ? 'Disponible' : 'No disponible'
            }.`,
          );
        }
      } catch (error_) {
        setError(toMessage(error_, 'No se pudo actualizar la disponibilidad del repartidor.'));
      } finally {
        if (mounted.current) setIsUpdatingAvailability(false);
      }
    },
    [effectiveCourierId, courierUseCases.updateAvailability],
  );

  const toggleAvailability = useCallback(async (): Promise<void> => {
    await setAvailability(!(courierAvailability ?? false));
  }, [courierAvailability, setAvailability]);

  const ensureDeliveryRecord = useCallback(
    async (orderId: string): Promise<DeliveryOrder | null> => {
      const request = ++recordSequence.current;
      recordRequests.current.set(orderId, request);
      setSyncingOrderIds((previous) =>
        previous.includes(orderId) ? previous : [...previous, orderId],
      );

      try {
        const record = await useCases.getDeliveryOrder.execute(orderId);
        if (mounted.current && recordRequests.current.get(orderId) === request) {
          setDeliveryRecords((previous) => ({ ...previous, [record.orderId]: record }));
          setInspectedOrder((previous) => (previous?.orderId === record.orderId ? record : previous));
        }
        return record;
      } catch (error_) {
        if (mounted.current && recordRequests.current.get(orderId) === request) {
          setError(
            toMessage(error_, `No se pudo consultar el estado del pedido #PED-${shortCode(orderId)}.`),
          );
        }
        return null;
      } finally {
        if (mounted.current) {
          setSyncingOrderIds((previous) => previous.filter((id) => id !== orderId));
        }
      }
    },
    [useCases.getDeliveryOrder],
  );

  const syncDeliveryRecord = useCallback(
    async (orderId: string): Promise<void> => {
      await ensureDeliveryRecord(orderId);
    },
    [ensureDeliveryRecord],
  );

  const syncAllDeliveryRecords = useCallback(async (): Promise<void> => {
    const stops = activeRoute?.stops ?? [];
    if (stops.length === 0) return;
    await Promise.all(stops.map((stop) => ensureDeliveryRecord(stop.orderId)));
  }, [activeRoute, ensureDeliveryRecord]);

  const advanceStop = useCallback(
    async (orderId: string): Promise<void> => {
      setAdvancingOrderId(orderId);
      setError(null);
      setSuccessMessage(null);

      try {
        const record = deliveryRecords[orderId] ?? (await ensureDeliveryRecord(orderId));
        if (!record) return;

        const next = getNextAllowedDeliveryStatus(record.status);
        if (next === null) {
          setError(
            record.status === 'entregado'
              ? 'El pedido ya se encuentra entregado; no hay más transiciones disponibles.'
              : 'El pedido no admite más transiciones de entrega en su estado actual. Verifica que esté asignado a tu ruta.',
          );
          return;
        }

        const result = await useCases.changeStatus.execute({
          orderId,
          newStatus: next,
          expectedVersion: record.version,
        });

        const updatedRecord: DeliveryOrder = {
          ...record,
          status: result.status,
          version: result.version,
          deliveredAt:
            result.status === 'entregado' ? new Date().toISOString() : record.deliveredAt,
          updatedAt: new Date().toISOString(),
        };

        setDeliveryRecords((previous) => ({
          ...previous,
          [orderId]: updatedRecord,
        }));
        setInspectedOrder((previous) =>
          previous?.orderId === orderId ? updatedRecord : previous,
        );
        setSuccessMessage(
          `Pedido #PED-${shortCode(orderId)}: estado actualizado a "${orderStatusLabel(result.status)}".`,
        );

        if (effectiveCourierId.length > 0) {
          const route = await courierUseCases.getActiveRoute.execute(effectiveCourierId);
          if (mounted.current) {
            setActiveRoute(route);
            if (route) {
              await Promise.all(route.stops.map((stop) => ensureDeliveryRecord(stop.orderId)));
            }
          }
        }
        onDeliveryChanged?.();
      } catch (error_) {
        const message = toMessage(error_, 'No se pudo cambiar el estado del pedido.');
        setError(
          isDataConflict(error_)
            ? `${message} Sincroniza el estado del pedido antes de reintentar.`
            : message,
        );
      } finally {
        if (mounted.current) setAdvancingOrderId(null);
      }
    },
    [
      deliveryRecords,
      ensureDeliveryRecord,
      useCases.changeStatus,
      courierUseCases.getActiveRoute,
      effectiveCourierId,
      onDeliveryChanged,
    ],
  );

  const completeActiveRoute = useCallback(async (): Promise<void> => {
    if (!activeRoute) {
      setError('No hay una hoja de ruta activa para completar.');
      return;
    }

    setIsCompletingRoute(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await useCases.completeRoute.execute(activeRoute.routeId);
      setSuccessMessage(`Ruta #RUT-${shortCode(result.routeId)} completada correctamente.`);
      setInspectedOrder(null);
      setInspectorOrderIdState('');
      setDeliveryRecords({});
      await loadActiveRoute();
      onDeliveryChanged?.();
    } catch (error_) {
      setError(toMessage(error_, 'No se pudo completar la hoja de ruta activa.'));
    } finally {
      if (mounted.current) setIsCompletingRoute(false);
    }
  }, [activeRoute, useCases.completeRoute, loadActiveRoute, onDeliveryChanged]);

  const inspectOrder = useCallback(
    async (orderId: string): Promise<void> => {
      const trimmed = orderId.trim();
      setInspectorOrderIdState(trimmed);
      setInspectorError(null);

      if (trimmed.length === 0) {
        setInspectedOrder(null);
        return;
      }

      const request = ++inspectorRequest.current;
      setIsLoadingInspector(true);

      try {
        const record = await useCases.getDeliveryOrder.execute(trimmed);
        if (mounted.current && request === inspectorRequest.current) {
          setInspectedOrder(record);
          setDeliveryRecords((previous) => ({ ...previous, [record.orderId]: record }));
        }
      } catch (error_) {
        if (mounted.current && request === inspectorRequest.current) {
          setInspectorError(
            toMessage(error_, 'No se pudo consultar el estado de entrega del pedido.'),
          );
        }
      } finally {
        if (mounted.current && request === inspectorRequest.current) {
          setIsLoadingInspector(false);
        }
      }
    },
    [useCases.getDeliveryOrder],
  );

  return {
    selectedCourierId,
    setSelectedCourierId,
    effectiveCourierId,
    couriers,
    isLoadingCouriers,
    couriersError,
    refreshCouriers,
    activeRoute,
    isLoadingRoute,
    routeError,
    loadActiveRoute,
    courierAvailability,
    isUpdatingAvailability,
    setAvailability,
    toggleAvailability,
    deliveryRecords,
    isLoadingDeliveryRecords: syncingOrderIds.length > 0,
    syncingOrderIds,
    syncDeliveryRecord,
    syncAllDeliveryRecords,
    advancingOrderId,
    advanceStop,
    isCompletingRoute,
    completeActiveRoute,
    inspectorOrderId,
    setInspectorOrderId,
    inspectOrder,
    inspectedOrder,
    isLoadingInspector,
    inspectorError,
    error,
    successMessage,
    clearFeedback,
  };
}

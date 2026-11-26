import { useEffect, useMemo, useState, type FC } from 'react';
import type { CourierUseCases } from '../../../couriers/application/courierUseCases.js';
import type { ActiveCourierRouteStop } from '../../../couriers/domain/index.js';
import type { CourierStoreOrder } from '../../../store/domain/storeTypes.js';
import { CollectDeliveryModal } from '../../../store/presentation/components/CollectDeliveryModal.js';
import type { HttpStoreGateway } from '../../../store/infrastructure/http/httpStoreGateway.js';
import type { Zone } from '../../../zones/domain/index.js';
import type { DeliveryUseCases } from '../../application/deliveryUseCases.js';
import { useDeliveries } from '../hooks/useDeliveries.js';
import { CourierOperationCard } from './CourierOperationCard.js';
import { DeliveryOrderInspectorCard } from './DeliveryOrderInspectorCard.js';
import { DeliveryStopList } from './DeliveryStopList.js';
import {
  Alert,
  Button,
  KpiStrip,
  PageHeader,
  RouteStopsMap,
  TopRefetchBar,
  type RouteMapStop,
} from '../../../../shared/ui/index.js';
import '../styles/deliveries.css';

export interface DeliveryActor {
  readonly id: string;
  readonly role: 'personal' | 'repartidor' | 'cliente';
  readonly courierId: string | null;
  readonly displayName: string | null;
}

export interface DeliveryExecutionViewProps {
  useCases: DeliveryUseCases;
  courierUseCases: CourierUseCases;
  actor: DeliveryActor;
  /** Catálogo de zonas para resolver el nombre real de la zona de la ruta. */
  zones?: readonly Zone[] | undefined;
  /** Gateway de tienda para enriquecer paradas con coordenadas (migración 013) y datos COD. */
  storeGateway?: HttpStoreGateway | undefined;
  /** Sincroniza catálogos compartidos tras cambiar estados o completar una ruta. */
  onDeliveryChanged?: (() => void) | undefined;
}

interface StopGeoMeta {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly recipientName?: string | null | undefined;
  readonly recipientPhone?: string | null | undefined;
  readonly totalCents?: number | null | undefined;
  readonly notes?: string | null | undefined;
}

const EMPTY_STOPS: readonly ActiveCourierRouteStop[] = [];

export const DeliveryExecutionView: FC<DeliveryExecutionViewProps> = ({
  useCases,
  courierUseCases,
  actor,
  zones,
  storeGateway,
  onDeliveryChanged,
}) => {
  const deliveries = useDeliveries(useCases, courierUseCases, actor, { onDeliveryChanged });
  const stops = deliveries.activeRoute?.stops ?? EMPTY_STOPS;
  const selectedCourier =
    deliveries.couriers.find((courier) => courier.id === deliveries.effectiveCourierId) ?? null;
  const hasCourierBinding = actor.role === 'repartidor' ? actor.courierId !== null : true;

  const [geoByOrderId, setGeoByOrderId] = useState<Record<string, StopGeoMeta>>({});
  const [courierStoreOrders, setCourierStoreOrders] = useState<Record<string, CourierStoreOrder>>({});
  const [collectTarget, setCollectTarget] = useState<CourierStoreOrder | null>(null);
  const [collectNotice, setCollectNotice] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const route = deliveries.activeRoute;
    if (!storeGateway || !route || route.stops.length === 0) {
      setGeoByOrderId({});
      setCourierStoreOrders({});
      return;
    }

    let cancelled = false;
    const loadGeo = async () => {
      try {
        const next: Record<string, StopGeoMeta> = {};
        if (actor.role === 'repartidor') {
          const items = await storeGateway.getCourierOrders();
          const storeOrders: Record<string, CourierStoreOrder> = {};
          for (const item of items) {
            if (item.isStoreOrder) storeOrders[item.orderId] = item;
          }
          if (!cancelled) setCourierStoreOrders(storeOrders);
          for (const item of items) {
            next[item.orderId] = {
              latitude: item.deliveryLatitude,
              longitude: item.deliveryLongitude,
              recipientName: item.recipientName,
              recipientPhone: item.recipientPhone,
              totalCents: item.totalCents,
              notes: item.notes,
            };
          }
        } else if (actor.role === 'personal') {
          const res = await storeGateway.adminListOrders({
            deliveryDate: route.serviceDate,
            pageSize: 50,
          });
          for (const item of res.items) {
            next[item.id] = {
              latitude: item.deliveryLatitude,
              longitude: item.deliveryLongitude,
              recipientName: item.recipientName,
              recipientPhone: item.recipientPhone,
              totalCents: item.totalCents,
              notes: item.notes,
            };
          }
        }
        if (!cancelled) setGeoByOrderId(next);
      } catch {
        // Las coordenadas son opcionales: si la consulta falla la ejecución operativa sigue intacta.
      }
    };

    void loadGeo();
    return () => {
      cancelled = true;
    };
  }, [actor.role, deliveries.activeRoute, storeGateway, reloadTick]);

  const collectableOrderIds = useMemo(
    () => new Set(Object.keys(courierStoreOrders)),
    [courierStoreOrders],
  );

  const activeServiceDate = deliveries.activeRoute?.serviceDate;

  const mapStops = useMemo<readonly RouteMapStop[]>(() => {
    return stops.map((stop) => {
      const record = deliveries.deliveryRecords[stop.orderId];
      const geo = geoByOrderId[stop.orderId];
      return {
        orderId: stop.orderId,
        position: stop.position,
        address: stop.deliveryAddress,
        status: record?.status ?? stop.status,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        deliveryDate: activeServiceDate,
        deliveryTime: stop.deliveryTime,
        recipientName: geo?.recipientName,
        recipientPhone: geo?.recipientPhone,
        totalCents: geo?.totalCents,
        notes: geo?.notes,
      };
    });
  }, [activeServiceDate, deliveries.deliveryRecords, geoByOrderId, stops]);

  const activeZoneName =
    deliveries.activeRoute
      ? zones?.find((z) => z.id === deliveries.activeRoute?.zoneId)?.name ?? null
      : null;

  const deliveredCount = stops.filter(
    (s) => (deliveries.deliveryRecords[s.orderId]?.status ?? s.status) === 'entregado',
  ).length;
  const closedCount = stops.filter((s) => {
    const st = deliveries.deliveryRecords[s.orderId]?.status ?? s.status;
    return st === 'entregado' || st === 'entrega_fallida';
  }).length;
  const progressPct = stops.length === 0 ? 0 : Math.round((closedCount / stops.length) * 100);
  const availLabel =
    deliveries.courierAvailability === null
      ? 'Por confirmar'
      : deliveries.courierAvailability
        ? 'Disponible'
        : 'No disponible';

  return (
    <section className="deliveries-layout" aria-labelledby="deliveries-view-title">
      <PageHeader
        id="deliveries-view-title"
        eyebrow={actor.role === 'repartidor' ? 'Reparto en Ruta' : 'Supervisión · Entregas'}
        title="Ejecución de entregas"
        subtitle={
          activeZoneName
            ? `Ruta activa en ${activeZoneName}${deliveries.activeRoute ? ` · ${deliveries.activeRoute.serviceDate}` : ''}.`
            : 'Seguimiento en vivo de paradas, trazado vial y confirmación de entregas.'
        }
        actions={
          stops.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={deliveries.isLoadingDeliveryRecords}
              disabled={deliveries.isLoadingDeliveryRecords}
              onClick={() => void deliveries.syncAllDeliveryRecords()}
              aria-label="Sincronizar estados de todas las paradas"
            >
              {deliveries.isLoadingDeliveryRecords ? 'Sincronizando...' : '↻ Sincronizar estados'}
            </Button>
          ) : undefined
        }
      />

      <TopRefetchBar
        active={deliveries.isLoadingRoute || deliveries.isLoadingDeliveryRecords}
        label="Sincronizando entregas"
      />

      {hasCourierBinding && (
        <KpiStrip
          ariaLabel="Resumen de ejecución de entregas"
          items={[
            {
              label: 'Disponibilidad',
              value: availLabel,
              hint: selectedCourier?.displayName ?? actor.displayName ?? 'Operador',
              tone:
                deliveries.courierAvailability === null
                  ? 'neutral'
                  : deliveries.courierAvailability
                    ? 'green'
                    : 'red',
            },
            {
              label: 'Paradas en ruta',
              value: stops.length,
              hint: deliveries.activeRoute ? `Estado: ${deliveries.activeRoute.status}` : 'Sin ruta activa',
              tone: 'blue',
            },
            {
              label: 'Entregadas',
              value: `${deliveredCount}/${stops.length}`,
              hint: `${progressPct}% completado`,
              tone: progressPct === 100 && stops.length > 0 ? 'green' : 'neutral',
            },
          ]}
        />
      )}

      {deliveries.error && (
        <Alert type="error" title="Atención" onClose={deliveries.clearFeedback}>
          {deliveries.error}
        </Alert>
      )}

      {deliveries.successMessage && (
        <Alert type="success" title="Operación exitosa" onClose={deliveries.clearFeedback}>
          {deliveries.successMessage}
        </Alert>
      )}

      {actor.role === 'repartidor' && actor.courierId === null && (
        <Alert type="warning" title="Sin repartidor vinculado">
          Tu cuenta aún no tiene una ficha operativa en flota. Un administrador debe vincular o
          aprobar tu perfil de repartidor para operar entregas.
        </Alert>
      )}

      {hasCourierBinding && (
        <div className="deliveries-grid">
          <div className="deliveries-grid__main">
            {deliveries.activeRoute && stops.length > 0 && (
              <RouteStopsMap
                title="Mapa de la ruta activa"
                subtitle={`${deliveries.activeRoute.serviceDate}${activeZoneName ? ` · ${activeZoneName}` : ''}${selectedCourier ? ` · ${selectedCourier.displayName}` : ''}`}
                stops={mapStops}
                selectedOrderId={deliveries.inspectorOrderId}
                onSelectStop={(orderId) => void deliveries.inspectOrder(orderId)}
              />
            )}

            <DeliveryStopList
              actor={actor}
              effectiveCourierId={deliveries.effectiveCourierId}
              selectedCourierName={selectedCourier?.displayName ?? null}
              activeRoute={deliveries.activeRoute}
              isLoadingRoute={deliveries.isLoadingRoute}
              routeError={deliveries.routeError}
              zones={zones}
              deliveryRecords={deliveries.deliveryRecords}
              syncingOrderIds={deliveries.syncingOrderIds}
              advancingOrderId={deliveries.advancingOrderId}
              inspectorOrderId={deliveries.inspectorOrderId}
              isLoadingInspector={deliveries.isLoadingInspector}
              isCompletingRoute={deliveries.isCompletingRoute}
              onLoadActiveRoute={() => void deliveries.loadActiveRoute()}
              onInspectStop={(orderId) => void deliveries.inspectOrder(orderId)}
              onAdvanceStop={(orderId) => void deliveries.advanceStop(orderId)}
              collectableOrderIds={collectableOrderIds}
              onCollectStop={(orderId) => setCollectTarget(courierStoreOrders[orderId] ?? null)}
              onCompleteRoute={() => void deliveries.completeActiveRoute()}
            />
          </div>

          <div className="deliveries-grid__side">
            <CourierOperationCard
              actor={actor}
              couriers={deliveries.couriers}
              selectedCourierId={deliveries.selectedCourierId}
              effectiveCourierId={deliveries.effectiveCourierId}
              isLoadingCouriers={deliveries.isLoadingCouriers}
              couriersError={deliveries.couriersError}
              courierAvailability={deliveries.courierAvailability}
              isUpdatingAvailability={deliveries.isUpdatingAvailability}
              onSelectCourier={deliveries.setSelectedCourierId}
              onRefreshCouriers={() => void deliveries.refreshCouriers()}
              onSetAvailability={(available) => void deliveries.setAvailability(available)}
            />

            {(stops.length > 0 ||
              deliveries.inspectedOrder !== null ||
              deliveries.inspectorError !== null) && (
              <DeliveryOrderInspectorCard
                stops={stops}
                inspectorOrderId={deliveries.inspectorOrderId}
                inspectedOrder={deliveries.inspectedOrder}
                isLoadingInspector={deliveries.isLoadingInspector}
                inspectorError={deliveries.inspectorError}
                syncingOrderIds={deliveries.syncingOrderIds}
                onInspectOrder={(orderId) => void deliveries.inspectOrder(orderId)}
                onSyncOrder={(orderId) => void deliveries.syncDeliveryRecord(orderId)}
              />
            )}
          </div>
        </div>
      )}
      {collectTarget && storeGateway && (
        <CollectDeliveryModal
          storeGateway={storeGateway}
          order={collectTarget}
          onClose={() => setCollectTarget(null)}
          onDelivered={async (collectedCents) => {
            const orderId = collectTarget.orderId;
            setCollectTarget(null);
            setCollectNotice(
              `Entrega confirmada (${(collectedCents / 100).toFixed(2)} USD cobrados contra entrega).`,
            );
            await deliveries.syncDeliveryRecord(orderId);
            await deliveries.loadActiveRoute();
            setReloadTick((tick) => tick + 1);
            onDeliveryChanged?.();
          }}
        />
      )}
      {collectNotice && (
        <Alert type="success" title="Entrega registrada" onClose={() => setCollectNotice(null)}>
          {collectNotice}
        </Alert>
      )}
    </section>
  );
};

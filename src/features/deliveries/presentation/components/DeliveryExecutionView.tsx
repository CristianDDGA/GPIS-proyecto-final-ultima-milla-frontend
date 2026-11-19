import type { FC } from 'react';
import type { CourierUseCases } from '../../../couriers/application/courierUseCases.js';
import type { ActiveCourierRouteStop } from '../../../couriers/domain/index.js';
import type { Zone } from '../../../zones/domain/index.js';
import type { DeliveryUseCases } from '../../application/deliveryUseCases.js';
import { useDeliveries } from '../hooks/useDeliveries.js';
import { CourierOperationCard } from './CourierOperationCard.js';
import { DeliveryOrderInspectorCard } from './DeliveryOrderInspectorCard.js';
import { DeliveryStopList } from './DeliveryStopList.js';
import { Alert, Button, KineticHeader } from '../../../../shared/ui/index.js';
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
  /** Sincroniza catálogos compartidos tras cambiar estados o completar una ruta. */
  onDeliveryChanged?: (() => void) | undefined;
}

const EMPTY_STOPS: readonly ActiveCourierRouteStop[] = [];

export const DeliveryExecutionView: FC<DeliveryExecutionViewProps> = ({
  useCases,
  courierUseCases,
  actor,
  zones,
  onDeliveryChanged,
}) => {
  const deliveries = useDeliveries(useCases, courierUseCases, actor, { onDeliveryChanged });
  const stops = deliveries.activeRoute?.stops ?? EMPTY_STOPS;
  const selectedCourier =
    deliveries.couriers.find((courier) => courier.id === deliveries.effectiveCourierId) ?? null;
  const hasCourierBinding = actor.role === 'repartidor' ? actor.courierId !== null : true;

  return (
    <section className="deliveries-layout" aria-labelledby="deliveries-view-title">
      <KineticHeader
        id="deliveries-view-title"
        level="h2"
        title="Ejecución de entregas"
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
    </section>
  );
};

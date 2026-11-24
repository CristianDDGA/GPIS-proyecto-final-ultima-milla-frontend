import type { FC } from 'react';
import type { ActiveCourierRoute, ActiveCourierRouteStop } from '../../../couriers/domain/index.js';
import type { OrderStatus } from '../../../orders/domain/index.js';
import type { Zone } from '../../../zones/domain/index.js';
import type { DeliveryOrder } from '../../domain/index.js';
import {
  deliveryActionLabel,
  getNextAllowedDeliveryStatus,
  orderStatusLabel,
} from '../../domain/index.js';
import type { DeliveryActor } from './DeliveryExecutionView.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ShortIdBadge,
  Spinner,
} from '../../../../shared/ui/index.js';

export interface DeliveryStopListProps {
  readonly actor: DeliveryActor;
  readonly effectiveCourierId: string;
  readonly selectedCourierName: string | null;
  readonly activeRoute: ActiveCourierRoute | null;
  readonly isLoadingRoute: boolean;
  readonly routeError: string | null;
  readonly zones?: readonly Zone[] | undefined;
  readonly deliveryRecords: Readonly<Record<string, DeliveryOrder>>;
  readonly syncingOrderIds: readonly string[];
  readonly advancingOrderId: string | null;
  readonly inspectorOrderId: string;
  readonly isLoadingInspector: boolean;
  readonly isCompletingRoute: boolean;
  readonly onLoadActiveRoute: () => void;
  readonly onInspectStop: (orderId: string) => void;
  readonly onAdvanceStop: (orderId: string) => void;
  /** Pedidos de tienda: se entregan cobrando, no con "Marcar entregado". */
  readonly collectableOrderIds?: ReadonlySet<string> | undefined;
  readonly onCollectStop?: ((orderId: string) => void) | undefined;
  readonly onCompleteRoute: () => void;
}

const ROUTE_STATUS_LABELS: Record<string, string> = {
  asignada: 'Asignada',
  en_curso: 'En curso',
};

const STOP_STAGES: readonly { readonly status: OrderStatus; readonly label: string }[] = [
  { status: 'asignado_a_ruta', label: 'Asignado' },
  { status: 'recogido', label: 'Recogido' },
  { status: 'en_camino', label: 'En camino' },
  { status: 'entregado', label: 'Entregado' },
];

function stageIndexOf(status: OrderStatus): number {
  const index = STOP_STAGES.findIndex((stage) => stage.status === status);
  return index >= 0 ? index : 0;
}

export const DeliveryStopList: FC<DeliveryStopListProps> = ({
  actor,
  effectiveCourierId,
  selectedCourierName,
  activeRoute,
  isLoadingRoute,
  routeError,
  zones,
  deliveryRecords,
  syncingOrderIds,
  advancingOrderId,
  inspectorOrderId,
  isLoadingInspector,
  isCompletingRoute,
  onLoadActiveRoute,
  onInspectStop,
  onAdvanceStop,
  collectableOrderIds,
  onCollectStop,
  onCompleteRoute,
}) => {
  const stops: readonly ActiveCourierRouteStop[] = activeRoute?.stops ?? [];

  const resolveZoneName = (zoneId: string): string =>
    zones?.find((zone) => zone.id === zoneId)?.name ?? 'Zona sin catalogar';

  const statusOf = (orderId: string, fallback: OrderStatus): OrderStatus =>
    deliveryRecords[orderId]?.status ?? fallback;

  const closedCount = stops.filter((stop) => {
    const st = statusOf(stop.orderId, stop.status);
    return st === 'entregado' || st === 'entrega_fallida';
  }).length;
  const deliveredCount = stops.filter(
    (stop) => statusOf(stop.orderId, stop.status) === 'entregado',
  ).length;
  const allClosed = stops.length > 0 && closedCount === stops.length;
  const canCompleteRoute =
    activeRoute !== null && activeRoute.status === 'en_curso' && allClosed;
  const progressPercent = stops.length === 0 ? 0 : Math.round((closedCount / stops.length) * 100);

  const completeRouteReason = ((): string => {
    if (!activeRoute) return 'No hay una hoja de ruta activa cargada.';
    if (stops.length === 0) return 'La ruta no tiene paradas activas.';
    if (activeRoute.status !== 'en_curso') {
      return 'Inicia la ruta marcando al menos un pedido en camino para poder completarla.';
    }
    if (!allClosed) {
      return `Faltan entregas: ${closedCount} de ${stops.length} paradas cerradas.`;
    }
    return '';
  })();

  const operatorLabel =
    selectedCourierName ??
    (actor.role === 'repartidor' ? actor.displayName : null) ??
    'Repartidor en sesión';

  return (
    <Card variant="elevated" className="deliveries-route-card">
      <div className="deliveries-card__header">
        <h3 className="deliveries-card__title">Hoja de ruta activa</h3>
        <div className="deliveries-card__actions">
          <Button
            type="button"
            variant={activeRoute === null ? 'outline' : 'secondary'}
            size="sm"
            isLoading={isLoadingRoute}
            disabled={effectiveCourierId.length === 0 || isLoadingRoute}
            onClick={onLoadActiveRoute}
          >
            {activeRoute === null ? 'Cargar hoja de ruta' : '↻ Recargar'}
          </Button>
        </div>
      </div>

      {effectiveCourierId.length === 0 ? (
        <p className="deliveries-hint">
          Selecciona un repartidor para cargar su hoja de ruta activa.
        </p>
      ) : actor.role === 'personal' ? (
        <p className="deliveries-hint">
          Repartidor en operación: <strong>{operatorLabel}</strong>
        </p>
      ) : null}

      {isLoadingRoute && (
        <div className="deliveries-loading" role="status">
          <Spinner size="md" label="Cargando hoja de ruta activa..." />
          <p>Consultando la hoja de ruta asignada...</p>
        </div>
      )}

      {!isLoadingRoute && routeError && (
        <Alert type="error" title="Hoja de ruta no disponible">
          {routeError}
        </Alert>
      )}

      {!isLoadingRoute &&
        routeError === null &&
        effectiveCourierId.length > 0 &&
        activeRoute === null && (
          <EmptyState
            title="Sin hoja de ruta activa"
            description="No hay una ruta asignada o en curso en este momento. Revisa tu disponibilidad o vuelve a consultar más tarde."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onLoadActiveRoute}
              >
                ↻ Volver a consultar
              </Button>
            }
          />
        )}

      {activeRoute && (
        <>
          <dl className="deliveries-route-meta">
            <div className="deliveries-route-meta__item">
              <dt>Zona</dt>
              <dd>{resolveZoneName(activeRoute.zoneId)}</dd>
            </div>
            <div className="deliveries-route-meta__item">
              <dt>Fecha de servicio</dt>
              <dd>{activeRoute.serviceDate}</dd>
            </div>
            <div className="deliveries-route-meta__item">
              <dt>Estado de la ruta</dt>
              <dd>
                <span
                  className={`deliveries-status-badge deliveries-status-badge--${activeRoute.status}`}
                >
                  {ROUTE_STATUS_LABELS[activeRoute.status] ?? activeRoute.status}
                </span>
              </dd>
            </div>
            <div className="deliveries-route-meta__item">
              <dt>Código</dt>
              <dd>
                <ShortIdBadge id={activeRoute.routeId} prefix="RUT" copyable={false} />
              </dd>
            </div>
          </dl>

          <div className="deliveries-progress" aria-label="Progreso de la ruta">
            <div className="deliveries-progress__summary">
              <span className="deliveries-progress__label">
                Entregados: <strong>{deliveredCount}</strong> de <strong>{stops.length}</strong>
              </span>
              <span className="deliveries-progress__percent">{progressPercent}%</span>
            </div>
            <div
              className="deliveries-progress__track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={stops.length}
              aria-valuenow={deliveredCount}
              aria-label="Pedidos entregados de la hoja de ruta"
            >
              <span
                className={`deliveries-progress__fill ${
                  allClosed ? 'deliveries-progress__fill--complete' : ''
                }`.trim()}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {stops.length === 0 ? (
            <p className="deliveries-empty-inline">
              La hoja de ruta no tiene paradas activas registradas.
            </p>
          ) : (
            <ol className="deliveries-stops" aria-label="Paradas de la hoja de ruta activa">
              {stops.map((stop) => {
                const currentStatus = statusOf(stop.orderId, stop.status);
                const next = getNextAllowedDeliveryStatus(currentStatus);
                const isSyncing = syncingOrderIds.includes(stop.orderId);
                const isAdvancing = advancingOrderId === stop.orderId;
                const isInspecting = inspectorOrderId === stop.orderId && isLoadingInspector;
                const currentStageIndex = stageIndexOf(currentStatus);
                const needsCollection =
                  next === 'entregado' &&
                  onCollectStop !== undefined &&
                  collectableOrderIds?.has(stop.orderId) === true;

                return (
                  <li
                    key={stop.orderId}
                    className={`deliveries-stop ${
                      inspectorOrderId === stop.orderId ? 'deliveries-stop--selected' : ''
                    }`.trim()}
                  >
                    <div className="deliveries-stop__position">
                      <span className="deliveries-stop__position-value">{stop.position}</span>
                      <span className="deliveries-stop__position-label">Parada</span>
                    </div>

                    <div className="deliveries-stop__body">
                      <div className="deliveries-stop__heading">
                        <button
                          type="button"
                          className="deliveries-stop__address"
                          onClick={() => onInspectStop(stop.orderId)}
                          aria-label={`Inspeccionar la parada ${stop.position} en ${stop.deliveryAddress}`}
                        >
                          {stop.deliveryAddress}
                        </button>
                        <span
                          className={`deliveries-status-badge deliveries-status-badge--${currentStatus}`}
                        >
                          {orderStatusLabel(currentStatus)}
                        </span>
                      </div>

                      <div className="deliveries-stop__meta">
                        <span>Entrega programada: {stop.deliveryTime}</span>
                        <ShortIdBadge id={stop.orderId} prefix="PED" />
                      </div>

                      <div className="deliveries-stop__stepper" aria-hidden="true">
                        {STOP_STAGES.map((stage, index) => {
                          const stateClass =
                            index < currentStageIndex
                              ? 'deliveries-stop__stage--done'
                              : index === currentStageIndex
                                ? 'deliveries-stop__stage--current'
                                : '';
                          return (
                            <span
                              key={stage.status}
                              className={`deliveries-stop__stage ${stateClass}`.trim()}
                            >
                              {stage.label}
                            </span>
                          );
                        })}
                      </div>

                      <div className="deliveries-stop__actions">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => onInspectStop(stop.orderId)}
                          isLoading={isInspecting}
                          disabled={isSyncing || isAdvancing}
                        >
                          Inspeccionar
                        </Button>

                        {next ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            isLoading={isAdvancing}
                            disabled={isAdvancing || isSyncing}
                            onClick={() =>
                              needsCollection ? onCollectStop?.(stop.orderId) : onAdvanceStop(stop.orderId)
                            }
                          >
                            {needsCollection ? 'Cobrar y entregar' : deliveryActionLabel(next)}
                          </Button>
                        ) : (
                          <span className="deliveries-stop__done" role="status">
                            {currentStatus === 'entregado'
                              ? 'Pedido entregado'
                              : currentStatus === 'entrega_fallida'
                                ? 'Entrega fallida'
                                : currentStatus === 'cancelado'
                                  ? 'Pedido cancelado'
                                  : 'Sin transición disponible'}
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="deliveries-route-completion">
            <div className="deliveries-route-completion__info">
              <span>
                Pedidos entregados: <strong>{deliveredCount}</strong> de{' '}
                <strong>{stops.length}</strong>
              </span>
              {!canCompleteRoute && completeRouteReason.length > 0 && (
                <span className="deliveries-route-completion__reason" role="status">
                  {completeRouteReason}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="primary"
              isLoading={isCompletingRoute}
              disabled={!canCompleteRoute || isCompletingRoute}
              onClick={onCompleteRoute}
              aria-label="Completar la hoja de ruta activa"
            >
              {isCompletingRoute ? 'Completando...' : 'Completar ruta'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

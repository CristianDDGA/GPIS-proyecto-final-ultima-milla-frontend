import { useEffect, useMemo, useState, type FC } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import type {
  RouteDetail,
  RouteStatus,
  RouteStop,
  RouteSummary,
  StopOrderStatus,
} from '../../domain/index.js';
import { Alert, Button, Card, Select } from '../../../../shared/ui/index.js';

const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  planificada: 'Planificada',
  asignada: 'Asignada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const STOP_STATUS_LABELS: Record<StopOrderStatus, string> = {
  asignado_a_ruta: 'Asignado a ruta',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

const EDITABLE_ROUTE_STATUSES: ReadonlySet<RouteStatus> = new Set<RouteStatus>(['planificada', 'asignada']);

const STARTED_STOP_STATUSES: ReadonlySet<StopOrderStatus> = new Set<StopOrderStatus>(['recogido', 'en_camino', 'entregado']);

const MOVABLE_ROUTE_STATUSES: ReadonlySet<RouteStatus> = new Set<RouteStatus>(['planificada', 'asignada']);

export interface RouteDetailPanelProps {
  route: RouteDetail;
  routes: readonly RouteSummary[];
  zones: readonly Zone[];
  isAdmin: boolean;
  isLoadingDetail: boolean;
  detailError: string | null;
  isReordering: boolean;
  isCancelling: boolean;
  isMovingOrder: boolean;
  onReorderStops: (orderIds: string[]) => Promise<boolean>;
  onCancelRoute: () => Promise<boolean>;
  onMoveOrder: (orderId: string, destinationRouteId: string) => Promise<boolean>;
  onReload: () => void;
  onClose: () => void;
}

export const RouteDetailPanel: FC<RouteDetailPanelProps> = ({
  route,
  routes,
  zones,
  isAdmin,
  isLoadingDetail,
  detailError,
  isReordering,
  isCancelling,
  isMovingOrder,
  onReorderStops,
  onCancelRoute,
  onMoveOrder,
  onReload,
  onClose,
}) => {
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>(() => route.stops.map((stop) => stop.orderId));
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraftOrderIds(route.stops.map((stop) => stop.orderId));
    setConfirmingCancel(false);
    setMoveTargets({});
  }, [route]);

  const stopsByOrderId = useMemo(() => {
    const byOrderId = new Map<string, RouteStop>();
    for (const stop of route.stops) {
      byOrderId.set(stop.orderId, stop);
    }
    return byOrderId;
  }, [route.stops]);

  const orderedStops = useMemo(
    () =>
      draftOrderIds
        .map((orderId) => stopsByOrderId.get(orderId))
        .filter((stop): stop is RouteStop => stop !== undefined),
    [draftOrderIds, stopsByOrderId],
  );

  const isEditable = EDITABLE_ROUTE_STATUSES.has(route.status);
  const canReorder = isAdmin && isEditable;
  const hasStartedStops = route.stops.some((stop) => STARTED_STOP_STATUSES.has(stop.status));
  const canCancel = isAdmin && isEditable && !hasStartedStops;
  const zoneName = zones.find((zone) => zone.id === route.zoneId)?.name ?? route.zoneId;

  const isDraftDirty =
    draftOrderIds.length !== route.stops.length ||
    draftOrderIds.some((orderId, index) => orderId !== route.stops[index]?.orderId);

  const compatibleRoutes = useMemo(
    () =>
      routes.filter(
        (candidate) =>
          candidate.id !== route.id &&
          candidate.zoneId === route.zoneId &&
          candidate.serviceDate === route.serviceDate &&
          MOVABLE_ROUTE_STATUSES.has(candidate.status) &&
          candidate.occupiedSlots < candidate.capacityLimit,
      ),
    [route, routes],
  );

  const handleMoveStop = (index: number, offset: number) => {
    setDraftOrderIds((previous) => {
      const target = index + offset;
      const currentOrderId = previous[index];
      const targetOrderId = previous[target];
      if (currentOrderId === undefined || targetOrderId === undefined) {
        return previous;
      }
      const next = [...previous];
      next[index] = targetOrderId;
      next[target] = currentOrderId;
      return next;
    });
  };

  const handleDiscardDraft = () => {
    setDraftOrderIds(route.stops.map((stop) => stop.orderId));
  };

  const handleMoveTargetChange = (orderId: string, destinationRouteId: string) => {
    setMoveTargets((previous) => ({ ...previous, [orderId]: destinationRouteId }));
  };

  return (
    <Card variant="elevated" className="routes-detail-card">
      <div className="routes-detail-card__header">
        <h3 className="routes-detail-card__title">Detalle de la Ruta Seleccionada (GET /routes/:id)</h3>
        <div className="routes-detail-card__header-actions">
          <Button type="button" variant="secondary" size="sm" onClick={onReload} isLoading={isLoadingDetail}>
            ↻ Recargar detalle
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar detalle
          </Button>
        </div>
      </div>

      {detailError && (
        <Alert type="error" title="No se pudo actualizar el detalle">
          {detailError}
        </Alert>
      )}

      <dl className="routes-detail-meta">
        <div className="routes-detail-meta__item">
          <dt>Identificador</dt>
          <dd>
            <code>{route.id}</code>
          </dd>
        </div>
        <div className="routes-detail-meta__item">
          <dt>Zona</dt>
          <dd>
            {zoneName} <span className="routes-table__muted">{route.zoneId}</span>
          </dd>
        </div>
        <div className="routes-detail-meta__item">
          <dt>Fecha de servicio</dt>
          <dd>{route.serviceDate}</dd>
        </div>
        <div className="routes-detail-meta__item">
          <dt>Estado</dt>
          <dd>
            <span className={`routes-status-badge routes-status-badge--${route.status}`}>
              {ROUTE_STATUS_LABELS[route.status]}
            </span>
          </dd>
        </div>
        <div className="routes-detail-meta__item">
          <dt>Ocupación</dt>
          <dd>
            {route.occupiedSlots} / {route.capacityLimit}
          </dd>
        </div>
        <div className="routes-detail-meta__item">
          <dt>Repartidor</dt>
          <dd>{route.courierId ?? 'Sin asignar'}</dd>
        </div>
      </dl>

      <section className="routes-stops" aria-labelledby="routes-stops-title">
        <h4 id="routes-stops-title" className="routes-stops__title">
          Paradas de la ruta
        </h4>

        {orderedStops.length === 0 ? (
          <p className="routes-stops__empty">Esta ruta todavía no tiene paradas asignadas.</p>
        ) : (
          <div className="routes-table-wrapper">
            <table className="routes-table" aria-label="Paradas de la ruta seleccionada">
              <thead>
                <tr>
                  <th scope="col">Posición</th>
                  <th scope="col">Pedido</th>
                  <th scope="col">Dirección</th>
                  <th scope="col">Fecha y hora</th>
                  <th scope="col">Estado</th>
                  {canReorder && <th scope="col">Orden</th>}
                  {isAdmin && <th scope="col">Mover a otra ruta</th>}
                </tr>
              </thead>
              <tbody>
                {orderedStops.map((stop, index) => {
                  const moveTarget = moveTargets[stop.orderId] ?? '';
                  const canMoveStop = stop.status === 'asignado_a_ruta';

                  return (
                    <tr key={stop.orderId}>
                      <td>{index + 1}</td>
                      <td>
                        <code className="routes-table__uuid">{stop.orderId}</code>
                      </td>
                      <td>{stop.deliveryAddress}</td>
                      <td>
                        {stop.deliveryDate} {stop.deliveryTime}
                      </td>
                      <td>
                        <span className={`routes-status-badge routes-status-badge--${stop.status}`}>
                          {STOP_STATUS_LABELS[stop.status]}
                        </span>
                      </td>
                      {canReorder && (
                        <td>
                          <div className="routes-stops__order-actions">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMoveStop(index, -1)}
                              disabled={index === 0 || isReordering}
                              aria-label={`Subir la parada ${index + 1} del pedido ${stop.orderId}`}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMoveStop(index, 1)}
                              disabled={index === orderedStops.length - 1 || isReordering}
                              aria-label={`Bajar la parada ${index + 1} del pedido ${stop.orderId}`}
                            >
                              ↓
                            </Button>
                          </div>
                        </td>
                      )}
                      {isAdmin && (
                        <td>
                          {!canMoveStop ? (
                            <span className="routes-table__muted">
                              Sólo se pueden reubicar paradas en estado asignado_a_ruta.
                            </span>
                          ) : compatibleRoutes.length === 0 ? (
                            <span className="routes-table__muted">No hay rutas compatibles con cupo disponible.</span>
                          ) : (
                            <div className="routes-stops__move-actions">
                              <Select
                                label={`Ruta destino para el pedido ${stop.orderId}`}
                                options={[
                                  { value: '', label: 'Selecciona una ruta destino' },
                                  ...compatibleRoutes.map((candidate) => ({
                                    value: candidate.id,
                                    label: `${candidate.serviceDate} · ${
                                      zones.find((zone) => zone.id === candidate.zoneId)?.name ?? candidate.zoneId
                                    } · ${candidate.occupiedSlots}/${candidate.capacityLimit}`,
                                  })),
                                ]}
                                value={moveTarget}
                                onChange={(event) => handleMoveTargetChange(stop.orderId, event.target.value)}
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => onMoveOrder(stop.orderId, moveTarget)}
                                disabled={moveTarget.length === 0 || isMovingOrder}
                              >
                                Mover pedido
                              </Button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {canReorder && (
          <div className="routes-stops__draft-actions">
            <Button
              type="button"
              variant="primary"
              size="sm"
              isLoading={isReordering}
              disabled={!isDraftDirty}
              onClick={() => void onReorderStops(draftOrderIds)}
            >
              Guardar nuevo orden de paradas
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={handleDiscardDraft} disabled={!isDraftDirty || isReordering}>
              Descartar cambios
            </Button>
            {isDraftDirty && (
              <span className="routes-table__muted" role="status">
                Hay cambios sin guardar en el orden de las paradas.
              </span>
            )}
          </div>
        )}
      </section>

      {canCancel && (
        <section className="routes-cancel" aria-labelledby="routes-cancel-title">
          <h4 id="routes-cancel-title" className="routes-stops__title">
            Cancelar Ruta (POST /routes/:id/cancel)
          </h4>
          {confirmingCancel ? (
            <div className="routes-cancel__confirm">
              <p>¿Confirma la cancelación de esta ruta?</p>
              <div className="routes-cancel__actions">
                <Button type="button" variant="danger" size="sm" isLoading={isCancelling} onClick={() => void onCancelRoute()}>
                  Sí, cancelar
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmingCancel(false)} disabled={isCancelling}>
                  No, volver
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="danger" size="sm" onClick={() => setConfirmingCancel(true)}>
              Cancelar ruta
            </Button>
          )}
        </section>
      )}
    </Card>
  );
};

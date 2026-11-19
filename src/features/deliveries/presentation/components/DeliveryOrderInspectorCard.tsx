import { useMemo, type FC } from 'react';
import type { ActiveCourierRouteStop } from '../../../couriers/domain/index.js';
import type { DeliveryOrder } from '../../domain/index.js';
import { orderStatusLabel } from '../../domain/index.js';
import {
  Alert,
  Button,
  Card,
  Select,
  ShortIdBadge,
} from '../../../../shared/ui/index.js';

export interface DeliveryOrderInspectorCardProps {
  readonly stops: readonly ActiveCourierRouteStop[];
  readonly inspectorOrderId: string;
  readonly inspectedOrder: DeliveryOrder | null;
  readonly isLoadingInspector: boolean;
  readonly inspectorError: string | null;
  readonly syncingOrderIds: readonly string[];
  readonly onInspectOrder: (orderId: string) => void;
  readonly onSyncOrder: (orderId: string) => void;
}

function formatUtcTimestamp(isoValue: string | null): string {
  if (isoValue === null || isoValue.trim().length === 0) {
    return 'No registrado';
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return isoValue;
  }
  const formatted = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
  return `${formatted} UTC`;
}

export const DeliveryOrderInspectorCard: FC<DeliveryOrderInspectorCardProps> = ({
  stops,
  inspectorOrderId,
  inspectedOrder,
  isLoadingInspector,
  inspectorError,
  syncingOrderIds,
  onInspectOrder,
  onSyncOrder,
}) => {
  const inspectorOptions = useMemo(
    () =>
      stops.map((stop) => ({
        value: stop.orderId,
        label: `Parada ${stop.position} · ${stop.deliveryAddress}`,
      })),
    [stops],
  );

  const selectValue = inspectorOptions.some((option) => option.value === inspectorOrderId)
    ? inspectorOrderId
    : '';

  const isSyncingInspected =
    inspectedOrder !== null && syncingOrderIds.includes(inspectedOrder.orderId);

  return (
    <Card variant="elevated" className="deliveries-inspector-card">
      <div className="deliveries-card__header">
        <h3 className="deliveries-card__title">Detalle de parada</h3>
        {inspectedOrder !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            isLoading={isSyncingInspected}
            disabled={isSyncingInspected || isLoadingInspector}
            onClick={() => onSyncOrder(inspectedOrder.orderId)}
          >
            ↻ Sincronizar
          </Button>
        )}
      </div>

      {inspectorOptions.length > 0 ? (
        <Select
          label="Paradas de la ruta activa"
          placeholder="Selecciona una parada de la ruta"
          options={inspectorOptions}
          value={selectValue}
          onChange={(event) => onInspectOrder(event.target.value)}
          disabled={isLoadingInspector}
        />
      ) : (
        <p className="deliveries-hint">
          Carga una hoja de ruta para inspeccionar el detalle y la versión de cada parada.
        </p>
      )}

      {inspectorError && (
        <Alert type="error" title="Consulta no disponible">
          {inspectorError}
        </Alert>
      )}

      {inspectedOrder && (
        <dl className="deliveries-inspector-result">
          <div className="deliveries-inspector-result__item">
            <dt>Pedido</dt>
            <dd>
              <ShortIdBadge id={inspectedOrder.orderId} prefix="PED" />
            </dd>
          </div>
          <div className="deliveries-inspector-result__item">
            <dt>Ruta</dt>
            <dd>
              {inspectedOrder.routeId ? (
                <ShortIdBadge id={inspectedOrder.routeId} prefix="RUT" copyable={false} />
              ) : (
                'Sin ruta asignada'
              )}
            </dd>
          </div>
          <div className="deliveries-inspector-result__item">
            <dt>Estado</dt>
            <dd>
              <span
                className={`deliveries-status-badge deliveries-status-badge--${inspectedOrder.status}`}
              >
                {orderStatusLabel(inspectedOrder.status)}
              </span>
            </dd>
          </div>
          <div className="deliveries-inspector-result__item">
            <dt>Versión</dt>
            <dd className="deliveries-code">v{inspectedOrder.version}</dd>
          </div>
          <div className="deliveries-inspector-result__item">
            <dt>Entregado</dt>
            <dd>{formatUtcTimestamp(inspectedOrder.deliveredAt)}</dd>
          </div>
          <div className="deliveries-inspector-result__item">
            <dt>Actualizado</dt>
            <dd>{formatUtcTimestamp(inspectedOrder.updatedAt)}</dd>
          </div>
        </dl>
      )}
    </Card>
  );
};

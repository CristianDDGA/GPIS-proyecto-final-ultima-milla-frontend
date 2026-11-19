import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import type { Order } from '../../../orders/domain/index.js';
import {
  validateLateOrderPlacementInput,
  type LateOrderPlacementResult,
} from '../../domain/index.js';
import { Alert, Button, Card, Select, ShortIdBadge, TextInput } from '../../../../shared/ui/index.js';

const DEFAULT_CAPACITY_LIMIT = '4';
const MAX_VISIBLE_PENDING_OPTIONS = 50;

export interface LateOrderPlacementCardProps {
  pendingOrders: readonly Order[];
  isPlacingLate: boolean;
  onPlaceLateOrder: (orderId: string, capacityLimit: number) => Promise<LateOrderPlacementResult | null>;
  onInspectRoute: (routeId: string) => void;
}

export const LateOrderPlacementCard: FC<LateOrderPlacementCardProps> = ({
  pendingOrders,
  isPlacingLate,
  onPlaceLateOrder,
  onInspectRoute,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [capacityLimit, setCapacityLimit] = useState(DEFAULT_CAPACITY_LIMIT);
  const [result, setResult] = useState<LateOrderPlacementResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const allPendingOrders = useMemo(
    () => pendingOrders.filter((order) => order.status === 'pendiente'),
    [pendingOrders],
  );

  const filteredPendingOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (query.length === 0) {
      return allPendingOrders;
    }
    return allPendingOrders.filter(
      (order) =>
        order.deliveryAddress.toLowerCase().includes(query) ||
        order.deliveryDate.toLowerCase().includes(query) ||
        order.deliveryTime.toLowerCase().includes(query) ||
        order.id.toLowerCase().includes(query),
    );
  }, [allPendingOrders, searchQuery]);

  const pendingOrderOptions = useMemo(
    () =>
      filteredPendingOrders.slice(0, MAX_VISIBLE_PENDING_OPTIONS).map((order) => ({
        value: order.id,
        label: `${order.deliveryAddress} · ${order.deliveryDate} ${order.deliveryTime}`,
      })),
    [filteredPendingOrders],
  );

  const orderId = selectedOrderId.trim();
  const validation = validateLateOrderPlacementInput({ orderId, capacityLimit: Number(capacityLimit) });
  const orderIdError = showErrors ? validation.errors['orderId'] : undefined;
  const capacityLimitError = showErrors ? validation.errors['capacityLimit'] : undefined;
  const assignedRouteId = result && result.status === 'asignado_a_ruta' ? result.routeId : null;
  const isPendingPlacement = result?.status === 'pendiente';

  useEffect(() => {
    const firstOption = pendingOrderOptions[0];
    if (!firstOption) {
      return;
    }

    const stillPending = pendingOrderOptions.some((option) => option.value === selectedOrderId);
    if (selectedOrderId.trim().length === 0 || !stillPending) {
      setSelectedOrderId(firstOption.value);
    }
  }, [pendingOrderOptions, selectedOrderId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setShowErrors(true);
    setResult(null);
    if (!validation.isValid) {
      return;
    }
    void onPlaceLateOrder(orderId, Number(capacityLimit)).then((next) => {
      if (next) {
        setResult(next);
        setShowErrors(false);
        setSelectedOrderId('');
      }
    });
  };

  return (
    <Card variant="elevated" className="routes-operation-card">
      <div className="routes-operation-card__header">
        <h3 className="routes-operation-card__title">Insertar pedido tardío</h3>
      </div>

      <form className="routes-form" onSubmit={handleSubmit} aria-label="Insertar pedido tardío">
        {allPendingOrders.length > MAX_VISIBLE_PENDING_OPTIONS && (
          <TextInput
            label="Filtrar pedido pendiente"
            placeholder="Buscar por dirección o fecha..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        )}

        {pendingOrderOptions.length > 0 ? (
          <Select
            label="Pedido pendiente"
            options={pendingOrderOptions}
            value={selectedOrderId}
            onChange={(event) => setSelectedOrderId(event.target.value)}
            error={orderIdError}
            helperText={
              filteredPendingOrders.length > MAX_VISIBLE_PENDING_OPTIONS
                ? `Mostrando ${MAX_VISIBLE_PENDING_OPTIONS} de ${filteredPendingOrders.length} pedidos pendientes. Usa el filtro para acotar.`
                : undefined
            }
          />
        ) : (
          <Alert type="info" title="Sin pedidos pendientes">
            {allPendingOrders.length === 0
              ? 'No hay pedidos pendientes disponibles para insertar en rutas activas.'
              : 'Ningún pedido pendiente coincide con la búsqueda ingresada.'}
          </Alert>
        )}

        <TextInput
          label="Límite de capacidad de la ruta"
          type="number"
          min={1}
          max={2147483647}
          value={capacityLimit}
          onChange={(event) => setCapacityLimit(event.target.value)}
          error={capacityLimitError}
          isRequired
        />

        <div className="routes-form__actions">
          <Button
            type="submit"
            variant="primary"
            isLoading={isPlacingLate}
            disabled={pendingOrderOptions.length === 0}
          >
            Insertar pedido tardío
          </Button>
        </div>
      </form>

      {assignedRouteId && (
        <Alert type="success" title="Pedido tardío insertado" onClose={() => setResult(null)}>
          <p className="routes-late-result">
            El pedido se asignó a la ruta{' '}
            <ShortIdBadge id={assignedRouteId} prefix="RUT" copyable={false} />.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => onInspectRoute(assignedRouteId)}>
            Inspeccionar esa ruta
          </Button>
        </Alert>
      )}

      {isPendingPlacement && (
        <Alert type="warning" title="Pedido tardío pendiente" onClose={() => setResult(null)}>
          No hay repartidor disponible con capacidad suficiente para insertar este pedido. La
          operación quedará pendiente hasta que se libere un repartidor.
        </Alert>
      )}
    </Card>
  );
};

import { useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import type { Order } from '../../../orders/domain/index.js';
import {
  validateLateOrderPlacementInput,
  type LateOrderPlacementResult,
} from '../../domain/index.js';
import { Alert, Button, Card, Select, TextInput } from '../../../../shared/ui/index.js';

type OrderInputMode = 'list' | 'manual';

const MODE_OPTIONS = [
  { value: 'list', label: 'Elegir de la lista' },
  { value: 'manual', label: 'Escribir UUID' },
];

const DEFAULT_CAPACITY_LIMIT = '4';

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
  const [mode, setMode] = useState<OrderInputMode>('list');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [manualOrderId, setManualOrderId] = useState('');
  const [capacityLimit, setCapacityLimit] = useState(DEFAULT_CAPACITY_LIMIT);
  const [result, setResult] = useState<LateOrderPlacementResult | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  const pendingOrderOptions = useMemo(
    () =>
      pendingOrders
        .filter((order) => order.status === 'pendiente')
        .map((order) => ({
          value: order.id,
          label: `${order.deliveryAddress} — ${order.deliveryDate} ${order.deliveryTime}`,
        })),
    [pendingOrders],
  );

  const orderId = (mode === 'manual' ? manualOrderId : selectedOrderId).trim();
  const validation = validateLateOrderPlacementInput({ orderId, capacityLimit: Number(capacityLimit) });
  const orderIdError = showErrors ? validation.errors['orderId'] : undefined;
  const capacityLimitError = showErrors ? validation.errors['capacityLimit'] : undefined;
  const assignedRouteId = result && result.status === 'asignado_a_ruta' ? result.routeId : null;
  const isPendingPlacement = result?.status === 'pendiente';

  // The native select always shows its first option, so the state must mirror it:
  // otherwise submitting would validate an empty orderId until the user changes it.
  useEffect(() => {
    if (mode !== 'list') {
      return;
    }

    const firstOption = pendingOrderOptions[0];
    if (!firstOption) {
      return;
    }

    const stillPending = pendingOrderOptions.some((option) => option.value === selectedOrderId);
    if (selectedOrderId.trim().length === 0 || !stillPending) {
      setSelectedOrderId(firstOption.value);
    }
  }, [mode, pendingOrderOptions, selectedOrderId]);

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
        setManualOrderId('');
      }
    });
  };

  return (
    <Card variant="elevated" className="routes-operation-card">
      <h3 className="routes-operation-card__title">Insertar Pedido Tardío (POST /late-order-placements)</h3>
      <p className="routes-operation-card__hint">
        Incorpora un pedido pendiente a una ruta con cupo disponible del mismo día.
      </p>

      <form className="routes-form" onSubmit={handleSubmit} aria-label="Insertar pedido tardío">
        <Select
          label="Origen del pedido"
          options={MODE_OPTIONS}
          value={mode}
          onChange={(event) => {
            setMode(event.target.value === 'manual' ? 'manual' : 'list');
            setShowErrors(false);
            setResult(null);
          }}
        />

        {mode === 'list' ? (
          <Select
            label="Pedido pendiente"
            options={pendingOrderOptions}
            value={selectedOrderId}
            onChange={(event) => setSelectedOrderId(event.target.value)}
            error={orderIdError}
            helperText={
              pendingOrderOptions.length === 0
                ? 'No hay pedidos pendientes disponibles; cambia a "Escribir UUID" para ingresarlo manualmente.'
                : undefined
            }
          />
        ) : (
          <TextInput
            label="Identificador del pedido (UUID)"
            type="text"
            value={manualOrderId}
            onChange={(event) => setManualOrderId(event.target.value)}
            error={orderIdError}
            placeholder="00000000-0000-4000-8000-000000000000"
          />
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
          <Button type="submit" variant="primary" isLoading={isPlacingLate}>
            Insertar pedido tardío
          </Button>
        </div>
      </form>

      {assignedRouteId && (
        <Alert type="success" title="Pedido tardío insertado" onClose={() => setResult(null)}>
          <p>
            El pedido se asignó a la ruta <code>{assignedRouteId}</code>.
          </p>
          <Button type="button" variant="secondary" size="sm" onClick={() => onInspectRoute(assignedRouteId)}>
            Inspeccionar esa ruta
          </Button>
        </Alert>
      )}

      {isPendingPlacement && (
        <Alert type="warning" title="Pedido tardío pendiente" onClose={() => setResult(null)}>
          No hay repartidor disponible para insertar el pedido (NO_AVAILABLE_COURIER).
        </Alert>
      )}
    </Card>
  );
};

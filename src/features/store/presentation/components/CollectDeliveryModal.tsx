import { useState, type FC, type FormEvent } from 'react';
import { Alert, Button, Modal, TextInput } from '../../../../shared/ui/index.js';
import {
  formatCents,
  generateIdempotencyKey,
  parseDollarsToCents,
  type CourierStoreOrder,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';

export interface CollectDeliveryModalProps {
  readonly storeGateway: HttpStoreGateway;
  readonly order: Pick<CourierStoreOrder, 'orderId' | 'version' | 'totalCents' | 'deliveryAddress'>;
  readonly onClose: () => void;
  /** Se llama tras registrar la entrega con el monto realmente cobrado. */
  readonly onDelivered: (collectedCents: number) => void | Promise<void>;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

/** Ventana para cobrar contra entrega y marcar el pedido de tienda como entregado. */
export const CollectDeliveryModal: FC<CollectDeliveryModalProps> = ({
  storeGateway,
  order,
  onClose,
  onDelivered,
}) => {
  const [amount, setAmount] = useState(((order.totalCents ?? 0) / 100).toFixed(2));
  const [key] = useState(() => generateIdempotencyKey());
  const [isDelivering, setIsDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isDelivering) return;
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      setError('Ingresa un monto válido en dólares (ej. 24.50).');
      return;
    }
    setIsDelivering(true);
    setError(null);
    try {
      const outcome = await storeGateway.deliverCourierOrder(
        order.orderId,
        { expectedVersion: order.version, collectedCents: cents },
        key,
      );
      await onDelivered(outcome.collectedCents ?? cents);
    } catch (err) {
      setError(errorMessage(err, 'No se pudo registrar la entrega con cobro.'));
    } finally {
      setIsDelivering(false);
    }
  };

  return (
    <Modal
      title="Confirmar entrega con cobro"
      description={`Registra el cobro exacto contra entrega para ${order.deliveryAddress}.`}
      onClose={() => !isDelivering && onClose()}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" disabled={isDelivering} onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="courier-deliver-form"
            variant="primary"
            size="sm"
            isLoading={isDelivering}
          >
            Confirmar entrega
          </Button>
        </>
      }
    >
      <form id="courier-deliver-form" className="store-form" onSubmit={handleSubmit}>
        {error && (
          <Alert type="error" title="No se pudo confirmar" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        <p className="wf-modal__paragraph">
          Total exacto a cobrar: <strong>{formatCents(order.totalCents ?? 0)}</strong>
        </p>
        <TextInput
          id="courier-deliver-amount"
          label="Monto recibido en efectivo (USD)"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          isRequired
          disabled={isDelivering}
        />
      </form>
    </Modal>
  );
};

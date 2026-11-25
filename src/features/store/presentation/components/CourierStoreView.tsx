import { useCallback, useEffect, useState, type CSSProperties, type FC, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Modal,
  RouteStopsMap,
  SectionHeader,
  Select,
  ShortIdBadge,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import {
  FAILURE_REASONS,
  FAILURE_REASON_LABELS,
  MAX_DELIVERY_ATTEMPTS,
  STORE_ORDER_STATUS_LABELS,
  formatCents,
  generateIdempotencyKey,
  googleMapsDirectionsUrl,
  osmDirectionsUrl,
  todayInEcuador,
  type CourierCashSummary,
  type CourierStoreOrder,
  type FailureReason,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';
import { CollectDeliveryModal } from './CollectDeliveryModal.js';
import '../styles/store.css';

export interface CourierStoreViewProps {
  readonly storeGateway: HttpStoreGateway;
  readonly onOrdersChanged?: (() => void) | undefined;
}

type CourierStoreTab = 'orders' | 'cash';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function statusPillTone(status: string): string {
  switch (status) {
    case 'entregado':
      return 'store-pill--green';
    case 'en_camino':
    case 'asignado_a_ruta':
      return 'store-pill--blue';
    case 'entrega_fallida':
    case 'cancelado':
      return 'store-pill--red';
    case 'pendiente':
      return 'store-pill--amber';
    default:
      return '';
  }
}

export const CourierStoreView: FC<CourierStoreViewProps> = ({ storeGateway, onOrdersChanged }) => {
  const [tab, setTab] = useState<CourierStoreTab>('orders');
  const [orders, setOrders] = useState<readonly CourierStoreOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [cashDate, setCashDate] = useState<string>(() => todayInEcuador());
  const [cash, setCash] = useState<CourierCashSummary | null>(null);
  const [isLoadingCash, setIsLoadingCash] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);

  // Modal de entrega con cobro COD
  const [deliverTarget, setDeliverTarget] = useState<CourierStoreOrder | null>(null);

  // Modal de entrega fallida
  const [failTarget, setFailTarget] = useState<CourierStoreOrder | null>(null);
  const [failReason, setFailReason] = useState<FailureReason>('cliente_ausente');
  const [failNote, setFailNote] = useState('');
  const [failKey, setFailKey] = useState('');
  const [isFailing, setIsFailing] = useState(false);
  const [failError, setFailError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    setOrdersError(null);
    try {
      const items = await storeGateway.getCourierOrders();
      setOrders(items);
    } catch (err) {
      setOrdersError(errorMessage(err, 'No se pudieron cargar tus paradas con detalle de tienda.'));
    } finally {
      setIsLoadingOrders(false);
    }
  }, [storeGateway]);

  const loadCash = useCallback(
    async (date: string) => {
      setIsLoadingCash(true);
      setCashError(null);
      try {
        const result = await storeGateway.getCourierCash(date);
        setCash(result);
      } catch (err) {
        setCash(null);
        setCashError(errorMessage(err, 'No se pudo consultar tu caja del día.'));
      } finally {
        setIsLoadingCash(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    if (tab === 'cash') {
      void loadCash(cashDate);
    }
  }, [tab, cashDate, loadCash]);

  const openDeliverModal = (order: CourierStoreOrder) => {
    setDeliverTarget(order);
  };

  const handleDelivered = async (collectedCents: number) => {
    setDeliverTarget(null);
    setFeedback({
      type: 'success',
      message: `Entrega confirmada (${formatCents(collectedCents)} cobrados contra entrega).`,
    });
    await loadOrders();
    if (tab === 'cash') await loadCash(cashDate);
    onOrdersChanged?.();
  };

  const openFailModal = (order: CourierStoreOrder) => {
    setFailTarget(order);
    setFailReason('cliente_ausente');
    setFailNote('');
    setFailKey(generateIdempotencyKey());
    setFailError(null);
  };

  const handleFailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!failTarget || isFailing) return;
    setIsFailing(true);
    setFailError(null);
    try {
      const outcome = await storeGateway.failCourierOrder(
        failTarget.orderId,
        { expectedVersion: failTarget.version, reason: failReason, note: failNote },
        failKey,
      );
      setFailTarget(null);
      setFeedback({
        type: 'success',
        message: `Entrega marcada como fallida (intento ${outcome.attempt ?? failTarget.failedAttempts + 1} de ${MAX_DELIVERY_ATTEMPTS}).`,
      });
      await loadOrders();
      onOrdersChanged?.();
    } catch (err) {
      setFailError(errorMessage(err, 'No se pudo registrar la entrega fallida.'));
    } finally {
      setIsFailing(false);
    }
  };

  const segmentedStyle = {
    '--seg-index': tab === 'orders' ? 0 : 1,
    '--seg-count': 2,
  } as CSSProperties;

  return (
    <section className="store-layout" aria-labelledby="courier-store-title">
      <SectionHeader
        title="Cobros contra entrega y caja"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              className="segmented store-tabs"
              role="tablist"
              aria-label="Sección de reparto tienda"
              style={segmentedStyle}
            >
              <span className="segmented__thumb" aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'orders'}
                className={`store-tab ${tab === 'orders' ? 'store-tab--active' : ''}`}
                onClick={() => setTab('orders')}
              >
                Paradas con cobro
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'cash'}
                className={`store-tab ${tab === 'cash' ? 'store-tab--active' : ''}`}
                onClick={() => setTab('cash')}
              >
                Mi caja
              </button>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={tab === 'orders' ? isLoadingOrders : isLoadingCash}
              onClick={() => (tab === 'orders' ? void loadOrders() : void loadCash(cashDate))}
            >
              ↻ Actualizar
            </Button>
          </div>
        }
      />
      <h2 id="courier-store-title" className="sr-only">
        Cobros contra entrega y caja del repartidor
      </h2>

      {feedback && (
        <Alert
          type={feedback.type}
          title={feedback.type === 'success' ? 'Operación registrada' : 'Atención'}
          onClose={() => setFeedback(null)}
        >
          {feedback.message}
        </Alert>
      )}

      {tab === 'orders' ? (
        <Card className="store-card">
          <div className="store-card__header">
            <div>
              <h3 className="store-card__title">Paradas de tu ruta activa (detalle de productos y COD)</h3>
              <p className="store-card__subtitle">
                Los pedidos originados en la tienda requieren registrar el monto cobrado exacto al entregar.
              </p>
            </div>
            <span className="store-pill">{orders.length} {orders.length === 1 ? 'parada' : 'paradas'}</span>
          </div>

          {ordersError && (
            <Alert type="error" title="No se pudieron cargar las paradas">
              {ordersError}
            </Alert>
          )}

          {isLoadingOrders && orders.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
              <Spinner size="md" label="Cargando paradas de tienda..." />
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              title="Sin paradas activas"
              description="Cuando tengas una ruta asignada o en curso verás aquí tus paradas con productos, total a cobrar y destino en el mapa."
            />
          ) : (
            <>
              <RouteStopsMap
                title="Mapa de paradas de tu ruta"
                subtitle="Secuencia de entrega en calles reales con trazado y navegación directa."
                selectedOrderId={selectedStopId}
                onSelectStop={(orderId) => setSelectedStopId(orderId)}
                stops={orders.map((stop) => ({
                  orderId: stop.orderId,
                  position: stop.position,
                  address: stop.deliveryAddress,
                  status: stop.status,
                  latitude: stop.deliveryLatitude,
                  longitude: stop.deliveryLongitude,
                  deliveryDate: stop.deliveryDate,
                  deliveryTime: stop.deliveryTime,
                  recipientName: stop.recipientName,
                  recipientPhone: stop.recipientPhone,
                  totalCents: stop.totalCents,
                  notes: stop.notes,
                }))}
              />

              <ol className="store-stop-list" aria-label="Paradas con detalle y cobro">
                {orders.map((stop) => {
                  const canActOnRoad = stop.status === 'en_camino';
                  const canCollect = stop.isStoreOrder && canActOnRoad;
                  const canFail = canActOnRoad;
                  const isFocused = selectedStopId === stop.orderId;
                  return (
                    <li
                      key={stop.orderId}
                      className="store-stop-card"
                      style={
                        isFocused
                          ? { borderColor: 'rgba(22, 104, 243, 0.52)', backgroundColor: 'rgba(238, 245, 255, 0.90)' }
                          : undefined
                      }
                    >
                      <div className="store-stop-card__head">
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span className="store-pill store-pill--blue">Parada #{stop.position}</span>
                            <ShortIdBadge id={stop.orderId} prefix="PED" />
                            <span className={`store-pill ${statusPillTone(stop.status)}`}>
                              {STORE_ORDER_STATUS_LABELS[stop.status] ?? stop.status}
                            </span>
                            {stop.isStoreOrder && stop.totalCents !== null && (
                              <span className="store-pill store-pill--green">
                                Cobrar: {formatCents(stop.totalCents)}
                              </span>
                            )}
                            {stop.failedAttempts > 0 && (
                              <span className="store-pill store-pill--amber">
                                Intentos fallidos: {stop.failedAttempts}/{MAX_DELIVERY_ATTEMPTS}
                              </span>
                            )}
                          </div>
                          <p style={{ marginTop: '8px', fontWeight: 700, fontSize: '15px' }}>
                            {stop.deliveryAddress}
                          </p>
                          <p className="store-card__subtitle" style={{ marginTop: '2px' }}>
                            {stop.deliveryDate} · {stop.deliveryTime}
                            {stop.recipientName ? ` · Recibe: ${stop.recipientName}` : ''}
                            {stop.recipientPhone ? ` (${stop.recipientPhone})` : ''}
                          </p>
                          {stop.notes && (
                            <p className="store-card__subtitle" style={{ marginTop: '4px' }}>
                              Nota: {stop.notes}
                            </p>
                          )}
                        </div>

                        {stop.deliveryLatitude !== null && stop.deliveryLongitude !== null && (
                          <div className="store-map-links">
                            <button
                              type="button"
                              className="route-map-chip route-map-chip--active"
                              onClick={() => setSelectedStopId(stop.orderId)}
                            >
                              Ubicar en mapa
                            </button>
                            <a
                              href={osmDirectionsUrl(stop.deliveryLatitude, stop.deliveryLongitude)}
                              target="_blank"
                              rel="noreferrer"
                              className="store-map-link"
                            >
                              Abrir en OpenStreetMap
                            </a>
                            <a
                              href={googleMapsDirectionsUrl(stop.deliveryLatitude, stop.deliveryLongitude)}
                              target="_blank"
                              rel="noreferrer"
                              className="store-map-link"
                            >
                              Google Maps
                            </a>
                          </div>
                        )}
                      </div>

                    {stop.items.length > 0 && (
                      <div style={{ overflowX: 'auto' }}>
                        <table className="store-lines-table" aria-label={`Productos del pedido ${stop.orderId}`}>
                          <thead>
                            <tr>
                              <th scope="col">Producto</th>
                              <th scope="col">Cantidad</th>
                              <th scope="col">Precio unit.</th>
                              <th scope="col">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stop.items.map((line, index) => (
                              <tr key={`${stop.orderId}-${index}`}>
                                <td>{line.name}</td>
                                <td>{line.quantity}</td>
                                <td>{formatCents(line.unitPriceCents)}</td>
                                <td>
                                  <strong>{formatCents(line.lineTotalCents)}</strong>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {canCollect && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => openDeliverModal(stop)}
                        >
                          Cobrar y entregar ({formatCents(stop.totalCents ?? 0)})
                        </Button>
                      )}
                      {canFail && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => openFailModal(stop)}
                        >
                          Reportar entrega fallida
                        </Button>
                      )}
                      {!canActOnRoad && stop.status !== 'entregado' && stop.status !== 'entrega_fallida' && (
                        <span className="store-card__subtitle">
                          Avanza esta parada a «En camino» en la pestaña Entregas para registrar el cobro o reportar falla.
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            </>
          )}
        </Card>
      ) : (
        <Card className="store-card">
          <div className="store-card__header">
            <div>
              <h3 className="store-card__title">Mi caja diaria (efectivo contra entrega)</h3>
              <p className="store-card__subtitle">
                Consulta el efectivo acumulado del día y el estado de rendición con administración.
              </p>
            </div>
            <div style={{ width: '210px' }}>
              <TextInput
                id="courier-cash-date"
                type="date"
                label="Fecha (Ecuador)"
                value={cashDate}
                onChange={(e) => setCashDate(e.target.value)}
              />
            </div>
          </div>

          {cashError && (
            <Alert type="error" title="No se pudo consultar la caja">
              {cashError}
            </Alert>
          )}

          {isLoadingCash ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}>
              <Spinner size="md" label="Consultando caja..." />
            </div>
          ) : cash ? (
            <div className="store-kpi-grid">
              <div className="store-kpi-card">
                <span className="store-kpi-card__label">Efectivo cobrado ({cash.date})</span>
                <span className="store-kpi-card__value">{formatCents(cash.collectedCents)}</span>
                <span className="store-kpi-card__meta">
                  {cash.ordersCount} {cash.ordersCount === 1 ? 'pedido cobrado' : 'pedidos cobrados'}
                </span>
              </div>
              <div className="store-kpi-card">
                <span className="store-kpi-card__label">Estado de rendición</span>
                <span className="store-kpi-card__value" style={{ fontSize: '18px' }}>
                  {cash.settlement ? 'Caja rendida' : 'Pendiente de rendición'}
                </span>
                <span className="store-kpi-card__meta">
                  {cash.settlement
                    ? `Recibido: ${formatCents(cash.settlement.receivedCents)} · Diferencia: ${formatCents(cash.settlement.differenceCents)}`
                    : 'Entrega el efectivo en caja administrativa al terminar tu jornada.'}
                </span>
              </div>
            </div>
          ) : null}
        </Card>
      )}

      {deliverTarget && (
        <CollectDeliveryModal
          storeGateway={storeGateway}
          order={deliverTarget}
          onClose={() => setDeliverTarget(null)}
          onDelivered={handleDelivered}
        />
      )}

      {failTarget && (
        <Modal
          title="Reportar entrega fallida"
          description={`Selecciona el motivo del fallo en ${failTarget.deliveryAddress}.`}
          onClose={() => !isFailing && setFailTarget(null)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isFailing}
                onClick={() => setFailTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="courier-fail-form"
                variant="danger"
                size="sm"
                isLoading={isFailing}
              >
                Registrar falla
              </Button>
            </>
          }
        >
          <form id="courier-fail-form" className="store-form" onSubmit={handleFailSubmit}>
            {failError && (
              <Alert type="error" title="No se pudo registrar">
                {failError}
              </Alert>
            )}
            <Select
              id="courier-fail-reason"
              label="Motivo"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value as FailureReason)}
              options={FAILURE_REASONS.map((reason) => ({
                value: reason,
                label: FAILURE_REASON_LABELS[reason],
              }))}
              isRequired
              disabled={isFailing}
            />
            <TextInput
              id="courier-fail-note"
              label="Observación (opcional)"
              placeholder="Ej. Nadie respondió tras llamar dos veces"
              value={failNote}
              onChange={(e) => setFailNote(e.target.value)}
              maxLength={200}
              disabled={isFailing}
            />
          </form>
        </Modal>
      )}
    </section>
  );
};

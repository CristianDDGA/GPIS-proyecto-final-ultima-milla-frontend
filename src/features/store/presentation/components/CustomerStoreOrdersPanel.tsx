import { useCallback, useEffect, useState, type FC, type FormEvent } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Modal,
  RouteStopsMap,
  Select,
  ShortIdBadge,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  STORE_ORDER_STATUS_LABELS,
  formatCents,
  googleMapsDirectionsUrl,
  osmDirectionsUrl,
  todayInEcuador,
  type CancelReason,
  type DeliverySlot,
  type StoreOrderDetail,
  type StoreOrderSummary,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';

export interface CustomerStoreOrdersPanelProps {
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
  readonly refreshToken?: number | undefined;
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function statusTone(status: string): string {
  switch (status) {
    case 'entregado':
      return 'store-pill--green';
    case 'asignado_a_ruta':
    case 'en_camino':
      return 'store-pill--blue';
    case 'pendiente':
      return 'store-pill--amber';
    case 'entrega_fallida':
    case 'cancelado':
      return 'store-pill--red';
    default:
      return '';
  }
}

export const CustomerStoreOrdersPanel: FC<CustomerStoreOrdersPanelProps> = ({
  storeGateway,
  zones,
  refreshToken = 0,
}) => {
  const [orders, setOrders] = useState<readonly StoreOrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [detail, setDetail] = useState<StoreOrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<StoreOrderSummary | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>('cliente_desiste');
  const [cancelNote, setCancelNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [reschedTarget, setReschedTarget] = useState<StoreOrderSummary | null>(null);
  const [reschedDate, setReschedDate] = useState(() => todayInEcuador());
  const [reschedSlots, setReschedSlots] = useState<readonly DeliverySlot[]>([]);
  const [reschedTime, setReschedTime] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reschedError, setReschedError] = useState<string | null>(null);

  const pageSize = 15;

  const load = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await storeGateway.listOrders(targetPage, pageSize);
        setOrders(res.items);
        setTotal(res.total);
      } catch (err) {
        setError(errMsg(err, 'No se pudieron cargar tus pedidos de tienda.'));
      } finally {
        setIsLoading(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    void load(page);
  }, [load, page, refreshToken]);

  const openDetail = async (id: string) => {
    setIsLoadingDetail(true);
    setError(null);
    try {
      setDetail(await storeGateway.getOrder(id));
    } catch (err) {
      setError(errMsg(err, 'No se pudo cargar el detalle del pedido.'));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadRescheduleSlots = useCallback(
    async (zoneId: string, date: string) => {
      setIsLoadingSlots(true);
      setReschedError(null);
      try {
        const res = await storeGateway.getDeliverySlots(zoneId, date);
        setReschedSlots(res.items);
        const firstAvailable = res.items.find((s) => s.available);
        setReschedTime(firstAvailable?.time ?? '');
      } catch (err) {
        setReschedSlots([]);
        setReschedTime('');
        setReschedError(errMsg(err, 'No se pudieron consultar franjas para esa fecha.'));
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    if (reschedTarget) {
      void loadRescheduleSlots(reschedTarget.zoneId, reschedDate);
    }
  }, [reschedTarget, reschedDate, loadRescheduleSlots]);

  const handleCancel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cancelTarget || isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      const res = await storeGateway.cancelOrder(cancelTarget.id, cancelReason, cancelNote);
      setCancelTarget(null);
      setDetail(null);
      setNotice(
        res.alreadyCancelled
          ? 'El pedido ya estaba cancelado.'
          : 'Pedido cancelado. El stock y el cupo de franja fueron liberados.',
      );
      await load(page);
    } catch (err) {
      setCancelError(errMsg(err, 'No se pudo cancelar el pedido.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReschedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reschedTarget || isRescheduling || reschedTime.length === 0) return;
    setIsRescheduling(true);
    setReschedError(null);
    try {
      await storeGateway.rescheduleOrder(reschedTarget.id, reschedDate, reschedTime);
      setReschedTarget(null);
      setDetail(null);
      setNotice(`Pedido reprogramado para ${reschedDate} a las ${reschedTime}.`);
      await load(page);
    } catch (err) {
      setReschedError(errMsg(err, 'No se pudo reprogramar el pedido.'));
    } finally {
      setIsRescheduling(false);
    }
  };

  const zoneNameOf = (id: string) => zones.find((z) => z.id === id)?.name ?? 'Zona';

  return (
    <Card className="store-card">
      <div className="store-card__header">
        <div>
          <h3 className="store-card__title">Mis pedidos de tienda</h3>
          <p className="store-card__subtitle">
            Revisa el detalle de tus compras contra entrega, cancela o reprograma tras una entrega fallida.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" isLoading={isLoading} onClick={() => void load(page)}>
          ↻ Actualizar
        </Button>
      </div>

      {error && (
        <Alert type="error" title="Atención" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert type="success" title="Pedido actualizado" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {isLoading && orders.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}>
          <Spinner size="md" label="Cargando pedidos de tienda..." />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title="Aún no tienes compras en la tienda"
          description="Explora el catálogo, agrega productos al carrito y programa tu primera entrega."
        />
      ) : (
        <>
          <div className="orders-table-wrapper">
            <table className="orders-table" aria-label="Listado de pedidos de tienda">
              <thead>
                <tr>
                  <th scope="col">Pedido / Dirección</th>
                  <th scope="col">Zona</th>
                  <th scope="col">Franja</th>
                  <th scope="col">Total</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="orders-table__actions-head">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => {
                  const canCancel =
                    order.status === 'pendiente' ||
                    order.status === 'asignado_a_ruta' ||
                    order.status === 'entrega_fallida';
                  const canReschedule = order.status === 'entrega_fallida';
                  return (
                    <tr key={order.id}>
                      <td>
                        <span className="orders-table__address">{order.deliveryAddress}</span>
                        <span className="orders-table__id">
                          <ShortIdBadge id={order.id} prefix="PED" />
                        </span>
                      </td>
                      <td>{zoneNameOf(order.zoneId)}</td>
                      <td className="orders-table__schedule">
                        {order.deliveryDate} · {order.deliveryTime}
                      </td>
                      <td>
                        <strong>{formatCents(order.totalCents)}</strong>
                        <span style={{ display: 'block', fontSize: '11.5px', color: '#475569' }}>
                          {order.itemsCount} {order.itemsCount === 1 ? 'producto' : 'productos'}
                        </span>
                      </td>
                      <td>
                        <span className={`store-pill ${statusTone(order.status)}`}>
                          {STORE_ORDER_STATUS_LABELS[order.status] ?? order.status}
                        </span>
                      </td>
                      <td className="orders-table__actions">
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            isLoading={isLoadingDetail}
                            onClick={() => void openDetail(order.id)}
                          >
                            Ver
                          </Button>
                          {canReschedule && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setReschedTarget(order);
                                setReschedDate(todayInEcuador());
                                setReschedError(null);
                              }}
                            >
                              Reprogramar
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() => {
                                setCancelTarget(order);
                                setCancelReason('cliente_desiste');
                                setCancelNote('');
                                setCancelError(null);
                              }}
                            >
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {total > pageSize && (
            <div className="store-pagination">
              <span className="store-pagination__info">
                Página {page} · {total} pedidos
              </span>
              <div className="store-pagination__actions">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1 || isLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={page * pageSize >= total || isLoading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {detail && (
        <Modal
          title="Detalle del pedido"
          size="lg"
          onClose={() => setDetail(null)}
          footer={
            <Button type="button" variant="secondary" size="sm" onClick={() => setDetail(null)}>
              Cerrar
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <ShortIdBadge id={detail.id} prefix="PED" />
              <span className={`store-pill ${statusTone(detail.status)}`}>
                {STORE_ORDER_STATUS_LABELS[detail.status] ?? detail.status}
              </span>
              <span className="store-pill store-pill--green">
                Total contra entrega: {formatCents(detail.totalCents)}
              </span>
            </div>

            <p className="wf-modal__paragraph">
              <strong>Dirección:</strong> {detail.deliveryAddress} ({zoneNameOf(detail.zoneId)})<br />
              <strong>Entrega:</strong> {detail.deliveryDate} · {detail.deliveryTime}
              {detail.recipientName ? (
                <>
                  <br />
                  <strong>Destinatario:</strong> {detail.recipientName}
                  {detail.recipientPhone ? ` (${detail.recipientPhone})` : ''}
                </>
              ) : null}
              {detail.notes ? (
                <>
                  <br />
                  <strong>Notas:</strong> {detail.notes}
                </>
              ) : null}
            </p>

            {detail.deliveryLatitude !== null && detail.deliveryLongitude !== null && (
              <>
                <RouteStopsMap
                  title="Ubicación de entrega"
                  subtitle={detail.deliveryAddress}
                  compact
                  height={240}
                  showRoutePolyline={false}
                  selectedOrderId={detail.id}
                  stops={[
                    {
                      orderId: detail.id,
                      position: 1,
                      address: detail.deliveryAddress,
                      status: detail.status,
                      latitude: detail.deliveryLatitude,
                      longitude: detail.deliveryLongitude,
                      deliveryDate: detail.deliveryDate,
                      deliveryTime: detail.deliveryTime,
                      recipientName: detail.recipientName,
                      recipientPhone: detail.recipientPhone,
                      totalCents: detail.totalCents,
                    },
                  ]}
                />
                <div className="store-map-links">
                  <a
                    href={osmDirectionsUrl(detail.deliveryLatitude, detail.deliveryLongitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="store-map-link"
                  >
                    Ver pin en OpenStreetMap
                  </a>
                  <a
                    href={googleMapsDirectionsUrl(detail.deliveryLatitude, detail.deliveryLongitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="store-map-link"
                  >
                    Abrir en Google Maps
                  </a>
                </div>
              </>
            )}

            {detail.items && detail.items.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <table className="store-lines-table">
                  <thead>
                    <tr>
                      <th scope="col">Producto</th>
                      <th scope="col">SKU</th>
                      <th scope="col">Cant.</th>
                      <th scope="col">Unitario</th>
                      <th scope="col">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((line) => (
                      <tr key={line.productId}>
                        <td>{line.name}</td>
                        <td>{line.sku}</td>
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
          </div>
        </Modal>
      )}

      {cancelTarget && (
        <Modal
          title="Cancelar pedido"
          description="El stock y el cupo de la franja se liberarán automáticamente."
          onClose={() => !isCancelling && setCancelTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isCancelling} onClick={() => setCancelTarget(null)}>
                Volver
              </Button>
              <Button type="submit" form="cancel-store-order-form" variant="danger" size="sm" isLoading={isCancelling}>
                Confirmar cancelación
              </Button>
            </>
          }
        >
          <form id="cancel-store-order-form" className="store-form" onSubmit={handleCancel}>
            {cancelError && <Alert type="error" title="No se pudo cancelar">{cancelError}</Alert>}
            <Select
              id="cancel-order-reason"
              label="Motivo de cancelación"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as CancelReason)}
              options={CANCEL_REASONS.map((r) => ({ value: r, label: CANCEL_REASON_LABELS[r] }))}
              isRequired
            />
            <TextInput
              id="cancel-order-note"
              label="Detalle adicional (opcional)"
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              maxLength={200}
            />
          </form>
        </Modal>
      )}

      {reschedTarget && (
        <Modal
          title="Reprogramar entrega"
          description="Elige una nueva fecha y una franja disponible para reintentar la entrega."
          onClose={() => !isRescheduling && setReschedTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isRescheduling} onClick={() => setReschedTarget(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="reschedule-store-order-form"
                variant="primary"
                size="sm"
                isLoading={isRescheduling}
                disabled={reschedTime.length === 0}
              >
                Guardar reprogramación
              </Button>
            </>
          }
        >
          <form id="reschedule-store-order-form" className="store-form" onSubmit={handleReschedule}>
            {reschedError && <Alert type="error" title="No se pudo reprogramar">{reschedError}</Alert>}
            <TextInput
              id="resched-date"
              type="date"
              label="Nueva fecha de entrega"
              value={reschedDate}
              onChange={(e) => setReschedDate(e.target.value)}
              isRequired
            />
            {isLoadingSlots ? (
              <Spinner size="sm" label="Consultando franjas..." />
            ) : reschedSlots.length === 0 ? (
              <p className="wf-modal__paragraph">No hay franjas disponibles para la fecha seleccionada.</p>
            ) : (
              <div className="store-slots-grid" role="group" aria-label="Franjas disponibles">
                {reschedSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    className={`store-slot-btn ${reschedTime === slot.time ? 'store-slot-btn--selected' : ''}`}
                    onClick={() => setReschedTime(slot.time)}
                  >
                    <span className="store-slot-btn__time">{slot.time}</span>
                    <span className="store-slot-btn__cap">
                      {slot.available ? `${slot.capacity - slot.reserved} libres` : 'Sin cupo'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </Modal>
      )}
    </Card>
  );
};

import { useCallback, useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Modal,
  RouteStopsMap,
  SectionHeader,
  ShortIdBadge,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import {
  CANCEL_REASON_LABELS,
  formatCents,
  todayInEcuador,
  type CancelReason,
  type DeliverySlot,
  type StoreOrderDetail,
  type StoreOrderSummary,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';
import '../styles/store.css';
import '../styles/client.css';

export interface ClientOrdersViewProps {
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
  /** Abre directamente el seguimiento de este pedido (por ejemplo, tras confirmar la compra). */
  readonly initialOrderId?: string | null | undefined;
  readonly onTrackingChange?: ((orderId: string | null) => void) | undefined;
  readonly onShop?: (() => void) | undefined;
}

interface StatusInfo {
  readonly label: string;
  readonly title: string;
  readonly color: string;
  readonly soft: string;
  readonly step: number;
}

/** Estados en palabras del cliente, con los colores semánticos del proyecto. */
const STATUS: Readonly<Record<string, StatusInfo>> = {
  pendiente: { label: 'Recibido', title: 'Recibimos tu pedido', color: '#D97706', soft: '#FEF3C7', step: 0 },
  asignado_a_ruta: { label: 'Preparando', title: 'Estamos preparando tu pedido', color: '#4F46E5', soft: '#E0E7FF', step: 1 },
  recogido: { label: 'Listo para salir', title: 'Tu pedido está por salir', color: '#4F46E5', soft: '#E0E7FF', step: 2 },
  en_camino: { label: 'En camino', title: 'Tu pedido va en camino', color: '#0284C7', soft: '#E0F2FE', step: 3 },
  entregado: { label: 'Entregado', title: 'Pedido entregado', color: '#059669', soft: '#D1FAE5', step: 4 },
  entrega_fallida: { label: 'No se pudo entregar', title: 'No pudimos entregar tu pedido', color: '#D97706', soft: '#FEF3C7', step: 3 },
  cancelado: { label: 'Cancelado', title: 'Pedido cancelado', color: '#DC2626', soft: '#FEE2E2', step: -1 },
};

const FALLBACK_STATUS: StatusInfo = { label: 'En proceso', title: 'Tu pedido está en proceso', color: '#475569', soft: '#E2E8F0', step: 0 };

const TIMELINE = [
  { status: 'pendiente', label: 'Pedido recibido' },
  { status: 'asignado_a_ruta', label: 'Preparando tu pedido' },
  { status: 'recogido', label: 'Listo para salir' },
  { status: 'en_camino', label: 'En camino' },
  { status: 'entregado', label: 'Entregado' },
] as const;

const IN_PROGRESS = new Set(['pendiente', 'asignado_a_ruta', 'recogido', 'en_camino', 'entrega_fallida']);
const CLIENT_CANCEL_REASONS: readonly CancelReason[] = ['cliente_desiste', 'error_en_pedido', 'demora', 'otro'];

export function statusInfo(status: string): StatusInfo {
  return STATUS[status] ?? FALLBACK_STATUS;
}

export function orderCode(id: string): string {
  return `PED-${id.replace(/[^0-9a-z]/gi, '').slice(0, 4).toUpperCase()}`;
}

/** "lun 23 nov, 16:36" en hora de Ecuador. */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: 'America/Guayaquil',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** "Hoy", "Mañana" o "mié 25 nov", y la franja "17:00 – 18:00". */
export function describeDelivery(date: string, time: string, today: string = todayInEcuador()): string {
  const hour = Number.parseInt(time.slice(0, 2), 10);
  const end = Number.isFinite(hour) ? `${String(hour + 1).padStart(2, '0')}:00` : '';
  const range = end ? `${time.slice(0, 5)} – ${end}` : time;
  const tomorrow = new Date(`${today}T12:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  let day: string;
  if (date === today) day = 'hoy';
  else if (date === tomorrow.toISOString().slice(0, 10)) day = 'mañana';
  else {
    const parsed = new Date(`${date}T12:00:00Z`);
    day = Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(parsed)
      : date;
  }
  return `${day}, ${range}`;
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function progressOf(status: string): number {
  if (status === 'cancelado') return 100;
  return Math.round(((statusInfo(status).step + 1) / TIMELINE.length) * 100);
}

export const ClientOrdersView: FC<ClientOrdersViewProps> = ({
  storeGateway,
  zones,
  initialOrderId = null,
  onTrackingChange,
  onShop,
}) => {
  const [orders, setOrders] = useState<readonly StoreOrderSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<'curso' | 'anteriores' | 'todos'>('curso');

  const [trackingId, setTrackingId] = useState<string | null>(initialOrderId);
  const [detail, setDetail] = useState<StoreOrderDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState<CancelReason>('cliente_desiste');
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState(() => todayInEcuador());
  const [reschedSlots, setReschedSlots] = useState<readonly DeliverySlot[]>([]);
  const [reschedTime, setReschedTime] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [reschedError, setReschedError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const page = await storeGateway.listOrders(1, 50);
      setOrders(page.items);
    } catch (err) {
      setError(errMsg(err, 'No pudimos cargar tus pedidos.'));
    } finally {
      setIsLoading(false);
    }
  }, [storeGateway]);

  const loadDetail = useCallback(
    async (id: string) => {
      setIsLoadingDetail(true);
      setError(null);
      try {
        setDetail(await storeGateway.getOrder(id));
      } catch (err) {
        setError(errMsg(err, 'No pudimos cargar el estado del pedido.'));
        setTrackingId(null);
      } finally {
        setIsLoadingDetail(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    setTrackingId(initialOrderId);
  }, [initialOrderId]);

  useEffect(() => {
    if (trackingId === null) {
      setDetail(null);
      return;
    }
    void loadDetail(trackingId);
  }, [trackingId, loadDetail]);

  const openTracking = (id: string | null) => {
    setTrackingId(id);
    onTrackingChange?.(id);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inProgress = useMemo(() => orders.filter((order) => IN_PROGRESS.has(order.status)), [orders]);
  const finished = useMemo(() => orders.filter((order) => !IN_PROGRESS.has(order.status)), [orders]);
  const shown = filter === 'curso' ? inProgress : filter === 'anteriores' ? finished : orders;

  const loadRescheduleSlots = useCallback(
    async (zoneId: string, date: string) => {
      setIsLoadingSlots(true);
      setReschedError(null);
      try {
        const res = await storeGateway.getDeliverySlots(zoneId, date);
        const available = res.items.filter((slot) => slot.available);
        setReschedSlots(available);
        setReschedTime(available[0]?.time ?? '');
      } catch (err) {
        setReschedSlots([]);
        setReschedTime('');
        setReschedError(errMsg(err, 'No pudimos consultar los horarios de esa fecha.'));
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    if (reschedOpen && detail) void loadRescheduleSlots(detail.zoneId, reschedDate);
  }, [reschedOpen, detail, reschedDate, loadRescheduleSlots]);

  const handleCancel = async () => {
    if (!detail || isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await storeGateway.cancelOrder(detail.id, cancelReason);
      setCancelOpen(false);
      setNotice('Cancelamos tu pedido. No se te cobrará nada.');
      await Promise.all([loadDetail(detail.id), loadList()]);
    } catch (err) {
      setCancelError(errMsg(err, 'No pudimos cancelar el pedido.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReschedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!detail || isRescheduling || reschedTime.length === 0) return;
    setIsRescheduling(true);
    setReschedError(null);
    try {
      await storeGateway.rescheduleOrder(detail.id, reschedDate, reschedTime);
      setReschedOpen(false);
      setNotice(`Listo, lo volvemos a llevar ${describeDelivery(reschedDate, reschedTime)}.`);
      await Promise.all([loadDetail(detail.id), loadList()]);
    } catch (err) {
      setReschedError(errMsg(err, 'Todavía no se puede reprogramar. Te avisaremos por correo cuando puedas elegir otra fecha.'));
    } finally {
      setIsRescheduling(false);
    }
  };

  const zoneName = (id: string) => zones.find((zone) => zone.id === id)?.name ?? '';

  // ------------------------------------------------------------------ seguimiento
  if (trackingId !== null) {
    if (detail === null || isLoadingDetail) {
      return (
        <div className="wf-loading-card wf-loading-card--inline">
          <Spinner size="md" label="Cargando el estado del pedido" />
          <p role="status">Consultando tu pedido...</p>
        </div>
      );
    }
    const info = statusInfo(detail.status);
    const history = detail.history ?? [];
    const lastAt = (status: string) => {
      for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index]?.status === status) return history[index]?.at ?? null;
      }
      return null;
    };
    const failed = detail.status === 'entrega_fallida';
    const cancelled = detail.status === 'cancelado';
    const canCancel = detail.status === 'pendiente' || detail.status === 'asignado_a_ruta' || failed;
    const schedule = describeDelivery(detail.deliveryDate, detail.deliveryTime);
    const subtitle: Readonly<Record<string, string>> = {
      pendiente: `Llega ${schedule}. Te avisaremos cuando salga.`,
      asignado_a_ruta: `Ya tiene repartidor. Llega ${schedule}.`,
      recogido: `Sale en unos minutos. Llega ${schedule}.`,
      en_camino: `Llega ${schedule}. Ten listo el efectivo.`,
      entregado: `Gracias por tu compra. Pagaste ${formatCents(detail.totalCents)} en efectivo.`,
      entrega_fallida: 'Intentamos entregarlo, pero no fue posible.',
      cancelado: 'No se te cobrará nada. Los productos volvieron a la tienda.',
    };

    return (
      <section className="client-stack" aria-labelledby="client-track-title">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => openTracking(null)}>
            ← Mis pedidos
          </Button>
        </div>
        {notice && (
          <Alert type="success" title="Listo" onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        )}
        <div className="client-grid">
          <div className="client-grid__main">
            <Card className="store-card">
              <span className="store-pill" style={{ backgroundColor: info.soft, color: info.color, alignSelf: 'flex-start' }}>
                {info.label}
              </span>
              <h2 id="client-track-title" className="client-track-title">
                {info.title}
              </h2>
              <p className="client-muted" style={{ fontSize: '15px' }}>
                {subtitle[detail.status] ?? `Llega ${schedule}.`}
              </p>

              {detail.courier && (detail.status === 'recogido' || detail.status === 'en_camino' || detail.status === 'asignado_a_ruta') && (
                <div className="client-courier">
                  <span className="client-courier__avatar" aria-hidden="true">
                    {detail.courier.firstName.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{detail.courier.firstName} te lo lleva</p>
                    <p className="client-muted">Ten listos {formatCents(detail.totalCents)} en efectivo.</p>
                  </div>
                </div>
              )}

              {failed && (
                <Alert type="warning" title="No te encontramos">
                  Cuando el repartidor termine su recorrido podrás elegir otro día y hora, o cancelar sin costo.
                </Alert>
              )}

              {!cancelled && (
                <ol className="client-timeline" aria-label="Estado del pedido">
                  {TIMELINE.map((step, index) => {
                    const failedHere = failed && step.status === 'en_camino';
                    const done = !failedHere && index <= info.step;
                    const current = done && index === info.step && detail.status !== 'entregado';
                    const at = failedHere ? lastAt('entrega_fallida') : lastAt(step.status);
                    const dotClass = failedHere
                      ? 'client-timeline__dot--warn'
                      : current
                        ? 'client-timeline__dot--current'
                        : done
                          ? 'client-timeline__dot--done'
                          : '';
                    return (
                      <li key={step.status} className="client-timeline__item">
                        <div className="client-timeline__rail">
                          <span className={`client-timeline__dot ${dotClass}`} aria-hidden="true">
                            {done && !current && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <path d="M5 12.5l4.5 4.5L19 7.5" />
                              </svg>
                            )}
                          </span>
                          {index < TIMELINE.length - 1 && (
                            <span className={`client-timeline__line ${index < info.step && !failed ? 'client-timeline__line--done' : ''}`} />
                          )}
                        </div>
                        <div className="client-timeline__content">
                          <p className={`client-timeline__label ${done || failedHere ? '' : 'client-timeline__label--pending'}`}>
                            {failedHere ? 'No se pudo entregar' : step.label}
                          </p>
                          {at && <p className="client-muted">{formatMoment(at)}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>

            {detail.deliveryLatitude !== null && detail.deliveryLongitude !== null && (
              <Card className="store-card">
                <RouteStopsMap
                  title="Lugar de entrega"
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
              </Card>
            )}
          </div>

          <aside className="client-grid__side">
            <Card className="store-card">
              <div className="store-card__header">
                <p className="client-label" style={{ margin: 0 }}>
                  Pedido
                </p>
                <ShortIdBadge id={detail.id} prefix="PED" />
              </div>
              <ul className="client-lines">
                {(detail.items ?? []).map((line) => (
                  <li key={line.productId}>
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <strong>{formatCents(line.lineTotalCents)}</strong>
                  </li>
                ))}
              </ul>
              <div className="client-total-row">
                <strong>Total</strong>
                <span className="store-price">{formatCents(detail.totalCents)}</span>
              </div>
              <p className="client-muted">Pagas en efectivo al recibir.</p>
            </Card>
            <Card className="store-card">
              <div>
                <p className="client-label">Se entrega en</p>
                <p style={{ margin: 0 }}>
                  {detail.deliveryAddress}
                  {zoneName(detail.zoneId) ? ` · ${zoneName(detail.zoneId)}` : ''}
                </p>
              </div>
              <div>
                <p className="client-label">Horario</p>
                <p style={{ margin: 0, textTransform: 'capitalize' }}>{schedule}</p>
              </div>
              {detail.recipientName && (
                <div>
                  <p className="client-label">Recibe</p>
                  <p style={{ margin: 0 }}>{detail.recipientName}</p>
                </div>
              )}
            </Card>
            {failed && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setReschedDate(todayInEcuador());
                  setReschedError(null);
                  setReschedOpen(true);
                }}
              >
                Elegir otra fecha
              </Button>
            )}
            {canCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCancelReason('cliente_desiste');
                  setCancelError(null);
                  setCancelOpen(true);
                }}
              >
                Cancelar pedido
              </Button>
            )}
          </aside>
        </div>

        {cancelOpen && (
          <Modal
            title="¿Cancelar este pedido?"
            description="Cuéntanos por qué (opcional)."
            size="sm"
            onClose={() => !isCancelling && setCancelOpen(false)}
            footer={
              <>
                <Button type="button" variant="secondary" size="sm" disabled={isCancelling} onClick={() => setCancelOpen(false)}>
                  No, mantenerlo
                </Button>
                <Button type="button" variant="danger" size="sm" isLoading={isCancelling} onClick={() => void handleCancel()}>
                  Sí, cancelar
                </Button>
              </>
            }
          >
            {cancelError && <Alert type="error" title="No se pudo cancelar">{cancelError}</Alert>}
            <div className="client-filter" role="group" aria-label="Motivo de la cancelación">
              {CLIENT_CANCEL_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  className={`client-day ${cancelReason === reason ? 'client-day--selected' : ''}`}
                  aria-pressed={cancelReason === reason}
                  onClick={() => setCancelReason(reason)}
                >
                  <strong>{CANCEL_REASON_LABELS[reason]}</strong>
                </button>
              ))}
            </div>
          </Modal>
        )}

        {reschedOpen && (
          <Modal
            title="Elige otra fecha"
            description="Solo te mostramos los horarios con cupo."
            onClose={() => !isRescheduling && setReschedOpen(false)}
            footer={
              <>
                <Button type="button" variant="secondary" size="sm" disabled={isRescheduling} onClick={() => setReschedOpen(false)}>
                  Volver
                </Button>
                <Button
                  type="submit"
                  form="client-reschedule-form"
                  variant="primary"
                  size="sm"
                  isLoading={isRescheduling}
                  disabled={reschedTime.length === 0}
                >
                  Guardar
                </Button>
              </>
            }
          >
            <form id="client-reschedule-form" className="store-form" onSubmit={handleReschedule}>
              {reschedError && <Alert type="error" title="No se pudo reprogramar">{reschedError}</Alert>}
              <TextInput
                id="client-resched-date"
                type="date"
                label="Nueva fecha"
                value={reschedDate}
                min={todayInEcuador()}
                onChange={(event) => setReschedDate(event.target.value)}
                isRequired
              />
              {isLoadingSlots ? (
                <Spinner size="sm" label="Consultando horarios..." />
              ) : reschedSlots.length === 0 ? (
                <p className="wf-modal__paragraph">No hay horarios con cupo ese día. Prueba otra fecha.</p>
              ) : (
                <div className="store-slots-grid" role="group" aria-label="Horarios disponibles">
                  {reschedSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      className={`store-slot-btn ${reschedTime === slot.time ? 'store-slot-btn--selected' : ''}`}
                      onClick={() => setReschedTime(slot.time)}
                    >
                      <span className="store-slot-btn__time">{slot.time}</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </Modal>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------------ listado
  return (
    <section className="client-stack" aria-labelledby="client-orders-title">
      <SectionHeader
        title="Mis pedidos"
        actions={
          <Button type="button" variant="secondary" size="sm" isLoading={isLoading} onClick={() => void loadList()}>
            Actualizar
          </Button>
        }
      />
      <h2 id="client-orders-title" className="sr-only">
        Mis pedidos
      </h2>
      {error && (
        <Alert type="error" title="Atención" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert type="success" title="Listo" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className="client-filter" role="group" aria-label="Filtrar pedidos">
        {(
          [
            ['curso', `En curso (${inProgress.length})`],
            ['anteriores', `Anteriores (${finished.length})`],
            ['todos', 'Todos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`client-day ${filter === id ? 'client-day--selected' : ''}`}
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
          >
            <strong>{label}</strong>
          </button>
        ))}
      </div>

      {isLoading && orders.length === 0 ? (
        <div className="wf-loading-card wf-loading-card--inline">
          <Spinner size="md" label="Cargando tus pedidos" />
          <p role="status">Cargando tus pedidos...</p>
        </div>
      ) : shown.length === 0 ? (
        <Card className="store-card">
          <EmptyState
            title={orders.length === 0 ? 'Todavía no tienes pedidos' : 'No hay pedidos aquí'}
            description={orders.length === 0 ? 'Elige tus productos y te los llevamos hoy mismo.' : 'Prueba con otro filtro.'}
            action={
              onShop ? (
                <Button type="button" variant="primary" size="sm" onClick={onShop}>
                  Ir a la tienda
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        shown.map((order) => {
          const info = statusInfo(order.status);
          const title =
            order.status === 'entregado' || order.status === 'cancelado'
              ? info.label
              : order.status === 'entrega_fallida'
                ? 'No se pudo entregar'
                : `Llega ${describeDelivery(order.deliveryDate, order.deliveryTime)}`;
          return (
            <Card key={order.id} className="store-card client-order-card">
              <div className="client-order-card__top">
                <div>
                  <p className="client-order-card__title">{title}</p>
                  <p className="client-muted">
                    Pedido <span className="store-pill">{orderCode(order.id)}</span> · hecho el {formatMoment(order.createdAt)}
                  </p>
                </div>
                <span className="store-pill" style={{ backgroundColor: info.soft, color: info.color }}>
                  {info.label}
                </span>
              </div>
              <div className="client-progress" aria-hidden="true">
                <div className="client-progress__bar" style={{ width: `${progressOf(order.status)}%`, backgroundColor: info.color }} />
              </div>
              <div className="client-order-card__bottom">
                <span className="client-muted">
                  {order.itemsCount} {order.itemsCount === 1 ? 'producto' : 'productos'} ·{' '}
                  <strong style={{ color: 'var(--wl-ink, #0b132b)' }}>{formatCents(order.totalCents)}</strong>
                </span>
                <Button type="button" variant="secondary" size="sm" onClick={() => openTracking(order.id)}>
                  Ver estado
                </Button>
              </div>
            </Card>
          );
        })
      )}
    </section>
  );
};

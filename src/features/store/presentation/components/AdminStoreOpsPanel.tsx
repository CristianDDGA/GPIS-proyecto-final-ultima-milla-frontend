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
  Skeleton,
  StopCardsSkeleton,
  TableRowsSkeleton,
  TextInput,
  TopRefetchBar,
} from '../../../../shared/ui/index.js';
import {
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  STORE_ORDER_STATUS_LABELS,
  formatCents,
  googleMapsDirectionsUrl,
  osmDirectionsUrl,
  parseDollarsToCents,
  todayInEcuador,
  type AdminCashRow,
  type CancelReason,
  type DeliverySlot,
  type StoreOrderDetail,
  type StoreSettings,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';

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

export const AdminStoreOrdersPanel: FC<{
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
}> = ({ storeGateway, zones }) => {
  const [orders, setOrders] = useState<readonly StoreOrderDetail[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<StoreOrderDetail | null>(null);
  const [cancelReason, setCancelReason] = useState<CancelReason>('sin_stock');
  const [cancelNote, setCancelNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [reschedTarget, setReschedTarget] = useState<StoreOrderDetail | null>(null);
  const [reschedDate, setReschedDate] = useState(() => todayInEcuador());
  const [reschedSlots, setReschedSlots] = useState<readonly DeliverySlot[]>([]);
  const [reschedTime, setReschedTime] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  const pageSize = 20;

  const load = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await storeGateway.adminListOrders({
          status: status || undefined,
          deliveryDate: deliveryDate || undefined,
          zoneId: zoneId || undefined,
          expandItems: true,
          page: targetPage,
          pageSize,
        });
        setOrders(res.items);
        setTotal(res.total);
      } catch (err) {
        setError(errMsg(err, 'No se pudieron consultar los pedidos de tienda.'));
      } finally {
        setIsLoading(false);
      }
    },
    [storeGateway, status, deliveryDate, zoneId],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  useEffect(() => {
    if (!reschedTarget) return;
    void storeGateway
      .getDeliverySlots(reschedTarget.zoneId, reschedDate)
      .then((res) => {
        setReschedSlots(res.items);
        setReschedTime(res.items.find((s) => s.available)?.time ?? '');
      })
      .catch(() => {
        setReschedSlots([]);
        setReschedTime('');
      });
  }, [reschedTarget, reschedDate, storeGateway]);

  const handleCancel = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cancelTarget || isCancelling) return;
    setIsCancelling(true);
    setError(null);
    try {
      await storeGateway.cancelOrder(cancelTarget.id, cancelReason, cancelNote);
      setCancelTarget(null);
      setNotice('Pedido cancelado y stock restaurado.');
      await load(page);
    } catch (err) {
      setError(errMsg(err, 'No se pudo cancelar el pedido.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReschedule = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!reschedTarget || !reschedTime || isRescheduling) return;
    setIsRescheduling(true);
    setError(null);
    try {
      await storeGateway.rescheduleOrder(reschedTarget.id, reschedDate, reschedTime);
      setReschedTarget(null);
      setNotice(`Pedido reprogramado para ${reschedDate} a las ${reschedTime}.`);
      await load(page);
    } catch (err) {
      setError(errMsg(err, 'No se pudo reprogramar el pedido.'));
    } finally {
      setIsRescheduling(false);
    }
  };

  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? 'Zona';

  return (
    <Card className="store-card">
      <div className="store-card__header">
        <div>
          <h3 className="store-card__title">Pedidos de tienda (despacho y detalle)</h3>
          <p className="store-card__subtitle">
            Incluye líneas de producto, coordenadas de mapa y acciones de cancelación o reprogramación.
          </p>
        </div>
        <Button type="button" variant="secondary" size="sm" isLoading={isLoading} onClick={() => void load(page)}>
          ↻ Actualizar
        </Button>
      </div>

      {error && <Alert type="error" title="Atención" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert type="success" title="Pedido actualizado" onClose={() => setNotice(null)}>{notice}</Alert>}

      <form
        className="store-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          void load(1);
        }}
      >
        <Select
          id="admin-order-status"
          label="Estado"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Todos los estados' },
            ...Object.entries(STORE_ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <TextInput
          id="admin-order-date"
          type="date"
          label="Fecha de entrega"
          value={deliveryDate}
          onChange={(e) => {
            setDeliveryDate(e.target.value);
            setPage(1);
          }}
        />
        <Select
          id="admin-order-zone"
          label="Zona"
          value={zoneId}
          onChange={(e) => {
            setZoneId(e.target.value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'Todas las zonas' },
            ...zones.map((z) => ({ value: z.id, label: z.name })),
          ]}
        />
        <div className="store-filters__actions">
          <Button type="submit" size="sm" isLoading={isLoading}>Filtrar</Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setStatus('');
              setDeliveryDate('');
              setZoneId('');
              setPage(1);
            }}
          >
            Limpiar
          </Button>
        </div>
      </form>

      <TopRefetchBar active={isLoading && orders.length > 0} label="Actualizando pedidos de tienda" />

      {isLoading && orders.length === 0 ? (
        <StopCardsSkeleton count={4} label="Cargando pedidos de tienda" />
      ) : orders.length === 0 ? (
        <EmptyState
          title="Sin pedidos de tienda"
          description="No hay compras registradas que coincidan con los filtros seleccionados."
        />
      ) : (
        <>
          <RouteStopsMap
            title="Mapa de pedidos de tienda"
            subtitle="Distribución geográfica de entregas en Ecuador según los filtros activos."
            showRoutePolyline={false}
            selectedOrderId={selectedOrderId}
            onSelectStop={(orderId) => setSelectedOrderId(orderId)}
            stops={orders.map((order, idx) => ({
              orderId: order.id,
              position: idx + 1,
              address: order.deliveryAddress,
              status: order.status,
              latitude: order.deliveryLatitude,
              longitude: order.deliveryLongitude,
              deliveryDate: order.deliveryDate,
              deliveryTime: order.deliveryTime,
              recipientName: order.recipientName,
              recipientPhone: order.recipientPhone,
              totalCents: order.totalCents,
              notes: order.notes,
            }))}
          />

          <ul className="store-stop-list">
            {orders.map((order) => {
              const canCancel =
                order.status === 'pendiente' ||
                order.status === 'asignado_a_ruta' ||
                order.status === 'entrega_fallida';
              const canReschedule = order.status === 'entrega_fallida';
              const isFocused = selectedOrderId === order.id;
              return (
                <li
                  key={order.id}
                  className={'store-stop-card' + (isFocused ? ' store-stop-card--focused' : '')}
                >
                <div className="store-stop-card__head">
                  <div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <ShortIdBadge id={order.id} prefix="PED" />
                      <span className={`store-pill ${statusTone(order.status)}`}>
                        {STORE_ORDER_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      <span className="store-pill store-pill--green">{formatCents(order.totalCents)}</span>
                      <span className="store-pill">{zoneName(order.zoneId)}</span>
                    </div>
                    <p style={{ marginTop: '6px', fontWeight: 700 }}>{order.deliveryAddress}</p>
                    <p className="store-card__subtitle">
                      {order.deliveryDate} · {order.deliveryTime}
                      {order.recipientName ? ` · Destinatario: ${order.recipientName}` : ''}
                      {order.recipientPhone ? ` (${order.recipientPhone})` : ''}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {order.deliveryLatitude !== null && order.deliveryLongitude !== null && (
                      <>
                        <a
                          href={osmDirectionsUrl(order.deliveryLatitude, order.deliveryLongitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="store-map-link"
                        >
                          Mapa OSM
                        </a>
                        <a
                          href={googleMapsDirectionsUrl(order.deliveryLatitude, order.deliveryLongitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="store-map-link"
                        >
                          Google Maps
                        </a>
                      </>
                    )}
                    {canReschedule && (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setReschedTarget(order);
                          setReschedDate(todayInEcuador());
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
                          setCancelReason('sin_stock');
                          setCancelNote('');
                        }}
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </div>

                {order.items && order.items.length > 0 && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="store-lines-table">
                      <thead>
                        <tr>
                          <th scope="col">Producto</th>
                          <th scope="col">SKU</th>
                          <th scope="col">Cant.</th>
                          <th scope="col">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.items.map((line) => (
                          <tr key={line.productId}>
                            <td>{line.name}</td>
                            <td>{line.sku}</td>
                            <td>{line.quantity}</td>
                            <td><strong>{formatCents(line.lineTotalCents)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        </>
      )}

      {total > pageSize && (
        <div className="store-pagination">
          <span className="store-pagination__info">Página {page} · {total} pedidos</span>
          <div className="store-pagination__actions">
            <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {cancelTarget && (
        <Modal
          title="Cancelar pedido (Admin)"
          onClose={() => !isCancelling && setCancelTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isCancelling} onClick={() => setCancelTarget(null)}>
                Volver
              </Button>
              <Button type="submit" form="admin-cancel-order-form" variant="danger" size="sm" isLoading={isCancelling}>
                Confirmar cancelación
              </Button>
            </>
          }
        >
          <form id="admin-cancel-order-form" className="store-form" onSubmit={handleCancel}>
            <Select
              id="admin-cancel-reason"
              label="Motivo"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value as CancelReason)}
              options={CANCEL_REASONS.map((r) => ({ value: r, label: CANCEL_REASON_LABELS[r] }))}
              isRequired
            />
            <TextInput id="admin-cancel-note" label="Nota (opcional)" value={cancelNote} onChange={(e) => setCancelNote(e.target.value)} />
          </form>
        </Modal>
      )}

      {reschedTarget && (
        <Modal
          title="Reprogramar entrega (Admin)"
          onClose={() => !isRescheduling && setReschedTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isRescheduling} onClick={() => setReschedTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="admin-resched-form" variant="primary" size="sm" isLoading={isRescheduling} disabled={!reschedTime}>
                Reprogramar
              </Button>
            </>
          }
        >
          <form id="admin-resched-form" className="store-form" onSubmit={handleReschedule}>
            <TextInput id="admin-resched-date" type="date" label="Nueva fecha" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} isRequired />
            <div className="store-slots-grid">
              {reschedSlots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  disabled={!slot.available}
                  className={`store-slot-btn ${reschedTime === slot.time ? 'store-slot-btn--selected' : ''}`}
                  onClick={() => setReschedTime(slot.time)}
                >
                  <span className="store-slot-btn__time">{slot.time}</span>
                  <span className="store-slot-btn__cap">{slot.available ? `${slot.capacity - slot.reserved} libres` : 'Llena'}</span>
                </button>
              ))}
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
};

export const AdminStoreCashPanel: FC<{ readonly storeGateway: HttpStoreGateway }> = ({ storeGateway }) => {
  const [date, setDate] = useState(() => todayInEcuador());
  const [rows, setRows] = useState<readonly AdminCashRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [settleRow, setSettleRow] = useState<AdminCashRow | null>(null);
  const [receivedDollars, setReceivedDollars] = useState('');
  const [note, setNote] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  const load = useCallback(
    async (targetDate: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await storeGateway.adminCash(targetDate);
        setRows(res.items);
      } catch (err) {
        setError(errMsg(err, 'No se pudo consultar la caja de los repartidores.'));
      } finally {
        setIsLoading(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    void load(date);
  }, [load, date]);

  const handleSettle = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settleRow || isSettling) return;
    const receivedCents = parseDollarsToCents(receivedDollars);
    if (receivedCents === null) {
      setError('Ingresa un monto válido en USD (ej. 85.00).');
      return;
    }
    setIsSettling(true);
    setError(null);
    try {
      const res = await storeGateway.adminSettleCash({
        courierUserId: settleRow.courierUserId,
        date,
        receivedCents,
        note,
      });
      setSettleRow(null);
      setNotice(
        `Rendición registrada: esperado ${formatCents(res.expectedCents)}, recibido ${formatCents(res.receivedCents)}, diferencia ${formatCents(res.differenceCents)}.`,
      );
      await load(date);
    } catch (err) {
      setError(errMsg(err, 'No se pudo registrar la rendición de caja.'));
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <Card className="store-card">
      <div className="store-card__header">
        <div>
          <h3 className="store-card__title">Caja y rendición de repartidores</h3>
          <p className="store-card__subtitle">
            Revisa el efectivo cobrado contra entrega por repartidor y registra la rendición diaria.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <TextInput id="admin-cash-date" type="date" label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="button" variant="secondary" size="sm" isLoading={isLoading} onClick={() => void load(date)}>
            ↻
          </Button>
        </div>
      </div>

      {error && <Alert type="error" title="Atención" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert type="success" title="Rendición completada" onClose={() => setNotice(null)}>{notice}</Alert>}

      <TopRefetchBar active={isLoading && rows.length > 0} label="Actualizando cajas diarias" />

      {isLoading && rows.length === 0 ? (
        <TableRowsSkeleton rows={4} label="Consultando cajas de repartidores" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Sin cobros registrados en esta fecha"
          description="Cuando los repartidores entreguen pedidos de tienda con cobro COD aparecerán aquí para rendir caja."
        />
      ) : (
        <div className="orders-table-wrapper">
          <table className="orders-table" aria-label="Caja diaria por repartidor">
            <thead>
              <tr>
                <th scope="col">Repartidor</th>
                <th scope="col">Pedidos cobrados</th>
                <th scope="col">Efectivo esperado</th>
                <th scope="col">Estado</th>
                <th scope="col" className="orders-table__actions-head">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.courierUserId}>
                  <td><strong>{row.courierName ?? row.courierUserId}</strong></td>
                  <td>{row.ordersCount}</td>
                  <td><strong>{formatCents(row.collectedCents)}</strong></td>
                  <td>
                    {row.settlement ? (
                      <span className="store-pill store-pill--green">
                        Rendida · Recibido {formatCents(row.settlement.receivedCents)} (Dif. {formatCents(row.settlement.differenceCents)})
                      </span>
                    ) : (
                      <span className="store-pill store-pill--amber">Pendiente de rendición</span>
                    )}
                  </td>
                  <td className="orders-table__actions">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      disabled={Boolean(row.settlement) || row.collectedCents <= 0}
                      onClick={() => {
                        setSettleRow(row);
                        setReceivedDollars((row.collectedCents / 100).toFixed(2));
                        setNote('');
                      }}
                    >
                      Rendir caja
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {settleRow && (
        <Modal
          title={`Rendir caja · ${settleRow.courierName ?? 'Repartidor'}`}
          description={`Esperado del día ${date}: ${formatCents(settleRow.collectedCents)} (${settleRow.ordersCount} pedidos).`}
          onClose={() => !isSettling && setSettleRow(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isSettling} onClick={() => setSettleRow(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="admin-settle-form" variant="primary" size="sm" isLoading={isSettling}>
                Confirmar rendición
              </Button>
            </>
          }
        >
          <form id="admin-settle-form" className="store-form" onSubmit={handleSettle}>
            <TextInput
              id="settle-amount"
              label="Efectivo recibido (USD)"
              inputMode="decimal"
              value={receivedDollars}
              onChange={(e) => setReceivedDollars(e.target.value)}
              isRequired
            />
            <TextInput
              id="settle-note"
              label="Nota de cuadre (opcional)"
              placeholder="Ej. Cuadre completo en efectivo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </form>
        </Modal>
      )}
    </Card>
  );
};

export const AdminStoreSettingsPanel: FC<{ readonly storeGateway: HttpStoreGateway }> = ({
  storeGateway,
}) => {
  const [slotCapacity, setSlotCapacity] = useState('10');
  const [firstSlotHour, setFirstSlotHour] = useState('8');
  const [lastSlotHour, setLastSlotHour] = useState('20');
  const [minLeadMinutes, setMinLeadMinutes] = useState('60');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void storeGateway
      .adminGetSettings()
      .then((s) => {
        setSlotCapacity(String(s.slotCapacity));
        setFirstSlotHour(String(s.firstSlotHour));
        setLastSlotHour(String(s.lastSlotHour));
        setMinLeadMinutes(String(s.minLeadMinutes));
      })
      .catch((err) => setError(errMsg(err, 'No se pudo cargar la configuración de la tienda.')))
      .finally(() => setIsLoading(false));
  }, [storeGateway]);

  const handleSave = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSaving) return;
    const payload: StoreSettings = {
      slotCapacity: Number.parseInt(slotCapacity, 10),
      firstSlotHour: Number.parseInt(firstSlotHour, 10),
      lastSlotHour: Number.parseInt(lastSlotHour, 10),
      minLeadMinutes: Number.parseInt(minLeadMinutes, 10),
    };
    setIsSaving(true);
    setError(null);
    setNotice(null);
    try {
      await storeGateway.adminUpdateSettings(payload);
      setNotice('Configuración de franjas y cupos guardada.');
    } catch (err) {
      setError(errMsg(err, 'No se pudo guardar la configuración.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="store-card">
      <h3 className="store-card__title">Configuración operativa de franjas de entrega</h3>
      <p className="store-card__subtitle">
        Define la capacidad por franja horaria (1–500), el rango de horas (0–23) y los minutos mínimos de anticipación.
      </p>

      {error && <Alert type="error" title="Atención" onClose={() => setError(null)}>{error}</Alert>}
      {notice && <Alert type="success" title="Configuración guardada" onClose={() => setNotice(null)}>{notice}</Alert>}

      {isLoading ? (
        <div className="store-form" role="status" aria-busy="true" aria-label="Cargando configuración">
          <div className="store-form__row">
            <Skeleton height={44} radius={15} />
            <Skeleton height={44} radius={15} />
          </div>
          <div className="store-form__row">
            <Skeleton height={44} radius={15} />
            <Skeleton height={44} radius={15} />
          </div>
        </div>
      ) : (
        <form className="store-form" onSubmit={handleSave}>
          <div className="store-form__row">
            <TextInput
              id="set-cap"
              type="number"
              min={1}
              max={500}
              label="Cupo máximo por franja"
              value={slotCapacity}
              onChange={(e) => setSlotCapacity(e.target.value)}
              isRequired
            />
            <TextInput
              id="set-lead"
              type="number"
              min={0}
              label="Anticipación mínima (minutos)"
              value={minLeadMinutes}
              onChange={(e) => setMinLeadMinutes(e.target.value)}
              isRequired
            />
          </div>
          <div className="store-form__row">
            <TextInput
              id="set-first"
              type="number"
              min={0}
              max={23}
              label="Primera hora disponible (0–23)"
              value={firstSlotHour}
              onChange={(e) => setFirstSlotHour(e.target.value)}
              isRequired
            />
            <TextInput
              id="set-last"
              type="number"
              min={0}
              max={23}
              label="Última hora disponible (0–23)"
              value={lastSlotHour}
              onChange={(e) => setLastSlotHour(e.target.value)}
              isRequired
            />
          </div>
          <div className="store-form__actions">
            <Button type="submit" variant="primary" isLoading={isSaving}>
              Guardar configuración
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
};

import { useCallback, useEffect, useState, type FC, type SubmitEvent } from 'react';
import type { Order, OrderFilters, OrderStatus } from '../../domain/index.js';
import type { OrderUseCases } from '../../application/orderUseCases.js';
import { useOrders } from '../hooks/useOrders.js';
import { OrderForm } from './OrderForm.js';
import { OrderList } from './OrderList.js';
import {
  Alert,
  Button,
  Card,
  KineticHeader,
  Select,
  ShortIdBadge,
  TextInput,
} from '../../../../shared/ui/index.js';
import '../styles/orders.css';

export interface OrderManagementViewProps {
  useCases: OrderUseCases;
  canCreateOrder?: boolean | undefined;
  /** Navegación guiada del pipeline: planificar rutas para la fecha del pedido. */
  onNavigateToRoutes?: ((deliveryDate: string) => void) | undefined;
}

const STATUS_TIMELINE: readonly { readonly status: OrderStatus; readonly label: string }[] = [
  { status: 'pendiente', label: 'Pendiente' },
  { status: 'asignado_a_ruta', label: 'Asignado a ruta' },
  { status: 'recogido', label: 'Recogido' },
  { status: 'en_camino', label: 'En camino' },
  { status: 'entregado', label: 'Entregado' },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pendiente: 'Pendiente',
  asignado_a_ruta: 'Asignado a ruta',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

export const OrderManagementView: FC<OrderManagementViewProps> = ({
  useCases,
  canCreateOrder = true,
  onNavigateToRoutes,
}) => {
  const readLocation = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      deliveryDate: params.get('deliveryDate') || '',
      zoneId: params.get('zoneId') || '',
      orderId: params.get('orderId') || '',
    };
  };
  const [location, setLocation] = useState(readLocation);
  const [draftFilters, setDraftFilters] = useState(() => readLocation());
  const [detail, setDetail] = useState<Order | null>(null);
  const [detailState, setDetailState] = useState<'loading' | 'found' | 'missing' | 'error'>('loading');
  const focusDetail = useCallback((element: HTMLHeadingElement | null) => {
    element?.focus();
  }, []);
  const {
    orders,
    zones,
    isLoadingZones,
    isLoadingOrders,
    isSubmitting,
    error,
    ordersError,
    setFilters,
    successMessage,
    loadZones,
    loadOrders,
    createOrder,
    clearFeedback,
  } = useOrders(useCases, { deliveryDate: location.deliveryDate, zoneId: location.zoneId });

  const navigate = (next: { deliveryDate: string; zoneId: string; orderId: string }) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'orders');
    for (const key of ['deliveryDate', 'zoneId', 'orderId'] as const) {
      if (next[key]) url.searchParams.set(key, next[key]);
      else url.searchParams.delete(key);
    }
    window.history.pushState({}, '', url);
    setLocation(next);
  };

  useEffect(() => {
    const restore = () => {
      const next = readLocation();
      setLocation(next);
      setDraftFilters(next);
      setFilters({ deliveryDate: next.deliveryDate, zoneId: next.zoneId });
    };
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [setFilters]);

  useEffect(() => {
    if (!location.orderId) return;
    let current = true;
    setDetail(null);
    setDetailState('loading');
    void useCases.getOrderById
      .execute(location.orderId)
      .then((order) => {
        if (!current) return;
        setDetail(order);
        setDetailState(order ? 'found' : 'missing');
      })
      .catch(() => {
        if (current) setDetailState('error');
      });
    return () => {
      current = false;
    };
  }, [location.orderId, useCases.getOrderById]);

  const applyFilters = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selected: OrderFilters = {};
    if (draftFilters.deliveryDate) selected.deliveryDate = draftFilters.deliveryDate;
    if (draftFilters.zoneId) selected.zoneId = draftFilters.zoneId;
    setFilters(selected);
    navigate({ ...location, deliveryDate: draftFilters.deliveryDate, zoneId: draftFilters.zoneId });
  };

  const handleRefresh = () => {
    void loadZones();
    void loadOrders();
  };

  const isRefreshing = isLoadingZones || isLoadingOrders;
  const activeFilters = Boolean(location.deliveryDate || location.zoneId);

  return (
    <section className="orders-layout" aria-labelledby="orders-view-title">
      <KineticHeader
        id="orders-view-title"
        level="h2"
        title="Gestión de pedidos"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isRefreshing}
            onClick={handleRefresh}
            aria-label="Refrescar zonas y pedidos"
          >
            {isRefreshing ? 'Actualizando...' : '↻ Actualizar'}
          </Button>
        }
      />

      {error && (
        <Alert type="error" title="Atención" onClose={clearFeedback}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" title="Pedido registrado" onClose={clearFeedback}>
          {successMessage}
        </Alert>
      )}

      {location.orderId ? (
        <Card variant="elevated" className="orders-detail-card">
          <div className="orders-detail__header">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate({ ...location, orderId: '' })}
            >
              Volver al listado
            </Button>
            <h3 tabIndex={-1} ref={focusDetail} className="orders-detail__title">
              Detalle del pedido
            </h3>
          </div>

          {detailState === 'loading' && <p role="status">Cargando detalle...</p>}
          {detailState === 'missing' && <p role="status">Pedido no encontrado.</p>}
          {detailState === 'error' && (
            <Alert type="error" title="Error">No se pudo consultar el pedido.</Alert>
          )}
          {detailState === 'found' && detail && detail.id === location.orderId && (
            <>
              <div className="orders-detail__grid">
                <dl className="orders-detail__list">
                  <dt>ID</dt>
                  <dd className="orders-detail__mono">{detail.id}</dd>
                  <dt>Dirección de entrega</dt>
                  <dd>{detail.deliveryAddress}</dd>
                  <dt>Zona</dt>
                  <dd>{zones.find((zone) => zone.id === detail.zoneId)?.name || detail.zoneId}</dd>
                  <dt>Fecha de entrega</dt>
                  <dd>{detail.deliveryDate}</dd>
                  <dt>Hora de entrega</dt>
                  <dd>{detail.deliveryTime}</dd>
                  <dt>Estado</dt>
                  <dd>
                    <span className={`orders-status-badge orders-status-badge--${detail.status}`}>
                      {STATUS_LABELS[detail.status] ?? detail.status}
                    </span>
                    <span className="orders-detail__raw-status sr-only">{detail.status}</span>
                  </dd>
                  <dt>Creado (UTC)</dt>
                  <dd className="orders-detail__mono">{detail.createdAt}</dd>
                  <dt>Actualizado (UTC)</dt>
                  <dd className="orders-detail__mono">{detail.updatedAt}</dd>
                </dl>

                <aside className="orders-timeline" aria-label="Línea de tiempo del pedido">
                  <p className="orders-timeline__title">Progreso operativo</p>
                  <ol className="orders-timeline__list">
                    {STATUS_TIMELINE.map((step) => {
                      const stepIndex = STATUS_TIMELINE.findIndex(
                        (candidate) => candidate.status === detail.status,
                      );
                      const currentIndex = STATUS_TIMELINE.findIndex(
                        (candidate) => candidate.status === step.status,
                      );
                      const state =
                        currentIndex < stepIndex
                          ? 'done'
                          : currentIndex === stepIndex
                            ? 'current'
                            : 'pending';
                      return (
                        <li
                          key={step.status}
                          className={`orders-timeline__item orders-timeline__item--${state}`}
                        >
                          <span className="orders-timeline__dot" aria-hidden="true" />
                          <span className="orders-timeline__label">{step.label}</span>
                        </li>
                      );
                    })}
                  </ol>
                  <ShortIdBadge id={detail.id} prefix="PED" />
                </aside>
              </div>

              {onNavigateToRoutes !== undefined && (
                <div className="orders-detail__actions">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => onNavigateToRoutes(detail.deliveryDate)}
                  >
                    Ir a planificar rutas de esta fecha →
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      ) : (
        <>
          <div className={`orders-grid${canCreateOrder ? '' : ' orders-grid--single'}`}>
            {canCreateOrder && (
              <Card variant="elevated" className="orders-form-card">
                <h3 className="orders-form-card__title">Programar nuevo pedido</h3>
                <OrderForm
                  zones={zones}
                  isLoadingZones={isLoadingZones}
                  onSubmit={createOrder}
                  isSubmitting={isSubmitting}
                />
              </Card>
            )}

            <Card variant="elevated" className="orders-list-card">
              <div className="orders-list-card__header">
                <h3 className="orders-list-card__title">Pedidos programados</h3>
                <span className="orders-badge-count">
                  {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
                </span>
              </div>

              <form
                className="orders-filters"
                onSubmit={applyFilters}
                aria-label="Filtrar pedidos"
              >
                <TextInput
                  id="filter-date"
                  type="date"
                  label="Fecha de entrega"
                  value={draftFilters.deliveryDate}
                  onChange={(event) =>
                    setDraftFilters((previous) => ({
                      ...previous,
                      deliveryDate: event.target.value,
                    }))
                  }
                  disabled={isLoadingOrders}
                />
                <Select
                  id="filter-zone"
                  label="Zona"
                  options={[
                    { value: '', label: 'Todas las zonas' },
                    ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
                  ]}
                  value={draftFilters.zoneId}
                  onChange={(event) =>
                    setDraftFilters((previous) => ({ ...previous, zoneId: event.target.value }))
                  }
                  disabled={isLoadingOrders}
                />
                <div className="orders-filters__actions">
                  <Button type="submit" disabled={isLoadingOrders}>
                    Filtrar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setDraftFilters({ ...location, deliveryDate: '', zoneId: '' });
                      setFilters({});
                      navigate({ ...location, deliveryDate: '', zoneId: '' });
                    }}
                  >
                    Limpiar filtros
                  </Button>
                </div>
              </form>
              {!ordersError && (
                <OrderList
                  orders={orders}
                  zones={zones}
                  isLoading={isLoadingOrders}
                  hasActiveFilters={activeFilters}
                  onSelect={(orderId) => navigate({ ...location, orderId })}
                />
              )}
            </Card>
          </div>
        </>
      )}
    </section>
  );
};

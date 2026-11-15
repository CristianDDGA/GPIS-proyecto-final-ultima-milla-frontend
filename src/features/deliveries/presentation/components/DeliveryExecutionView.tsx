import { useMemo, type FC, type FormEvent } from 'react';
import type { CourierUseCases } from '../../../couriers/application/courierUseCases.js';
import type { ActiveCourierRouteStop } from '../../../couriers/domain/index.js';
import type { OrderStatus } from '../../../orders/domain/index.js';
import type { DeliveryUseCases } from '../../application/deliveryUseCases.js';
import {
  deliveryActionLabel,
  getNextAllowedDeliveryStatus,
  orderStatusLabel,
} from '../../domain/index.js';
import { useDeliveries } from '../hooks/useDeliveries.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Select,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import '../styles/deliveries.css';

export interface DeliveryActor {
  readonly id: string;
  readonly role: 'personal' | 'repartidor' | 'cliente';
  readonly courierId: string | null;
  readonly displayName: string | null;
}

export interface DeliveryExecutionViewProps {
  useCases: DeliveryUseCases;
  courierUseCases: CourierUseCases;
  actor: DeliveryActor;
}

const ROUTE_STATUS_LABELS: Record<string, string> = {
  asignada: 'Asignada',
  en_curso: 'En curso',
};

const EMPTY_STOPS: readonly ActiveCourierRouteStop[] = [];

export const DeliveryExecutionView: FC<DeliveryExecutionViewProps> = ({
  useCases,
  courierUseCases,
  actor,
}) => {
  const {
    selectedCourierId,
    setSelectedCourierId,
    effectiveCourierId,
    couriers,
    isLoadingCouriers,
    couriersError,
    refreshCouriers,
    activeRoute,
    isLoadingRoute,
    routeError,
    loadActiveRoute,
    courierAvailability,
    isUpdatingAvailability,
    toggleAvailability,
    deliveryRecords,
    isLoadingDeliveryRecords,
    syncingOrderIds,
    syncDeliveryRecord,
    syncAllDeliveryRecords,
    advancingOrderId,
    advanceStop,
    isCompletingRoute,
    completeActiveRoute,
    inspectorOrderId,
    setInspectorOrderId,
    inspectOrder,
    inspectedOrder,
    isLoadingInspector,
    inspectorError,
    error,
    successMessage,
    clearFeedback,
  } = useDeliveries(useCases, courierUseCases, actor);

  const stops = activeRoute?.stops ?? EMPTY_STOPS;

  const statusOf = (orderId: string, fallback: OrderStatus): OrderStatus =>
    deliveryRecords[orderId]?.status ?? fallback;

  const deliveredCount = stops.filter(
    (stop) => statusOf(stop.orderId, stop.status) === 'entregado',
  ).length;
  const allDelivered = stops.length > 0 && deliveredCount === stops.length;
  const canCompleteRoute =
    activeRoute !== null && activeRoute.status === 'en_curso' && allDelivered;

  const completeRouteReason = ((): string => {
    if (!activeRoute) return 'No hay una hoja de ruta activa cargada.';
    if (activeRoute.status !== 'en_curso') {
      return 'La ruta debe estar en curso para poder completarse.';
    }
    if (stops.length === 0) return 'La ruta no tiene paradas activas.';
    if (!allDelivered) {
      return `Faltan entregas: ${deliveredCount} de ${stops.length} pedidos entregados.`;
    }
    return '';
  })();

  const courierOptions = useMemo(
    () =>
      couriers.map((courier) => ({
        value: courier.id,
        label: `${courier.displayName} · ${courier.isAvailable ? 'Disponible' : 'No disponible'}`,
      })),
    [couriers],
  );

  const inspectorOptions = useMemo(
    () =>
      stops.map((stop) => ({
        value: stop.orderId,
        label: `Parada ${stop.position} · ${stop.deliveryAddress}`,
      })),
    [stops],
  );

  const inspectorSelectValue = inspectorOptions.some(
    (option) => option.value === inspectorOrderId,
  )
    ? inspectorOrderId
    : '';

  const availabilityLabel =
    courierAvailability === null
      ? 'Sin información de disponibilidad'
      : courierAvailability
        ? 'Disponible'
        : 'No disponible';

  const hasCourierBinding = actor.role === 'repartidor' ? actor.courierId !== null : true;

  const handleInspect = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void inspectOrder(inspectorOrderId);
  };

  const handleCompleteRoute = (): void => {
    void completeActiveRoute();
  };

  return (
    <section className="deliveries-layout" aria-labelledby="deliveries-view-title">
      <header className="deliveries-header">
        <div className="deliveries-header__title-group">
          <h2 id="deliveries-view-title">Ejecución de Entregas</h2>
          <p>
            Consulta la hoja de ruta del repartidor, registra las transiciones de cada pedido y
            completa la ruta cuando todas las entregas estén confirmadas.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          isLoading={isLoadingDeliveryRecords}
          disabled={activeRoute === null || stops.length === 0 || isLoadingDeliveryRecords}
          onClick={() => void syncAllDeliveryRecords()}
          aria-label="Sincronizar estados de todas las paradas"
        >
          {isLoadingDeliveryRecords ? 'Sincronizando...' : '↻ Sincronizar estados'}
        </Button>
      </header>

      {error && (
        <Alert type="error" title="Atención" onClose={clearFeedback}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" title="Operación Exitosa" onClose={clearFeedback}>
          {successMessage}
        </Alert>
      )}

      {actor.role === 'repartidor' && actor.courierId === null && (
        <Alert type="warning" title="Sin repartidor vinculado">
          Tu cuenta no tiene un repartidor vinculado; no es posible operar entregas.
        </Alert>
      )}

      {hasCourierBinding && (
        <div className="deliveries-grid">
          <div className="deliveries-grid__main">
            <Card variant="elevated" className="deliveries-route-card">
              <div className="deliveries-card__header">
                <h3 className="deliveries-card__title">Hoja de Ruta Activa</h3>
                <div className="deliveries-card__actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={isLoadingRoute}
                    disabled={effectiveCourierId.length === 0 || isLoadingRoute}
                    onClick={() => void loadActiveRoute()}
                  >
                    Cargar hoja de ruta
                  </Button>
                  {effectiveCourierId.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isLoading={isLoadingRoute}
                      disabled={isLoadingRoute}
                      onClick={() => void loadActiveRoute()}
                      aria-label="Recargar hoja de ruta activa"
                    >
                      ↻ Recargar
                    </Button>
                  )}
                </div>
              </div>

              {effectiveCourierId.length === 0 && (
                <p className="deliveries-hint">
                  Selecciona un repartidor para cargar su hoja de ruta activa.
                </p>
              )}

              {effectiveCourierId.length > 0 && (
                <p className="deliveries-hint">
                  Repartidor:{' '}
                  <code className="deliveries-code">{effectiveCourierId}</code>
                </p>
              )}

              {isLoadingRoute && (
                <div className="deliveries-loading" role="status">
                  <Spinner size="md" label="Cargando hoja de ruta activa..." />
                  <p>Consultando la hoja de ruta del repartidor...</p>
                </div>
              )}

              {!isLoadingRoute && routeError && (
                <Alert type="error" title="Hoja de ruta no disponible">
                  {routeError}
                </Alert>
              )}

              {!isLoadingRoute &&
                routeError === null &&
                effectiveCourierId.length > 0 &&
                activeRoute === null && (
                  <EmptyState
                    title="Sin hoja de ruta activa"
                    description="El repartidor no tiene una ruta activa asignada."
                    action={
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => void loadActiveRoute()}
                      >
                        ↻ Volver a consultar
                      </Button>
                    }
                  />
                )}

              {activeRoute && (
                <>
                  <dl className="deliveries-route-meta">
                    <div className="deliveries-route-meta__item">
                      <dt>Identificador de ruta</dt>
                      <dd>
                        <code className="deliveries-code">{activeRoute.routeId}</code>
                      </dd>
                    </div>
                    <div className="deliveries-route-meta__item">
                      <dt>Fecha de servicio</dt>
                      <dd>{activeRoute.serviceDate}</dd>
                    </div>
                    <div className="deliveries-route-meta__item">
                      <dt>Zona</dt>
                      <dd>
                        <code className="deliveries-code">{activeRoute.zoneId}</code>
                      </dd>
                    </div>
                    <div className="deliveries-route-meta__item">
                      <dt>Estado de la ruta</dt>
                      <dd>
                        <span
                          className={`deliveries-status-badge deliveries-status-badge--${activeRoute.status}`}
                        >
                          {ROUTE_STATUS_LABELS[activeRoute.status] ?? activeRoute.status}
                        </span>
                      </dd>
                    </div>
                  </dl>

                  {stops.length === 0 ? (
                    <p className="deliveries-empty-inline">
                      La hoja de ruta no tiene paradas activas registradas.
                    </p>
                  ) : (
                    <ol className="deliveries-stops" aria-label="Paradas de la hoja de ruta activa">
                      {stops.map((stop) => {
                        const record = deliveryRecords[stop.orderId];
                        const currentStatus = statusOf(stop.orderId, stop.status);
                        const next = getNextAllowedDeliveryStatus(currentStatus);
                        const isSyncing = syncingOrderIds.includes(stop.orderId);
                        const isAdvancing = advancingOrderId === stop.orderId;

                        return (
                          <li key={stop.orderId} className="deliveries-stop">
                            <div className="deliveries-stop__position">
                              <span className="deliveries-stop__position-value">
                                {stop.position}
                              </span>
                              <span className="deliveries-stop__position-label">Parada</span>
                            </div>

                            <div className="deliveries-stop__body">
                              <div className="deliveries-stop__heading">
                                <span className="deliveries-stop__address">
                                  {stop.deliveryAddress}
                                </span>
                                <span
                                  className={`deliveries-status-badge deliveries-status-badge--${currentStatus}`}
                                >
                                  {orderStatusLabel(currentStatus)}
                                </span>
                              </div>

                              <div className="deliveries-stop__meta">
                                <span>Hora de entrega: {stop.deliveryTime}</span>
                                <code className="deliveries-code">{stop.orderId}</code>
                              </div>

                              {record ? (
                                <div className="deliveries-stop__record">
                                  <span>
                                    Versión: <code className="deliveries-code">{record.version}</code>
                                  </span>
                                  <span>
                                    Entregado el: {record.deliveredAt ?? 'No registrado'}
                                  </span>
                                  <span>Última actualización: {record.updatedAt}</span>
                                </div>
                              ) : (
                                <p className="deliveries-stop__record deliveries-stop__record--empty">
                                  Sin registro de entrega sincronizado.
                                </p>
                              )}

                              <div className="deliveries-stop__actions">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  isLoading={isSyncing}
                                  disabled={isSyncing || isAdvancing}
                                  onClick={() => void syncDeliveryRecord(stop.orderId)}
                                >
                                  Sincronizar
                                </Button>

                                {next ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="primary"
                                    isLoading={isAdvancing}
                                    disabled={isAdvancing || isSyncing}
                                    onClick={() => void advanceStop(stop.orderId)}
                                  >
                                    {deliveryActionLabel(next)}
                                  </Button>
                                ) : (
                                  <span className="deliveries-stop__done" role="status">
                                    {currentStatus === 'entregado'
                                      ? 'Pedido entregado'
                                      : 'Sin transición disponible'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  <div className="deliveries-route-completion">
                    <div className="deliveries-route-completion__info">
                      <span>
                        Pedidos entregados: <strong>{deliveredCount}</strong> de{' '}
                        <strong>{stops.length}</strong>
                      </span>
                      {!canCompleteRoute && completeRouteReason.length > 0 && (
                        <span className="deliveries-route-completion__reason" role="status">
                          {completeRouteReason}
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      isLoading={isCompletingRoute}
                      disabled={!canCompleteRoute || isCompletingRoute}
                      onClick={handleCompleteRoute}
                      aria-label="Completar la hoja de ruta activa"
                    >
                      {isCompletingRoute ? 'Completando...' : 'Completar Ruta'}
                    </Button>
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="deliveries-grid__side">
            <Card variant="elevated" className="deliveries-identity-card">
              <h3 className="deliveries-card__title">Repartidor en Operación</h3>

              {actor.role === 'personal' ? (
                <>
                  <Select
                    label="Repartidor"
                    placeholder={
                      isLoadingCouriers
                        ? 'Cargando repartidores...'
                        : 'Selecciona un repartidor'
                    }
                    options={courierOptions}
                    value={selectedCourierId}
                    onChange={(event) => setSelectedCourierId(event.target.value)}
                    helperText="La hoja de ruta se recarga automáticamente al cambiar de repartidor."
                    disabled={isLoadingCouriers || isUpdatingAvailability}
                  />
                  {couriersError && (
                    <Alert type="error" title="Catálogo no disponible">
                      {couriersError}
                    </Alert>
                  )}
                  <div className="deliveries-identity-actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      isLoading={isLoadingCouriers}
                      disabled={isLoadingCouriers}
                      onClick={() => void refreshCouriers()}
                    >
                      ↻ Actualizar catálogo
                    </Button>
                  </div>
                </>
              ) : (
                <div className="deliveries-identity-summary">
                  <p className="deliveries-identity-summary__name">
                    {actor.displayName ?? 'Repartidor sin nombre visible'}
                  </p>
                  <p className="deliveries-identity-summary__meta">
                    Identificador de repartidor:{' '}
                    <code className="deliveries-code">{actor.courierId ?? 'No vinculado'}</code>
                  </p>
                </div>
              )}

              <div className="deliveries-availability">
                <div>
                  <span className="deliveries-availability__label">Estado del repartidor</span>
                  <span
                    className={`deliveries-status-badge ${
                      courierAvailability === true
                        ? 'deliveries-status-badge--disponible'
                        : 'deliveries-status-badge--no_disponible'
                    }`}
                  >
                    {availabilityLabel}
                  </span>
                </div>
                <Button
                  type="button"
                  variant={courierAvailability === true ? 'outline' : 'secondary'}
                  size="sm"
                  aria-pressed={courierAvailability === true}
                  isLoading={isUpdatingAvailability}
                  disabled={effectiveCourierId.length === 0 || isUpdatingAvailability}
                  onClick={() => void toggleAvailability()}
                >
                  {courierAvailability === true ? 'Marcar no disponible' : 'Marcar disponible'}
                </Button>
              </div>
            </Card>

            <Card variant="elevated" className="deliveries-inspector-card">
              <h3 className="deliveries-card__title">Inspector Individual de Orden de Entrega</h3>

              <form className="deliveries-inspector-form" onSubmit={handleInspect} noValidate>
                <TextInput
                  id="delivery-inspector-order-id"
                  label="Identificador del pedido"
                  placeholder="UUID del pedido de entrega"
                  value={inspectorOrderId}
                  onChange={(event) => setInspectorOrderId(event.target.value)}
                  helperText="Formato UUID. Consulta el estado actual, la versión y las fechas de entrega."
                  isRequired
                  disabled={isLoadingInspector}
                />

                {inspectorOptions.length > 0 && (
                  <Select
                    label="Paradas de la ruta activa"
                    placeholder="Selecciona una parada de la ruta"
                    options={inspectorOptions}
                    value={inspectorSelectValue}
                    onChange={(event) => setInspectorOrderId(event.target.value)}
                    disabled={isLoadingInspector}
                    helperText="Atajo para consultar una parada de la hoja de ruta activa."
                  />
                )}

                <Button type="submit" size="sm" isLoading={isLoadingInspector}>
                  {isLoadingInspector ? 'Consultando...' : 'Consultar estado de entrega'}
                </Button>
              </form>

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
                      <code className="deliveries-code">{inspectedOrder.orderId}</code>
                    </dd>
                  </div>
                  <div className="deliveries-inspector-result__item">
                    <dt>Ruta</dt>
                    <dd>
                      {inspectedOrder.routeId ? (
                        <code className="deliveries-code">{inspectedOrder.routeId}</code>
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
                    <dd>
                      <code className="deliveries-code">{inspectedOrder.version}</code>
                    </dd>
                  </div>
                  <div className="deliveries-inspector-result__item">
                    <dt>Entregado el</dt>
                    <dd>{inspectedOrder.deliveredAt ?? 'No registrado'}</dd>
                  </div>
                  <div className="deliveries-inspector-result__item">
                    <dt>Última actualización</dt>
                    <dd>{inspectedOrder.updatedAt}</dd>
                  </div>
                </dl>
              )}
            </Card>
          </div>
        </div>
      )}
    </section>
  );
};

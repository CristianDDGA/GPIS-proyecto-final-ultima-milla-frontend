import { useCallback, useEffect, useMemo, useState, type FC, type FormEvent } from 'react';
import type {
  ActiveCourierRouteStop,
  CreateCourierInput,
  Courier,
} from '../../domain/index.js';
import { validateCreateCourierInput } from '../../domain/index.js';
import type { CourierUseCases } from '../../application/courierUseCases.js';
import { useCouriers, type CourierAvailabilityFilter } from '../hooks/useCouriers.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Select,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import '../styles/couriers.css';

export interface DispatchableRoute {
  readonly id: string;
  readonly zoneId: string;
  readonly serviceDate: string;
  readonly status: string;
  readonly capacityLimit: number;
  readonly occupiedSlots: number;
}

export interface CourierFleetDispatchViewProps {
  useCases: CourierUseCases;
  listPlanifiedRoutes: () => Promise<readonly DispatchableRoute[]>;
}

const STOP_STATUS_LABELS: Record<ActiveCourierRouteStop['status'], string> = {
  asignado_a_ruta: 'Asignado a ruta',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
};

const ROUTE_STATUS_LABELS: Record<string, string> = {
  asignada: 'Asignada',
  en_curso: 'En curso',
};

const AVAILABILITY_FILTERS: readonly {
  readonly value: CourierAvailabilityFilter;
  readonly label: string;
}[] = [
  { value: 'all', label: 'Todos' },
  { value: 'available', label: 'Solo disponibles' },
  { value: 'unavailable', label: 'No disponibles' },
];

export const CourierFleetDispatchView: FC<CourierFleetDispatchViewProps> = ({
  useCases,
  listPlanifiedRoutes,
}) => {
  const {
    couriers,
    isLoadingCouriers,
    couriersError,
    assignableCouriers,
    isLoadingAssignableCouriers,
    assignableCouriersError,
    refreshCouriers,
    availabilityFilter,
    setAvailabilityFilter,
    isCreatingCourier,
    createCourier,
    updatingCourierId,
    toggleAvailability,
    isAssigning,
    assignRoute,
    activeRoute,
    isLoadingActiveRoute,
    activeRouteError,
    loadActiveRoute,
    selectedCourierId,
    successMessage,
    error,
    clearFeedback,
  } = useCouriers(useCases);

  const [displayName, setDisplayName] = useState('');
  const [capacity, setCapacity] = useState('5');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [routes, setRoutes] = useState<readonly DispatchableRoute[]>([]);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedAssignCourierId, setSelectedAssignCourierId] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setIsLoadingRoutes(true);
    setRoutesError(null);

    void listPlanifiedRoutes()
      .then((planified) => {
        if (isCurrent) setRoutes(planified);
      })
      .catch((error_: unknown) => {
        if (isCurrent) {
          setRoutes([]);
          setRoutesError(
            error_ instanceof Error && error_.message.trim().length > 0
              ? error_.message
              : 'No se pudieron cargar las rutas planificadas.',
          );
        }
      })
      .finally(() => {
        if (isCurrent) setIsLoadingRoutes(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [listPlanifiedRoutes]);

  const reloadRoutes = useCallback((): void => {
    setIsLoadingRoutes(true);
    setRoutesError(null);

    void listPlanifiedRoutes()
      .then((planified) => {
        setRoutes(planified);
      })
      .catch((error_: unknown) => {
        setRoutes([]);
        setRoutesError(
          error_ instanceof Error && error_.message.trim().length > 0
            ? error_.message
            : 'No se pudieron cargar las rutas planificadas.',
        );
      })
      .finally(() => {
        setIsLoadingRoutes(false);
      });
  }, [listPlanifiedRoutes]);

  const planifiedRoutes = useMemo(
    () => routes.filter((route) => route.status === 'planificada'),
    [routes],
  );

  const selectedPlanifiedRoute = useMemo(
    () => planifiedRoutes.find((route) => route.id === selectedRouteId) ?? null,
    [planifiedRoutes, selectedRouteId],
  );

  // The backend only assigns a courier when it is enabled, available and able to
  // carry every stop of the route, so the selector mirrors those preconditions.
  const availableCouriers = useMemo(
    () =>
      assignableCouriers.filter(
        (courier) =>
          courier.isEnabled &&
          (selectedPlanifiedRoute === null ||
            selectedPlanifiedRoute.occupiedSlots <= courier.maxOrdersPerTrip),
      ),
    [assignableCouriers, selectedPlanifiedRoute],
  );

  useEffect(() => {
    if (selectedAssignCourierId.length === 0) {
      return;
    }

    const stillAssignable = availableCouriers.some(
      (courier) => courier.id === selectedAssignCourierId,
    );
    if (!stillAssignable) {
      setSelectedAssignCourierId('');
    }
  }, [availableCouriers, selectedAssignCourierId]);

  const routeOptions = useMemo(
    () =>
      planifiedRoutes.map((route) => ({
        value: route.id,
        label: `${route.serviceDate} · ${route.zoneId} · ${route.occupiedSlots}/${route.capacityLimit}`,
      })),
    [planifiedRoutes],
  );

  const availableCourierOptions = useMemo(
    () =>
      availableCouriers.map((courier: Courier) => ({
        value: courier.id,
        label: `${courier.displayName} · ${courier.maxOrdersPerTrip} pedidos por viaje`,
      })),
    [availableCouriers],
  );

  const selectedCourier = useMemo(
    () => couriers.find((courier) => courier.id === selectedCourierId) ?? null,
    [couriers, selectedCourierId],
  );

  const handleCreateCourier = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const input: CreateCourierInput = {
      displayName: displayName.trim(),
      maxOrdersPerTrip: Number(capacity),
    };
    const validation = validateCreateCourierInput(input);
    setFieldErrors(validation.errors);
    if (!validation.isValid) return;

    const created = await createCourier(input);
    if (created) {
      setDisplayName('');
      setCapacity('5');
      setFieldErrors({});
    }
  };

  const handleAssignRoute = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (selectedRouteId.length === 0 || selectedAssignCourierId.length === 0) return;

    const result = await assignRoute(selectedRouteId, selectedAssignCourierId);
    if (result) {
      setSelectedRouteId('');
      setSelectedAssignCourierId('');
      reloadRoutes();
    }
  };

  return (
    <section className="couriers-layout" aria-labelledby="couriers-view-title">
      <header className="couriers-header">
        <div className="couriers-header__title-group">
          <h2 id="couriers-view-title">Flota de Repartidores y Asignación de Rutas</h2>
          <p>
            Registra repartidores, administra su disponibilidad y asigna rutas planificadas para la
            operación de última milla.
          </p>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          isLoading={isLoadingCouriers}
          onClick={() => void refreshCouriers()}
          aria-label="Refrescar catálogo de repartidores"
        >
          {isLoadingCouriers ? 'Actualizando...' : '↻ Actualizar'}
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

      <div className="couriers-grid">
        <div className="couriers-grid__column">
          <Card variant="elevated" className="couriers-form-card">
            <h3 className="couriers-card__title">Alta de Repartidor</h3>
            <form className="couriers-form" onSubmit={handleCreateCourier} noValidate>
              <TextInput
                id="courier-display-name"
                label="Nombre del repartidor"
                placeholder="Ej. Carlos Andrade"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                error={fieldErrors['displayName']}
                helperText="Nombre visible del repartidor en la operación."
                isRequired
                maxLength={120}
                disabled={isCreatingCourier}
                autoComplete="name"
              />

              <TextInput
                id="courier-capacity"
                type="number"
                label="Máximo de pedidos por viaje"
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
                error={fieldErrors['maxOrdersPerTrip']}
                helperText="Capacidad operativa del repartidor por ruta."
                isRequired
                min={1}
                step={1}
                inputMode="numeric"
                disabled={isCreatingCourier}
              />

              <div className="couriers-form__actions">
                <Button type="submit" isLoading={isCreatingCourier} disabled={isCreatingCourier}>
                  {isCreatingCourier ? 'Registrando...' : 'Registrar repartidor'}
                </Button>
              </div>
            </form>
          </Card>

          <Card variant="elevated" className="couriers-assignment-card">
            <div className="couriers-card__header">
              <h3 className="couriers-card__title">Asignación de Ruta a Repartidor</h3>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                isLoading={isLoadingRoutes}
                onClick={reloadRoutes}
                aria-label="Recargar rutas planificadas"
              >
                ↻ Recargar rutas
              </Button>
            </div>

            {routesError && (
              <Alert type="error" title="Rutas no disponibles">
                {routesError}
              </Alert>
            )}

            {assignableCouriersError && (
              <Alert type="error" title="Repartidores no disponibles">
                {assignableCouriersError}
              </Alert>
            )}

            {isLoadingRoutes ? (
              <div className="couriers-inline-loading" role="status">
                <Spinner size="sm" label="Cargando rutas planificadas..." />
                <span>Cargando rutas planificadas...</span>
              </div>
            ) : (
              <form className="couriers-form" onSubmit={handleAssignRoute} noValidate>
                <Select
                  id="courier-assignment-route"
                  label="Ruta planificada"
                  placeholder={
                    planifiedRoutes.length === 0
                      ? 'No hay rutas planificadas disponibles'
                      : 'Selecciona una ruta planificada'
                  }
                  options={routeOptions}
                  value={selectedRouteId}
                  onChange={(event) => setSelectedRouteId(event.target.value)}
                  helperText="Solo se muestran rutas en estado planificada."
                  isRequired
                  disabled={planifiedRoutes.length === 0 || isAssigning}
                />

                <Select
                  id="courier-assignment-courier"
                  label="Repartidor disponible"
                  placeholder={
                    isLoadingAssignableCouriers
                      ? 'Cargando repartidores disponibles...'
                      : availableCouriers.length === 0
                        ? 'No hay repartidores disponibles'
                        : 'Selecciona un repartidor'
                  }
                  options={availableCourierOptions}
                  value={selectedAssignCourierId}
                  onChange={(event) => setSelectedAssignCourierId(event.target.value)}
                  helperText="Solo se muestran repartidores habilitados, disponibles y con capacidad suficiente para la ruta elegida."
                  isRequired
                  disabled={availableCouriers.length === 0 || isAssigning}
                />

                <div className="couriers-form__actions">
                  <Button
                    type="submit"
                    isLoading={isAssigning}
                    disabled={
                      isAssigning ||
                      selectedRouteId.length === 0 ||
                      selectedAssignCourierId.length === 0
                    }
                  >
                    {isAssigning ? 'Asignando...' : 'Asignar ruta'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>

        <div className="couriers-grid__column">
          <Card variant="elevated" className="couriers-fleet-card">
            <div className="couriers-card__header">
              <h3 className="couriers-card__title">Catálogo de Flota</h3>
              <span className="couriers-badge-count">
                {couriers.length} {couriers.length === 1 ? 'repartidor' : 'repartidores'}
              </span>
            </div>

            <div className="fleet-filter" role="group" aria-label="Filtrar repartidores por disponibilidad">
              {AVAILABILITY_FILTERS.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={availabilityFilter === filter.value ? 'primary' : 'outline'}
                  aria-pressed={availabilityFilter === filter.value}
                  onClick={() => setAvailabilityFilter(filter.value)}
                  isLoading={
                    availabilityFilter === filter.value ? isLoadingCouriers : false
                  }
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {couriersError && (
              <Alert type="error" title="Catálogo no disponible">
                {couriersError}
              </Alert>
            )}

            {isLoadingCouriers && couriers.length === 0 ? (
              <div className="couriers-loading" role="status">
                <Spinner size="md" label="Cargando repartidores..." />
                <p>Consultando repartidores registrados...</p>
              </div>
            ) : couriers.length === 0 ? (
              <EmptyState
                title={
                  availabilityFilter === 'all'
                    ? 'No hay repartidores registrados'
                    : 'No hay repartidores para el filtro seleccionado'
                }
                description={
                  availabilityFilter === 'all'
                    ? 'Registra el primer repartidor para poder asignarle rutas planificadas.'
                    : 'Ningún repartidor coincide con el filtro de disponibilidad elegido. Cambia el filtro o actualiza el catálogo.'
                }
                action={
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => void refreshCouriers()}
                  >
                    ↻ Actualizar catálogo
                  </Button>
                }
              />
            ) : (
              <div className="couriers-table-wrapper">
                <table className="couriers-table" aria-label="Catálogo de repartidores">
                  <thead>
                    <tr>
                      <th scope="col">Repartidor</th>
                      <th scope="col">Capacidad</th>
                      <th scope="col">Habilitación</th>
                      <th scope="col">Disponibilidad</th>
                      <th scope="col">Hoja de ruta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {couriers.map((courier) => (
                      <tr key={courier.id}>
                        <td>
                          <span className="couriers-table__name">{courier.displayName}</span>
                          <code className="couriers-table__id">{courier.id}</code>
                        </td>
                        <td>{courier.maxOrdersPerTrip} pedidos</td>
                        <td>
                          <span
                            className={`couriers-status-badge ${
                              courier.isEnabled
                                ? 'couriers-status-badge--enabled'
                                : 'couriers-status-badge--disabled'
                            }`}
                          >
                            {courier.isEnabled ? 'Habilitado' : 'Deshabilitado'}
                          </span>
                        </td>
                        <td>
                          <Button
                            type="button"
                            size="sm"
                            variant={courier.isAvailable ? 'secondary' : 'outline'}
                            aria-pressed={courier.isAvailable}
                            isLoading={updatingCourierId === courier.id}
                            disabled={!courier.isEnabled}
                            onClick={() => void toggleAvailability(courier)}
                          >
                            {courier.isAvailable ? 'Marcar no disponible' : 'Marcar disponible'}
                          </Button>
                        </td>
                        <td>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void loadActiveRoute(courier.id)}
                            aria-label={`Ver hoja de ruta activa de ${courier.displayName}`}
                          >
                            Ver hoja de ruta activa
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card variant="elevated" className="couriers-route-card">
            <h3 className="couriers-card__title">Hoja de Ruta Activa del Repartidor Seleccionado</h3>

            {selectedCourierId.length === 0 ? (
              <p className="couriers-hint">
                Selecciona un repartidor en el catálogo con la acción &quot;Ver hoja de ruta
                activa&quot; para consultar su ruta.
              </p>
            ) : (
              <p className="couriers-hint">
                Repartidor:{' '}
                <strong>{selectedCourier?.displayName ?? 'Sin nombre en el catálogo'}</strong>{' '}
                <code className="couriers-table__id">{selectedCourierId}</code>
              </p>
            )}

            {isLoadingActiveRoute && (
              <div className="couriers-inline-loading" role="status">
                <Spinner size="sm" label="Consultando hoja de ruta activa..." />
                <span>Consultando hoja de ruta activa...</span>
              </div>
            )}

            {!isLoadingActiveRoute && activeRouteError && (
              <Alert type="error" title="Hoja de ruta no disponible">
                {activeRouteError}
              </Alert>
            )}

            {!isLoadingActiveRoute &&
              activeRouteError === null &&
              selectedCourierId.length > 0 &&
              activeRoute === null && (
                <p className="couriers-empty-inline">
                  El repartidor no tiene una ruta activa asignada.
                </p>
              )}

            {activeRoute && (
              <div className="couriers-active-route">
                <dl className="couriers-route-meta">
                  <div className="couriers-route-meta__item">
                    <dt>Identificador de ruta</dt>
                    <dd>
                      <code className="couriers-table__id">{activeRoute.routeId}</code>
                    </dd>
                  </div>
                  <div className="couriers-route-meta__item">
                    <dt>Fecha de servicio</dt>
                    <dd>{activeRoute.serviceDate}</dd>
                  </div>
                  <div className="couriers-route-meta__item">
                    <dt>Zona</dt>
                    <dd>
                      <code className="couriers-table__id">{activeRoute.zoneId}</code>
                    </dd>
                  </div>
                  <div className="couriers-route-meta__item">
                    <dt>Estado</dt>
                    <dd>
                      <span
                        className={`couriers-status-badge couriers-status-badge--${activeRoute.status}`}
                      >
                        {ROUTE_STATUS_LABELS[activeRoute.status] ?? activeRoute.status}
                      </span>
                    </dd>
                  </div>
                </dl>

                <ol className="couriers-stops" aria-label="Paradas de la ruta activa">
                  {activeRoute.stops.map((stop) => (
                    <li key={stop.orderId} className="couriers-stop">
                      <div className="couriers-stop__position">
                        <span className="couriers-stop__position-value">{stop.position}</span>
                        <span className="couriers-stop__position-label">Parada</span>
                      </div>
                      <div className="couriers-stop__body">
                        <span className="couriers-stop__address">{stop.deliveryAddress}</span>
                        <span className="couriers-stop__meta">
                          Hora de entrega: {stop.deliveryTime}
                        </span>
                        <code className="couriers-table__id">{stop.orderId}</code>
                      </div>
                      <span
                        className={`couriers-status-badge couriers-status-badge--${stop.status}`}
                      >
                        {STOP_STATUS_LABELS[stop.status]}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};

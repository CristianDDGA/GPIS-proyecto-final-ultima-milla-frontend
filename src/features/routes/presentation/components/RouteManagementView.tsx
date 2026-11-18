import type { FC } from 'react';
import type { Courier } from '../../../couriers/domain/index.js';
import type { Order } from '../../../orders/domain/index.js';
import type { Zone } from '../../../zones/domain/index.js';
import type {
  LateOrderPlacementResult,
  PlanRoutesInput,
  PlanRoutesResult,
} from '../../domain/index.js';
import type { RouteUseCases } from '../../application/routeUseCases.js';
import { DEFAULT_ROUTE_FILTERS, useRoutes } from '../hooks/useRoutes.js';
import { LateOrderPlacementCard } from './LateOrderPlacementCard.js';
import { RouteDetailPanel } from './RouteDetailPanel.js';
import { RouteFiltersForm } from './RouteFiltersForm.js';
import { RoutePlannerCard } from './RoutePlannerCard.js';
import { RouteTable } from './RouteTable.js';
import { Alert, Button, Card, KineticHeader, Spinner } from '../../../../shared/ui/index.js';
import '../styles/routes.css';

export interface RouteManagementViewProps {
  useCases: RouteUseCases;
  zones: readonly Zone[];
  pendingOrders?: readonly Order[] | undefined;
  /** Catálogo de repartidores para resolver nombres en tablas y detalles. */
  couriers?: readonly Courier[] | undefined;
  isAdmin: boolean;
  /**
   * Se invoca después de una planificación o inserción de pedido tardío exitosa para
   * que el composition root refresque el catálogo compartido de pedidos pendientes.
   */
  onCatalogChanged?: (() => void) | undefined;
  /** Navegación guiada del pipeline: asignar repartidor en Despacho. */
  onNavigateToFleet?: (() => void) | undefined;
}

export const RouteManagementView: FC<RouteManagementViewProps> = ({
  useCases,
  zones,
  pendingOrders,
  couriers,
  isAdmin,
  onCatalogChanged,
  onNavigateToFleet,
}) => {
  const routes = useRoutes(useCases, { isAdmin });
  const pending = pendingOrders ?? [];
  const courierList = couriers ?? [];

  const handlePlan = async (input: PlanRoutesInput): Promise<PlanRoutesResult | null> => {
    const result = await routes.planRoutes(input);
    if (result) {
      onCatalogChanged?.();
    }
    return result;
  };

  const handlePlaceLateOrder = async (
    orderId: string,
    capacityLimit: number,
  ): Promise<LateOrderPlacementResult | null> => {
    const result = await routes.placeLateOrder(orderId, capacityLimit);
    if (result) {
      onCatalogChanged?.();
    }
    return result;
  };

  return (
    <section className="routes-layout" aria-labelledby="routes-view-title">
      <KineticHeader
        id="routes-view-title"
        level="h2"
        eyebrow="Etapa 03 · Planificación"
        title="Planificación y operaciones de ruta"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={routes.isLoadingRoutes}
            onClick={() => void routes.loadRoutes()}
            aria-label="Refrescar listado de rutas"
          >
            ↻ Actualizar
          </Button>
        }
      />

      {routes.error && (
        <Alert type="error" title="Atención" onClose={routes.clearFeedback}>
          {routes.error}
        </Alert>
      )}

      {routes.successMessage && (
        <Alert type="success" title="Operación exitosa" onClose={routes.clearFeedback}>
          {routes.successMessage}
        </Alert>
      )}

      {isAdmin ? (
        <div className="routes-operations-grid">
          <RoutePlannerCard
            isPlanning={routes.isPlanning}
            planError={routes.planError}
            planSuccess={routes.planSuccess}
            planResult={routes.planResult}
            onPlan={handlePlan}
            onClearFeedback={routes.clearPlanFeedback}
          />
          <LateOrderPlacementCard
            pendingOrders={pending}
            isPlacingLate={routes.isPlacingLate}
            onPlaceLateOrder={handlePlaceLateOrder}
            onInspectRoute={(routeId) => void routes.inspectRoute(routeId)}
          />
        </div>
      ) : (
        <Alert type="info" title="Modo consulta">
          Sólo el personal administrativo puede generar planificaciones, reordenar paradas,
          cancelar rutas o reubicar pedidos. Puedes consultar el listado y el detalle de cada ruta.
        </Alert>
      )}

      <Card variant="elevated" className="routes-list-card">
        <div className="routes-list-card__header">
          <h3 className="routes-list-card__title">Rutas planificadas</h3>
          <span className="routes-badge-count">
            {routes.routes.length} {routes.routes.length === 1 ? 'ruta' : 'rutas'}
          </span>
        </div>

        <RouteFiltersForm
          filters={routes.filters}
          zones={zones}
          isLoading={routes.isLoadingRoutes}
          onChange={routes.setFilters}
          onApply={() => void routes.applyFilters()}
          onReset={() => void routes.applyFilters({ ...DEFAULT_ROUTE_FILTERS })}
          onRefresh={() => void routes.loadRoutes()}
        />

        {routes.routesError && (
          <Alert type="error" title="No se pudo cargar el listado">
            {routes.routesError}
          </Alert>
        )}

        <RouteTable
          routes={routes.routes}
          zones={zones}
          couriers={courierList}
          isLoading={routes.isLoadingRoutes}
          onInspect={(routeId) => void routes.inspectRoute(routeId)}
        />
      </Card>

      {routes.isLoadingDetail && !routes.selectedRoute && (
        <Card variant="outlined" className="routes-detail-loading">
          <Spinner size="lg" label="Cargando detalle de la ruta..." />
          <p role="status">Consultando el detalle de la ruta seleccionada...</p>
        </Card>
      )}

      {routes.detailError && !routes.selectedRoute && (
        <Alert type="error" title="No se pudo cargar el detalle" onClose={routes.clearSelectedRoute}>
          {routes.detailError}
        </Alert>
      )}

      {routes.selectedRoute && (
        <RouteDetailPanel
          route={routes.selectedRoute}
          routes={routes.routes}
          zones={zones}
          couriers={courierList}
          isAdmin={isAdmin}
          isLoadingDetail={routes.isLoadingDetail}
          detailError={routes.detailError}
          isReordering={routes.isReordering}
          isCancelling={routes.isCancelling}
          isMovingOrder={routes.isMovingOrder}
          onReorderStops={routes.reorderStops}
          onCancelRoute={routes.cancelRoute}
          onMoveOrder={routes.moveOrder}
          onReload={() => void routes.reloadSelectedRoute()}
          onClose={routes.clearSelectedRoute}
          onNavigateToFleet={onNavigateToFleet}
        />
      )}
    </section>
  );
};

import { useEffect, useState, type FC, type FormEvent } from 'react';
import {
  addDaysToIsoDate,
  getTodayIsoDate,
  MAX_PLANNING_DAYS_AHEAD,
  MAX_ROUTE_CAPACITY,
  validatePlanRoutesInput,
  type PlanRoutesInput,
  type PlanRoutesResult,
  type PreviewPlanInput,
  type RoutePlanPreview,
} from '../../domain/index.js';
import { Alert, Button, Card, ShortIdBadge, TextInput } from '../../../../shared/ui/index.js';

export interface RoutePlannerCardProps {
  isPlanning: boolean;
  planError: string | null;
  planSuccess: string | null;
  planResult: PlanRoutesResult | null;
  preview: RoutePlanPreview | null;
  isPreviewing: boolean;
  previewError: string | null;
  onPreview: (input: PreviewPlanInput) => Promise<void>;
  onClearPreview: () => void;
  onPlan: (input: PlanRoutesInput) => Promise<PlanRoutesResult | null>;
  onClearFeedback: () => void;
}

const DEFAULT_CAPACITY_LIMIT = '4';

function readInitialServiceDate(): string {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('deliveryDate');
    if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
      return param;
    }
  }
  return getTodayIsoDate();
}

export const RoutePlannerCard: FC<RoutePlannerCardProps> = ({
  isPlanning,
  planError,
  planSuccess,
  planResult,
  preview,
  isPreviewing,
  previewError,
  onPreview,
  onClearPreview,
  onPlan,
  onClearFeedback,
}) => {
  const [serviceDate, setServiceDate] = useState(readInitialServiceDate);
  const [capacityLimit, setCapacityLimit] = useState(DEFAULT_CAPACITY_LIMIT);

  const validation = validatePlanRoutesInput({ serviceDate, capacityLimit: Number(capacityLimit) });

  // La vista previa se actualiza sola cuando fecha y capacidad son validas (y despues de generar el plan).
  const isValid = validation.isValid;
  useEffect(() => {
    if (!isValid) {
      onClearPreview();
      return undefined;
    }
    const timer = setTimeout(() => {
      void onPreview({ serviceDate, capacityLimit: Number(capacityLimit) });
    }, 350);
    return () => clearTimeout(timer);
  }, [isValid, serviceDate, capacityLimit, planResult, onPreview, onClearPreview]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validation.isValid) {
      return;
    }
    void onPlan({ serviceDate, capacityLimit: Number(capacityLimit) });
  };

  return (
    <Card variant="elevated" className="routes-operation-card">
      <div className="routes-operation-card__header">
        <h3 className="routes-operation-card__title">Generar plan de rutas</h3>
      </div>

      <form className="routes-form" onSubmit={handleSubmit} aria-label="Generar plan de rutas">
        <div className="routes-form__row">
          <TextInput
            label="Fecha de servicio"
            type="date"
            min={getTodayIsoDate()}
            max={addDaysToIsoDate(getTodayIsoDate(), MAX_PLANNING_DAYS_AHEAD)}
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
            error={validation.errors['serviceDate']}
            isRequired
          />
          <TextInput
            label="Límite de capacidad por ruta"
            type="number"
            min={1}
            max={MAX_ROUTE_CAPACITY}
            value={capacityLimit}
            onChange={(event) => setCapacityLimit(event.target.value)}
            error={validation.errors['capacityLimit']}
            isRequired
          />
        </div>

        <div className="routes-form__actions">
          <Button type="submit" variant="primary" isLoading={isPlanning} disabled={!validation.isValid}>
            Generar planificación
          </Button>
        </div>
      </form>

      <section className="routes-preview" aria-label="Vista previa de la planificación" aria-live="polite">
        <h4 className="routes-preview__title">Vista previa</h4>
        {isPreviewing && preview === null && <p className="routes-preview__hint">Calculando...</p>}
        {previewError && <p className="routes-preview__error" role="alert">{previewError}</p>}
        {preview !== null && preview.totalOrders === 0 && (
          <p className="routes-preview__hint">No hay pedidos pendientes para el {preview.serviceDate}: no se crearía ninguna ruta.</p>
        )}
        {preview !== null && preview.totalOrders > 0 && (
          <>
            <p className="routes-preview__summary">
              Se crearían <strong>{preview.totalRoutes}</strong> {preview.totalRoutes === 1 ? 'ruta' : 'rutas'} con{' '}
              <strong>{preview.totalOrders}</strong> {preview.totalOrders === 1 ? 'pedido' : 'pedidos'}.
            </p>
            <ul className="routes-preview__zones">
              {preview.zones.map((zone) => (
                <li key={zone.zoneId}>
                  <strong>{zone.zoneName}</strong>: {zone.orders} {zone.orders === 1 ? 'pedido' : 'pedidos'} en {zone.routes}{' '}
                  {zone.routes === 1 ? 'ruta' : 'rutas'} ({zone.routeSizes.join(' + ')})
                </li>
              ))}
            </ul>
            <p className={preview.availableCouriers < preview.totalRoutes ? 'routes-preview__warn' : 'routes-preview__hint'}>
              Repartidores disponibles ahora: {preview.availableCouriers}.
              {preview.availableCouriers < preview.totalRoutes &&
                ' Hay menos que rutas: las rutas se crean igual y las asignas en Despacho cuando haya repartidores.'}
            </p>
          </>
        )}
      </section>

      {planError && (
        <Alert type="error" title="No se pudo planificar" onClose={onClearFeedback}>
          {planError}
        </Alert>
      )}

      {planSuccess && planResult && (
        <Alert type="success" title="Planificación generada" onClose={onClearFeedback}>
          <p>
            {planSuccess} para el día <strong>{planResult.serviceDate}</strong>.
          </p>
          {planResult.routeIds.length > 0 ? (
            <ul className="routes-plan-result" aria-label="Rutas generadas">
              {planResult.routeIds.map((routeId) => (
                <li key={routeId}>
                  <ShortIdBadge id={routeId} prefix="RUT" />
                </li>
              ))}
            </ul>
          ) : (
            <p>No se generaron rutas nuevas para esa fecha.</p>
          )}
        </Alert>
      )}
    </Card>
  );
};

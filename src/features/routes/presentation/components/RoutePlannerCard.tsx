import { useState, type FC, type FormEvent } from 'react';
import {
  getTodayIsoDate,
  validatePlanRoutesInput,
  type PlanRoutesInput,
  type PlanRoutesResult,
} from '../../domain/index.js';
import { Alert, Button, Card, ShortIdBadge, TextInput } from '../../../../shared/ui/index.js';

export interface RoutePlannerCardProps {
  isPlanning: boolean;
  planError: string | null;
  planSuccess: string | null;
  planResult: PlanRoutesResult | null;
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
  onPlan,
  onClearFeedback,
}) => {
  const [serviceDate, setServiceDate] = useState(readInitialServiceDate);
  const [capacityLimit, setCapacityLimit] = useState(DEFAULT_CAPACITY_LIMIT);

  const validation = validatePlanRoutesInput({ serviceDate, capacityLimit: Number(capacityLimit) });

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
            value={serviceDate}
            onChange={(event) => setServiceDate(event.target.value)}
            error={validation.errors['serviceDate']}
            isRequired
          />
          <TextInput
            label="Límite de capacidad por ruta"
            type="number"
            min={1}
            max={2147483647}
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

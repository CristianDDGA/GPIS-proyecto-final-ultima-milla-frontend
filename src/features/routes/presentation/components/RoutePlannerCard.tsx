import { useState, type FC, type FormEvent } from 'react';
import {
  getTodayIsoDate,
  validatePlanRoutesInput,
  type PlanRoutesInput,
  type PlanRoutesResult,
} from '../../domain/index.js';
import { Alert, Button, Card, TextInput } from '../../../../shared/ui/index.js';

export interface RoutePlannerCardProps {
  isPlanning: boolean;
  planError: string | null;
  planSuccess: string | null;
  planResult: PlanRoutesResult | null;
  onPlan: (input: PlanRoutesInput) => Promise<PlanRoutesResult | null>;
  onClearFeedback: () => void;
}

const DEFAULT_CAPACITY_LIMIT = '4';

export const RoutePlannerCard: FC<RoutePlannerCardProps> = ({
  isPlanning,
  planError,
  planSuccess,
  planResult,
  onPlan,
  onClearFeedback,
}) => {
  const [serviceDate, setServiceDate] = useState(getTodayIsoDate);
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
      <h3 className="routes-operation-card__title">Generar Plan de Rutas (POST /route-plans)</h3>
      <p className="routes-operation-card__hint">
        Agrupa los pedidos pendientes por zona y hora de entrega en rutas con capacidad limitada.
      </p>

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
                  <code>{routeId}</code>
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

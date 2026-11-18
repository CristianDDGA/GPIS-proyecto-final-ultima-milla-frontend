import { useMemo, type FC } from 'react';
import type { Courier } from '../../../couriers/domain/index.js';
import type { DeliveryActor } from './DeliveryExecutionView.js';
import { Alert, Button, Card, Select } from '../../../../shared/ui/index.js';

export interface CourierOperationCardProps {
  readonly actor: DeliveryActor;
  readonly couriers: readonly Courier[];
  readonly selectedCourierId: string;
  readonly effectiveCourierId: string;
  readonly isLoadingCouriers: boolean;
  readonly couriersError: string | null;
  readonly courierAvailability: boolean | null;
  readonly isUpdatingAvailability: boolean;
  readonly onSelectCourier: (courierId: string) => void;
  readonly onRefreshCouriers: () => void;
  readonly onSetAvailability: (available: boolean) => void;
}

export const CourierOperationCard: FC<CourierOperationCardProps> = ({
  actor,
  couriers,
  selectedCourierId,
  effectiveCourierId,
  isLoadingCouriers,
  couriersError,
  courierAvailability,
  isUpdatingAvailability,
  onSelectCourier,
  onRefreshCouriers,
  onSetAvailability,
}) => {
  const courierOptions = useMemo(
    () =>
      couriers.map((courier) => ({
        value: courier.id,
        label: `${courier.displayName} · ${courier.isAvailable ? 'Disponible' : 'No disponible'}`,
      })),
    [couriers],
  );

  const availabilityBadge =
    courierAvailability === null
      ? {
          label: actor.role === 'repartidor' ? 'Por confirmar' : 'Sin seleccionar',
          modifier: 'neutral',
        }
      : courierAvailability
        ? { label: 'Disponible', modifier: 'disponible' }
        : { label: 'No disponible', modifier: 'no_disponible' };

  return (
    <Card variant="elevated" className="deliveries-identity-card">
      <h3 className="deliveries-card__title">
        {actor.role === 'repartidor' ? 'Mi perfil de reparto' : 'Repartidor en operación'}
      </h3>

      {actor.role === 'personal' ? (
        <>
          <Select
            label="Repartidor"
            placeholder={
              isLoadingCouriers ? 'Cargando repartidores...' : 'Selecciona un repartidor'
            }
            options={courierOptions}
            value={selectedCourierId}
            onChange={(event) => onSelectCourier(event.target.value)}
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
              onClick={onRefreshCouriers}
            >
              ↻ Actualizar catálogo
            </Button>
          </div>
        </>
      ) : (
        <div className="deliveries-identity-summary">
          <p className="deliveries-identity-summary__name">
            {actor.displayName ?? 'Repartidor en sesión'}
          </p>
          <p className="deliveries-identity-summary__meta">
            Perfil de reparto vinculado a la sesión activa.
          </p>
        </div>
      )}

      <div className="deliveries-availability">
        <div className="deliveries-availability__status">
          <span className="deliveries-availability__label">Disponibilidad operativa</span>
          <span className={`deliveries-status-badge deliveries-status-badge--${availabilityBadge.modifier}`}>
            {availabilityBadge.label}
          </span>
        </div>

        {actor.role === 'repartidor' && effectiveCourierId.length > 0 && (
          <div className="deliveries-availability__controls">
            {courierAvailability === null ? (
              <>
                <p className="deliveries-availability__hint">
                  Define explícitamente si estás disponible para recibir nuevas rutas asignadas.
                </p>
                <div className="deliveries-availability__buttons">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    isLoading={isUpdatingAvailability}
                    disabled={isUpdatingAvailability}
                    onClick={() => onSetAvailability(true)}
                  >
                    Marcar disponible
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isLoading={isUpdatingAvailability}
                    disabled={isUpdatingAvailability}
                    onClick={() => onSetAvailability(false)}
                  >
                    No disponible
                  </Button>
                </div>
              </>
            ) : (
              <div className="deliveries-availability__buttons">
                <Button
                  type="button"
                  variant={courierAvailability ? 'outline' : 'primary'}
                  size="sm"
                  aria-pressed={courierAvailability}
                  isLoading={isUpdatingAvailability}
                  disabled={isUpdatingAvailability}
                  onClick={() => onSetAvailability(!courierAvailability)}
                >
                  {courierAvailability ? 'Marcar no disponible' : 'Marcar disponible'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

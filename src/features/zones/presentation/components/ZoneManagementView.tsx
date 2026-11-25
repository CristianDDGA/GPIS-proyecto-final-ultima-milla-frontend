import { useMemo, useState, type FC } from 'react';
import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import { describeCoverage, isZoneActive, type Zone, type ZoneRepository } from '../../domain/index.js';
import { defaultZoneRepository, HttpZoneRepository } from '../../infrastructure/http/index.js';
import { useZones } from '../hooks/useZones.js';
import { ZoneForm } from './ZoneForm.js';
import { ZoneList } from './ZoneList.js';
import { ZoneCoverageEditor } from './ZoneCoverageEditor.js';
import {
  Alert,
  Button,
  Card,
  KineticHeader,
  Modal,
  ShortIdBadge,
  Spinner,
} from '../../../../shared/ui/index.js';
import '../styles/zones.css';

export interface ZoneManagementViewProps {
  httpClient?: HttpClient | undefined;
  canCreateZone?: boolean | undefined;
  /** Pedidos ya cargados por el composition root; sólo se usa zoneId. */
  orders?: readonly { readonly zoneId: string }[] | undefined;
  /** Navegación guiada del pipeline: Pedidos filtrados por la zona inspeccionada. */
  onNavigateToOrders?: ((zoneId: string) => void) | undefined;
}

function formatUtcTimestamp(isoDateString: string): string {
  const date = new Date(isoDateString);
  if (Number.isNaN(date.getTime())) return isoDateString;
  const formatted = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(date);
  return `${formatted} UTC`;
}

interface ZoneDetailPanelProps {
  zone: Zone;
  orderCount: number;
  onNavigateToOrders?: ((zoneId: string) => void) | undefined;
  onClose: () => void;
}

const ZoneDetailPanel: FC<ZoneDetailPanelProps> = ({
  zone,
  orderCount,
  onNavigateToOrders,
  onClose,
}) => (
  <Card variant="outlined" className="zones-detail-card" aria-labelledby="zones-detail-title">
    <div className="zones-detail-card__header">
      <h3 id="zones-detail-title" className="zones-detail-card__title">
        Detalle de zona
      </h3>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Cerrar
      </Button>
    </div>

    <div className="zones-detail-card__hero">
      <div className="zones-detail-card__hero-text">
        <p className="zones-detail-card__kicker">Área de cobertura</p>
        <p className="zones-detail-card__name">{zone.name}</p>
        <p className="zones-detail-card__stats">
          <strong>{orderCount}</strong> {orderCount === 1 ? 'pedido asociado' : 'pedidos asociados'}
        </p>
      </div>
    </div>

    <dl className="zones-detail-list">
      <div className="zones-detail-item">
        <dt>Nombre</dt>
        <dd>{zone.name}</dd>
      </div>
      <div className="zones-detail-item">
        <dt>Cobertura</dt>
        <dd>{describeCoverage(zone.coverage)}</dd>
      </div>
      <div className="zones-detail-item">
        <dt>Código</dt>
        <dd>
          <ShortIdBadge id={zone.id} prefix="ZON" ariaLabel={`Copiar el identificador de la zona ${zone.name}`} />
        </dd>
      </div>
      <div className="zones-detail-item">
        <dt>Fecha de creación</dt>
        <dd>
          <time dateTime={zone.createdAt}>{formatUtcTimestamp(zone.createdAt)}</time>
        </dd>
      </div>
      <div className="zones-detail-item">
        <dt>Última actualización</dt>
        <dd>
          <time dateTime={zone.updatedAt}>{formatUtcTimestamp(zone.updatedAt)}</time>
        </dd>
      </div>
    </dl>

    {onNavigateToOrders !== undefined && (
      <div className="zones-detail-card__actions">
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={() => onNavigateToOrders(zone.id)}
        >
          Ver pedidos de esta zona →
        </Button>
      </div>
    )}
  </Card>
);

export const ZoneManagementView: FC<ZoneManagementViewProps> = ({
  httpClient,
  canCreateZone = true,
  orders,
  onNavigateToOrders,
}) => {
  const repository = useMemo<ZoneRepository>(
    () => (httpClient ? new HttpZoneRepository(httpClient) : defaultZoneRepository),
    [httpClient],
  );

  const {
    zones,
    isLoading,
    isCreating,
    error,
    successMessage,
    selectedZone,
    isLoadingDetail,
    detailError,
    loadZones,
    createZone,
    setCoverage,
    setActive,
    clearFeedback,
    inspectZone,
    clearSelectedZone,
  } = useZones(repository);

  const [coverageZone, setCoverageZone] = useState<Zone | null>(null);
  const [zoneToDeactivate, setZoneToDeactivate] = useState<Zone | null>(null);
  const [isChangingState, setIsChangingState] = useState(false);

  /** Reactivar es inmediato; desactivar pide confirmación porque la zona deja de recibir pedidos. */
  const handleToggleActive = (zone: Zone) => {
    if (isZoneActive(zone)) {
      setZoneToDeactivate(zone);
      return;
    }
    void setActive(zone, true);
  };

  const confirmDeactivate = async () => {
    if (zoneToDeactivate === null) return;
    setIsChangingState(true);
    try {
      await setActive(zoneToDeactivate, false);
    } finally {
      setIsChangingState(false);
      setZoneToDeactivate(null);
    }
  };

  const isDetailVisible = isLoadingDetail || selectedZone !== null || detailError !== null;

  const orderCountByZone = useMemo(() => {
    const counts = new Map<string, number>();
    for (const order of orders ?? []) {
      counts.set(order.zoneId, (counts.get(order.zoneId) ?? 0) + 1);
    }
    return counts;
  }, [orders]);

  return (
    <section className="zones-layout" aria-labelledby="zones-view-title">
      <KineticHeader
        id="zones-view-title"
        level="h2"
        title="Zonas de cobertura"
        actions={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isLoading}
            onClick={() => void loadZones()}
            aria-label="Refrescar lista de zonas"
          >
            {isLoading ? 'Actualizando...' : '↻ Actualizar'}
          </Button>
        }
      />

      {error && (
        <Alert type="error" title="Atención" onClose={clearFeedback}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert type="success" title="Operación exitosa" onClose={clearFeedback}>
          {successMessage}
        </Alert>
      )}

      {isDetailVisible && (
        <div className="zones-detail-region" aria-live="polite">
          {isLoadingDetail && (
            <Card variant="outlined" className="zones-detail-card">
              <div className="zones-loading-container" role="status">
                <Spinner size="md" label="Cargando detalle de la zona..." />
                <p>Consultando detalle de la zona...</p>
              </div>
            </Card>
          )}

          {!isLoadingDetail && detailError && (
            <Alert type="error" title="Detalle no disponible" onClose={clearSelectedZone}>
              {detailError}
            </Alert>
          )}

          {!isLoadingDetail && !detailError && selectedZone && (
            <ZoneDetailPanel
              zone={selectedZone}
              orderCount={orderCountByZone.get(selectedZone.id) ?? 0}
              onNavigateToOrders={onNavigateToOrders}
              onClose={clearSelectedZone}
            />
          )}
        </div>
      )}

      <div className={`zones-grid${canCreateZone ? '' : ' zones-grid--single'}`}>
        {canCreateZone && (
          <Card variant="elevated" className="zones-form-card">
            <h3 className="zones-form-card__title">Registrar nueva zona</h3>
            <ZoneForm onSubmit={createZone} isSubmitting={isCreating} />
          </Card>
        )}

        <Card variant="elevated" className="zones-list-card">
          <div className="zones-list-card__header">
            <h3 className="zones-list-card__title">Zonas operativas</h3>
            <span className="zones-badge-count">
              {zones.length} {zones.length === 1 ? 'zona' : 'zonas'}
            </span>
          </div>

          <ZoneList
            zones={zones}
            isLoading={isLoading}
            orderCountByZone={orderCountByZone}
            onSelectZone={inspectZone}
            onEditCoverage={canCreateZone ? setCoverageZone : undefined}
            onToggleActive={canCreateZone ? handleToggleActive : undefined}
          />
        </Card>
      </div>

      {zoneToDeactivate && (
        <Modal
          title={`Desactivar ${zoneToDeactivate.name}`}
          description="La zona dejará de recibir pedidos y de entrar en la planificación. Conserva su cobertura y su historial, y puedes activarla de nuevo. Si tiene rutas o pedidos abiertos, el sistema no lo permitirá."
          size="sm"
          onClose={() => !isChangingState && setZoneToDeactivate(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isChangingState} onClick={() => setZoneToDeactivate(null)}>
                Cancelar
              </Button>
              <Button type="button" variant="danger" size="sm" isLoading={isChangingState} onClick={() => void confirmDeactivate()}>
                Desactivar zona
              </Button>
            </>
          }
        >
          <p className="zones-form__hint">¿Seguro que quieres desactivar la zona &quot;{zoneToDeactivate.name}&quot;?</p>
        </Modal>
      )}

      {coverageZone && (
        <ZoneCoverageEditor
          zone={zones.find((zone) => zone.id === coverageZone.id) ?? coverageZone}
          zones={zones}
          onSave={setCoverage}
          onClose={() => setCoverageZone(null)}
        />
      )}
    </section>
  );
};

import type { FC } from 'react';
import type { HealthStatus } from '../../../domain/index.js';
import { MillastBrandGlyph } from './AuthIcons.js';

export interface AuthTopNavProps {
  readonly healthStatus?: HealthStatus | undefined;
}

const HEALTH_LABEL: Record<HealthStatus, string> = {
  online: 'Sistema operativo',
  checking: 'Verificando API…',
  offline: 'Sin conexión API',
};

/**
 * Cabecera superior cápsula Waterline unificada con la barra de los dashboards:
 * emblema circular #1668f3 + wordmark Millast + estado de servicio en vivo.
 */
export const AuthTopNav: FC<AuthTopNavProps> = ({ healthStatus }) => (
  <header className="mlg-header mlg-enter mlg-delay-1">
    <div className="mlg-header-pill">
      <div className="mlg-brand">
        <div className="mlg-brand__badge" aria-hidden="true">
          <MillastBrandGlyph />
        </div>
        <div className="mlg-brand__copy">
          <span className="mlg-brand__name">Millast</span>
          <span className="mlg-brand__tag">Última milla · Ecuador</span>
        </div>
      </div>

      {healthStatus && (
        <span
          className={`mlg-health-pill mlg-health-pill--${healthStatus}`}
          role="status"
          aria-live="polite"
        >
          <span className="mlg-health-pill__dot" aria-hidden="true" />
          <span>{HEALTH_LABEL[healthStatus]}</span>
        </span>
      )}
    </div>
  </header>
);

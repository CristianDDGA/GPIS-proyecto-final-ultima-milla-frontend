import type { FC, ReactNode } from 'react';
import './KpiStrip.css';

export type KpiTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red';

export interface KpiItem {
  readonly label: string;
  readonly value: string | number;
  readonly hint?: string | undefined;
  readonly tone?: KpiTone | undefined;
  readonly icon?: ReactNode | undefined;
}

export interface KpiStripProps {
  readonly items: readonly KpiItem[];
  readonly ariaLabel?: string | undefined;
}

/** Franja de métricas operativas canónica para todos los roles de Millast. */
export const KpiStrip: FC<KpiStripProps> = ({
  items,
  ariaLabel = 'Resumen de métricas',
}) => (
  <div className="wl-kpi-strip" role="region" aria-label={ariaLabel}>
    {items.map((item) => (
      <article
        key={item.label}
        className={`wl-kpi-tile ${item.tone ? `wl-kpi-tile--${item.tone}` : ''}`.trim()}
      >
        <div className="wl-kpi-tile__top">
          <span className="wl-kpi-tile__label">{item.label}</span>
          {item.icon && (
            <span className="wl-kpi-tile__icon" aria-hidden="true">
              {item.icon}
            </span>
          )}
        </div>
        <strong className="wl-kpi-tile__value">{item.value}</strong>
        {item.hint && <span className="wl-kpi-tile__hint">{item.hint}</span>}
      </article>
    ))}
  </div>
);

import type { FC, ReactNode } from 'react';
import './SectionHeader.css';

export interface SectionHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string | undefined;
  readonly actions?: ReactNode | undefined;
  readonly metrics?: ReactNode | undefined;
}

/**
 * Cabecera de vista AuthKit: eyebrow monoespaciado con líneas desvanecidas,
 * titular Space Grotesk 500 y ranura para acciones/métricas tabulares.
 */
export const SectionHeader: FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  metrics,
}) => (
  <header className="mk-section-header">
    <div className="mk-section-header__main">
      <p className="mk-eyebrow">{eyebrow}</p>
      <h2 className="mk-section-header__title">{title}</h2>
      {description !== undefined && description.length > 0 && (
        <p className="mk-section-header__description">{description}</p>
      )}
    </div>

    {(actions !== undefined || metrics !== undefined) && (
      <div className="mk-section-header__aside">
        {metrics !== undefined && <div className="mk-section-header__metrics">{metrics}</div>}
        {actions !== undefined && <div className="mk-section-header__actions">{actions}</div>}
      </div>
    )}
  </header>
);

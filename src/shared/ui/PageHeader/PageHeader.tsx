import type { FC, ReactNode } from 'react';
import './PageHeader.css';

export interface PageHeaderProps {
  readonly id?: string | undefined;
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly actions?: ReactNode | undefined;
  readonly badge?: ReactNode | undefined;
}

/**
 * Cabecera canónica unificada para todas las vistas de Admin, Repartidor y Cliente.
 * Reemplaza la convivencia desigual entre KineticHeader (22px sin divisor) y SectionHeader.
 */
export const PageHeader: FC<PageHeaderProps> = ({
  id,
  eyebrow,
  title,
  subtitle,
  actions,
  badge,
}) => (
  <header className="wl-page-header">
    <div className="wl-page-header__main">
      {eyebrow && <p className="wl-page-header__eyebrow">{eyebrow}</p>}
      <div className="wl-page-header__title-row">
        <h2 id={id} className="wl-page-header__title">
          {title}
        </h2>
        {badge}
      </div>
      {subtitle && <p className="wl-page-header__subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="wl-page-header__actions">{actions}</div>}
  </header>
);

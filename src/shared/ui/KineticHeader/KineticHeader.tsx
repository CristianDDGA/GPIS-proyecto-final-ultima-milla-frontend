import type { FC, ReactNode } from 'react';
import './KineticHeader.css';

export interface KineticHeaderProps {
  readonly title: string;
  readonly eyebrow?: string | undefined;
  readonly description?: string | undefined;
  /** 'h1' para portada, 'h2' para las cabeceras de módulo. */
  readonly level?: 'h1' | 'h2' | 'h3' | undefined;
  /** Control de etiqueta para asociar el encabezado a la sección (aria-labelledby). */
  readonly id?: string | undefined;
  /** Acciones alineadas a la derecha: refrescar, KPI o CTA del flujo. */
  readonly actions?: ReactNode | undefined;
  readonly className?: string | undefined;
}

/**
 * Cabecera de módulo operativa Millast (Operate mode):
 * legible e instantánea sin cascada repetitiva de palabras al cambiar de pestaña.
 */
export const KineticHeader: FC<KineticHeaderProps> = ({
  title,
  eyebrow,
  description,
  level = 'h2',
  id,
  actions,
  className = '',
}) => {
  const Heading = level;

  return (
    <header className={`kinetic-header ${className}`.trim()}>
      <div className="kinetic-header__main">
        {eyebrow !== undefined && eyebrow.length > 0 && (
          <p className="kinetic-header__eyebrow">{eyebrow}</p>
        )}

        <Heading id={id} className="kinetic-header__title">
          {title}
        </Heading>

        {description !== undefined && description.length > 0 && (
          <p className="kinetic-header__description">{description}</p>
        )}
      </div>

      {actions !== undefined && <div className="kinetic-header__actions">{actions}</div>}
    </header>
  );
};

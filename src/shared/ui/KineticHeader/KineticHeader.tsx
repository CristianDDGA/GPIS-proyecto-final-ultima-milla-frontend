import { Fragment, type FC, type ReactNode } from 'react';
import './KineticHeader.css';

export interface KineticHeaderProps {
  /** Título principal que se revela palabra por palabra. */
  readonly title: string;
  readonly eyebrow?: string | undefined;
  readonly description?: string | undefined;
  /** 'h1' para la portada, 'h2' para las cabeceras de módulo. */
  readonly level?: 'h1' | 'h2' | 'h3' | undefined;
  /** Control de etiqueta para asociar el encabezado a la sección (aria-labelledby). */
  readonly id?: string | undefined;
  /** Acciones alineadas a la derecha: refrescar, KPI o CTA del flujo. */
  readonly actions?: ReactNode | undefined;
  readonly className?: string | undefined;
}

/**
 * Cabecera cinética Webflow Studio (DESIGN.md):
 * revela el título palabra por palabra con tipografía Inter (peso 600).
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
  const words = title.split(' ').filter((word) => word.length > 0);

  return (
    <header className={`kinetic-header ${className}`.trim()}>
      <div className="kinetic-header__main">
        {eyebrow !== undefined && eyebrow.length > 0 && (
          <p className="kinetic-header__eyebrow">{eyebrow}</p>
        )}

        <Heading id={id} className="kinetic-header__title">
          {words.map((word, index) => (
            <Fragment key={`${title}-${word}-${index}`}>
              <span
                className="kinetic-header__word"
                style={{ animationDelay: `${index * 22}ms` }}
              >
                {word}
              </span>
              {index < words.length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </Heading>

        {description !== undefined && description.length > 0 && (
          <p className="kinetic-header__description">{description}</p>
        )}
      </div>

      {actions !== undefined && <div className="kinetic-header__actions">{actions}</div>}
    </header>
  );
};

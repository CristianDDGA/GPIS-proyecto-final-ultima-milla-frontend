import { Fragment, type FC, type ReactNode } from 'react';
import './SectionHeader.css';

export interface SectionHeaderProps {
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly actions?: ReactNode | undefined;
  readonly metrics?: ReactNode | undefined;
}

/**
 * Cabecera de vista Webflow Studio (DESIGN.md) con Tipografía Cinética:
 * eyebrow opcional (13px uppercase +0.1em #5a5a5a), título revelado palabra por
 * palabra en #080808 (peso 600) y ranura de acciones/métricas.
 */
export const SectionHeader: FC<SectionHeaderProps> = ({
  eyebrow,
  title,
  description,
  actions,
  metrics,
}) => {
  const words = title.split(' ').filter((word) => word.length > 0);

  return (
    <header className="wf-section-header">
      <div className="wf-section-header__main">
        {eyebrow !== undefined && eyebrow.length > 0 && (
          <p className="wf-section-header__eyebrow">{eyebrow}</p>
        )}
        <h2 className="wf-section-header__title">
          {words.map((word, index) => (
            <Fragment key={`${title}-${word}-${index}`}>
              <span
                className="wf-section-header__word"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {word}
              </span>
              {index < words.length - 1 ? ' ' : null}
            </Fragment>
          ))}
        </h2>
        {description !== undefined && description.length > 0 && (
          <p className="wf-section-header__description">{description}</p>
        )}
      </div>

      {(actions !== undefined || metrics !== undefined) && (
        <div className="wf-section-header__aside">
          {metrics !== undefined && <div className="wf-section-header__metrics">{metrics}</div>}
          {actions !== undefined && <div className="wf-section-header__actions">{actions}</div>}
        </div>
      )}
    </header>
  );
};

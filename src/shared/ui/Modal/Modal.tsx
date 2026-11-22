import { Fragment, useEffect, useRef, type FC, type ReactNode } from 'react';
import { CloseIcon } from '../Waterline/WaterlineIcons.js';
import './Modal.css';

export interface ModalProps {
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly size?: 'sm' | 'md' | 'lg' | undefined;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode | undefined;
}

/**
 * Diálogo modal Waterline Liquid Glass:
 * superficie esmerilada de 26px con backdrop-blur, cierre por Escape,
 * botón de cierre accesible y foco inicial en el primer control interactivo.
 */
export const Modal: FC<ModalProps> = ({
  eyebrow,
  title,
  description,
  size = 'md',
  onClose,
  children,
  footer,
}) => {
  const dialogRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'input, select, textarea, button:not(.wf-modal__close), [href], [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? dialog?.querySelector<HTMLElement>('.wf-modal__close'))?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const titleId = 'wf-modal-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const words = title.split(' ').filter((word) => word.length > 0);

  return (
    <div className="wf-modal-root wl-modal-host" role="presentation">
      <div className="wf-modal-backdrop" aria-hidden="true" onClick={onClose} />
      <section
        ref={dialogRef}
        className={'wf-modal wf-modal--' + size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="wf-modal__top">
          <header className="wf-modal__header">
            {eyebrow !== undefined && eyebrow.length > 0 && (
              <p className="wf-modal__eyebrow">{eyebrow}</p>
            )}
            <h2 id={titleId} className="wf-modal__title">
              {words.map((word, index) => (
                <Fragment key={`${title}-${word}-${index}`}>
                  <span
                    className="wf-modal__title-word"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    {word}
                  </span>
                  {index < words.length - 1 ? ' ' : null}
                </Fragment>
              ))}
            </h2>
            {description !== undefined && description.length > 0 && (
              <p className="wf-modal__description">{description}</p>
            )}
          </header>

          <button
            type="button"
            className="wf-modal__close"
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        <div className="wf-modal__body">{children}</div>

        {footer !== undefined && <footer className="wf-modal__actions">{footer}</footer>}
      </section>
    </div>
  );
};

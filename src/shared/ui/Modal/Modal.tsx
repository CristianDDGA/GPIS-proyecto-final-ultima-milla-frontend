import { useEffect, useRef, type FC, type ReactNode } from 'react';

export interface ModalProps {
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly size?: 'sm' | 'md' | 'lg' | undefined;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode | undefined;
}

/** Modal AuthKit: superficie profunda con foco atrapado en el primer control. */
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

  // El foco inicial ocurre una sola vez; un onClose inline no debe re-enfocar en cada tecla.
  useEffect(() => {
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>(
      'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
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

  const titleId = 'mk-modal-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="mk-modal-root" role="presentation">
      <div className="mk-modal-backdrop" aria-hidden="true" onClick={onClose} />
      <section
        ref={dialogRef}
        className={'mk-modal mk-modal--' + size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="mk-modal__header">
          {eyebrow !== undefined && <p className="mk-eyebrow">{eyebrow}</p>}
          <h2 id={titleId} className="mk-modal__title">
            {title}
          </h2>
          {description !== undefined && description.length > 0 && (
            <p className="mk-modal__description">{description}</p>
          )}
        </header>

        <div className="mk-modal__body">{children}</div>

        {footer !== undefined && <footer className="mk-modal__actions">{footer}</footer>}
      </section>
    </div>
  );
};

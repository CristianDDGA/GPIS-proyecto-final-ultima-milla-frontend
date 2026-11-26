import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from '../Waterline/WaterlineIcons.js';
import './Modal.css';

export interface ModalProps {
  readonly eyebrow?: string | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly size?: 'sm' | 'md' | 'lg' | 'xl' | undefined;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer?: ReactNode | undefined;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Diálogo modal Waterline Liquid Glass (WCAG 2.2 AA):
 * portal en document.body, focus trap cíclico (Tab / Shift+Tab), cierre por Escape,
 * bloqueo de scroll del documento y restauración exacta del foco al cerrar.
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
    const previouslyFocused =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const dialog = dialogRef.current;
    const focusables = dialog
      ? Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      : [];
    const firstNonClose = focusables.find((el) => !el.classList.contains('wf-modal__close'));
    (firstNonClose ?? focusables[0] ?? dialog)?.focus();

    const prevOverflow = typeof document !== 'undefined' ? document.body.style.overflow : '';
    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
      document.body.dataset.modalOpen = 'true';
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && dialog) {
        const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => el.offsetParent !== null || el.getClientRects().length > 0,
        );
        if (items.length === 0) {
          event.preventDefault();
          dialog.focus();
          return;
        }
        const first = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || !dialog.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else if (active === last || !dialog.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (typeof document !== 'undefined') {
        document.body.style.overflow = prevOverflow;
        delete document.body.dataset.modalOpen;
      }
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const titleId = 'wf-modal-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const modalNode = (
    <div className="wf-modal-root wl-modal-host" role="presentation">
      <div className="wf-modal-backdrop" aria-hidden="true" onClick={onClose} />
      <section
        ref={dialogRef}
        tabIndex={-1}
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
              {title}
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

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};

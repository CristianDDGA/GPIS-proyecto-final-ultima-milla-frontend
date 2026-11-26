import { useEffect, useRef, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Alert.css';

export interface AlertProps {
  type?: 'info' | 'success' | 'error' | 'warning' | undefined;
  title?: string | undefined;
  children: ReactNode;
  /**
   * Si se entrega, el aviso se muestra como ventana centrada sobre la pantalla
   * (así el usuario lo ve aunque esté al final de la página). Sin `onClose`
   * el aviso queda en línea, dentro de su tarjeta.
   */
  onClose?: (() => void) | undefined;
  /** Fuerza el aviso en línea aunque tenga `onClose`. */
  inline?: boolean | undefined;
}

const ICONS: Record<NonNullable<AlertProps['type']>, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export const Alert: FC<AlertProps> = ({
  type = 'info',
  title,
  children,
  onClose,
  inline = false,
}) => {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isDialog = onClose !== undefined && !inline && typeof document !== 'undefined';

  useEffect(() => {
    if (!isDialog) return undefined;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        onCloseRef.current?.();
      }
    };
    // Captura: el aviso se cierra primero, sin cerrar la ventana que tenga debajo.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isDialog]);

  if (isDialog) {
    return createPortal(
      <div className="ui-notice-root">
        <div className="ui-notice-backdrop" aria-hidden="true" onClick={onClose} />
        <div
          className={`ui-notice ui-notice--${type}`}
          role={type === 'error' ? 'alertdialog' : 'dialog'}
          aria-modal="true"
          aria-label={title ?? 'Aviso'}
        >
          <div className="ui-notice__icon" aria-hidden="true">
            {ICONS[type]}
          </div>
          {title && <strong className="ui-notice__title">{title}</strong>}
          <div className="ui-notice__content">{children}</div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="ui-notice__button"
            aria-label="Cerrar notificación"
          >
            Entendido
          </button>
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <div
      className={`ui-alert ui-alert--${type}`}
      role={type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="ui-alert__icon" aria-hidden="true">
        {ICONS[type]}
      </div>

      <div className="ui-alert__body">
        {title && <strong className="ui-alert__title">{title}</strong>}
        <div className="ui-alert__content">{children}</div>
      </div>
    </div>
  );
};


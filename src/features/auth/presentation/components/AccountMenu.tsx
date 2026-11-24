import { useEffect, useId, useRef, useState, type FC } from 'react';
import type { AuthUser } from '../../domain/index.js';
import '../../../store/presentation/styles/client.css';

export interface AccountMenuProps {
  readonly user: AuthUser;
  readonly isLoading?: boolean | undefined;
  /** Solo el cliente tiene perfil, pedidos y postulación en el menú. */
  readonly onOpenProfile?: (() => void) | undefined;
  readonly onOpenOrders?: (() => void) | undefined;
  readonly onOpenCourierApplication?: (() => void) | undefined;
  /** Sin perfil propio (administrador y conductor) se ofrece cambiar la clave desde aquí. */
  readonly onOpenPassword?: (() => void) | undefined;
  readonly onLogout: () => void;
  /** 'dark' para la barra oscura del cliente. */
  readonly tone?: 'light' | 'dark' | undefined;
}

export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) return '·';
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Nombre corto para el saludo: el nombre de pila o, si no hay, el inicio del correo. */
export function greetingName(user: Pick<AuthUser, 'displayName' | 'email'>): string {
  const name = user.displayName?.trim() ?? '';
  if (name.length > 0) return name.split(/\s+/)[0] ?? name;
  return user.email.split('@')[0] ?? user.email;
}

/** Botón de la cuenta: avatar con iniciales y "Hola, nombre"; abre un menú con el perfil y la salida. */
export const AccountMenu: FC<AccountMenuProps> = ({
  user,
  isLoading = false,
  onOpenProfile,
  onOpenOrders,
  onOpenCourierApplication,
  onOpenPassword,
  onLogout,
  tone = 'light',
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const fullName = user.displayName?.trim() || user.email;

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (action: (() => void) | undefined) => () => {
    setOpen(false);
    action?.();
  };

  return (
    <div className="wl-header-trailing" aria-label="Mi cuenta">
      <div className={`wl-account ${tone === 'dark' ? 'wl-account--dark' : ''}`} ref={rootRef}>
        <button
          type="button"
          className="wl-account__trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={`Abrir el menú de la cuenta de ${fullName}`}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="wl-account__avatar" aria-hidden="true">
            {initialsOf(fullName)}
          </span>
          <span className="wl-account__hello">
            <small>Hola,</small>
            <strong>{greetingName(user)}</strong>
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div className="wl-account__menu" id={menuId} role="menu" aria-label="Opciones de la cuenta">
            <div className="wl-account__head">
              <span className="wl-account__avatar" aria-hidden="true">
                {initialsOf(fullName)}
              </span>
              <div>
                <p>
                  <strong>{fullName}</strong>
                </p>
                <p className="wl-account__email">{user.email}</p>
              </div>
            </div>
            {onOpenProfile && (
              <button type="button" role="menuitem" className="wl-account__item" onClick={run(onOpenProfile)}>
                Mi perfil
              </button>
            )}
            {onOpenOrders && (
              <button type="button" role="menuitem" className="wl-account__item" onClick={run(onOpenOrders)}>
                Mis pedidos
              </button>
            )}
            {onOpenCourierApplication && (
              <button type="button" role="menuitem" className="wl-account__item" onClick={run(onOpenCourierApplication)}>
                Quiero ser repartidor
              </button>
            )}
            {onOpenPassword && (
              <button type="button" role="menuitem" className="wl-account__item" onClick={run(onOpenPassword)}>
                Cambiar contraseña
              </button>
            )}
            <div className="wl-account__divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="wl-account__item wl-account__item--danger"
              disabled={isLoading}
              onClick={run(onLogout)}
            >
              {isLoading ? 'Saliendo...' : 'Cerrar sesión'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

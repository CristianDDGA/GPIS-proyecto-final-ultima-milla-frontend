import type { FC } from 'react';
import type { AuthUser } from '../../domain/index.js';
import { APP_ROLE_LABELS } from '../../domain/index.js';
import { KeyRoundIcon, LogOutIcon } from '../../../../shared/ui/index.js';

export interface SessionBarProps {
  readonly user: AuthUser;
  readonly isLoading?: boolean | undefined;
  readonly onOpenPassword: () => void;
  readonly onLogout: () => void;
}

function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (words.length === 0) {
    return '·';
  }

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Cápsula de sesión Waterline Liquid Glass: identidad, rol y acciones accesibles en todos los viewports. */
export const SessionBar: FC<SessionBarProps> = ({
  user,
  isLoading = false,
  onOpenPassword,
  onLogout,
}) => {
  const hasDisplayName = user.displayName !== null && user.displayName.trim().length > 0;
  const displayName = hasDisplayName && user.displayName !== null ? user.displayName : user.email;
  const roleLabel = APP_ROLE_LABELS[user.role];

  return (
    <div className="wl-header-trailing" aria-label="Sesión del usuario">
      <div className="wl-session-pill" title={`${displayName} · ${user.email} (${roleLabel})`}>
        <span className="wl-session-pill__avatar" aria-hidden="true">
          {initialsOf(displayName)}
        </span>
        <div className="wl-session-pill__identity">
          <span className="wl-session-pill__name">{displayName}</span>
          <span className="wl-session-pill__email">{user.email}</span>
        </div>
        <span className={`wl-session-pill__role wl-session-pill__role--${user.publicRole}`}>
          {roleLabel}
        </span>
      </div>

      <button
        type="button"
        className="wl-header-action wl-header-action--subtle"
        onClick={onOpenPassword}
        aria-label="Cambiar contraseña"
        title="Cambiar contraseña"
      >
        <KeyRoundIcon size={13} />
        <span className="wl-header-action__label wl-header-action__label--collapsible">Clave</span>
      </button>

      <button
        type="button"
        className="wl-header-action"
        onClick={onLogout}
        disabled={isLoading}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOutIcon size={13} />
        <span className="wl-header-action__label">{isLoading ? 'Saliendo...' : 'Salir'}</span>
      </button>
    </div>
  );
};

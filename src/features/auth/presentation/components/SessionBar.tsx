import type { FC } from 'react';
import type { AuthUser } from '../../domain/index.js';
import { APP_ROLE_LABELS } from '../../domain/index.js';
import { Button } from '../../../../shared/ui/index.js';

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

/** Cápsula de sesión AuthKit: identidad, rol y acciones sin ruido técnico. */
export const SessionBar: FC<SessionBarProps> = ({
  user,
  isLoading = false,
  onOpenPassword,
  onLogout,
}) => {
  const hasDisplayName = user.displayName !== null && user.displayName.trim().length > 0;
  const displayName = hasDisplayName && user.displayName !== null ? user.displayName : user.email;

  return (
    <section className="mk-session" aria-label="Cápsula de sesión del usuario">
      <span className="mk-session__avatar" aria-hidden="true">
        {initialsOf(displayName)}
      </span>
      <div className="mk-session__identity">
        <p className="mk-session__name">{displayName}</p>
        <p className="mk-session__email">{user.email}</p>
      </div>
      <span className={'mk-role mk-role--' + user.publicRole}>{APP_ROLE_LABELS[user.role]}</span>
      <div className="mk-session__actions">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenPassword}>
          Clave
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onLogout} isLoading={isLoading}>
          Salir
        </Button>
      </div>
    </section>
  );
};

import type { FC } from 'react';
import type { AuthUser, HealthStatus } from '../../domain/index.js';
import { Alert, Button } from '../../../../shared/ui/index.js';
import '../styles/auth.css';

export interface SessionBarProps {
  user: AuthUser;
  healthStatus: HealthStatus;
  isLoading?: boolean | undefined;
  verificationMessage?: string | null | undefined;
  onLogout: () => void;
  onVerifyProfile: () => void;
}

const ROLE_LABELS: Record<AuthUser['role'], string> = {
  personal: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

const HEALTH_LABELS: Record<HealthStatus, string> = {
  checking: 'Verificando',
  online: 'En línea',
  offline: 'Sin conexión',
};

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
  return `${first}${last}`.toUpperCase();
}

/**
 * Cápsula de sesión de la capa funcional flotante: identidad compacta, rol
 * semántico, estado real del servidor y acciones de sesión sin filtrar
 * identificadores técnicos ni rutas internas de la API.
 */
export const SessionBar: FC<SessionBarProps> = ({
  user,
  healthStatus,
  isLoading = false,
  verificationMessage,
  onLogout,
  onVerifyProfile,
}) => {
  const hasDisplayName = user.displayName !== null && user.displayName.trim().length > 0;
  const displayName =
    hasDisplayName && user.displayName !== null ? user.displayName : user.email;
  const initials = initialsOf(displayName);

  return (
    <section className="session-bar" aria-label="Barra de sesión del usuario">
      <div className="session-bar__identity">
        <span className="session-bar__avatar" aria-hidden="true">
          {initials}
        </span>
        <div className="session-bar__identity-text">
          <p className="session-bar__name">{displayName}</p>
          <p className="session-bar__email">{user.email}</p>
        </div>
      </div>

      <div className="session-bar__badges">
        <span className={`session-bar__role-badge session-bar__role-badge--${user.role}`}>
          {ROLE_LABELS[user.role]}
        </span>

        <span
          className={`session-bar__health session-bar__health--${healthStatus}`}
          role="status"
          aria-live="polite"
        >
          <span className="session-bar__health-dot" aria-hidden="true" />
          {HEALTH_LABELS[healthStatus]}
        </span>
      </div>

      <div className="session-bar__actions">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onVerifyProfile}
          isLoading={isLoading}
          aria-label="Validar la sesión activa contra el servidor"
        >
          Validar sesión
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onLogout}>
          Salir
        </Button>
      </div>

      {verificationMessage && verificationMessage.trim().length > 0 && (
        <div className="session-bar__verification">
          <Alert type="success" title="Perfil verificado" onClose={onVerifyProfile}>
            {verificationMessage}
          </Alert>
        </div>
      )}
    </section>
  );
};

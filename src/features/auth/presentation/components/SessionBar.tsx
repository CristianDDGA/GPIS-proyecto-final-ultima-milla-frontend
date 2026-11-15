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
  checking: 'Verificando servidor...',
  online: 'Servidor en línea',
  offline: 'Servidor sin conexión',
};

export const SessionBar: FC<SessionBarProps> = ({
  user,
  healthStatus,
  isLoading = false,
  verificationMessage,
  onLogout,
  onVerifyProfile,
}) => {
  const hasDisplayName = user.displayName !== null && user.displayName.trim().length > 0;
  const displayName = hasDisplayName ? user.displayName : user.email;

  return (
    <section className="session-bar" aria-label="Barra de sesión del usuario">
      <div className="session-bar__identity">
        <p className="session-bar__eyebrow">Sesión activa</p>
        <p className="session-bar__name">{displayName}</p>
        <p className="session-bar__email">{user.email}</p>
      </div>

      <div className="session-bar__badges">
        <span className={`session-bar__role-badge session-bar__role-badge--${user.role}`}>
          {ROLE_LABELS[user.role]}
        </span>

        {user.role === 'repartidor' && (
          <span className="session-bar__courier">
            {user.courierId !== null && user.courierId.trim().length > 0
              ? `Repartidor: ${user.courierId}`
              : 'Sin repartidor vinculado'}
          </span>
        )}

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
          variant="secondary"
          size="sm"
          onClick={onVerifyProfile}
          isLoading={isLoading}
          aria-label="Verificar perfil de la sesión con el endpoint /auth/me"
        >
          Verificar perfil (/auth/me)
        </Button>
        <Button type="button" variant="danger" size="sm" onClick={onLogout}>
          Cerrar sesión
        </Button>
      </div>

      {verificationMessage && verificationMessage.trim().length > 0 && (
        <div className="session-bar__verification">
          <Alert type="success" title="Perfil verificado">
            {verificationMessage}
          </Alert>
        </div>
      )}
    </section>
  );
};

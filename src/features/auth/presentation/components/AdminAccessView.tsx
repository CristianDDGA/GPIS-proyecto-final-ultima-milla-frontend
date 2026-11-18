import { useState } from 'react';
import type { FC } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import type { CourierApplicationUseCases } from '../../../courier-applications/application/index.js';
import { AdminCourierApplicationsPanel } from '../../../courier-applications/presentation/components/AdminCourierApplicationsPanel.js';
import { SectionHeader } from '../../../../shared/ui/index.js';
import { AdminUserManagementView } from './AdminUserManagementView.js';

type AccessTab = 'users' | 'applications';

export interface AdminAccessViewProps {
  readonly authUseCases: AuthUseCases;
  readonly applicationUseCases: CourierApplicationUseCases;
}

/** Pestaña Accesos del administrador: directorio de cuentas + revisión de postulaciones. */
export const AdminAccessView: FC<AdminAccessViewProps> = ({ authUseCases, applicationUseCases }) => {
  const [tab, setTab] = useState<AccessTab>('users');

  return (
    <section className="mk-access" aria-labelledby="mk-access-title">
      <SectionHeader
        eyebrow="Administración"
        title="Accesos y solicitudes"
        description="Directorio de cuentas internas y revisión de postulaciones de repartidor."
        actions={
          <div className="mk-segmented" role="tablist" aria-label="Sección de administración">
            <button
              type="button"
              role="tab"
              id="mk-access-tab-users"
              aria-selected={tab === 'users'}
              className={'mk-segmented__tab ' + (tab === 'users' ? 'mk-segmented__tab--active' : '')}
              onClick={() => setTab('users')}
            >
              Usuarios
            </button>
            <button
              type="button"
              role="tab"
              id="mk-access-tab-applications"
              aria-selected={tab === 'applications'}
              className={'mk-segmented__tab ' + (tab === 'applications' ? 'mk-segmented__tab--active' : '')}
              onClick={() => setTab('applications')}
            >
              Solicitudes
            </button>
          </div>
        }
      />

      <h2 id="mk-access-title" className="mk-sr-only">
        Accesos y solicitudes
      </h2>

      {tab === 'users' ? (
        <AdminUserManagementView useCases={authUseCases} />
      ) : (
        <AdminCourierApplicationsPanel useCases={applicationUseCases} />
      )}
    </section>
  );
};

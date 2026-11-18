import { useState, type CSSProperties, type FC } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import type { CourierApplicationUseCases } from '../../../courier-applications/application/index.js';
import { AdminCourierApplicationsPanel } from '../../../courier-applications/presentation/components/AdminCourierApplicationsPanel.js';
import { SectionHeader } from '../../../../shared/ui/index.js';
import { AdminUserManagementView } from './AdminUserManagementView.js';
import '../styles/admin-access.css';

type AccessTab = 'users' | 'applications';

export interface AdminAccessViewProps {
  readonly authUseCases: AuthUseCases;
  readonly applicationUseCases: CourierApplicationUseCases;
}

/**
 * Pestaña 06 · Accesos del Administrador (Webflow Studio):
 * Directorio de cuentas internas y revisión de postulaciones con cabecera
 * cinética e indicador segmentado deslizante de 4px.
 */
export const AdminAccessView: FC<AdminAccessViewProps> = ({
  authUseCases,
  applicationUseCases,
}) => {
  const [tab, setTab] = useState<AccessTab>('users');

  const segmentedStyle = {
    '--seg-index': tab === 'users' ? 0 : 1,
    '--seg-count': 2,
  } as CSSProperties;

  return (
    <section className="wf-access" aria-labelledby="wf-access-title">
      <SectionHeader
        eyebrow="Etapa 6 · Accesos"
        title={tab === 'users' ? 'Directorio de usuarios' : 'Solicitudes de repartidor'}
        actions={
          <div
            className="segmented wf-access__tabs"
            role="tablist"
            aria-label="Sección de administración"
            style={segmentedStyle}
          >
            <span className="segmented__thumb" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              id="wf-access-tab-users"
              aria-selected={tab === 'users'}
              className={'wf-access__tab ' + (tab === 'users' ? 'wf-access__tab--active' : '')}
              onClick={() => setTab('users')}
            >
              Usuarios
            </button>
            <button
              type="button"
              role="tab"
              id="wf-access-tab-applications"
              aria-selected={tab === 'applications'}
              className={
                'wf-access__tab ' + (tab === 'applications' ? 'wf-access__tab--active' : '')
              }
              onClick={() => setTab('applications')}
            >
              Solicitudes
            </button>
          </div>
        }
      />

      <h2 id="wf-access-title" className="sr-only">
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

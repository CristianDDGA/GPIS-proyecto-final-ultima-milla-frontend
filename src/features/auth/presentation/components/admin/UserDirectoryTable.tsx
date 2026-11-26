import type { FC } from 'react';
import type { ManagedUser, PublicRole } from '../../../domain/index.js';
import { Button, EmptyState, TableRowsSkeleton } from '../../../../../shared/ui/index.js';

export const ROLE_LABELS: Record<PublicRole, string> = {
  admin: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

export function formatAdminDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date);
}

export interface UserDirectoryTableProps {
  readonly items: readonly ManagedUser[];
  readonly total: number;
  readonly offset: number;
  readonly pageSize: number;
  readonly isLoading: boolean;
  readonly onInspect: (user: ManagedUser) => void;
  readonly onToggleStatus: (user: ManagedUser) => void;
  readonly onResetPassword: (user: ManagedUser) => void;
  readonly onPageChange: (nextOffset: number) => void;
}

export const UserDirectoryTable: FC<UserDirectoryTableProps> = ({
  items,
  total,
  offset,
  pageSize,
  isLoading,
  onInspect,
  onToggleStatus,
  onResetPassword,
  onPageChange,
}) => {
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, total);

  return (
    <>
      <div className="wf-table-wrap">
        <table className="wf-table" aria-label="Directorio de usuarios">
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">Verificación</th>
              <th scope="col">Creado</th>
              <th scope="col" className="wf-table__actions-head">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="wf-table__identity">
                    <span className="wf-table__name">{user.displayName ?? user.email}</span>
                    <span className="wf-table__email">{user.email}</span>
                  </div>
                </td>
                <td>
                  <span className={'wf-badge wf-badge--role-' + user.publicRole}>
                    {ROLE_LABELS[user.publicRole]}
                  </span>
                </td>
                <td>
                  <span className={'wf-badge ' + (user.isActive ? 'wf-badge--ok' : 'wf-badge--off')}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <span
                    className={
                      'wf-badge ' + (user.emailVerified ? 'wf-badge--info' : 'wf-badge--warn')
                    }
                  >
                    {user.emailVerified ? 'Verificado' : 'Pendiente'}
                  </span>
                </td>
                <td className="wf-table__mono">{formatAdminDate(user.createdAt)}</td>
                <td>
                  <div className="wf-table__actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onInspect(user)}
                    >
                      Ver
                    </Button>
                    <Button
                      type="button"
                      variant={user.isActive ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => onToggleStatus(user)}
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onResetPassword(user)}
                    >
                      Clave
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && items.length === 0 && (
          <EmptyState
            title="Sin usuarios"
            description="No hay cuentas que coincidan con los filtros activos."
          />
        )}

        {isLoading && items.length === 0 && (
          <TableRowsSkeleton rows={5} label="Consultando el directorio de usuarios..." />
        )}
      </div>

      <footer className="wf-pagination">
        <span className="wf-pagination__info">
          {rangeStart}–{rangeEnd} de {total}
        </span>
        <div className="wf-pagination__actions">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={offset === 0 || isLoading}
            onClick={() => onPageChange(Math.max(0, offset - pageSize))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={offset + pageSize >= total || isLoading}
            onClick={() => onPageChange(offset + pageSize)}
          >
            Siguiente
          </Button>
        </div>
      </footer>
    </>
  );
};

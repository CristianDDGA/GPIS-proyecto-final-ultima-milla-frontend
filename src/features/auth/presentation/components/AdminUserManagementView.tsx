import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { FC } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  validateCreateManagedUserInput,
  validateResetManagedUserPasswordInput,
  type ManagedUser,
  type ManagedUserFilters,
  type PublicRole,
} from '../../domain/index.js';
import {
  Alert,
  Button,
  EmptyState,
  Modal,
  Select,
  ShortIdBadge,
  TextInput,
} from '../../../../shared/ui/index.js';

const PAGE_SIZE = 10;

const ROLE_OPTIONS = [
  { value: 'all', label: 'Todos los roles' },
  { value: 'admin', label: 'Administrador' },
  { value: 'repartidor', label: 'Repartidor' },
  { value: 'cliente', label: 'Cliente' },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

const ROLE_LABELS: Record<PublicRole, string> = {
  admin: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

const VERIFIED_VIA_LABELS: Record<string, string> = {
  code: 'Código de correo',
  admin: 'Verificado por admin',
  legacy: 'Cuenta heredada',
  demo: 'Modo demo',
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date);
}

export const AdminUserManagementView: FC<{ useCases: AuthUseCases }> = ({ useCases }) => {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState<ManagedUserFilters>({});
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<readonly ManagedUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createDisplayName, setCreateDisplayName] = useState('');
  const [createRole, setCreateRole] = useState<PublicRole>('repartidor');
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [isCreating, setIsCreating] = useState(false);

  const [detailUser, setDetailUser] = useState<ManagedUser | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [toggleUser, setToggleUser] = useState<ManagedUser | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);

  const [resetUser, setResetUser] = useState<ManagedUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetErrors, setResetErrors] = useState<Record<string, string>>({});
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadPage = useCallback(
    async (filters: ManagedUserFilters) => {
      setIsLoading(true);
      setRequestError(null);
      try {
        const page = await useCases.listManagedUsers.execute({
          ...filters,
          limit: PAGE_SIZE,
          offset: filters.offset ?? 0,
        });
        if (!mountedRef.current) {
          return;
        }
        setItems(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (error_) {
        if (mountedRef.current) {
          setRequestError(toErrorMessage(error_, 'No se pudo cargar el directorio de usuarios.'));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [useCases],
  );

  useEffect(() => {
    void loadPage({ ...appliedFilters, offset: 0 });
  }, [appliedFilters, loadPage]);

  const applyFilters = (): void => {
    setAppliedFilters({
      ...(roleFilter !== 'all' ? { role: roleFilter as PublicRole } : {}),
      ...(statusFilter === 'true' || statusFilter === 'false'
        ? { isActive: statusFilter === 'true' }
        : {}),
      ...(query.trim().length > 0 ? { q: query.trim() } : {}),
    });
  };

  const clearFilters = (): void => {
    setQuery('');
    setRoleFilter('all');
    setStatusFilter('all');
    setAppliedFilters({});
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setCreateErrors({});
    const input = {
      email: createEmail,
      password: createPassword,
      role: createRole,
      displayName: createDisplayName.trim().length === 0 ? null : createDisplayName,
    };
    const validation = validateCreateManagedUserInput(input);
    if (!validation.isValid) {
      setCreateErrors(validation.errors);
      return;
    }

    setIsCreating(true);
    try {
      const created = await useCases.createManagedUser.execute(input);
      setIsCreateOpen(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateDisplayName('');
      setCreateRole('repartidor');
      setNotice('Usuario ' + created.email + ' creado correctamente.');
      await loadPage({ ...appliedFilters, offset: 0 });
    } catch (error_) {
      setCreateErrors({ form: toErrorMessage(error_, 'No se pudo crear el usuario.') });
    } finally {
      setIsCreating(false);
    }
  };

  const openDetail = async (user: ManagedUser): Promise<void> => {
    setDetailUser(user);
    setDetailError(null);
    setIsDetailLoading(true);
    try {
      const detail = await useCases.getManagedUser.execute(user.id);
      if (mountedRef.current) {
        setDetailUser(detail);
      }
    } catch (error_) {
      if (mountedRef.current) {
        setDetailError(toErrorMessage(error_, 'No se pudo consultar el usuario.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsDetailLoading(false);
      }
    }
  };

  const handleToggle = async (): Promise<void> => {
    if (toggleUser === null) {
      return;
    }
    setIsToggling(true);
    setToggleError(null);
    try {
      await useCases.setManagedUserActive.execute({
        userId: toggleUser.id,
        isActive: !toggleUser.isActive,
      });
      setNotice(
        (toggleUser.isActive ? 'Usuario desactivado: ' : 'Usuario activado: ') + toggleUser.email,
      );
      setToggleUser(null);
      await loadPage({ ...appliedFilters, offset: 0 });
    } catch (error_) {
      setToggleError(toErrorMessage(error_, 'No se pudo cambiar el estado del usuario.'));
    } finally {
      setIsToggling(false);
    }
  };

  const handleReset = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (resetUser === null) {
      return;
    }
    setResetErrors({});
    setResetError(null);
    const validation = validateResetManagedUserPasswordInput({
      userId: resetUser.id,
      newPassword: resetPassword,
    });
    if (!validation.isValid) {
      setResetErrors(validation.errors);
      return;
    }

    setIsResetting(true);
    try {
      await useCases.resetManagedUserPassword.execute({
        userId: resetUser.id,
        newPassword: resetPassword,
      });
      setNotice('Contraseña restablecida para ' + resetUser.email + '.');
      setResetUser(null);
      setResetPassword('');
    } catch (error_) {
      setResetError(toErrorMessage(error_, 'No se pudo restablecer la contraseña.'));
    } finally {
      setIsResetting(false);
    }
  };

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, total);

  return (
    <section className="mk-admin" aria-labelledby="mk-admin-users-title">
      <div className="mk-toolbar">
        <form
          className="mk-toolbar__filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <TextInput
            id="admin-users-q"
            label="Buscar"
            type="search"
            placeholder="Correo o nombre"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
          />
          <Select
            id="admin-users-role"
            label="Rol"
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
          />
          <Select
            id="admin-users-status"
            label="Estado"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
          <div className="mk-toolbar__filter-actions">
            <Button type="submit" variant="secondary" size="sm">
              Filtrar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          </div>
        </form>

        <Button type="button" variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
          Nuevo usuario
        </Button>
      </div>

      {requestError !== null && (
        <Alert type="error" title="Directorio de usuarios" onClose={() => setRequestError(null)}>
          {requestError}
        </Alert>
      )}

      {notice !== null && (
        <Alert type="success" title="Operación completada" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className="mk-table-wrap">
        <table className="mk-table" aria-label="Directorio de usuarios">
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">Verificación</th>
              <th scope="col">Creado</th>
              <th scope="col" className="mk-table__actions-head">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="mk-table__identity">
                    <span className="mk-table__name">{user.displayName ?? user.email}</span>
                    <span className="mk-table__email">{user.email}</span>
                  </div>
                </td>
                <td>
                  <span className={'mk-badge mk-badge--role-' + user.publicRole}>
                    {ROLE_LABELS[user.publicRole]}
                  </span>
                </td>
                <td>
                  <span className={'mk-badge ' + (user.isActive ? 'mk-badge--ok' : 'mk-badge--off')}>
                    {user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <span className={'mk-badge ' + (user.emailVerified ? 'mk-badge--info' : 'mk-badge--warn')}>
                    {user.emailVerified ? 'Verificado' : 'Pendiente'}
                  </span>
                </td>
                <td className="mk-table__mono">{formatDate(user.createdAt)}</td>
                <td>
                  <div className="mk-table__actions">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void openDetail(user);
                      }}
                    >
                      Ver
                    </Button>
                    <Button
                      type="button"
                      variant={user.isActive ? 'ghost' : 'secondary'}
                      size="sm"
                      onClick={() => {
                        setToggleUser(user);
                        setToggleError(null);
                      }}
                    >
                      {user.isActive ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResetUser(user);
                        setResetPassword('');
                        setResetErrors({});
                        setResetError(null);
                      }}
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
          <p className="mk-table__loading" role="status">
            Consultando el directorio de usuarios…
          </p>
        )}
      </div>

      <footer className="mk-pagination">
        <span className="mk-pagination__info">
          {rangeStart}–{rangeEnd} de {total}
        </span>
        <div className="mk-pagination__actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset === 0 || isLoading}
            onClick={() => {
              void loadPage({ ...appliedFilters, offset: Math.max(0, offset - PAGE_SIZE) });
            }}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset + PAGE_SIZE >= total || isLoading}
            onClick={() => {
              void loadPage({ ...appliedFilters, offset: offset + PAGE_SIZE });
            }}
          >
            Siguiente
          </Button>
        </div>
      </footer>

      {isCreateOpen && (
        <Modal
          eyebrow="Directorio"
          title="Nuevo usuario"
          description="Crea una cuenta interna con rol y contraseña inicial."
          onClose={() => setIsCreateOpen(false)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="mk-create-user-form"
                variant="primary"
                isLoading={isCreating}
                disabled={isCreating}
              >
                Crear usuario
              </Button>
            </>
          }
        >
          <form id="mk-create-user-form" className="mk-form" onSubmit={handleCreate} noValidate>
            {createErrors['form'] !== undefined && (
              <Alert type="error" title="No se pudo crear" onClose={() => setCreateErrors({})}>
                {createErrors['form']}
              </Alert>
            )}

            <div className={'mk-role-pills'} role="radiogroup" aria-label="Rol del usuario">
              {(['admin', 'repartidor', 'cliente'] as const).map((role) => (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={createRole === role}
                  className={'mk-role-pill ' + (createRole === role ? 'mk-role-pill--active' : '')}
                  onClick={() => setCreateRole(role)}
                >
                  {ROLE_LABELS[role]}
                </button>
              ))}
            </div>

            <TextInput
              id="mk-create-email"
              label="Correo electrónico"
              type="email"
              autoComplete="off"
              placeholder="equipo@millast.ec"
              value={createEmail}
              onChange={(event) => {
                setCreateEmail(event.target.value);
                setCreateErrors({});
              }}
              error={createErrors['email']}
              isRequired
              maxLength={254}
              disabled={isCreating}
            />

            <TextInput
              id="mk-create-display-name"
              label="Nombre para mostrar (opcional)"
              type="text"
              autoComplete="off"
              placeholder="Ej. Ana Paredes"
              value={createDisplayName}
              onChange={(event) => {
                setCreateDisplayName(event.target.value);
                setCreateErrors({});
              }}
              error={createErrors['displayName']}
              maxLength={120}
              disabled={isCreating}
            />

            <TextInput
              id="mk-create-password"
              label="Contraseña inicial"
              type="password"
              autoComplete="new-password"
              helperText="Entre 8 y 128 caracteres."
              value={createPassword}
              onChange={(event) => {
                setCreatePassword(event.target.value);
                setCreateErrors({});
              }}
              error={createErrors['password']}
              isRequired
              maxLength={128}
              disabled={isCreating}
            />
          </form>
        </Modal>
      )}

      {detailUser !== null && (
        <Modal
          eyebrow="Usuario"
          title="Detalle de la cuenta"
          description={detailUser.email}
          onClose={() => setDetailUser(null)}
          footer={
            <Button type="button" variant="secondary" onClick={() => setDetailUser(null)}>
              Cerrar
            </Button>
          }
        >
          {detailError !== null && (
            <Alert type="error" title="No se pudo consultar" onClose={() => setDetailError(null)}>
              {detailError}
            </Alert>
          )}
          {isDetailLoading && <p role="status">Consultando usuario…</p>}
          <div className="mk-detail-grid">
            <div>
              <span className="mk-detail-grid__label">Código</span>
              <ShortIdBadge id={detailUser.id} prefix="USR" />
            </div>
            <div>
              <span className="mk-detail-grid__label">Rol</span>
              <span>{ROLE_LABELS[detailUser.publicRole]}</span>
            </div>
            <div>
              <span className="mk-detail-grid__label">Estado</span>
              <span>{detailUser.isActive ? 'Activo' : 'Inactivo'}</span>
            </div>
            <div>
              <span className="mk-detail-grid__label">Verificación</span>
              <span>
                {detailUser.emailVerified
                  ? VERIFIED_VIA_LABELS[detailUser.emailVerifiedVia ?? ''] ?? 'Verificado'
                  : 'Pendiente'}
              </span>
            </div>
            <div>
              <span className="mk-detail-grid__label">Nombre</span>
              <span>{detailUser.displayName ?? '—'}</span>
            </div>
            <div>
              <span className="mk-detail-grid__label">Creado</span>
              <span>{formatDate(detailUser.createdAt)}</span>
            </div>
          </div>
        </Modal>
      )}

      {toggleUser !== null && (
        <Modal
          eyebrow="Confirmación"
          title={toggleUser.isActive ? 'Desactivar usuario' : 'Activar usuario'}
          description={toggleUser.email}
          size="sm"
          onClose={() => setToggleUser(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setToggleUser(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant={toggleUser.isActive ? 'danger' : 'primary'}
                isLoading={isToggling}
                onClick={() => {
                  void handleToggle();
                }}
              >
                {toggleUser.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </>
          }
        >
          {toggleError !== null && (
            <Alert type="error" title="No se pudo cambiar el estado" onClose={() => setToggleError(null)}>
              {toggleError}
            </Alert>
          )}
          <p className="mk-modal__paragraph">
            {toggleUser.isActive
              ? 'La cuenta dejará de poder iniciar sesión. Si es el último administrador activo o tiene una ruta asignada, el backend rechazará la operación.'
              : 'La cuenta podrá volver a iniciar sesión con su contraseña actual.'}
          </p>
        </Modal>
      )}

      {resetUser !== null && (
        <Modal
          eyebrow="Seguridad"
          title="Restablecer contraseña"
          description={resetUser.email}
          onClose={() => setResetUser(null)}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setResetUser(null)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="mk-reset-password-form"
                variant="primary"
                isLoading={isResetting}
                disabled={isResetting}
              >
                Restablecer
              </Button>
            </>
          }
        >
          <form id="mk-reset-password-form" className="mk-form" onSubmit={handleReset} noValidate>
            {resetError !== null && (
              <Alert type="error" title="No se pudo restablecer" onClose={() => setResetError(null)}>
                {resetError}
              </Alert>
            )}
            <TextInput
              id="mk-reset-password"
              label="Nueva contraseña"
              type="password"
              autoComplete="new-password"
              helperText="Entre 8 y 128 caracteres."
              value={resetPassword}
              onChange={(event) => {
                setResetPassword(event.target.value);
                setResetErrors({});
              }}
              error={resetErrors['newPassword']}
              isRequired
              maxLength={128}
              disabled={isResetting}
            />
          </form>
        </Modal>
      )}
    </section>
  );
};

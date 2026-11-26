import { useCallback, useState, type FC, type FormEvent } from 'react';
import type { AuthUseCases } from '../../application/authUseCases.js';
import {
  validateResetManagedUserPasswordInput,
  type ManagedUser,
  type ManagedUserFilters,
  type PublicRole,
} from '../../domain/index.js';
import { toErrorMessage, usePaginatedList } from '../../../../shared/hooks/usePaginatedList.js';
import { Alert, Button, Select, TextInput } from '../../../../shared/ui/index.js';
import { UserDirectoryTable } from './admin/UserDirectoryTable.js';
import {
  UserDetailModal,
  UserResetPasswordModal,
  UserToggleModal,
} from './admin/UserModals.js';

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

export const AdminUserManagementView: FC<{ useCases: AuthUseCases }> = ({ useCases }) => {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState<ManagedUserFilters>({});
  const [notice, setNotice] = useState<string | null>(null);

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

  const fetchUsers = useCallback(
    (params: ManagedUserFilters & { readonly limit: number; readonly offset: number }) =>
      useCases.listManagedUsers.execute(params),
    [useCases],
  );

  const { items, total, offset, isLoading, requestError, setRequestError, loadPage, mountedRef } =
    usePaginatedList<ManagedUser, ManagedUserFilters>({
      appliedFilters,
      pageSize: PAGE_SIZE,
      errorFallback: 'No se pudo cargar el directorio de usuarios.',
      fetchPage: fetchUsers,
    });

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
      await loadPage({ ...appliedFilters, offset });
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

  return (
    <section className="wf-admin" aria-label="Directorio de usuarios">
      <div className="wf-toolbar">
        <form
          className="wf-toolbar__filters"
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
          <div className="wf-toolbar__filter-actions">
            <Button type="submit" variant="primary" size="sm">
              Filtrar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              Limpiar
            </Button>
          </div>
        </form>
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

      <UserDirectoryTable
        items={items}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        onInspect={(user) => {
          void openDetail(user);
        }}
        onToggleStatus={(user) => {
          setToggleUser(user);
          setToggleError(null);
        }}
        onResetPassword={(user) => {
          setResetUser(user);
          setResetPassword('');
          setResetErrors({});
          setResetError(null);
        }}
        onPageChange={(nextOffset) => {
          void loadPage({ ...appliedFilters, offset: nextOffset });
        }}
      />

      {detailUser !== null && (
        <UserDetailModal
          user={detailUser}
          isLoading={isDetailLoading}
          error={detailError}
          onClearError={() => setDetailError(null)}
          onClose={() => setDetailUser(null)}
        />
      )}

      {toggleUser !== null && (
        <UserToggleModal
          user={toggleUser}
          isToggling={isToggling}
          error={toggleError}
          onClearError={() => setToggleError(null)}
          onClose={() => setToggleUser(null)}
          onConfirm={() => {
            void handleToggle();
          }}
        />
      )}

      {resetUser !== null && (
        <UserResetPasswordModal
          user={resetUser}
          password={resetPassword}
          errors={resetErrors}
          requestError={resetError}
          isResetting={isResetting}
          onPasswordChange={setResetPassword}
          onClearErrors={() => {
            setResetErrors({});
            setResetError(null);
          }}
          onClose={() => setResetUser(null)}
          onSubmit={handleReset}
        />
      )}
    </section>
  );
};

import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  EmptyState,
  PickerField,
  ShortIdChip,
  StatusBadge,
  TextInputField,
  colors,
  fontFamilySans,
  spacing,
  tabularNumbersStyle,
  typography,
} from '../../../../shared/ui';
import {formatUtcDateOnly, runAsync} from '../../../../shared/utils/format';
import {
  validateNewEmailStrict,
  validateNewPasswordPolicy,
  validatePersonName,
} from '../../../../shared/utils/validation';
import {ROLE_LABELS, type AdminUserView} from '../../domain/authUser';
import type {HttpAuthGateway} from '../../infrastructure/httpAuthGateway';

const PAGE_LIMIT = 15;

interface AdminUsersPanelProps {
  readonly gateway: HttpAuthGateway;
}

export function AdminUsersPanel({gateway}: AdminUsersPanelProps) {
  const [users, setUsers] = useState<readonly AdminUserView[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'' | 'admin' | 'repartidor' | 'cliente'>('');
  const [activeFilter, setActiveFilter] = useState<'' | 'true' | 'false'>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<AdminUserView | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'repartidor' | 'cliente'>('cliente');
  const [newPassword, setNewPassword] = useState('');
  const [isMutating, setIsMutating] = useState(false);

  const [resetTarget, setResetTarget] = useState<AdminUserView | null>(null);
  const [resetPwd, setResetPwd] = useState('');

  const load = useCallback(
    async (targetOffset = offset) => {
      setIsLoading(true);
      setError(null);
      try {
        const page = await gateway.listUsers({
          ...(roleFilter ? {role: roleFilter} : {}),
          ...(activeFilter ? {isActive: activeFilter === 'true'} : {}),
          ...(search.trim() ? {q: search.trim()} : {}),
          limit: PAGE_LIMIT,
          offset: targetOffset,
        });
        setUsers(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el directorio.');
      } finally {
        setIsLoading(false);
      }
    },
    [activeFilter, gateway, offset, roleFilter, search],
  );

  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      runAsync(load(0));
    }
  }, [load]);

  const handleCreateUser = async () => {
    const emailErr = validateNewEmailStrict(newEmail);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const nameErr = validatePersonName(newName, 'El nombre', false);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    const passErr = validateNewPasswordPolicy(newPassword, newEmail);
    if (passErr) {
      setError(passErr);
      return;
    }

    setIsMutating(true);
    setError(null);
    try {
      await gateway.createManagedUser({
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        ...(newName.trim() ? {displayName: newName.trim()} : {}),
      });
      setCreateOpen(false);
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setSuccess('Usuario creado correctamente.');
      await load(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleActive = async (user: AdminUserView) => {
    setIsMutating(true);
    setError(null);
    try {
      const updated = await gateway.setUserActive(user.id, !user.isActive);
      setUsers(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setSelectedUser(updated);
      setSuccess(
        `Cuenta ${updated.isActive ? 'activada' : 'desactivada'}: ${updated.email}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
    } finally {
      setIsMutating(false);
    }
  };

  const handleAdminReset = async () => {
    if (!resetTarget) return;
    const passErr = validateNewPasswordPolicy(resetPwd, resetTarget.email);
    if (passErr) {
      setError(passErr);
      return;
    }
    setIsMutating(true);
    setError(null);
    try {
      await gateway.adminResetPassword(resetTarget.id, resetPwd);
      setSuccess(`Contraseña restablecida para ${resetTarget.email}.`);
      setResetTarget(null);
      setResetPwd('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo restablecer la clave.');
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <View style={styles.container}>
      {error ? (
        <AlertBanner onClose={() => setError(null)} title="Atención" type="error">
          {error}
        </AlertBanner>
      ) : null}
      {success ? (
        <AlertBanner onClose={() => setSuccess(null)} title="Operación exitosa" type="success">
          {success}
        </AlertBanner>
      ) : null}

      <Card variant="muted">
        <View style={styles.topRow}>
          <Text style={typography.cardTitle}>Directorio de usuarios</Text>
          <Button label="Nuevo usuario" onPress={() => setCreateOpen(true)} size="sm" />
        </View>
        <TextInputField
          autoCapitalize="none"
          label="Buscar"
          onChangeText={setSearch}
          placeholder="Correo o nombre"
          value={search}
        />
        <PickerField
          label="Rol"
          onValueChange={val => setRoleFilter(val as typeof roleFilter)}
          options={[
            {value: '', label: 'Todos los roles'},
            {value: 'admin', label: 'Administrador'},
            {value: 'repartidor', label: 'Repartidor'},
            {value: 'cliente', label: 'Cliente'},
          ]}
          value={roleFilter}
        />
        <PickerField
          label="Estado"
          onValueChange={val => setActiveFilter(val as typeof activeFilter)}
          options={[
            {value: '', label: 'Todos los estados'},
            {value: 'true', label: 'Activos'},
            {value: 'false', label: 'Inactivos'},
          ]}
          value={activeFilter}
        />
        <View style={styles.filterActions}>
          <Button
            isLoading={isLoading}
            label="Filtrar"
            onPress={() => runAsync(load(0))}
            size="sm"
          />
          <Button
            label="Limpiar"
            onPress={() => {
              setSearch('');
              setRoleFilter('');
              setActiveFilter('');
              runAsync(load(0));
            }}
            size="sm"
            variant="secondary"
          />
        </View>
      </Card>

      {isLoading && users.length === 0 ? (
        <ActivityIndicator color={colors.webflowBlue} size="large" />
      ) : users.length === 0 ? (
        <EmptyState
          description="No hay usuarios que coincidan con los filtros actuales."
          title="Sin resultados"
        />
      ) : (
        <View style={styles.list}>
          {users.map(user => (
            <Card key={user.id} style={styles.userCard}>
              <View style={styles.userHead}>
                <View style={styles.userMeta}>
                  <Text style={styles.userName}>{user.displayName || user.email}</Text>
                  <Text style={styles.userEmail}>{user.email}</Text>
                </View>
                <ShortIdChip id={user.id} prefix="USR" />
              </View>
              <View style={styles.badgesRow}>
                <StatusBadge
                  label={ROLE_LABELS[user.role]}
                  tone={user.role === 'personal' ? 'blue' : 'neutral'}
                />
                <StatusBadge
                  label={user.isActive ? 'Activo' : 'Inactivo'}
                  tone={user.isActive ? 'green' : 'red'}
                />
                <StatusBadge
                  label={user.emailVerified ? 'Verificado' : 'Sin verificar'}
                  tone={user.emailVerified ? 'blue' : 'amber'}
                />
              </View>
              <View style={styles.cardActions}>
                <Button
                  label="Ver"
                  onPress={() => setSelectedUser(user)}
                  size="sm"
                  variant="secondary"
                />
                <Button
                  isLoading={isMutating}
                  label={user.isActive ? 'Desactivar' : 'Activar'}
                  onPress={() => runAsync(handleToggleActive(user))}
                  size="sm"
                  variant="secondary"
                />
                <Button
                  label="Clave"
                  onPress={() => {
                    setResetPwd('');
                    setResetTarget(user);
                  }}
                  size="sm"
                  variant="ghost"
                />
              </View>
            </Card>
          ))}

          {total > PAGE_LIMIT ? (
            <View style={styles.pagination}>
              <Text style={[styles.pageInfo, tabularNumbersStyle]}>
                {`${offset + 1}–${Math.min(offset + users.length, total)} de ${total}`}
              </Text>
              <View style={styles.pageButtons}>
                <Button
                  disabled={offset === 0 || isLoading}
                  label="Anterior"
                  onPress={() => runAsync(load(Math.max(0, offset - PAGE_LIMIT)))}
                  size="sm"
                  variant="secondary"
                />
                <Button
                  disabled={offset + PAGE_LIMIT >= total || isLoading}
                  label="Siguiente"
                  onPress={() => runAsync(load(offset + PAGE_LIMIT))}
                  size="sm"
                  variant="secondary"
                />
              </View>
            </View>
          ) : null}
        </View>
      )}

      <BottomSheetModal
        onClose={() => setCreateOpen(false)}
        title="Nuevo usuario"
        visible={createOpen}>
        <TextInputField
          autoCapitalize="none"
          isRequired
          keyboardType="email-address"
          label="Correo electrónico"
          onChangeText={setNewEmail}
          value={newEmail}
        />
        <TextInputField
          label="Nombre completo"
          onChangeText={setNewName}
          value={newName}
        />
        <PickerField
          isRequired
          label="Rol asignado"
          onValueChange={val => setNewRole(val as typeof newRole)}
          options={[
            {value: 'cliente', label: 'Cliente'},
            {value: 'repartidor', label: 'Repartidor'},
            {value: 'admin', label: 'Administrador'},
          ]}
          value={newRole}
        />
        <TextInputField
          isPassword
          isRequired
          label="Contraseña inicial"
          onChangeText={setNewPassword}
          value={newPassword}
        />
        <Button
          fullWidth
          isLoading={isMutating}
          label="Crear usuario"
          onPress={() => runAsync(handleCreateUser())}
        />
      </BottomSheetModal>

      <BottomSheetModal
        onClose={() => setSelectedUser(null)}
        title="Detalle de usuario"
        visible={selectedUser !== null}>
        {selectedUser ? (
          <View style={styles.detailBox}>
            <Text style={typography.body}>
              {`Nombre: ${selectedUser.displayName ?? 'Sin nombre'}`}
            </Text>
            <Text style={typography.body}>{`Correo: ${selectedUser.email}`}</Text>
            <Text style={typography.body}>{`Rol: ${ROLE_LABELS[selectedUser.role]}`}</Text>
            <Text style={typography.body}>
              {`Creado: ${formatUtcDateOnly(selectedUser.createdAt)}`}
            </Text>
            {selectedUser.courierId ? (
              <ShortIdChip id={selectedUser.courierId} prefix="REP" />
            ) : null}
            <Button
              isLoading={isMutating}
              label={selectedUser.isActive ? 'Desactivar cuenta' : 'Activar cuenta'}
              onPress={() => runAsync(handleToggleActive(selectedUser))}
              variant={selectedUser.isActive ? 'danger' : 'primary'}
            />
          </View>
        ) : null}
      </BottomSheetModal>

      <BottomSheetModal
        onClose={() => setResetTarget(null)}
        subtitle={resetTarget?.email}
        title="Restablecer contraseña"
        visible={resetTarget !== null}>
        <TextInputField
          isPassword
          isRequired
          label="Nueva contraseña"
          onChangeText={setResetPwd}
          value={resetPwd}
        />
        <Button
          fullWidth
          isLoading={isMutating}
          label="Guardar nueva clave"
          onPress={() => runAsync(handleAdminReset())}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
  topRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  filterActions: {flexDirection: 'row', gap: spacing.sm},
  list: {gap: spacing.md},
  userCard: {gap: spacing.sm},
  userHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm},
  userMeta: {flex: 1, minWidth: 0, gap: 2},
  userName: {fontFamily: fontFamilySans, fontSize: 15, fontWeight: '600', color: colors.obsidian},
  userEmail: {fontFamily: fontFamilySans, fontSize: 13, color: colors.slate},
  badgesRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  cardActions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4},
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
  },
  pageInfo: {fontFamily: fontFamilySans, fontSize: 13, color: colors.slate},
  pageButtons: {flexDirection: 'row', gap: spacing.sm},
  detailBox: {gap: spacing.md},
});

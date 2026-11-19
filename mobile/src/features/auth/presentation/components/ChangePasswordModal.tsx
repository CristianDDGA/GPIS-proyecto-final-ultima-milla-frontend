import {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  TextInputField,
  spacing,
} from '../../../../shared/ui';
import {validateNewPasswordPolicy} from '../../../../shared/utils/validation';
import {runAsync} from '../../../../shared/utils/format';
import type {AuthUser} from '../../domain/authUser';
import type {HttpAuthGateway} from '../../infrastructure/httpAuthGateway';

interface ChangePasswordModalProps {
  readonly visible: boolean;
  readonly user: AuthUser;
  readonly gateway: HttpAuthGateway;
  readonly onClose: () => void;
  readonly onChanged: (token: string, nextUser: AuthUser) => Promise<void>;
}

export function ChangePasswordModal({
  visible,
  user,
  gateway,
  onClose,
  onChanged,
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (currentPassword.length === 0) {
      setError('Ingresa tu contraseña actual.');
      return;
    }
    const policyErr = validateNewPasswordPolicy(newPassword, user.email);
    if (policyErr) {
      setError(policyErr);
      return;
    }
    if (newPassword === currentPassword) {
      setError('La nueva contraseña debe ser distinta a la actual.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const session = await gateway.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await onChanged(session.token, session.user);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible cambiar la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      onClose={onClose}
      subtitle="Al confirmar, tus demás sesiones abiertas quedarán revocadas."
      title="Cambiar contraseña"
      visible={visible}>
      {error ? (
        <AlertBanner onClose={() => setError(null)} title="Atención" type="error">
          {error}
        </AlertBanner>
      ) : null}

      <View style={styles.form}>
        <TextInputField
          editable={!isSubmitting}
          isPassword
          isRequired
          label="Contraseña actual"
          onChangeText={setCurrentPassword}
          value={currentPassword}
        />
        <TextInputField
          editable={!isSubmitting}
          isPassword
          isRequired
          label="Nueva contraseña"
          onChangeText={setNewPassword}
          placeholder="Mínimo 8 caracteres"
          value={newPassword}
        />
        <TextInputField
          editable={!isSubmitting}
          isPassword
          isRequired
          label="Confirmar contraseña"
          onChangeText={setConfirmPassword}
          value={confirmPassword}
        />
        <Button
          fullWidth
          isLoading={isSubmitting}
          label="Actualizar contraseña"
          onPress={() => runAsync(handleSubmit())}
        />
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
  },
});

import {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {HttpError} from '../../../../shared/infrastructure/http/httpClient';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  KineticText,
  MillastMark,
  SegmentedControl,
  TextInputField,
  colors,
  fontFamilySans,
  radii,
  spacing,
  typography,
} from '../../../../shared/ui';
import {
  evaluatePasswordStrength,
  validateEmailLogin,
  validateNewEmailStrict,
  validateNewPasswordPolicy,
  validatePersonName,
} from '../../../../shared/utils/validation';
import {runAsync} from '../../../../shared/utils/format';
import type {AuthUser} from '../../domain/authUser';
import type {HttpAuthGateway} from '../../infrastructure/httpAuthGateway';

type AuthFlow = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';

interface AuthScreenProps {
  readonly gateway: HttpAuthGateway;
  readonly apiUrl: string;
  readonly onSaveApiUrl: (nextUrl: string) => Promise<void>;
  readonly onAuthenticated: (token: string, user: AuthUser) => Promise<void>;
  readonly externalError?: string | null;
  readonly onClearExternalError?: () => void;
}

const FLOW_TITLES: Record<AuthFlow, string> = {
  login: 'Accede a tu consola',
  register: 'Crea tu cuenta',
  'verify-email': 'Verifica tu correo',
  'forgot-password': 'Recupera tu contraseña',
  'reset-password': 'Nueva contraseña',
};

export function AuthScreen({
  gateway,
  apiUrl,
  onSaveApiUrl,
  onAuthenticated,
  externalError,
  onClearExternalError,
}: AuthScreenProps) {
  const insets = useSafeAreaInsets();
  const [flow, setFlow] = useState<AuthFlow>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [serverModalOpen, setServerModalOpen] = useState(false);
  const [draftApiUrl, setDraftApiUrl] = useState(apiUrl);

  useEffect(() => {
    setDraftApiUrl(apiUrl);
  }, [apiUrl]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const switchFlow = (next: AuthFlow, keepNotice = false) => {
    setFlow(next);
    setError(null);
    if (!keepNotice) setNotice(null);
  };

  const handleLogin = async () => {
    const emailErr = validateEmailLogin(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    if (password.length < 8) {
      setError('Ingresa tu contraseña (mínimo 8 caracteres).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const session = await gateway.login(email.trim().toLowerCase(), password);
      await onAuthenticated(session.token, session.user);
    } catch (err) {
      if (err instanceof HttpError && err.code === 'EMAIL_NOT_VERIFIED') {
        setNotice('Tu correo aún no está verificado. Ingresa el código de 6 dígitos enviado.');
        setCooldown(60);
        switchFlow('verify-email', true);
      } else {
        setError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const nameErr = validatePersonName(displayName, 'El nombre completo', false);
    if (nameErr) {
      setError(nameErr);
      return;
    }
    const emailErr = validateNewEmailStrict(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    const passErr = validateNewPasswordPolicy(password, email);
    if (passErr) {
      setError(passErr);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const outcome = await gateway.registerCustomer({
        email: email.trim().toLowerCase(),
        password,
        ...(displayName.trim().length > 0 ? {displayName: displayName.trim()} : {}),
      });
      if (outcome.kind === 'session') {
        await onAuthenticated(outcome.token, outcome.user);
      } else {
        setNotice('Enviamos un código de verificación de 6 dígitos a tu correo.');
        setCooldown(60);
        switchFlow('verify-email', true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible crear la cuenta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('El código debe tener exactamente 6 dígitos.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await gateway.verifyEmail(email.trim().toLowerCase(), code.trim());
      await onAuthenticated(session.token, session.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible verificar el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await gateway.resendVerification(email.trim().toLowerCase());
      setCooldown(60);
      setNotice('Si la cuenta admite verificación, reenviamos el código al correo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible reenviar el código.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgot = async () => {
    const emailErr = validateEmailLogin(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await gateway.forgotPassword(email.trim().toLowerCase());
      setNotice('Si el correo está verificado por código, recibirás las instrucciones para continuar.');
      switchFlow('reset-password', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible procesar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setError('El código debe tener exactamente 6 dígitos.');
      return;
    }
    const passErr = validateNewPasswordPolicy(newPassword, email);
    if (passErr) {
      setError(passErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await gateway.resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setCode('');
      setNotice('Contraseña restablecida. Inicia sesión con tu nueva clave.');
      switchFlow('login', true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible restablecer la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activePassword = flow === 'reset-password' ? newPassword : password;
  const strength = evaluatePasswordStrength(activePassword, email);
  const showPrimaryTabs = flow === 'login' || flow === 'register';

  return (
    <View style={[styles.screen, {paddingTop: insets.top, paddingBottom: insets.bottom}]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <MillastMark size={28} />
          <Text style={styles.brandName}>Millast</Text>
        </View>
        <Pressable
          accessibilityLabel="Configurar servidor API"
          accessibilityRole="button"
          onPress={() => {
            setDraftApiUrl(apiUrl);
            setServerModalOpen(true);
          }}
          style={styles.serverPill}
          testID="server-config-button">
          <Text numberOfLines={1} style={styles.serverPillText}>
            Servidor
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <KineticText style={typography.display} text="Planifica rutas." />
            <KineticText style={typography.display} text="Despacha a tiempo." />
          </View>

          {externalError ? (
            <AlertBanner
              onClose={onClearExternalError}
              title="Sesión finalizada"
              type="warning">
              {externalError}
            </AlertBanner>
          ) : null}

          <Card style={styles.authCard}>
            {showPrimaryTabs ? (
              <SegmentedControl<'login' | 'register'>
                onChange={next => switchFlow(next)}
                options={[
                  {value: 'login', label: 'Iniciar sesión', testID: 'auth-tab-login'},
                  {value: 'register', label: 'Crear cuenta', testID: 'auth-tab-register'},
                ]}
                value={flow}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => switchFlow('login')}
                style={styles.backLink}>
                <Text style={styles.backLinkText}>← Volver a iniciar sesión</Text>
              </Pressable>
            )}

            <KineticText style={typography.pageTitle} text={FLOW_TITLES[flow]} />

            {flow === 'login' ? (
              <Text style={typography.bodyMuted}>
                Ingresa con tu cuenta de administrador, repartidor o cliente.
              </Text>
            ) : null}

            {notice ? (
              <AlertBanner onClose={() => setNotice(null)} title="Información" type="info">
                {notice}
              </AlertBanner>
            ) : null}

            {error ? (
              <AlertBanner onClose={() => setError(null)} title="Revisa tus datos" type="error">
                {error}
              </AlertBanner>
            ) : null}

            {flow === 'login' ? (
              <View style={styles.form}>
                <TextInputField
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="email-address"
                  label="Correo electrónico"
                  onChangeText={setEmail}
                  placeholder="usuario@millast.ec"
                  testID="auth-login-email"
                  value={email}
                />
                <TextInputField
                  editable={!isSubmitting}
                  isPassword
                  isRequired
                  label="Contraseña"
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  testID="auth-login-password"
                  value={password}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => switchFlow('forgot-password')}
                  style={styles.forgotLink}>
                  <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
                </Pressable>
                <Button
                  fullWidth
                  isLoading={isSubmitting}
                  label="Entrar al sistema"
                  onPress={() => runAsync(handleLogin())}
                  size="lg"
                  testID="auth-login-submit"
                />
              </View>
            ) : null}

            {flow === 'register' ? (
              <View style={styles.form}>
                <TextInputField
                  editable={!isSubmitting}
                  label="Nombre completo"
                  maxLength={120}
                  onChangeText={setDisplayName}
                  placeholder="Ej. Carlos Andrade"
                  testID="auth-register-name"
                  value={displayName}
                />
                <TextInputField
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="email-address"
                  label="Correo electrónico"
                  onChangeText={setEmail}
                  placeholder="usuario@millast.ec"
                  testID="auth-register-email"
                  value={email}
                />
                <TextInputField
                  editable={!isSubmitting}
                  isPassword
                  isRequired
                  label="Contraseña"
                  onChangeText={setPassword}
                  placeholder="Mínimo 8 caracteres"
                  testID="auth-register-password"
                  value={password}
                />
                {password.length > 0 ? (
                  <View style={styles.meterWrap}>
                    <View style={styles.meterBars}>
                      {[1, 2, 3].map(bar => (
                        <View
                          key={bar}
                          style={[
                            styles.meterBar,
                            strength.level >= bar && styles.meterBarActive,
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={styles.meterLabel}>{strength.label}</Text>
                  </View>
                ) : null}
                <Button
                  fullWidth
                  isLoading={isSubmitting}
                  label="Crear cuenta de cliente"
                  onPress={() => runAsync(handleRegister())}
                  size="lg"
                  testID="auth-register-submit"
                />
              </View>
            ) : null}

            {flow === 'verify-email' ? (
              <View style={styles.form}>
                <TextInputField
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="email-address"
                  label="Correo electrónico"
                  onChangeText={setEmail}
                  placeholder="usuario@millast.ec"
                  value={email}
                />
                <TextInputField
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="number-pad"
                  label="Código de verificación"
                  maxLength={6}
                  onChangeText={setCode}
                  placeholder="6 dígitos"
                  value={code}
                />
                <Button
                  fullWidth
                  isLoading={isSubmitting}
                  label="Confirmar correo"
                  onPress={() => runAsync(handleVerifyEmail())}
                  size="lg"
                />
                <Button
                  disabled={cooldown > 0 || isSubmitting}
                  fullWidth
                  label={
                    cooldown > 0 ? `Reenviar código (${cooldown}s)` : 'Reenviar código'
                  }
                  onPress={() => runAsync(handleResend())}
                  variant="secondary"
                />
              </View>
            ) : null}

            {flow === 'forgot-password' ? (
              <View style={styles.form}>
                <Text style={typography.bodyMuted}>
                  Ingresa el correo con el que verificaste tu cuenta para emitir un código temporal.
                </Text>
                <TextInputField
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="email-address"
                  label="Correo electrónico"
                  onChangeText={setEmail}
                  placeholder="usuario@millast.ec"
                  value={email}
                />
                <Button
                  fullWidth
                  isLoading={isSubmitting}
                  label="Enviar código"
                  onPress={() => runAsync(handleForgot())}
                  size="lg"
                />
              </View>
            ) : null}

            {flow === 'reset-password' ? (
              <View style={styles.form}>
                <TextInputField
                  autoCapitalize="none"
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="email-address"
                  label="Correo electrónico"
                  onChangeText={setEmail}
                  value={email}
                />
                <TextInputField
                  editable={!isSubmitting}
                  isRequired
                  keyboardType="number-pad"
                  label="Código recibido"
                  maxLength={6}
                  onChangeText={setCode}
                  placeholder="6 dígitos"
                  value={code}
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
                  label="Confirmar nueva contraseña"
                  onChangeText={setConfirmPassword}
                  value={confirmPassword}
                />
                <Button
                  fullWidth
                  isLoading={isSubmitting}
                  label="Guardar nueva contraseña"
                  onPress={() => runAsync(handleReset())}
                  size="lg"
                />
              </View>
            ) : null}

            <View style={styles.cardFooter}>
              <Text style={styles.footerTrust}>Sesión cifrada en tránsito</Text>
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomSheetModal
        onClose={() => setServerModalOpen(false)}
        subtitle="Para emulador Android usa http://10.0.2.2:3000; con adb reverse usa http://127.0.0.1:3000."
        title="Servidor API"
        visible={serverModalOpen}>
        <TextInputField
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          label="URL base del backend"
          onChangeText={setDraftApiUrl}
          placeholder="http://10.0.2.2:3000"
          testID="api-url-input"
          value={draftApiUrl}
        />
        <Button
          fullWidth
          label="Guardar servidor"
          onPress={() => {
            runAsync(onSaveApiUrl(draftApiUrl).then(() => setServerModalOpen(false)));
          }}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.pureWhite,
  },
  flex: {
    flex: 1,
  },
  topbar: {
    height: 54,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.ashBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.pureWhite,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandName: {
    fontFamily: fontFamilySans,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.obsidian,
  },
  serverPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
  },
  serverPillText: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
    color: colors.slate,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  hero: {
    gap: 2,
  },
  authCard: {
    gap: spacing.md,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  backLinkText: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.webflowBlue,
  },
  form: {
    gap: spacing.md,
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 2,
  },
  forgotText: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.webflowBlue,
  },
  meterWrap: {
    gap: 6,
  },
  meterBars: {
    flexDirection: 'row',
    gap: 6,
  },
  meterBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.ashBorder,
  },
  meterBarActive: {
    backgroundColor: colors.webflowBlue,
    borderColor: colors.webflowBlue,
  },
  meterLabel: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    color: colors.slate,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.ashBorder,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  footerTrust: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    color: colors.slate,
  },
});

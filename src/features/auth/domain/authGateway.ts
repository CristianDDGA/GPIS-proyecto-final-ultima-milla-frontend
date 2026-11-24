import type {
  AuthSession,
  AuthUser,
  ForgotPasswordInput,
  HealthStatus,
  LoginInput,
  RegisterCustomerInput,
  RegisterCustomerOutcome,
  ResetPasswordInput,
  VerifyEmailInput,
} from './authUser.js';
import type {
  ChangePasswordInput,
  ManagedUser,
  ManagedUserFilters,
  ManagedUserPage,
  ResetManagedUserPasswordInput,
  SetManagedUserActiveInput,
  UpdateProfileInput,
  UserProfile,
} from './managedUser.js';

export interface AuthGateway {
  checkHealth(): Promise<HealthStatus>;
  login(input: LoginInput): Promise<AuthSession>;
  /** Inicio de sesión o alta de cliente verificado mediante Google ID Token (POST /auth/google). */
  loginWithGoogle(idToken: string): Promise<AuthSession>;
  /** Sesión directa (modo demo) o correo pendiente de verificación con código de 6 dígitos. */
  registerCustomer(input: RegisterCustomerInput): Promise<RegisterCustomerOutcome>;
  verifyEmail(input: VerifyEmailInput): Promise<AuthSession>;
  resendVerification(email: string): Promise<void>;
  forgotPassword(input: ForgotPasswordInput): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  getCurrentUser(): Promise<AuthUser>;
  logout(): Promise<void>;

  /** Autoservicio autenticado: rota la sesión y devuelve un token nuevo. */
  changePassword(input: ChangePasswordInput): Promise<AuthSession>;
  /** Alta administrativa de una cuenta (POST /auth/users). */
  /** Directorio administrativo real con filtros y paginación. */
  listManagedUsers(filters?: ManagedUserFilters): Promise<ManagedUserPage>;
  getManagedUser(userId: string): Promise<ManagedUser>;
  setManagedUserActive(input: SetManagedUserActiveInput): Promise<ManagedUser>;
  resetManagedUserPassword(input: ResetManagedUserPasswordInput): Promise<void>;
  /** Perfil propio para "Mi perfil" (GET /auth/me/profile). */
  getProfile(): Promise<UserProfile>;
  /** Cambia nombre y/o teléfono propios (PATCH /auth/me/profile). */
  updateProfile(input: UpdateProfileInput): Promise<UserProfile>;
}

import type {
  AuthSession,
  AuthUser,
  CreateManagedUserInput,
  ForgotPasswordInput,
  HealthStatus,
  LoginInput,
  RegisterCustomerInput,
  RegisterCustomerOutcome,
  ResetPasswordInput,
  VerifyEmailInput,
} from './authUser.js';

export interface AuthGateway {
  checkHealth(): Promise<HealthStatus>;
  login(input: LoginInput): Promise<AuthSession>;
  /** Sesión directa (modo demo) o correo pendiente de verificación con código de 6 dígitos. */
  registerCustomer(input: RegisterCustomerInput): Promise<RegisterCustomerOutcome>;
  verifyEmail(input: VerifyEmailInput): Promise<AuthSession>;
  resendVerification(email: string): Promise<void>;
  forgotPassword(input: ForgotPasswordInput): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<void>;
  getCurrentUser(): Promise<AuthUser>;
  logout(): Promise<void>;
  createManagedUser(input: CreateManagedUserInput): Promise<AuthUser>;
}

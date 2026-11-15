import type {
  AuthSession,
  AuthUser,
  CreateManagedUserInput,
  HealthStatus,
  LoginInput,
  RegisterCustomerInput,
} from './authUser.js';

export interface AuthGateway {
  checkHealth(): Promise<HealthStatus>;
  login(input: LoginInput): Promise<AuthSession>;
  registerCustomer(input: RegisterCustomerInput): Promise<AuthSession>;
  getCurrentUser(): Promise<AuthUser>;
  logout(): Promise<void>;
  createManagedUser(input: CreateManagedUserInput): Promise<AuthUser>;
}

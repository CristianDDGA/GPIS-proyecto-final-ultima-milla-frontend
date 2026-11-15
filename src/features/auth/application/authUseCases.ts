import type { AuthGateway } from '../domain/authGateway.js';
import {
  firstValidationError,
  validateCreateManagedUserInput,
  validateLoginInput,
  validateRegisterCustomerInput,
  type AuthSession,
  type AuthUser,
  type CreateManagedUserInput,
  type HealthStatus,
  type LoginInput,
  type RegisterCustomerInput,
  type ValidationErrors,
} from '../domain/index.js';

function assertValid(errors: ValidationErrors, fallbackMessage: string): void {
  if (Object.keys(errors).length > 0) {
    throw new Error(firstValidationError(errors) ?? fallbackMessage);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeDisplayName(displayName: string | null | undefined): string | null {
  if (typeof displayName !== 'string') {
    return null;
  }

  const trimmedDisplayName = displayName.trim();
  return trimmedDisplayName.length === 0 ? null : trimmedDisplayName;
}

export class CheckHealthUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(): Promise<HealthStatus> {
    return this.authGateway.checkHealth();
  }
}

export class LoginUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: LoginInput): Promise<AuthSession> {
    const validation = validateLoginInput(input);
    assertValid(validation.errors, 'Las credenciales ingresadas no son válidas.');

    return this.authGateway.login({
      email: normalizeEmail(input.email),
      password: input.password,
    });
  }
}

export class RegisterCustomerUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: RegisterCustomerInput): Promise<AuthSession> {
    const validation = validateRegisterCustomerInput(input);
    assertValid(validation.errors, 'Los datos de registro no son válidos.');

    return this.authGateway.registerCustomer({
      email: normalizeEmail(input.email),
      password: input.password,
      displayName: normalizeDisplayName(input.displayName),
    });
  }
}

export class GetCurrentUserUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(): Promise<AuthUser> {
    return this.authGateway.getCurrentUser();
  }
}

export class LogoutUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(): Promise<void> {
    return this.authGateway.logout();
  }
}

export class CreateManagedUserUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: CreateManagedUserInput): Promise<AuthUser> {
    const validation = validateCreateManagedUserInput(input);
    assertValid(validation.errors, 'Los datos del nuevo usuario no son válidos.');

    return this.authGateway.createManagedUser({
      email: normalizeEmail(input.email),
      password: input.password,
      role: input.role,
      displayName: normalizeDisplayName(input.displayName),
    });
  }
}

export interface AuthUseCases {
  checkHealth: Pick<CheckHealthUseCase, 'execute'>;
  login: Pick<LoginUseCase, 'execute'>;
  registerCustomer: Pick<RegisterCustomerUseCase, 'execute'>;
  getCurrentUser: Pick<GetCurrentUserUseCase, 'execute'>;
  logout: Pick<LogoutUseCase, 'execute'>;
  createManagedUser: Pick<CreateManagedUserUseCase, 'execute'>;
}

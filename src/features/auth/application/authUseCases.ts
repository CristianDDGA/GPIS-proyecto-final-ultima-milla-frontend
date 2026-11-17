import type { AuthGateway } from '../domain/authGateway.js';
import {
  firstValidationError,
  validateCreateManagedUserInput,
  validateForgotPasswordInput,
  validateLoginInput,
  validateRegisterCustomerInput,
  validateResetPasswordInput,
  validateVerifyEmailInput,
  type AuthSession,
  type AuthUser,
  type CreateManagedUserInput,
  type ForgotPasswordInput,
  type HealthStatus,
  type LoginInput,
  type RegisterCustomerInput,
  type RegisterCustomerOutcome,
  type ResetPasswordInput,
  type ValidationErrors,
  type VerifyEmailInput,
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

  public async execute(input: RegisterCustomerInput): Promise<RegisterCustomerOutcome> {
    const validation = validateRegisterCustomerInput(input);
    assertValid(validation.errors, 'Los datos de registro no son válidos.');

    return this.authGateway.registerCustomer({
      email: normalizeEmail(input.email),
      password: input.password,
      displayName: normalizeDisplayName(input.displayName),
    });
  }
}

export class VerifyEmailUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: VerifyEmailInput): Promise<AuthSession> {
    const validation = validateVerifyEmailInput(input);
    assertValid(validation.errors, 'El código de verificación no es válido.');

    return this.authGateway.verifyEmail({
      email: normalizeEmail(input.email),
      code: input.code.trim(),
    });
  }
}

export class ResendVerificationUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(email: string): Promise<void> {
    const validation = validateForgotPasswordInput({ email });
    assertValid(validation.errors, 'Ingresa un correo electrónico válido.');

    await this.authGateway.resendVerification(normalizeEmail(email));
  }
}

export class ForgotPasswordUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: ForgotPasswordInput): Promise<void> {
    const validation = validateForgotPasswordInput(input);
    assertValid(validation.errors, 'Ingresa un correo electrónico válido.');

    await this.authGateway.forgotPassword({ email: normalizeEmail(input.email) });
  }
}

export class ResetPasswordUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: ResetPasswordInput): Promise<void> {
    const validation = validateResetPasswordInput(input);
    assertValid(validation.errors, 'Revisa el código y la nueva contraseña.');

    await this.authGateway.resetPassword({
      email: normalizeEmail(input.email),
      code: input.code.trim(),
      newPassword: input.newPassword,
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
  verifyEmail: Pick<VerifyEmailUseCase, 'execute'>;
  resendVerification: Pick<ResendVerificationUseCase, 'execute'>;
  forgotPassword: Pick<ForgotPasswordUseCase, 'execute'>;
  resetPassword: Pick<ResetPasswordUseCase, 'execute'>;
  getCurrentUser: Pick<GetCurrentUserUseCase, 'execute'>;
  logout: Pick<LogoutUseCase, 'execute'>;
  createManagedUser: Pick<CreateManagedUserUseCase, 'execute'>;
}

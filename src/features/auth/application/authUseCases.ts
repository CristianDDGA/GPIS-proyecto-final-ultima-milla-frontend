import type { AuthGateway } from '../domain/authGateway.js';
import {
  firstValidationError,
  isUuidText,
  validateChangePasswordInput,
  validateCreateManagedUserInput,
  validateForgotPasswordInput,
  validateLoginInput,
  validateRegisterCustomerInput,
  validateResetPasswordInput,
  validateResetManagedUserPasswordInput,
  validateVerifyEmailInput,
  validateProfilePhone,
  validateDisplayName,
  type AuthSession,
  type AuthUser,
  type ChangePasswordInput,
  type CreateManagedUserInput,
  type ForgotPasswordInput,
  type HealthStatus,
  type LoginInput,
  type ManagedUser,
  type ManagedUserFilters,
  type ManagedUserPage,
  type RegisterCustomerInput,
  type RegisterCustomerOutcome,
  type ResetManagedUserPasswordInput,
  type ResetPasswordInput,
  type SetManagedUserActiveInput,
  type UpdateProfileInput,
  type UserProfile,
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

export class LoginWithGoogleUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(idToken: string): Promise<AuthSession> {
    const token = idToken.trim();
    if (token.length === 0) {
      throw new Error('No se recibió el token de Google.');
    }

    return this.authGateway.loginWithGoogle(token);
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

export class ChangePasswordUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: ChangePasswordInput): Promise<AuthSession> {
    const validation = validateChangePasswordInput(input);
    assertValid(validation.errors, 'Revisa la contraseña actual y la nueva.');

    return this.authGateway.changePassword({
      currentPassword: input.currentPassword,
      newPassword: input.newPassword,
    });
  }
}

export class ListManagedUsersUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(filters: ManagedUserFilters = {}): Promise<ManagedUserPage> {
    const trimmedQuery = filters.q?.trim() ?? '';
    return this.authGateway.listManagedUsers({
      ...(filters.role !== undefined ? { role: filters.role } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(trimmedQuery.length > 0 ? { q: trimmedQuery } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
    });
  }
}

export class GetManagedUserUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(userId: string): Promise<ManagedUser> {
    if (!isUuidText(userId)) {
      throw new Error('El identificador de usuario no es válido.');
    }

    return this.authGateway.getManagedUser(userId);
  }
}

export class SetManagedUserActiveUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(input: SetManagedUserActiveInput): Promise<ManagedUser> {
    if (!isUuidText(input.userId)) {
      throw new Error('El identificador de usuario no es válido.');
    }

    return this.authGateway.setManagedUserActive(input);
  }
}

export class ResetManagedUserPasswordUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: ResetManagedUserPasswordInput): Promise<void> {
    const validation = validateResetManagedUserPasswordInput(input);
    assertValid(validation.errors, 'Revisa la nueva contraseña del usuario.');

    await this.authGateway.resetManagedUserPassword(input);
  }
}

export class GetProfileUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public execute(): Promise<UserProfile> {
    return this.authGateway.getProfile();
  }
}

export class UpdateProfileUseCase {
  constructor(private readonly authGateway: AuthGateway) {}

  public async execute(input: UpdateProfileInput): Promise<UserProfile> {
    const errors: ValidationErrors = {};
    if (input.phone !== undefined && input.phone !== null) {
      const phoneError = validateProfilePhone(input.phone);
      if (phoneError !== null) errors['phone'] = phoneError;
    }
    const name = typeof input.displayName === 'string' ? input.displayName.trim() : input.displayName;
    if (typeof name === 'string' && name.length > 0) {
      const nameError = validateDisplayName(name);
      if (nameError !== null) errors['displayName'] = nameError;
    }
    assertValid(errors, 'Revisa tus datos.');

    const payload: { displayName?: string | null; phone?: string | null } = {};
    if (input.displayName !== undefined) payload.displayName = typeof name === 'string' && name.length > 0 ? name : null;
    if (input.phone !== undefined) payload.phone = input.phone === null || input.phone.trim().length === 0 ? null : input.phone.trim();
    return this.authGateway.updateProfile(payload);
  }
}

export interface AuthUseCases {
  checkHealth: Pick<CheckHealthUseCase, 'execute'>;
  login: Pick<LoginUseCase, 'execute'>;
  loginWithGoogle: Pick<LoginWithGoogleUseCase, 'execute'>;
  registerCustomer: Pick<RegisterCustomerUseCase, 'execute'>;
  verifyEmail: Pick<VerifyEmailUseCase, 'execute'>;
  resendVerification: Pick<ResendVerificationUseCase, 'execute'>;
  forgotPassword: Pick<ForgotPasswordUseCase, 'execute'>;
  resetPassword: Pick<ResetPasswordUseCase, 'execute'>;
  getCurrentUser: Pick<GetCurrentUserUseCase, 'execute'>;
  logout: Pick<LogoutUseCase, 'execute'>;
  createManagedUser: Pick<CreateManagedUserUseCase, 'execute'>;
  changePassword: Pick<ChangePasswordUseCase, 'execute'>;
  listManagedUsers: Pick<ListManagedUsersUseCase, 'execute'>;
  getManagedUser: Pick<GetManagedUserUseCase, 'execute'>;
  setManagedUserActive: Pick<SetManagedUserActiveUseCase, 'execute'>;
  resetManagedUserPassword: Pick<ResetManagedUserPasswordUseCase, 'execute'>;
  getProfile: Pick<GetProfileUseCase, 'execute'>;
  updateProfile: Pick<UpdateProfileUseCase, 'execute'>;
}

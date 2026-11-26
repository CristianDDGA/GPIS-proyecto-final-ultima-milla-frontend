import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import type { AuthGateway } from '../../domain/authGateway.js';
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
} from '../../domain/authUser.js';
import type {
  ChangePasswordInput,
  ManagedUser,
  ManagedUserFilters,
  ManagedUserPage,
  ResetManagedUserPasswordInput,
  SetManagedUserActiveInput,
  UpdateProfileInput,
  UserProfile,
} from '../../domain/managedUser.js';
import { clearToken, setToken } from './authTokenStorage.js';
import {
  isHealthOnline,
  readAuthSession,
  readAuthUser,
  readManagedUser,
  readManagedUserPage,
  readProfile,
  readRegisterOutcome,
} from './response.js';

interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string | null | undefined;
}

export class HttpAuthGateway implements AuthGateway {
  constructor(private readonly httpClient: HttpClient) {}

  /**
   * The health badge is informative only: a network failure or an unexpected payload is
   * reported as 'offline' instead of throwing, so the shell never breaks.
   */
  public async checkHealth(): Promise<HealthStatus> {
    try {
      const payload = await this.httpClient.get<unknown>('/health');
      return isHealthOnline(payload) ? 'online' : 'offline';
    } catch {
      return 'offline';
    }
  }

  public async login(input: LoginInput): Promise<AuthSession> {
    const session = readAuthSession(
      await this.httpClient.post<unknown>('/auth/login', {
        email: input.email,
        password: input.password,
      }),
    );

    setToken(session.token);
    return session;
  }

  public async loginWithGoogle(idToken: string): Promise<AuthSession> {
    const session = readAuthSession(
      await this.httpClient.post<unknown>('/auth/google', { idToken }),
    );

    setToken(session.token);
    return session;
  }

  public async registerCustomer(input: RegisterCustomerInput): Promise<RegisterCustomerOutcome> {
    const request: RegisterRequest = {
      email: input.email,
      password: input.password,
    };

    if (input.displayName !== undefined) {
      request.displayName = input.displayName;
    }

    const outcome = readRegisterOutcome(
      await this.httpClient.post<unknown>('/auth/register', request),
    );

    // En modo verificación no hay token todavía: la sesión se abre al confirmar el código.
    if (outcome.kind === 'session') {
      setToken(outcome.session.token);
    }

    return outcome;
  }

  public async verifyEmail(input: VerifyEmailInput): Promise<AuthSession> {
    const session = readAuthSession(
      await this.httpClient.post<unknown>('/auth/verify-email', {
        email: input.email,
        code: input.code,
      }),
    );

    setToken(session.token);
    return session;
  }

  public async resendVerification(email: string): Promise<void> {
    await this.httpClient.post<unknown>('/auth/resend-verification', { email });
  }

  public async forgotPassword(input: ForgotPasswordInput): Promise<void> {
    await this.httpClient.post<unknown>('/auth/forgot-password', { email: input.email });
  }

  public async resetPassword(input: ResetPasswordInput): Promise<void> {
    await this.httpClient.post<unknown>('/auth/reset-password', {
      email: input.email,
      code: input.code,
      newPassword: input.newPassword,
    });
  }

  public async getCurrentUser(): Promise<AuthUser> {
    return readAuthUser(await this.httpClient.get<unknown>('/auth/me'));
  }

  public async logout(): Promise<void> {
    try {
      await this.httpClient.post<unknown>('/auth/logout');
    } finally {
      // The local session is dropped even when the revocation call fails.
      clearToken();
    }
  }

  public async changePassword(input: ChangePasswordInput): Promise<AuthSession> {
    const session = readAuthSession(
      await this.httpClient.post<unknown>('/auth/change-password', {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    );

    setToken(session.token);
    return session;
  }

  public async listManagedUsers(filters: ManagedUserFilters = {}): Promise<ManagedUserPage> {
    const params = new URLSearchParams();

    if (filters.role !== undefined && filters.role !== 'all') {
      params.set('role', filters.role);
    }
    if (filters.isActive !== undefined && filters.isActive !== 'all') {
      params.set('isActive', String(filters.isActive));
    }

    const query = filters.q?.trim() ?? '';
    if (query.length > 0) {
      params.set('q', query);
    }
    if (filters.limit !== undefined) {
      params.set('limit', String(filters.limit));
    }
    if (filters.offset !== undefined) {
      params.set('offset', String(filters.offset));
    }

    const suffix = params.toString();
    return readManagedUserPage(
      await this.httpClient.get<unknown>('/auth/users' + (suffix.length > 0 ? '?' + suffix : '')),
    );
  }

  public async getManagedUser(userId: string): Promise<ManagedUser> {
    return readManagedUser(
      await this.httpClient.get<unknown>('/auth/users/' + encodeURIComponent(userId)),
    );
  }

  public async setManagedUserActive(input: SetManagedUserActiveInput): Promise<ManagedUser> {
    return readManagedUser(
      await this.httpClient.patch<unknown>('/auth/users/' + encodeURIComponent(input.userId), {
        isActive: input.isActive,
      }),
    );
  }

  public async getProfile(): Promise<UserProfile> {
    return readProfile(await this.httpClient.get<unknown>('/auth/me/profile'));
  }

  public async updateProfile(input: UpdateProfileInput): Promise<UserProfile> {
    const body: Record<string, string | null> = {};
    if (input.displayName !== undefined) body['displayName'] = input.displayName;
    if (input.phone !== undefined) body['phone'] = input.phone;
    return readProfile(await this.httpClient.patch<unknown>('/auth/me/profile', body));
  }

  public async resetManagedUserPassword(input: ResetManagedUserPasswordInput): Promise<void> {
    await this.httpClient.post<unknown>(
      '/auth/users/' + encodeURIComponent(input.userId) + '/reset-password',
      { newPassword: input.newPassword },
    );
  }
}
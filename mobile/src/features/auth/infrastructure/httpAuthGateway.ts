import type {MobileHttpClient} from '../../../shared/infrastructure/http/httpClient';
import type {
  AdminUserListFilters,
  AdminUserView,
  AdminUsersPage,
  AuthRole,
  AuthSession,
  AuthUser,
  EmailVerifiedVia,
  PublicRole,
  RegisterCustomerOutcome,
} from '../domain/authUser';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRole(value: unknown): AuthRole {
  if (value === 'personal' || value === 'repartidor' || value === 'cliente') {
    return value;
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

function asPublicRole(value: unknown, role: AuthRole): PublicRole {
  if (value === 'admin' || value === 'repartidor' || value === 'cliente') {
    return value;
  }
  return role === 'personal' ? 'admin' : role;
}

function parseUser(value: unknown): AuthUser {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.email !== 'string') {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  const role = asRole(value.role);
  return {
    id: value.id,
    authSubject: typeof value.authSubject === 'string' ? value.authSubject : value.email,
    email: value.email,
    role,
    publicRole: asPublicRole(value.publicRole, role),
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
    isActive: typeof value.isActive === 'boolean' ? value.isActive : true,
    courierId: typeof value.courierId === 'string' ? value.courierId : null,
    emailVerified: typeof value.emailVerified === 'boolean' ? value.emailVerified : true,
  };
}

function parseAdminUser(value: unknown): AdminUserView {
  const base = parseUser(value);
  const raw = value as Record<string, unknown>;
  const via = raw.emailVerifiedVia;
  const emailVerifiedVia: EmailVerifiedVia | null =
    via === 'code' || via === 'admin' || via === 'legacy' || via === 'demo' || via === 'google'
      ? via
      : null;
  return {
    ...base,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : '',
    emailVerifiedVia,
  };
}

function parseSession(payload: unknown): AuthSession {
  if (!isRecord(payload) || typeof payload.token !== 'string') {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  return {token: payload.token, user: parseUser(payload.user)};
}

function parseRegisterOutcome(payload: unknown): RegisterCustomerOutcome {
  if (!isRecord(payload)) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  const user = parseUser(payload.user);
  if (typeof payload.token === 'string' && payload.token.length > 0) {
    return {kind: 'session', token: payload.token, user};
  }
  if (payload.verificationRequired === true) {
    return {kind: 'verification_required', user};
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

export class HttpAuthGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async login(email: string, password: string): Promise<AuthSession> {
    return parseSession(await this.http.post<unknown>('/auth/login', {email, password}));
  }

  async registerCustomer(input: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<RegisterCustomerOutcome> {
    const body: Record<string, unknown> = {email: input.email, password: input.password};
    if (input.displayName && input.displayName.trim().length > 0) {
      body.displayName = input.displayName.trim();
    }
    return parseRegisterOutcome(await this.http.post<unknown>('/auth/register', body));
  }

  async verifyEmail(email: string, code: string): Promise<AuthSession> {
    return parseSession(await this.http.post<unknown>('/auth/verify-email', {email, code}));
  }

  async resendVerification(email: string): Promise<void> {
    await this.http.post<unknown>('/auth/resend-verification', {email});
  }

  async forgotPassword(email: string): Promise<void> {
    await this.http.post<unknown>('/auth/forgot-password', {email});
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    await this.http.post<unknown>('/auth/reset-password', {email, code, newPassword});
  }

  async getMe(): Promise<AuthUser> {
    const payload = await this.http.get<unknown>('/auth/me');
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseUser(payload.user);
  }

  async logout(): Promise<void> {
    await this.http.post<unknown>('/auth/logout', {});
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthSession> {
    return parseSession(
      await this.http.post<unknown>('/auth/change-password', {currentPassword, newPassword}),
    );
  }

  async listUsers(filters: AdminUserListFilters = {}): Promise<AdminUsersPage> {
    const query = new URLSearchParams();
    if (filters.role) query.set('role', filters.role);
    if (filters.isActive !== undefined) query.set('isActive', filters.isActive ? 'true' : 'false');
    if (filters.q && filters.q.trim().length > 0) query.set('q', filters.q.trim());
    if (filters.limit !== undefined) query.set('limit', String(filters.limit));
    if (filters.offset !== undefined) query.set('offset', String(filters.offset));
    const suffix = query.toString();
    const payload = await this.http.get<unknown>(`/auth/users${suffix ? `?${suffix}` : ''}`);
    if (
      !isRecord(payload) ||
      !Array.isArray(payload.items) ||
      typeof payload.total !== 'number' ||
      typeof payload.limit !== 'number' ||
      typeof payload.offset !== 'number'
    ) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return {
      items: payload.items.map(parseAdminUser),
      total: payload.total,
      limit: payload.limit,
      offset: payload.offset,
    };
  }

  async getUser(userId: string): Promise<AdminUserView> {
    const payload = await this.http.get<unknown>(`/auth/users/${encodeURIComponent(userId)}`);
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseAdminUser(payload.user);
  }

  async createManagedUser(input: {
    email: string;
    password: string;
    role: 'admin' | 'repartidor' | 'cliente';
    displayName?: string;
  }): Promise<AuthUser> {
    const payload = await this.http.post<unknown>('/auth/users', input);
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseUser(payload.user);
  }

  async setUserActive(userId: string, isActive: boolean): Promise<AdminUserView> {
    const payload = await this.http.patch<unknown>(
      `/auth/users/${encodeURIComponent(userId)}`,
      {isActive},
    );
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseAdminUser(payload.user);
  }

  async adminResetPassword(userId: string, newPassword: string): Promise<void> {
    await this.http.post<unknown>(
      `/auth/users/${encodeURIComponent(userId)}/reset-password`,
      {newPassword},
    );
  }
}

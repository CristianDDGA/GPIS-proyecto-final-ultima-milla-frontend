import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import type { AuthGateway } from '../../domain/authGateway.js';
import type {
  AuthSession,
  AuthUser,
  CreateManagedUserInput,
  HealthStatus,
  LoginInput,
  RegisterCustomerInput,
} from '../../domain/authUser.js';
import { clearToken, setToken } from './authTokenStorage.js';
import { isHealthOnline, readAuthSession, readAuthUser } from './response.js';

interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string | null | undefined;
}

interface CreateManagedUserRequest {
  email: string;
  password: string;
  role: string;
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

  public async registerCustomer(input: RegisterCustomerInput): Promise<AuthSession> {
    const request: RegisterRequest = {
      email: input.email,
      password: input.password,
    };

    if (input.displayName !== undefined) {
      request.displayName = input.displayName;
    }

    const session = readAuthSession(
      await this.httpClient.post<unknown>('/auth/register', request),
    );

    setToken(session.token);
    return session;
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

  public async createManagedUser(input: CreateManagedUserInput): Promise<AuthUser> {
    const request: CreateManagedUserRequest = {
      email: input.email,
      password: input.password,
      role: input.role,
    };

    if (input.displayName !== undefined) {
      request.displayName = input.displayName;
    }

    return readAuthUser(await this.httpClient.post<unknown>('/auth/users', request));
  }
}

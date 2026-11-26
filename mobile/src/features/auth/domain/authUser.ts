export type AuthRole = 'personal' | 'repartidor' | 'cliente';
export type PublicRole = 'admin' | 'repartidor' | 'cliente';
export type EmailVerifiedVia = 'code' | 'admin' | 'legacy' | 'demo' | 'google';

export interface AuthUser {
  readonly id: string;
  readonly authSubject: string;
  readonly email: string;
  readonly role: AuthRole;
  readonly publicRole: PublicRole;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly courierId: string | null;
  readonly emailVerified: boolean;
}

export interface AdminUserView extends AuthUser {
  readonly createdAt: string;
  readonly emailVerifiedVia: EmailVerifiedVia | null;
}

export interface AuthSession {
  readonly token: string;
  readonly user: AuthUser;
}

export type RegisterCustomerOutcome =
  | {readonly kind: 'session'; readonly token: string; readonly user: AuthUser}
  | {readonly kind: 'verification_required'; readonly user: AuthUser};

export interface AdminUsersPage {
  readonly items: readonly AdminUserView[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface AdminUserListFilters {
  readonly role?: 'admin' | 'repartidor' | 'cliente';
  readonly isActive?: boolean;
  readonly q?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export const ROLE_LABELS: Readonly<Record<AuthRole, string>> = {
  personal: 'Administrador',
  repartidor: 'Repartidor',
  cliente: 'Cliente',
};

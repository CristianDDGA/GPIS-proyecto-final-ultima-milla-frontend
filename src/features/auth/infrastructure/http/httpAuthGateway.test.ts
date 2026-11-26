import { describe, expect, it } from 'vitest';
import { HttpAuthGateway } from './httpAuthGateway.js';
import { AUTH_TOKEN_STORAGE_KEY, clearToken, getToken, setToken } from './authTokenStorage.js';
import { readManagedUserPage, readRegisterOutcome, CONTRACT_ERROR_MESSAGE } from './response.js';
import { buildAuthUser, createFakeHttpClient, VALID_UUID } from '../../../../test/fakeHttpClient.js';

const SESSION = { token: 'jwt-123', user: buildAuthUser() };
const MANAGED = {
  ...buildAuthUser(),
  createdAt: '2026-11-19T10:00:00.000Z',
  emailVerifiedVia: 'code',
};

describe('almacenamiento del token', () => {
  it('guarda, lee y borra el JWT', () => {
    expect(getToken()).toBeNull();
    setToken('abc');
    expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('abc');
    expect(getToken()).toBe('abc');
    clearToken();
    expect(getToken()).toBeNull();
    setToken('   ');
    expect(getToken()).toBeNull();
  });
});

describe('HttpAuthGateway', () => {
  it('login guarda el token de la sesión', async () => {
    const http = createFakeHttpClient(SESSION);
    const session = await new HttpAuthGateway(http).login({ email: 'a@b.ec', password: 'x' });
    expect(http.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.ec', password: 'x' });
    expect(session.user.email).toBe('cliente@millast.ec');
    expect(getToken()).toBe('jwt-123');
  });

  it('login con Google envía el idToken', async () => {
    const http = createFakeHttpClient(SESSION);
    await new HttpAuthGateway(http).loginWithGoogle('google-id-token');
    expect(http.post).toHaveBeenCalledWith('/auth/google', { idToken: 'google-id-token' });
  });

  it('rechaza respuestas que no cumplen el contrato', async () => {
    const http = createFakeHttpClient({ token: 'x', user: { id: 'no-uuid' } });
    await expect(new HttpAuthGateway(http).login({ email: 'a@b.ec', password: 'x' })).rejects.toThrow(
      CONTRACT_ERROR_MESSAGE,
    );
  });

  it('el registro con verificación pendiente no abre sesión', async () => {
    const http = createFakeHttpClient({ verificationRequired: true, user: buildAuthUser({ emailVerified: false }) });
    const outcome = await new HttpAuthGateway(http).registerCustomer({ email: 'a@b.ec', password: 'x', displayName: 'Ana' });
    expect(outcome.kind).toBe('verification_required');
    expect(getToken()).toBeNull();
  });

  it('el logout borra el token aunque el servidor falle', async () => {
    setToken('vieja');
    const http = createFakeHttpClient();
    http.post.mockRejectedValueOnce(new Error('caído'));
    await expect(new HttpAuthGateway(http).logout()).rejects.toThrow('caído');
    expect(getToken()).toBeNull();
  });

  it('health informa offline ante errores o respuestas raras', async () => {
    expect(await new HttpAuthGateway(createFakeHttpClient({ status: 'ok' })).checkHealth()).toBe('online');
    expect(await new HttpAuthGateway(createFakeHttpClient({ status: 'degraded' })).checkHealth()).toBe('offline');
    const failing = createFakeHttpClient();
    failing.get.mockRejectedValueOnce(new Error('503'));
    expect(await new HttpAuthGateway(failing).checkHealth()).toBe('offline');
  });

  it('lista usuarios con filtros en la query', async () => {
    const http = createFakeHttpClient({ items: [MANAGED], total: 1, limit: 20, offset: 0 });
    const page = await new HttpAuthGateway(http).listManagedUsers({
      role: 'repartidor',
      isActive: true,
      q: '  ana ',
      limit: 20,
      offset: 0,
    });
    expect(http.get).toHaveBeenCalledWith('/auth/users?role=repartidor&isActive=true&q=ana&limit=20&offset=0');
    expect(page.total).toBe(1);
  });

  it('activa usuarios y restablece claves con el id codificado', async () => {
    const http = createFakeHttpClient({ user: MANAGED });
    const gateway = new HttpAuthGateway(http);
    await gateway.setManagedUserActive({ userId: VALID_UUID, isActive: false });
    expect(http.patch).toHaveBeenCalledWith(`/auth/users/${VALID_UUID}`, { isActive: false });
    await gateway.resetManagedUserPassword({ userId: VALID_UUID, newPassword: 'Nueva-Clave-2026' });
    expect(http.post).toHaveBeenCalledWith(`/auth/users/${VALID_UUID}/reset-password`, {
      newPassword: 'Nueva-Clave-2026',
    });
  });

  it('los lectores de respuesta validan cada elemento', () => {
    expect(() => readRegisterOutcome({})).toThrow(CONTRACT_ERROR_MESSAGE);
    expect(() => readManagedUserPage({ items: [{}], total: 1, limit: 1, offset: 0 })).toThrow(CONTRACT_ERROR_MESSAGE);
  });
});

import { vi } from 'vitest';
import type { HttpClient } from '../shared/infrastructure/http/httpClient.js';

/** Cliente HTTP falso: registra cada llamada y devuelve lo que la prueba indique. */
export function createFakeHttpClient(response: unknown = {}) {
  const reply = () => Promise.resolve(response);
  const client = {
    get: vi.fn(reply),
    post: vi.fn(reply),
    put: vi.fn(reply),
    patch: vi.fn(reply),
    delete: vi.fn(reply),
    putBinary: vi.fn(reply),
    getBlob: vi.fn(() => Promise.resolve(new Blob())),
  };
  return client as typeof client & HttpClient;
}

export const VALID_UUID = '3f2b8c1e-9a4d-4c2b-8e1f-123456789abc';
export const OTHER_UUID = '7a1d2c3b-4e5f-4a6b-9c7d-abcdefabcdef';

export function buildAuthUser(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_UUID,
    authSubject: 'local|cliente',
    email: 'cliente@millast.ec',
    role: 'cliente',
    publicRole: 'cliente',
    displayName: 'Ana Pérez',
    isActive: true,
    courierId: null,
    emailVerified: true,
    ...overrides,
  };
}

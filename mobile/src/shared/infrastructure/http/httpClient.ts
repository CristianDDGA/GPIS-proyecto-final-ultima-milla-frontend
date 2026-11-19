export interface RequestOptions {
  readonly headers?: Readonly<Record<string, string>>;
  readonly timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface MobileHttpClientConfig {
  readonly getBaseUrl: () => string;
  readonly getAccessToken: () => string | null;
  readonly onUnauthorized?: () => void;
}

const DEFAULT_TIMEOUT_MS = 12_000;

const PUBLIC_UNAUTHENTICATED_PATHS = [
  '/health',
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
];

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  if (cleaned.length % 4 !== 0) {
    throw new Error('Base64 inválido.');
  }
  const padding = cleaned.endsWith('==') ? 2 : cleaned.endsWith('=') ? 1 : 0;
  const outputLength = Math.floor((cleaned.length * 3) / 4) - padding;
  const output = new Uint8Array(Math.max(0, outputLength));
  let outIndex = 0;

  for (let i = 0; i < cleaned.length; i += 4) {
    const a = BASE64_ALPHABET.indexOf(cleaned.charAt(i));
    const b = BASE64_ALPHABET.indexOf(cleaned.charAt(i + 1));
    const cChar = cleaned.charAt(i + 2);
    const dChar = cleaned.charAt(i + 3);
    const c = cChar === '=' ? 0 : BASE64_ALPHABET.indexOf(cChar);
    const d = dChar === '=' ? 0 : BASE64_ALPHABET.indexOf(dChar);

    if (a < 0 || b < 0 || c < 0 || d < 0) {
      throw new Error('Base64 inválido.');
    }

    const triple = a * 262144 + b * 4096 + c * 64 + d;
    if (outIndex < output.length) output[outIndex++] = Math.floor(triple / 65536) % 256;
    if (cChar !== '=' && outIndex < output.length) output[outIndex++] = Math.floor(triple / 256) % 256;
    if (dChar !== '=' && outIndex < output.length) output[outIndex++] = triple % 256;
  }
  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? (bytes[i + 1] ?? 0) : 0;
    const b2 = hasB2 ? (bytes[i + 2] ?? 0) : 0;

    const triple = b0 * 65536 + b1 * 256 + b2;
    result += BASE64_ALPHABET.charAt(Math.floor(triple / 262144) % 64);
    result += BASE64_ALPHABET.charAt(Math.floor(triple / 4096) % 64);
    result += hasB1 ? BASE64_ALPHABET.charAt(Math.floor(triple / 64) % 64) : '=';
    result += hasB2 ? BASE64_ALPHABET.charAt(triple % 64) : '=';
  }
  return result;
}

export function createIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = ((bytes[6] ?? 0) % 16) + 64;
  bytes[8] = ((bytes[8] ?? 0) % 64) + 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function shouldTriggerUnauthorized(path: string): boolean {
  const normalized = normalizePath(path).split('?')[0] ?? path;
  return !PUBLIC_UNAUTHENTICATED_PATHS.some(
    prefix => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}

function extractErrorEnvelope(
  payload: unknown,
  fallbackStatus: number,
): {readonly code: string; readonly message: string} {
  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as Record<string, unknown>;
    const nested =
      typeof obj.error === 'object' && obj.error !== null
        ? (obj.error as Record<string, unknown>)
        : undefined;
    const code =
      (typeof obj.code === 'string' && obj.code.trim()) ||
      (nested && typeof nested.code === 'string' && nested.code.trim()) ||
      `HTTP_${fallbackStatus}`;
    const message =
      (typeof obj.message === 'string' && obj.message.trim()) ||
      (nested && typeof nested.message === 'string' && nested.message.trim()) ||
      `Error HTTP ${fallbackStatus}`;
    return {code, message};
  }
  return {code: `HTTP_${fallbackStatus}`, message: `Error HTTP ${fallbackStatus}`};
}

export class MobileHttpClient {
  constructor(private readonly config: MobileHttpClientConfig) {}

  get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.requestJson<T>('GET', path, undefined, options);
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.requestJson<T>('POST', path, body, options);
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.requestJson<T>('PUT', path, body, options);
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.requestJson<T>('PATCH', path, body, options);
  }

  async putBinaryBase64<T>(
    path: string,
    base64: string,
    contentType: 'image/jpeg' | 'image/png',
    options?: RequestOptions,
  ): Promise<T> {
    const bytes = base64ToBytes(base64);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return this.executeRaw<T>(
      'PUT',
      path,
      buffer,
      {
        Accept: 'application/json',
        'Content-Type': contentType,
        ...(options?.headers ?? {}),
      },
      options?.timeoutMs,
    );
  }

  async getImageDataUri(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
    const url = `${this.config.getBaseUrl().replace(/\/$/, '')}${normalizePath(path)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {Accept: 'image/jpeg,image/png,*/*'};
      const token = this.config.getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      } as unknown as RequestInit);

      if (response.status === 401 && shouldTriggerUnauthorized(path)) {
        this.config.onUnauthorized?.();
      }

      if (!response.ok) {
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          payload = undefined;
        }
        const {code, message} = extractErrorEnvelope(payload, response.status);
        throw new HttpError(response.status, code, message, payload);
      }

      const mime = response.headers.get('content-type') || 'image/jpeg';
      const cleanMime = mime.split(';')[0]?.trim() || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const base64 = bytesToBase64(new Uint8Array(arrayBuffer));
      return `data:${cleanMime};base64,${base64}`;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'La descarga de imagen excedió el tiempo de espera.'
          : 'No se pudo conectar con el servidor.';
      throw new HttpError(0, 'NETWORK_ERROR', message);
    } finally {
      clearTimeout(timer);
    }
  }

  private requestJson<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH',
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(body !== undefined ? {'Content-Type': 'application/json'} : {}),
      ...(options?.headers ?? {}),
    };
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    return this.executeRaw<T>(method, path, serialized, headers, options?.timeoutMs);
  }

  private async executeRaw<T>(
    method: string,
    path: string,
    body: unknown,
    baseHeaders: Readonly<Record<string, string>>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const url = `${this.config.getBaseUrl().replace(/\/$/, '')}${normalizePath(path)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {...baseHeaders};
      const token = this.config.getAccessToken();
      if (token && !headers.Authorization) {
        headers.Authorization = `Bearer ${token}`;
      }

      const init: Record<string, unknown> = {
        method,
        headers,
        signal: controller.signal,
      };
      if (body !== undefined) {
        init.body = body;
      }

      const response = await fetch(url, init as unknown as RequestInit);

      if (response.status === 401 && shouldTriggerUnauthorized(path)) {
        this.config.onUnauthorized?.();
      }

      const rawText = await response.text();
      let payload: unknown;
      if (rawText.length > 0) {
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = rawText;
        }
      }

      if (!response.ok) {
        const {code, message} = extractErrorEnvelope(payload, response.status);
        throw new HttpError(response.status, code, message, payload);
      }

      return payload as T;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? 'La solicitud excedió el tiempo de espera. Verifica el servidor.'
          : 'No se pudo conectar con el servidor API. Verifica la URL y que el backend esté en línea.';
      throw new HttpError(0, 'NETWORK_ERROR', message);
    } finally {
      clearTimeout(timer);
    }
  }
}

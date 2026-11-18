function readNestedRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (!(key in record)) {
    return undefined;
  }

  const nested = record[key];
  if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) {
    return undefined;
  }

  return nested as Record<string, unknown>;
}

function readString(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const candidate = record[key];
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : undefined;
}

export class HttpError extends Error {
  public readonly code: string | undefined;

  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly details?: unknown,
  ) {
    const detailMessage =
      readString(details, 'message') ?? readString(readNestedRecord(details, 'error'), 'message');

    super(detailMessage ?? `Error HTTP ${status}: ${statusText}`);
    this.name = 'HttpError';
    this.code = readString(details, 'code') ?? readString(readNestedRecord(details, 'error'), 'code');
  }
}

export type RequestOptions = Omit<RequestInit, 'headers'> & {
  headers?: Record<string, string> | undefined;
};

export interface HttpClient {
  get<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>;
  put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>;
  patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>;
  delete<T>(endpoint: string, options?: RequestOptions): Promise<T>;
  /** Subida binaria autenticada (express.raw) con Content-Type explícito. */
  putBinary<T>(
    endpoint: string,
    body: Blob | ArrayBuffer,
    contentType: string,
    options?: RequestOptions,
  ): Promise<T>;
  /** Descarga autenticada de un recurso binario (imágenes privadas). */
  getBlob(endpoint: string, options?: RequestOptions): Promise<Blob>;
}

export interface HttpClientAuthConfig {
  getAccessToken?: (() => string | null) | undefined;
  onUnauthorized?: (() => void) | undefined;
}

const UNAUTHENTICATED_ENDPOINTS: ReadonlySet<string> = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/logout',
  '/health',
]);

function normalizeEndpoint(endpoint: string): string {
  const withoutQuery = endpoint.split('?')[0] ?? endpoint;
  const withoutFragment = withoutQuery.split('#')[0] ?? withoutQuery;
  return withoutFragment.startsWith('/') ? withoutFragment : `/${withoutFragment}`;
}

function headerKey(headers: Record<string, string>, name: string): string | undefined {
  const lowerCaseName = name.toLowerCase();
  return Object.keys(headers).find((key) => key.toLowerCase() === lowerCaseName);
}

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;
  private getAccessToken: (() => string | null) | undefined;
  private onUnauthorized: (() => void) | undefined;

  constructor(baseUrl?: string, authConfig: HttpClientAuthConfig = {}) {
    const rawBaseUrl = baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
    this.baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    this.getAccessToken = authConfig.getAccessToken;
    this.onUnauthorized = authConfig.onUnauthorized;
  }

  public setAccessTokenProvider(provider: (() => string | null) | undefined): void {
    this.getAccessToken = provider;
  }

  public setUnauthorizedHandler(handler: (() => void) | undefined): void {
    this.onUnauthorized = handler;
  }

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${this.baseUrl}${cleanEndpoint}`;
  }

  private applyAuthorizationHeader(headers: Record<string, string>): void {
    const token = this.getAccessToken?.();
    if (!token || token.trim().length === 0) {
      return;
    }
    if (headerKey(headers, 'Authorization') !== undefined) {
      return;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  private async request<T>(endpoint: string, init: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint);

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init.headers ?? {}),
    };

    this.applyAuthorizationHeader(headers);

    let body = init.body;
    if (init.body && typeof init.body === 'object' && !(init.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(init.body);
    }

    const { headers: _ignoredHeaders, body: _ignoredBody, ...restInit } = init;
    const fetchConfig: RequestInit = {
      ...restInit,
      headers,
    };

    if (body !== undefined) {
      fetchConfig.body = body;
    }

    let response: Response;
    try {
      response = await fetch(url, fetchConfig);
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'Error de red';
      throw new HttpError(0, 'NetworkError', { message: `No se pudo conectar con el servidor: ${message}` });
    }

    if (!response.ok) {
      let errorDetails: unknown;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text();
      }

      if (response.status === 401 && !UNAUTHENTICATED_ENDPOINTS.has(normalizeEndpoint(endpoint))) {
        this.onUnauthorized?.();
      }

      throw new HttpError(response.status, response.statusText, errorDetails);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  public get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const init: RequestOptions = {
      ...options,
      method: 'POST',
    };
    if (body !== undefined) {
      init.body = body as BodyInit;
    }
    return this.request<T>(endpoint, init);
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const init: RequestOptions = {
      ...options,
      method: 'PUT',
    };
    if (body !== undefined) {
      init.body = body as BodyInit;
    }
    return this.request<T>(endpoint, init);
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const init: RequestOptions = {
      ...options,
      method: 'PATCH',
    };
    if (body !== undefined) {
      init.body = body as BodyInit;
    }
    return this.request<T>(endpoint, init);
  }

  public delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
  private async rawRequest(
    endpoint: string,
    init: RequestOptions,
    accept: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Accept: accept,
      ...(init.headers ?? {}),
    };
    this.applyAuthorizationHeader(headers);

    const { headers: _ignoredHeaders, ...restInit } = init;
    let response: Response;
    try {
      response = await fetch(this.buildUrl(endpoint), { ...restInit, headers });
    } catch (networkError) {
      const message = networkError instanceof Error ? networkError.message : 'Error de red';
      throw new HttpError(0, 'NetworkError', {
        message: 'No se pudo conectar con el servidor: ' + message,
      });
    }

    if (!response.ok) {
      let errorDetails: unknown;
      try {
        errorDetails = await response.json();
      } catch {
        errorDetails = await response.text();
      }

      if (response.status === 401 && !UNAUTHENTICATED_ENDPOINTS.has(normalizeEndpoint(endpoint))) {
        this.onUnauthorized?.();
      }

      throw new HttpError(response.status, response.statusText, errorDetails);
    }

    return response;
  }

  public async putBinary<T>(
    endpoint: string,
    body: Blob | ArrayBuffer,
    contentType: string,
    options?: RequestOptions,
  ): Promise<T> {
    const response = await this.rawRequest(
      endpoint,
      {
        ...options,
        method: 'PUT',
        body: body as BodyInit,
        headers: { ...(options?.headers ?? {}), 'Content-Type': contentType },
      },
      'application/json',
    );

    const responseType = response.headers.get('content-type');
    if (responseType && responseType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  public async getBlob(endpoint: string, options?: RequestOptions): Promise<Blob> {
    const response = await this.rawRequest(
      endpoint,
      { ...options, method: 'GET' },
      '*/*',
    );

    return response.blob();
  }
}

export const defaultHttpClient = new FetchHttpClient();
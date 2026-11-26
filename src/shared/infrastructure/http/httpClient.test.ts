import { afterEach, describe, expect, it, vi } from 'vitest';
import { FetchHttpClient, HttpError } from './httpClient.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(() => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function lastInit(fetchMock: ReturnType<typeof mockFetch>): RequestInit {
  const call = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit];
  return call[1];
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FetchHttpClient', () => {
  it('une la URL base sin dobles barras y envía JSON con el token', async () => {
    const fetchMock = mockFetch(jsonResponse({ ok: true }));
    const client = new FetchHttpClient('http://api.test/', { getAccessToken: () => 'jwt-1' });

    await expect(client.post('zones', { name: 'Centro' })).resolves.toEqual({ ok: true });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    const init = lastInit(fetchMock);
    expect(url).toBe('http://api.test/zones');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"Centro"}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer jwt-1',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
  });

  it('no pisa una cabecera Authorization explícita ni envía tokens vacíos', async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    const client = new FetchHttpClient('http://api.test', { getAccessToken: () => '  ' });
    await client.get('/orders', { headers: { authorization: 'Bearer propio' } });
    expect(lastInit(fetchMock).headers).toEqual({ Accept: 'application/json', authorization: 'Bearer propio' });
  });

  it('convierte errores de la API en HttpError con código y mensaje', async () => {
    mockFetch(jsonResponse({ error: { code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada' } }, 429));
    const client = new FetchHttpClient('http://api.test');
    const error = await client.post('/auth/login', {}).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 429, code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada' });
  });

  it('avisa la sesión vencida (401) salvo en endpoints públicos', async () => {
    const onUnauthorized = vi.fn();
    const client = new FetchHttpClient('http://api.test', { onUnauthorized });

    mockFetch(jsonResponse({ message: 'Token inválido' }, 401));
    await expect(client.get('/orders?page=1')).rejects.toThrow('Token inválido');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    mockFetch(jsonResponse({ message: 'Credenciales' }, 401));
    await expect(client.post('/auth/login', {})).rejects.toBeInstanceOf(HttpError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('reporta la caída de red como estado 0', async () => {
    mockFetch(new TypeError('Failed to fetch'));
    const client = new FetchHttpClient('http://api.test');
    await expect(client.get('/health')).rejects.toMatchObject({ status: 0, statusText: 'NetworkError' });
  });

  it('maneja 204, texto plano y errores sin JSON', async () => {
    const client = new FetchHttpClient('http://api.test');
    mockFetch(new Response(null, { status: 204 }));
    await expect(client.delete('/store/addresses/1')).resolves.toBeUndefined();

    mockFetch(new Response('pong', { status: 200, headers: { 'content-type': 'text/plain' } }));
    await expect(client.get('/ping')).resolves.toBe('pong');

    mockFetch(new Response('fallo', { status: 500, statusText: 'Internal' }));
    await expect(client.patch('/x', { a: 1 })).rejects.toMatchObject({ status: 500, message: 'Error HTTP 500: Internal' });
  });

  it('sube binarios con su Content-Type y descarga blobs', async () => {
    const client = new FetchHttpClient('http://api.test', { getAccessToken: () => 'jwt' });
    const fetchMock = mockFetch(jsonResponse({ id: 'p1' }));
    await client.putBinary('/store/admin/products/p1/image', new Blob(['x']), 'image/png');
    expect(lastInit(fetchMock).headers).toMatchObject({ 'Content-Type': 'image/png', Authorization: 'Bearer jwt' });

    mockFetch(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    const blob = await client.getBlob('/courier-applications/me/files/photo');
    expect(blob.size).toBe(3);

    mockFetch(jsonResponse({ message: 'No existe' }, 404));
    await expect(client.getBlob('/x')).rejects.toMatchObject({ status: 404 });
  });

  it('resuelve URLs relativas y respeta las absolutas', () => {
    const client = new FetchHttpClient('http://api.test');
    expect(client.resolveUrl('/img/a.png')).toBe('http://api.test/img/a.png');
    expect(client.resolveUrl('https://cdn.test/a.png')).toBe('https://cdn.test/a.png');
  });
});

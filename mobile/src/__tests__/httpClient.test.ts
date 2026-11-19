import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {
  HttpError,
  MobileHttpClient,
  base64ToBytes,
  bytesToBase64,
  createIdempotencyKey,
} from '../shared/infrastructure/http/httpClient';
import {UUID_RE} from '../shared/utils/validation';

interface MockHeaders {
  get: (key: string) => string | null;
}

interface MockResponse {
  status: number;
  ok: boolean;
  headers: MockHeaders;
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

function makeResponse(
  status: number,
  body: string | Uint8Array,
  contentType = 'application/json',
): MockResponse {
  const bytes =
    typeof body === 'string'
      ? new Uint8Array(Array.from(body, ch => ch.charCodeAt(0)))
      : body;
  const textBody = typeof body === 'string' ? body : '';
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (key: string) => (key.toLowerCase() === 'content-type' ? contentType : null),
    },
    text: async () => textBody,
    arrayBuffer: async () => {
      const buf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buf).set(bytes);
      return buf;
    },
  };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('MobileHttpClient & encoding helpers', () => {
  it('round-trips arbitrary byte arrays via Base64 without bitwise drift', () => {
    const sample = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x7f, 0x80, 0x1b]);
    const encoded = bytesToBase64(sample);
    const decoded = base64ToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(sample));

    const paddingOne = new Uint8Array([1, 2]);
    expect(Array.from(base64ToBytes(bytesToBase64(paddingOne)))).toEqual([1, 2]);
  });

  it('rejects malformed base64 strings', () => {
    expect(() => base64ToBytes('abc*def=')).toThrow();
  });

  it('generates RFC-compliant UUID v4 idempotency keys', () => {
    const a = createIdempotencyKey();
    const b = createIdempotencyKey();
    expect(UUID_RE.test(a)).toBe(true);
    expect(UUID_RE.test(b)).toBe(true);
    expect(a).not.toBe(b);
  });

  it('attaches bearer token, uploads binary ArrayBuffer, and decodes image data URIs', async () => {
    const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = jest.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        expect((init?.headers as Record<string, string>)['Content-Type']).toBe('image/png');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jwt-1');
        expect(init?.body).toBeInstanceOf(ArrayBuffer);
        return makeResponse(200, JSON.stringify({ok: true}));
      }
      return makeResponse(200, pngHeader, 'image/png; charset=binary');
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MobileHttpClient({
      getBaseUrl: () => 'http://10.0.2.2:3000/',
      getAccessToken: () => 'jwt-1',
    });

    const uploadResult = await client.putBinaryBase64<{ok: boolean}>(
      '/courier-applications/me/files/license',
      bytesToBase64(pngHeader),
      'image/png',
    );
    expect(uploadResult.ok).toBe(true);

    const dataUri = await client.getImageDataUri('/courier-applications/me/files/license');
    expect(dataUri).toBe(`data:image/png;base64,${bytesToBase64(pngHeader)}`);
  });

  it('extracts nested error envelopes and triggers onUnauthorized only for protected endpoints', async () => {
    const onUnauthorized = jest.fn();
    global.fetch = jest.fn(async () =>
      makeResponse(
        401,
        JSON.stringify({error: {code: 'TOKEN_EXPIRED', message: 'Sesión expirada'}}),
      ),
    ) as unknown as typeof fetch;

    const client = new MobileHttpClient({
      getBaseUrl: () => 'http://10.0.2.2:3000',
      getAccessToken: () => 'jwt-old',
      onUnauthorized,
    });

    await expect(client.post('/auth/login', {email: 'a@b.ec', password: 'x'})).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Sesión expirada',
    });
    expect(onUnauthorized).not.toHaveBeenCalled();

    const error = await client.get('/orders').catch((err: unknown) => err);
    expect(error).toBeInstanceOf(HttpError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

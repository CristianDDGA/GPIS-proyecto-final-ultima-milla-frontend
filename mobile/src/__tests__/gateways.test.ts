import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {HttpAuthGateway} from '../features/auth/infrastructure/httpAuthGateway';
import {HttpCourierApplicationGateway} from '../features/courier-applications/infrastructure/httpCourierApplicationGateway';
import {HttpCourierGateway} from '../features/couriers/infrastructure/httpCourierGateway';
import {HttpDeliveryGateway} from '../features/deliveries/infrastructure/httpDeliveryGateway';
import {HttpOrderGateway} from '../features/orders/infrastructure/httpOrderGateway';
import {HttpRouteGateway} from '../features/routes/infrastructure/httpRouteGateway';
import {HttpZoneGateway} from '../features/zones/infrastructure/httpZoneGateway';
import {MobileHttpClient} from '../shared/infrastructure/http/httpClient';

interface RecordedCall {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

function mockClient(handler: (call: RecordedCall) => {status: number; payload: unknown}) {
  const calls: RecordedCall[] = [];
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    const rawHeaders = (init?.headers ?? {}) as Record<string, string>;
    let parsedBody: unknown = init?.body;
    if (typeof init?.body === 'string') {
      parsedBody = JSON.parse(init.body);
    }
    const call: RecordedCall = {
      url,
      method: init?.method ?? 'GET',
      headers: rawHeaders,
      body: parsedBody,
    };
    calls.push(call);
    const res = handler(call);
    const jsonText = JSON.stringify(res.payload);
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      headers: {get: () => 'application/json'},
      text: async () => jsonText,
      arrayBuffer: async () => new ArrayBuffer(0),
    };
  }) as unknown as typeof fetch;

  const client = new MobileHttpClient({
    getBaseUrl: () => 'http://10.0.2.2:3000',
    getAccessToken: () => 'jwt-token',
  });
  return {client, calls};
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('Domain HTTP Gateways', () => {
  it('HttpAuthGateway handles login, pending verification registration, and user listing', async () => {
    const {client} = mockClient(call => {
      if (call.url.endsWith('/auth/register')) {
        return {
          status: 201,
          payload: {
            verificationRequired: true,
            user: {id: 'u1', email: 'c@millast.ec', role: 'cliente'},
          },
        };
      }
      if (call.url.includes('/auth/users')) {
        return {
          status: 200,
          payload: {
            items: [{id: 'u1', email: 'c@millast.ec', role: 'cliente', createdAt: '2026-11-01'}],
            total: 1,
            limit: 15,
            offset: 0,
          },
        };
      }
      return {
        status: 200,
        payload: {token: 'jwt-new', user: {id: 'u1', email: 'c@millast.ec', role: 'personal'}},
      };
    });

    const gateway = new HttpAuthGateway(client);
    const session = await gateway.login('c@millast.ec', 'Clave#2026');
    expect(session.user.publicRole).toBe('admin');

    const reg = await gateway.registerCustomer({email: 'c@millast.ec', password: 'Clave#2026'});
    expect(reg.kind).toBe('verification_required');

    const page = await gateway.listUsers({role: 'cliente', limit: 15, offset: 0});
    expect(page.total).toBe(1);
    expect(page.items[0]?.id).toBe('u1');
  });

  it('HttpZoneGateway & HttpOrderGateway parse arrays, item envelopes, and filters', async () => {
    const {client, calls} = mockClient(call => {
      if (call.url.endsWith('/zones')) {
        return {status: 200, payload: [{id: 'z1', name: 'Norte'}]};
      }
      return {
        status: 200,
        payload: {
          items: [
            {
              id: 'o1',
              zoneId: 'z1',
              deliveryAddress: 'Av. Colón',
              deliveryDate: '2026-11-20',
              deliveryTime: '10:30',
              status: 'pendiente',
            },
          ],
        },
      };
    });

    const zones = await new HttpZoneGateway(client).getAll();
    expect(zones).toHaveLength(1);

    const orders = await new HttpOrderGateway(client).getAll({deliveryDate: '2026-11-20', zoneId: 'z1'});
    expect(orders[0]?.status).toBe('pendiente');
    expect(calls[1]?.url).toContain('deliveryDate=2026-11-20');
    expect(calls[1]?.url).toContain('zoneId=z1');
  });

  it('HttpRouteGateway sends Idempotency-Key on plan/late-order and sorts stops', async () => {
    const {client, calls} = mockClient(call => {
      if (call.url.endsWith('/route-plans')) {
        return {status: 200, payload: {serviceDate: '2026-11-20', routeIds: ['r1']}};
      }
      if (call.url.endsWith('/late-order-placements')) {
        return {status: 200, payload: {orderId: 'o9', status: 'pendiente', reason: 'NO_CAPACITY'}};
      }
      return {
        status: 200,
        payload: {
          id: 'r1',
          zoneId: 'z1',
          serviceDate: '2026-11-20',
          status: 'planificada',
          capacityLimit: 5,
          occupiedSlots: 2,
          stops: [
            {orderId: 'o2', position: 2, deliveryAddress: 'B', status: 'asignado_a_ruta'},
            {orderId: 'o1', position: 1, deliveryAddress: 'A', status: 'asignado_a_ruta'},
          ],
        },
      };
    });

    const gateway = new HttpRouteGateway(client);
    const plan = await gateway.planRoutes('2026-11-20', 5);
    expect(plan.routeIds).toEqual(['r1']);
    expect(calls[0]?.headers['Idempotency-Key']).toBeTruthy();

    const detail = await gateway.getRouteById('r1');
    expect(detail.stops.map(s => s.orderId)).toEqual(['o1', 'o2']);

    const late = await gateway.placeLateOrder('o9', 5);
    expect(late).toEqual({orderId: 'o9', status: 'pendiente', reason: 'NO_CAPACITY'});
    expect(calls[2]?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('HttpCourierGateway & HttpDeliveryGateway map active routes and idempotent status updates', async () => {
    const {client, calls} = mockClient(call => {
      if (call.url.endsWith('/couriers/c1/route')) {
        return {status: 200, payload: {item: null}};
      }
      if (call.url.endsWith('/delivery-status-changes')) {
        return {status: 200, payload: {orderId: 'o1', status: 'recogido', version: '2'}};
      }
      return {
        status: 200,
        payload: {id: 'c1', displayName: 'Carlos', maxOrdersPerTrip: 8, isAvailable: true},
      };
    });

    const courierGateway = new HttpCourierGateway(client);
    const updated = await courierGateway.updateAvailability('c1', true);
    expect(updated.isAvailable).toBe(true);
    await expect(courierGateway.getActiveRoute('c1')).resolves.toBeNull();

    const deliveryGateway = new HttpDeliveryGateway(client);
    const res = await deliveryGateway.changeStatus({
      orderId: 'o1',
      newStatus: 'recogido',
      expectedVersion: '1',
    });
    expect(res.version).toBe('2');
    expect(calls[2]?.headers['Idempotency-Key']).toBeTruthy();
  });

  it('HttpCourierApplicationGateway handles 200 null application and approval payloads', async () => {
    const {client} = mockClient(call => {
      if (call.method === 'GET' && call.url.endsWith('/courier-applications/me')) {
        return {status: 200, payload: {application: null}};
      }
      return {
        status: 200,
        payload: {
          application: {
            id: 'app-1',
            userId: 'u-1',
            status: 'aprobada',
            fullName: 'Lucía Vera',
            nationalId: '1710034065',
            phone: '0991234567',
            birthDate: '1997-04-12',
            vehicleType: 'moto',
            licenseNumber: '1710034065',
            licenseCategory: 'A',
            licenseExpiresOn: '2029-05-01',
            files: [{kind: 'license', contentType: 'image/png', sizeBytes: 1200, uploadedAt: '2026-11-18'}],
            approvedCapacity: 12,
            applicantEmail: 'lucia@millast.ec',
          },
        },
      };
    });

    const gateway = new HttpCourierApplicationGateway(client);
    await expect(gateway.getMine()).resolves.toBeNull();

    const approved = await gateway.approve('app-1', 12);
    expect(approved.status).toBe('aprobada');
    expect(approved.approvedCapacity).toBe(12);
    expect(approved.applicantEmail).toBe('lucia@millast.ec');
  });

  it('parses backend d72058c statuses (entrega_fallida, cancelado) and Google verification', async () => {
    const {client} = mockClient(call => {
      if (call.url.includes('/auth/users')) {
        return {
          status: 200,
          payload: {
            items: [
              {
                id: 'u-google',
                email: 'oauth@millast.ec',
                role: 'cliente',
                emailVerified: true,
                emailVerifiedVia: 'google',
                createdAt: '2026-11-24T00:00:00Z',
              },
            ],
            total: 1,
            limit: 15,
            offset: 0,
          },
        };
      }
      if (call.url.includes('/orders')) {
        return {
          status: 200,
          payload: {
            items: [
              {
                id: 'o-fail',
                zoneId: 'z1',
                deliveryAddress: 'Av. Amazonas 100',
                deliveryDate: '2026-11-25',
                deliveryTime: '11:00',
                status: 'entrega_fallida',
              },
              {
                id: 'o-cancel',
                zoneId: 'z1',
                deliveryAddress: 'Av. Shyris 200',
                deliveryDate: '2026-11-25',
                deliveryTime: '12:00',
                status: 'cancelado',
              },
            ],
          },
        };
      }
      if (call.url.includes('/routes/r-mix')) {
        return {
          status: 200,
          payload: {
            id: 'r-mix',
            zoneId: 'z1',
            serviceDate: '2026-11-25',
            status: 'en_curso',
            capacityLimit: 4,
            occupiedSlots: 2,
            stops: [
              {orderId: 'o-fail', position: 1, deliveryAddress: 'A', status: 'entrega_fallida'},
              {orderId: 'o-cancel', position: 2, deliveryAddress: 'B', status: 'cancelado'},
            ],
          },
        };
      }
      return {
        status: 200,
        payload: {
          orderId: 'o-fail',
          routeId: 'r-mix',
          status: 'entrega_fallida',
          version: '3',
          deliveredAt: null,
          updatedAt: '2026-11-25T12:00:00Z',
        },
      };
    });

    const usersPage = await new HttpAuthGateway(client).listUsers();
    expect(usersPage.items[0]?.emailVerifiedVia).toBe('google');

    const orders = await new HttpOrderGateway(client).getAll();
    expect(orders.map(o => o.status)).toEqual(['entrega_fallida', 'cancelado']);

    const route = await new HttpRouteGateway(client).getRouteById('r-mix');
    expect(route.stops.map(s => s.status)).toEqual(['entrega_fallida', 'cancelado']);

    const delivery = await new HttpDeliveryGateway(client).getDeliveryOrder('o-fail');
    expect(delivery.status).toBe('entrega_fallida');
  });
});

import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {AssignedRouteRequestError, HttpAssignedRouteGateway} from '../infrastructure/http/HttpAssignedRouteGateway';

type FetchResponse = {
  status: number;
  ok: boolean;
  json: () => Promise<unknown>;
};

function jsonResponse(status: number, payload: unknown): FetchResponse {
  return {status, ok: status >= 200 && status < 300, json: async () => payload};
}

function stubFetch(implementation: (input: unknown, init?: unknown) => Promise<FetchResponse>): jest.Mock {
  const mock = jest.fn(implementation);
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('HttpAssignedRouteGateway', () => {
  it('devuelve las paradas ordenadas por position cuando la ruta existe', async () => {
    const fetchMock = stubFetch(async () =>
      jsonResponse(200, {
        item: {
          routeId: 'route-1',
          zoneId: 'zone-1',
          serviceDate: '2027-02-14',
          status: 'PLANNED',
          stops: [
            {orderId: 'o2', position: 2, deliveryAddress: 'B', deliveryTime: '11:00', status: 'PENDING'},
            {orderId: 'o1', position: 1, deliveryAddress: 'A', deliveryTime: null, status: 'PENDING'},
          ],
        },
      }),
    );
    const gateway = new HttpAssignedRouteGateway('http://api', 'jwt-token');

    const route = await gateway.getAssignedRoute('courier-1');

    expect(route?.stops.map(stop => stop.orderId)).toEqual(['o1', 'o2']);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/couriers/courier-1/route',
      expect.objectContaining({
        headers: expect.objectContaining({Authorization: 'Bearer jwt-token'}),
      }),
    );
  });

  it('devuelve null cuando el repartidor no tiene ruta asignada', async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, {item: null}));
    const gateway = new HttpAssignedRouteGateway('http://api');

    await expect(gateway.getAssignedRoute('courier-1')).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api/couriers/courier-1/route',
      expect.objectContaining({headers: {Accept: 'application/json'}}),
    );
  });

  it('traduce el 404 a COURIER_NOT_FOUND', async () => {
    stubFetch(async () => jsonResponse(404, {}));
    const gateway = new HttpAssignedRouteGateway('http://api');

    await expect(gateway.getAssignedRoute('courier-x')).rejects.toMatchObject({
      code: 'COURIER_NOT_FOUND',
    });
  });

  it('traduce el 401 y el 500 a SERVER', async () => {
    const gateway = new HttpAssignedRouteGateway('http://api');

    stubFetch(async () => jsonResponse(401, {}));
    await expect(gateway.getAssignedRoute('c')).rejects.toMatchObject({code: 'SERVER'});

    stubFetch(async () => jsonResponse(500, {}));
    await expect(gateway.getAssignedRoute('c')).rejects.toMatchObject({code: 'SERVER'});
  });

  it('traduce un fallo de red a NETWORK', async () => {
    stubFetch(async () => {
      throw new Error('offline');
    });
    const gateway = new HttpAssignedRouteGateway('http://api');

    const error = await gateway.getAssignedRoute('c').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AssignedRouteRequestError);
    expect((error as AssignedRouteRequestError).code).toBe('NETWORK');
  });
});

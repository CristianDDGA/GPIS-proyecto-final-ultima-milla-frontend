import { describe, expect, it } from 'vitest';
import { extractOrderConflicts, HttpStoreGateway } from './httpStoreGateway.js';
import { HttpError } from '../../../../shared/infrastructure/http/httpClient.js';
import { createFakeHttpClient, VALID_UUID } from '../../../../test/fakeHttpClient.js';

describe('HttpStoreGateway', () => {
  it('crea el pedido con Idempotency-Key, recortando opcionales y con coordenadas', async () => {
    const http = createFakeHttpClient({ id: 'o1' });
    await new HttpStoreGateway(http).placeOrder(
      {
        zoneId: VALID_UUID,
        deliveryAddress: '  Av. Cevallos 12 ',
        deliveryDate: '2026-12-01',
        deliveryTime: '10:00',
        items: [{ productId: 'p1', quantity: 2 }],
        recipientName: '  ',
        notes: ' Timbre azul ',
        latitude: -1.25,
        longitude: -78.62,
      } as never,
      'clave-idem',
    );

    expect(http.post).toHaveBeenCalledWith(
      '/store/orders',
      {
        zoneId: VALID_UUID,
        deliveryAddress: 'Av. Cevallos 12',
        deliveryDate: '2026-12-01',
        deliveryTime: '10:00',
        items: [{ productId: 'p1', quantity: 2 }],
        notes: 'Timbre azul',
        latitude: -1.25,
        longitude: -78.62,
      },
      { headers: { 'Idempotency-Key': 'clave-idem' } },
    );
  });

  it('cancela con motivo y solo envía la nota si tiene texto', async () => {
    const http = createFakeHttpClient({});
    const gateway = new HttpStoreGateway(http);
    await gateway.cancelOrder('o/1', 'cambio_de_planes' as never, '  ');
    expect(http.post).toHaveBeenCalledWith('/store/orders/o%2F1/cancel', { reason: 'cambio_de_planes' });
  });

  it('reprograma y pagina los pedidos del cliente', async () => {
    const http = createFakeHttpClient({ items: [] });
    const gateway = new HttpStoreGateway(http);
    await gateway.rescheduleOrder('o1', '2026-12-02', '11:00');
    expect(http.post).toHaveBeenCalledWith('/store/orders/o1/reschedule', {
      deliveryDate: '2026-12-02',
      deliveryTime: '11:00',
    });
    await gateway.listOrders(2, 10);
    expect(http.get).toHaveBeenCalledWith('/store/orders?page=2&pageSize=10');
  });

  it('las acciones del conductor llevan Idempotency-Key', async () => {
    const http = createFakeHttpClient({});
    await new HttpStoreGateway(http).getCourierOrders();
    expect(http.get).toHaveBeenCalledWith('/store/courier/orders');
  });

  it('lee la lista de categorías desde items', async () => {
    const http = createFakeHttpClient({ items: [{ id: 'c1', name: 'Frutas' }] });
    await expect(new HttpStoreGateway(http).listCategories()).resolves.toEqual([{ id: 'c1', name: 'Frutas' }]);
  });
});

describe('extractOrderConflicts', () => {
  const conflicts = [{ productId: 'p1', reason: 'OUT_OF_STOCK' }];

  it('extrae los conflictos de stock de un 409 ORDER_CONFLICT', () => {
    const nested = new HttpError(409, 'Conflict', { code: 'ORDER_CONFLICT', details: { conflicts } });
    const flat = new HttpError(409, 'Conflict', { code: 'ORDER_CONFLICT', conflicts });
    expect(extractOrderConflicts(nested)).toEqual(conflicts);
    expect(extractOrderConflicts(flat)).toEqual(conflicts);
  });

  it('ignora otros errores', () => {
    expect(extractOrderConflicts(new Error('x'))).toEqual([]);
    expect(extractOrderConflicts(new HttpError(409, 'Conflict', { code: 'OTHER' }))).toEqual([]);
  });
});

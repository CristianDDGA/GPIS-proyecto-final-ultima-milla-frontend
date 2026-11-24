import { describe, expect, it } from 'vitest';
import { HttpCourierGateway } from './couriers/infrastructure/http/httpCourierGateway.js';
import {
  AssignRouteUseCase,
  GetActiveCourierRouteUseCase,
  GetCouriersUseCase,
  UpdateCourierAvailabilityUseCase,
} from './couriers/application/courierUseCases.js';
import { HttpDeliveryGateway } from './deliveries/infrastructure/http/httpDeliveryGateway.js';
import {
  ChangeDeliveryStatusUseCase,
  CompleteRouteUseCase,
  GetDeliveryOrderUseCase,
} from './deliveries/application/deliveryUseCases.js';
import { HttpOrderGateway } from './orders/infrastructure/http/httpOrderGateway.js';
import { CreateOrderUseCase } from './orders/application/createOrderUseCase.js';
import { HttpError } from '../shared/infrastructure/http/httpClient.js';
import { createFakeHttpClient, OTHER_UUID, VALID_UUID } from '../test/fakeHttpClient.js';

const NOW = '2026-11-23T10:00:00.000Z';
const COURIER = {
  id: VALID_UUID,
  displayName: 'Luis Andrade',
  maxOrdersPerTrip: 8,
  isEnabled: true,
  isAvailable: true,
  createdAt: NOW,
  updatedAt: NOW,
};
const ORDER = {
  id: OTHER_UUID,
  zoneId: VALID_UUID,
  deliveryAddress: 'Av. Cevallos 12',
  deliveryDate: '2026-12-01',
  deliveryTime: '09:00',
  status: 'pendiente',
  createdAt: NOW,
  updatedAt: NOW,
};
const DELIVERY = {
  orderId: OTHER_UUID,
  routeId: VALID_UUID,
  status: 'asignado_a_ruta',
  version: '4',
  deliveredAt: null,
  updatedAt: NOW,
};

describe('repartidores', () => {
  it('lista con filtros y valida el contrato de la página', async () => {
    const http = createFakeHttpClient({ items: [COURIER], limit: 20, offset: 0 });
    const page = await new GetCouriersUseCase(new HttpCourierGateway(http)).execute({ available: false, limit: 20 });
    expect(http.get).toHaveBeenCalledWith('/couriers?available=false&limit=20');
    expect(page.items).toHaveLength(1);

    const broken = createFakeHttpClient({ items: [{ ...COURIER, maxOrdersPerTrip: 0 }], limit: 20, offset: 0 });
    await expect(new HttpCourierGateway(broken).getCouriers()).rejects.toThrow();
  });

  it('cambia la disponibilidad solo con un UUID válido', async () => {
    const http = createFakeHttpClient(COURIER);
    const useCase = new UpdateCourierAvailabilityUseCase(new HttpCourierGateway(http));
    await expect(useCase.execute('x', true)).rejects.toThrow(/UUID/);
    await useCase.execute(VALID_UUID, false);
    expect(http.patch).toHaveBeenCalledWith(`/couriers/${VALID_UUID}/availability`, { isAvailable: false });
  });

  it('asigna ruta y lee la ruta activa ordenada', async () => {
    const assign = createFakeHttpClient({ routeId: OTHER_UUID, courierId: VALID_UUID, status: 'asignada' });
    await expect(
      new AssignRouteUseCase(new HttpCourierGateway(assign)).execute({ routeId: OTHER_UUID, courierId: VALID_UUID }),
    ).resolves.toMatchObject({ status: 'asignada' });

    const stop = (position: number) => ({
      orderId: OTHER_UUID,
      position,
      deliveryAddress: 'Calle 1',
      deliveryTime: '10:00',
      status: 'en_camino',
    });
    const active = createFakeHttpClient({
      item: { routeId: OTHER_UUID, zoneId: VALID_UUID, serviceDate: '2026-12-01', status: 'en_curso', stops: [stop(2), stop(1)] },
    });
    const route = await new GetActiveCourierRouteUseCase(new HttpCourierGateway(active)).execute(VALID_UUID);
    expect(route?.stops.map((item) => item.position)).toEqual([1, 2]);

    const none = createFakeHttpClient({ item: null });
    await expect(new HttpCourierGateway(none).getActiveRoute(VALID_UUID)).resolves.toBeNull();
  });
});

describe('entregas', () => {
  it('usa la versión actual del pedido cuando no se indica (concurrencia optimista)', async () => {
    const http = createFakeHttpClient(DELIVERY);
    http.post.mockResolvedValueOnce({ orderId: OTHER_UUID, status: 'recogido', version: '5' });
    const result = await new ChangeDeliveryStatusUseCase(new HttpDeliveryGateway(http)).execute({
      orderId: OTHER_UUID,
      newStatus: 'recogido',
      idempotencyKey: 'k-9',
    });

    expect(http.get).toHaveBeenCalledWith(`/delivery-orders/${OTHER_UUID}`);
    expect(http.post).toHaveBeenCalledWith(
      '/delivery-status-changes',
      { orderId: OTHER_UUID, newStatus: 'recogido', expectedVersion: '4' },
      { headers: { 'Idempotency-Key': 'k-9' } },
    );
    expect(result.version).toBe('5');
  });

  it('rechaza transiciones inválidas sin llamar a la API', async () => {
    const http = createFakeHttpClient(DELIVERY);
    await expect(
      new ChangeDeliveryStatusUseCase(new HttpDeliveryGateway(http)).execute({ orderId: 'x', newStatus: 'recogido' }),
    ).rejects.toThrow(/UUID/);
    expect(http.post).not.toHaveBeenCalled();
  });

  it('lee el pedido de entrega y completa la ruta', async () => {
    const http = createFakeHttpClient(DELIVERY);
    await expect(new GetDeliveryOrderUseCase(new HttpDeliveryGateway(http)).execute(OTHER_UUID)).resolves.toEqual(DELIVERY);
    await expect(new GetDeliveryOrderUseCase(new HttpDeliveryGateway(http)).execute('x')).rejects.toThrow();

    const done = createFakeHttpClient({ routeId: VALID_UUID, status: 'completada' });
    await new CompleteRouteUseCase(new HttpDeliveryGateway(done)).execute(VALID_UUID);
    expect(done.post).toHaveBeenCalledWith('/route-completions', { routeId: VALID_UUID });

    const bad = createFakeHttpClient({ ...DELIVERY, version: '0' });
    await expect(new HttpDeliveryGateway(bad).getDeliveryOrder(OTHER_UUID)).rejects.toThrow();
  });
});

describe('pedidos', () => {
  it('crea pedidos con datos recortados y valida la respuesta', async () => {
    const http = createFakeHttpClient(ORDER);
    await new CreateOrderUseCase(new HttpOrderGateway(http)).execute({
      zoneId: VALID_UUID,
      deliveryAddress: ' Av. Cevallos 12 ',
      deliveryDate: '2026-12-01',
      deliveryTime: '09:00',
    });
    expect(http.post).toHaveBeenCalledWith('/orders', {
      zoneId: VALID_UUID,
      deliveryAddress: 'Av. Cevallos 12',
      deliveryDate: '2026-12-01',
      deliveryTime: '09:00',
    });
  });

  it('filtra el listado y trata el 404 como inexistente', async () => {
    const http = createFakeHttpClient({ items: [ORDER] });
    const gateway = new HttpOrderGateway(http);
    await expect(gateway.getAll({ zoneId: VALID_UUID, deliveryDate: '2026-12-01' })).resolves.toHaveLength(1);
    expect(http.get).toHaveBeenCalledWith(`/orders?zoneId=${VALID_UUID}&deliveryDate=2026-12-01`);

    http.get.mockRejectedValueOnce(new HttpError(404, 'Not Found'));
    await expect(gateway.getById(OTHER_UUID)).resolves.toBeNull();

    await expect(new HttpOrderGateway(createFakeHttpClient({ items: [{ ...ORDER, status: 'raro' }] })).getAll()).rejects.toThrow();
  });
});

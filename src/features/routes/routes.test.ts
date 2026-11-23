import { describe, expect, it } from 'vitest';
import { HttpRouteGateway } from './infrastructure/http/httpRouteGateway.js';
import {
  CancelRouteUseCase,
  GetRouteByIdUseCase,
  GetRoutesUseCase,
  MoveOrderUseCase,
  PlaceLateOrderUseCase,
  PlanRoutesUseCase,
  ReorderRouteStopsUseCase,
} from './application/routeUseCases.js';
import { readLatePlacementResult, readRouteDetail, readRouteSummary } from './infrastructure/http/response.js';
import { createFakeHttpClient, OTHER_UUID, VALID_UUID } from '../../test/fakeHttpClient.js';

const SUMMARY = {
  id: VALID_UUID,
  zoneId: OTHER_UUID,
  serviceDate: '2026-12-01',
  capacityLimit: 5,
  status: 'planificada',
  courierId: null,
  occupiedSlots: 2,
};

const stop = (position: number, orderId: string) => ({
  orderId,
  position,
  deliveryAddress: 'Av. Cevallos 12',
  deliveryDate: '2026-12-01',
  deliveryTime: '09:00',
  status: 'asignado_a_ruta',
});

function gatewayReturning(response: unknown) {
  const http = createFakeHttpClient(response);
  return { http, gateway: new HttpRouteGateway(http) };
}

describe('lectores de respuesta de rutas', () => {
  it('valida la invariante occupiedSlots <= capacityLimit', () => {
    expect(readRouteSummary(SUMMARY)).toEqual(SUMMARY);
    expect(() => readRouteSummary({ ...SUMMARY, occupiedSlots: 6 })).toThrow(/contrato/);
    expect(() => readRouteSummary({ ...SUMMARY, status: 'otra' })).toThrow(/contrato/);
  });

  it('ordena las paradas por posición', () => {
    const detail = readRouteDetail({ ...SUMMARY, stops: [stop(2, OTHER_UUID), stop(1, VALID_UUID)] });
    expect(detail.stops.map((item) => item.position)).toEqual([1, 2]);
    expect(() => readRouteDetail({ ...SUMMARY, stops: [{ ...stop(1, VALID_UUID), deliveryTime: '25:00' }] })).toThrow();
  });

  it('inserción tardía: asignada o pendiente sin repartidor', () => {
    expect(readLatePlacementResult({ orderId: VALID_UUID, status: 'asignado_a_ruta', routeId: OTHER_UUID })).toEqual({
      orderId: VALID_UUID,
      status: 'asignado_a_ruta',
      routeId: OTHER_UUID,
    });
    expect(
      readLatePlacementResult({ orderId: VALID_UUID, status: 'pendiente', reason: 'NO_AVAILABLE_COURIER' }).status,
    ).toBe('pendiente');
    expect(() => readLatePlacementResult({ orderId: VALID_UUID, status: 'entregado' })).toThrow();
  });
});

describe('HttpRouteGateway y casos de uso', () => {
  it('planifica con Idempotency-Key', async () => {
    const { http, gateway } = gatewayReturning({ serviceDate: '2026-12-01', routeIds: [VALID_UUID] });
    const result = await new PlanRoutesUseCase(gateway).execute({
      serviceDate: ' 2026-12-01 ',
      capacityLimit: 5,
      idempotencyKey: 'k-1',
    });
    expect(result.routeIds).toEqual([VALID_UUID]);
    expect(http.post).toHaveBeenCalledWith(
      '/route-plans',
      { serviceDate: '2026-12-01', capacityLimit: 5 },
      { headers: { 'Idempotency-Key': 'k-1' } },
    );
  });

  it('no planifica con datos inválidos', async () => {
    const { http, gateway } = gatewayReturning({});
    await expect(new PlanRoutesUseCase(gateway).execute({ serviceDate: 'x', capacityLimit: 0 })).rejects.toThrow();
    expect(http.post).not.toHaveBeenCalled();
  });

  it('lista rutas enviando solo filtros válidos', async () => {
    const { http, gateway } = gatewayReturning({ items: [SUMMARY], limit: 20, offset: 0 });
    const routes = await new GetRoutesUseCase(gateway).execute({ serviceDate: ' 2026-12-01 ', zoneId: ' ', limit: 500, offset: 0 });
    expect(routes).toHaveLength(1);
    expect(http.get).toHaveBeenCalledWith('/routes?serviceDate=2026-12-01&offset=0');
  });

  it('detalle, cancelación, reorden y movimiento', async () => {
    const detail = gatewayReturning({ ...SUMMARY, stops: [] });
    await new GetRouteByIdUseCase(detail.gateway).execute(VALID_UUID);
    expect(detail.http.get).toHaveBeenCalledWith(`/routes/${VALID_UUID}`);
    expect(() => new GetRouteByIdUseCase(detail.gateway).execute('x')).toThrow(/UUID/);

    const cancel = gatewayReturning({ routeId: VALID_UUID, status: 'cancelada' });
    await expect(new CancelRouteUseCase(cancel.gateway).execute(VALID_UUID)).resolves.toMatchObject({ status: 'cancelada' });
    expect(cancel.http.post).toHaveBeenCalledWith(`/routes/${VALID_UUID}/cancel`);

    const reorder = gatewayReturning({ routeId: VALID_UUID, orderIds: [OTHER_UUID] });
    await new ReorderRouteStopsUseCase(reorder.gateway).execute({ routeId: VALID_UUID, orderIds: [` ${OTHER_UUID}`] });
    expect(reorder.http.put).toHaveBeenCalledWith(`/routes/${VALID_UUID}/stop-order`, { orderIds: [OTHER_UUID] });

    const move = gatewayReturning({ orderId: VALID_UUID, routeId: OTHER_UUID });
    await new MoveOrderUseCase(move.gateway).execute({ orderId: VALID_UUID, destinationRouteId: OTHER_UUID });
    expect(move.http.post).toHaveBeenCalledWith('/route-moves', { orderId: VALID_UUID, destinationRouteId: OTHER_UUID });
  });

  it('inserción tardía usa una clave de idempotencia', async () => {
    const { http, gateway } = gatewayReturning({ orderId: VALID_UUID, status: 'pendiente', reason: 'NO_AVAILABLE_COURIER' });
    await new PlaceLateOrderUseCase(gateway).execute({ orderId: VALID_UUID, capacityLimit: 3 });
    const [, body, options] = http.post.mock.calls[0] as unknown as [string, unknown, { headers: Record<string, string> }];
    expect(body).toEqual({ orderId: VALID_UUID, capacityLimit: 3 });
    expect(options.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

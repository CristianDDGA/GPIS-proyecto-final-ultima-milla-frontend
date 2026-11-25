import { describe, expect, it, vi } from 'vitest';
import { HttpRouteGateway } from './infrastructure/http/httpRouteGateway.js';
import { readPlanPreview } from './infrastructure/http/response.js';
import { PreviewPlanUseCase } from './application/routeUseCases.js';
import type { RouteGateway } from './domain/index.js';
import { createFakeHttpClient, VALID_UUID } from '../../test/fakeHttpClient.js';

const TODAY = new Date();
const pad = (value: number) => String(value).padStart(2, '0');
const tomorrow = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 1);
const DATE = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;

function preview(overrides: Record<string, unknown> = {}) {
  return {
    serviceDate: DATE,
    capacityLimit: 4,
    zones: [{ zoneId: VALID_UUID, zoneName: 'Ambato Centro', orders: 5, routes: 2, routeSizes: [4, 1] }],
    totalOrders: 5,
    totalRoutes: 2,
    availableCouriers: 1,
    ...overrides,
  };
}

describe('vista previa de la planificación', () => {
  it('el gateway pide GET /route-plans/preview con fecha y capacidad y lee la respuesta', async () => {
    const http = createFakeHttpClient(preview());
    const result = await new HttpRouteGateway(http).previewPlan({ serviceDate: DATE, capacityLimit: 4 });
    expect(http.get).toHaveBeenCalledWith(`/route-plans/preview?serviceDate=${DATE}&capacityLimit=4`);
    expect(result.totalRoutes).toBe(2);
    expect(result.zones[0]?.routeSizes).toEqual([4, 1]);
    expect(result.availableCouriers).toBe(1);
  });

  it('acepta una vista previa vacía', () => {
    expect(readPlanPreview(preview({ zones: [], totalOrders: 0, totalRoutes: 0 })).zones).toEqual([]);
  });

  it.each([
    ['no es un objeto', null],
    ['fecha inválida', preview({ serviceDate: 'x' })],
    ['capacidad inválida', preview({ capacityLimit: 0 })],
    ['zonas que no son una lista', preview({ zones: 'no' })],
    ['una zona sin identificador válido', preview({ zones: [{ zoneId: 'x', zoneName: 'A', orders: 1, routes: 1, routeSizes: [1] }] })],
    ['tamaños que no coinciden con las rutas', preview({ zones: [{ zoneId: VALID_UUID, zoneName: 'A', orders: 5, routes: 2, routeSizes: [4] }] })],
    ['una ruta que supera la capacidad', preview({ zones: [{ zoneId: VALID_UUID, zoneName: 'A', orders: 5, routes: 1, routeSizes: [5] }], totalRoutes: 1 })],
    ['tamaños que no suman los pedidos', preview({ zones: [{ zoneId: VALID_UUID, zoneName: 'A', orders: 5, routes: 2, routeSizes: [3, 1] }] })],
    ['totales que no coinciden', preview({ totalRoutes: 3 })],
    ['repartidores inválidos', preview({ availableCouriers: -1 })],
  ])('rechaza una respuesta que no cumple el contrato: %s', (_name, body) => {
    expect(() => readPlanPreview(body)).toThrow(/contrato/);
  });

  it('el caso de uso valida fecha y capacidad antes de llamar al servidor', async () => {
    const gateway = { previewPlan: vi.fn(() => Promise.resolve(readPlanPreview(preview()))) } as unknown as RouteGateway;
    const useCase = new PreviewPlanUseCase(gateway);

    await expect(useCase.execute({ serviceDate: DATE, capacityLimit: 21 })).rejects.toThrow(/entre 1 y 20/);
    await expect(useCase.execute({ serviceDate: '2020-01-01', capacityLimit: 4 })).rejects.toThrow(/pasada/);
    expect(gateway.previewPlan).not.toHaveBeenCalled();

    const result = await useCase.execute({ serviceDate: ` ${DATE} `, capacityLimit: 4 });
    expect(result.totalOrders).toBe(5);
    expect(gateway.previewPlan).toHaveBeenCalledWith({ serviceDate: DATE, capacityLimit: 4 });
  });
});

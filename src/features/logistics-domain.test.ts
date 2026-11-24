import { describe, expect, it } from 'vitest';
import { isZoneId, validateZoneName } from './zones/domain/zone.js';
import { validateOrder } from './orders/domain/order.js';
import { validateAssignCourierInput } from './couriers/domain/courier.js';
import {
  deliveryActionLabel,
  getNextAllowedDeliveryStatus,
  isPositiveVersion,
  orderStatusLabel,
  validateChangeDeliveryStatusInput,
} from './deliveries/domain/delivery.js';
import {
  getTodayIsoDate,
  isUuid,
  validateLateOrderPlacementInput,
  validateMoveOrderInput,
  validatePlanRoutesInput,
  validateReorderStopsInput,
} from './routes/domain/route.js';
import { VALID_UUID, OTHER_UUID } from '../test/fakeHttpClient.js';

describe('zonas', () => {
  it('valida el nombre de la zona', () => {
    expect(validateZoneName('Centro').isValid).toBe(true);
    expect(validateZoneName('   ').error).toMatch(/vacío/);
    expect(validateZoneName('A').error).toMatch(/2 caracteres/);
    expect(validateZoneName('x'.repeat(81)).error).toMatch(/80/);
  });

  it('reconoce identificadores de zona', () => {
    expect(isZoneId(` ${VALID_UUID} `)).toBe(true);
    expect(isZoneId('zona-1')).toBe(false);
  });
});

describe('pedidos', () => {
  const valid = { zoneId: VALID_UUID, deliveryAddress: 'Av. Cevallos 123', deliveryDate: '2026-12-01', deliveryTime: '09:30' };

  it('acepta un pedido completo', () => {
    expect(validateOrder(valid)).toEqual({ isValid: true, errors: {} });
  });

  it('marca cada campo inválido', () => {
    const result = validateOrder({ zoneId: '', deliveryAddress: 'abc', deliveryDate: '2026-02-30', deliveryTime: '24:00' });
    expect(Object.keys(result.errors).sort()).toEqual(['deliveryAddress', 'deliveryDate', 'deliveryTime', 'zoneId']);
    expect(result.errors.deliveryDate).toMatch(/calendario/);
  });

  it('limita la dirección a 200 caracteres y exige formato de fecha', () => {
    const result = validateOrder({ ...valid, deliveryAddress: 'x'.repeat(201), deliveryDate: '01/12/2026' });
    expect(result.errors.deliveryAddress).toMatch(/200/);
    expect(result.errors.deliveryDate).toMatch(/AAAA-MM-DD/);
  });
});

describe('repartidores', () => {
  it('la asignación exige dos UUID', () => {
    expect(validateAssignCourierInput({ routeId: VALID_UUID, courierId: OTHER_UUID }).isValid).toBe(true);
    expect(Object.keys(validateAssignCourierInput({ routeId: 'r', courierId: 'c' }).errors)).toHaveLength(2);
  });
});

describe('entregas (máquina de estados)', () => {
  it('sigue el orden asignado → recogido → en camino → entregado', () => {
    expect(getNextAllowedDeliveryStatus('asignado_a_ruta')).toBe('recogido');
    expect(getNextAllowedDeliveryStatus('recogido')).toBe('en_camino');
    expect(getNextAllowedDeliveryStatus('en_camino')).toBe('entregado');
    expect(getNextAllowedDeliveryStatus('entregado')).toBeNull();
    expect(getNextAllowedDeliveryStatus('pendiente')).toBeNull();
    expect(getNextAllowedDeliveryStatus('cancelado')).toBeNull();
  });

  it('valida el cambio de estado y la versión esperada', () => {
    expect(validateChangeDeliveryStatusInput({ orderId: VALID_UUID, newStatus: 'recogido', expectedVersion: '3' }).isValid).toBe(true);
    const result = validateChangeDeliveryStatusInput({
      orderId: 'x',
      newStatus: 'cancelado' as never,
      expectedVersion: '0',
    });
    expect(Object.keys(result.errors).sort()).toEqual(['expectedVersion', 'newStatus', 'orderId']);
    expect(isPositiveVersion('12')).toBe(true);
    expect(isPositiveVersion('01')).toBe(false);
  });

  it('tiene etiquetas para todas las acciones y estados', () => {
    expect(deliveryActionLabel('entregado')).toBe('Marcar entregado');
    expect(orderStatusLabel('entrega_fallida')).toBe('Entrega fallida');
    expect(orderStatusLabel('asignado_a_ruta')).toBe('Asignado a ruta');
  });
});

describe('rutas', () => {
  it('planificación: fecha de calendario y capacidad entera', () => {
    expect(validatePlanRoutesInput({ serviceDate: '2026-12-01', capacityLimit: 10 }).isValid).toBe(true);
    const result = validatePlanRoutesInput({ serviceDate: '2026-13-01', capacityLimit: 0 });
    expect(Object.keys(result.errors).sort()).toEqual(['capacityLimit', 'serviceDate']);
  });

  it('reordenar: sin vacíos, sin duplicados y con UUID', () => {
    expect(validateReorderStopsInput({ routeId: VALID_UUID, orderIds: [VALID_UUID, OTHER_UUID] }).isValid).toBe(true);
    expect(validateReorderStopsInput({ routeId: VALID_UUID, orderIds: [] }).errors['orderIds']).toMatch(/al menos/);
    expect(validateReorderStopsInput({ routeId: VALID_UUID, orderIds: ['x'] }).errors['orderIds']).toMatch(/UUID/);
    expect(validateReorderStopsInput({ routeId: 'r', orderIds: [VALID_UUID, VALID_UUID] }).errors).toMatchObject({
      routeId: expect.any(String),
      orderIds: expect.stringMatching(/repetir/),
    });
  });

  it('mover pedido e inserción tardía', () => {
    expect(validateMoveOrderInput({ orderId: VALID_UUID, destinationRouteId: 'x' }).errors['destinationRouteId']).toBeDefined();
    expect(validateLateOrderPlacementInput({ orderId: VALID_UUID, capacityLimit: 5 }).isValid).toBe(true);
    expect(validateLateOrderPlacementInput({ orderId: 'x', capacityLimit: -1 }).isValid).toBe(false);
  });

  it('fecha de hoy en formato local AAAA-MM-DD', () => {
    expect(getTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(isUuid(` ${VALID_UUID}`)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import {
  formatCents,
  generateIdempotencyKey,
  googleMapsDirectionsUrl,
  isWithinEcuador,
  osmDirectionsUrl,
  parseDollarsToCents,
  sanitizeBackendText,
  todayInEcuador,
} from './storeTypes.js';
import {
  clampEcuadorLatLng,
  computeFitView,
  formatDistanceKm,
  formatDurationMinutes,
  googleMapsMultiStopUrl,
  latLngToWorld,
  tileUrlFor,
  worldToLatLng,
} from '../../../shared/ui/Map/ecuadorMapMath.js';

const AMBATO = { lat: -1.2491, lng: -78.6167 };
const QUITO = { lat: -0.1807, lng: -78.4678 };

describe('dinero en centavos', () => {
  it('formatea centavos como dólares', () => {
    expect(formatCents(1250)).toBe('$12.50');
    expect(formatCents(-5)).toBe('-$0.05');
    expect(formatCents(Number.NaN)).toBe('$0.00');
  });

  it('convierte el texto del usuario a centavos', () => {
    expect(parseDollarsToCents('12,5')).toBe(1250);
    expect(parseDollarsToCents(' 3.99 ')).toBe(399);
    expect(parseDollarsToCents('1.999')).toBeNull();
    expect(parseDollarsToCents('-1')).toBeNull();
    expect(parseDollarsToCents('abc')).toBeNull();
  });
});

describe('utilidades de pedido', () => {
  it('genera claves de idempotencia UUID distintas', () => {
    const first = generateIdempotencyKey();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(generateIdempotencyKey()).not.toBe(first);
  });

  it('da la fecha de Ecuador en AAAA-MM-DD', () => {
    expect(todayInEcuador()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('limpia el texto de direcciones para la lista blanca del backend', () => {
    expect(sanitizeBackendText('Calle  Bolívar #12 😀 <script>')).toBe('Calle Bolívar #12 script');
    expect(sanitizeBackendText('x'.repeat(300), 10)).toHaveLength(10);
  });
});

describe('mapa de Ecuador', () => {
  it('solo acepta coordenadas dentro de Ecuador', () => {
    expect(isWithinEcuador(AMBATO.lat, AMBATO.lng)).toBe(true);
    expect(isWithinEcuador(40.4, -3.7)).toBe(false);
    expect(isWithinEcuador(Number.NaN, -78)).toBe(false);
  });

  it('ajusta coordenadas fuera del país al borde', () => {
    expect(clampEcuadorLatLng(10, -10)).toEqual({ lat: 1.5, lng: -75 });
  });

  it('proyección Mercator ida y vuelta', () => {
    const world = latLngToWorld(AMBATO.lat, AMBATO.lng, 12);
    const back = worldToLatLng(world.x, world.y, 12);
    expect(back.lat).toBeCloseTo(AMBATO.lat, 6);
    expect(back.lng).toBeCloseTo(AMBATO.lng, 6);
  });

  it('elige centro y zoom para las paradas', () => {
    expect(computeFitView([], 800, 600).zoom).toBe(13);
    expect(computeFitView([AMBATO], 800, 600)).toEqual({ center: AMBATO, zoom: 15 });
    const fit = computeFitView([AMBATO, QUITO], 800, 600);
    expect(fit.center.lat).toBeCloseTo((AMBATO.lat + QUITO.lat) / 2, 6);
    expect(fit.zoom).toBeGreaterThanOrEqual(6);
    expect(fit.zoom).toBeLessThan(15);
  });

  it('construye enlaces de navegación y teselas', () => {
    expect(osmDirectionsUrl(-1, -78)).toContain('to=-1%2C-78');
    expect(googleMapsDirectionsUrl(-1, -78)).toContain('destination=-1%2C-78');
    expect(googleMapsMultiStopUrl([])).toBeNull();
    expect(googleMapsMultiStopUrl([AMBATO])).toContain('destination=-1.2491,-78.6167');
    const multi = googleMapsMultiStopUrl([QUITO, AMBATO, QUITO]);
    expect(multi).toContain('waypoints=');
    expect(tileUrlFor('osm', 5, 1, 2)).toBe('https://tile.openstreetmap.org/5/1/2.png');
    expect(tileUrlFor('satellite', 5, 1, 2)).toContain('/tile/5/2/1');
  });

  it('formatea distancia y duración', () => {
    expect(formatDistanceKm(1500)).toMatch(/1[.,]5/);
    expect(formatDurationMinutes(600)).toMatch(/10/);
  });
});

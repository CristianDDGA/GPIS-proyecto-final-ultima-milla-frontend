import { describe, expect, it } from 'vitest';
import { distanceKm, isWithinEcuador } from './geo.js';

describe('geo compartido', () => {
  it('reconoce los puntos dentro de Ecuador (continental y Galápagos) y rechaza los de fuera', () => {
    expect(isWithinEcuador(-1.2491, -78.6167)).toBe(true);
    expect(isWithinEcuador(-0.9, -90.9)).toBe(true);
    expect(isWithinEcuador(40.4, -3.7)).toBe(false);
    expect(isWithinEcuador(-1.2, -60)).toBe(false);
    expect(isWithinEcuador(Number.NaN, -78.6)).toBe(false);
  });

  it('calcula la distancia de gran círculo en km', () => {
    expect(distanceKm(-1.2491, -78.6167, -1.2491, -78.6167)).toBe(0);
    // Quito a Ambato: unos 110 km en línea recta.
    const km = distanceKm(-0.1807, -78.4678, -1.2491, -78.6167);
    expect(km).toBeGreaterThan(105);
    expect(km).toBeLessThan(125);
  });
});

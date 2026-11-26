import { describe, expect, it } from 'vitest';
import { distanceKm, isWithinEcuador } from './geo.js';

describe('geo compartido', () => {
  it('reconoce las ciudades principales y Galápagos dentro de Ecuador', () => {
    const inside: readonly [number, number][] = [
      [-0.1807, -78.4678], // Quito
      [-1.2491, -78.6167], // Ambato
      [-2.1894, -79.8891], // Guayaquil
      [-2.9001, -79.0059], // Cuenca
      [-1.6635, -78.6546], // Riobamba
      [0.8119, -77.7173], // Tulcán
      [0.9592, -79.654], // Esmeraldas
      [-0.9677, -80.7089], // Manta
      [-2.2145, -80.9515], // Salinas
      [-3.2581, -79.9554], // Machala
      [-3.9931, -79.2042], // Loja
      [0.0847, -76.8828], // Lago Agrio
      [-0.9, -90.9], // Galápagos Isabela
      [-0.7436, -90.3132], // Galápagos Santa Cruz
    ];
    for (const [lat, lng] of inside) {
      expect(isWithinEcuador(lat, lng)).toBe(true);
    }
  });

  it('rechaza Colombia, Perú, mar abierto y coordenadas fuera de Ecuador', () => {
    const outside: readonly [number, number][] = [
      [1.2136, -77.2811], // Pasto, Colombia
      [1.8067, -78.7647], // Tumaco, Colombia
      [-3.5669, -80.4515], // Tumbes, Perú
      [-5.1945, -80.6328], // Piura, Perú
      [-3.7491, -73.2538], // Iquitos, Perú
      [-1.5, -85.0], // Océano Pacífico abierto
      [40.4, -3.7], // Madrid
      [-1.2, -60], // Brasil
      [Number.NaN, -78.6],
    ];
    for (const [lat, lng] of outside) {
      expect(isWithinEcuador(lat, lng)).toBe(false);
    }
  });

  it('calcula la distancia de gran círculo en km', () => {
    expect(distanceKm(-1.2491, -78.6167, -1.2491, -78.6167)).toBe(0);
    // Quito a Ambato: unos 110 km en línea recta.
    const km = distanceKm(-0.1807, -78.4678, -1.2491, -78.6167);
    expect(km).toBeGreaterThan(105);
    expect(km).toBeLessThan(125);
  });
});

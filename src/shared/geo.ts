/** Caja envolvente general de Ecuador (continental + Galápagos) para acotar el visor del mapa. */
export const ECUADOR_BOUNDS = {
  minLat: -5.1,
  maxLat: 1.5,
  minLng: -92.5,
  maxLng: -75.0,
} as const;

/** Polígono simplificado de Ecuador continental (lat, lng) siguiendo fronteras reales con Colombia, Perú y costa del Pacífico. */
const CONTINENTAL_ECUADOR_POLYGON: readonly (readonly [number, number])[] = [
  [1.45, -78.88],
  [1.44, -78.55],
  [1.12, -78.18],
  [0.84, -77.82],
  [0.815, -77.68],
  [0.65, -77.2],
  [0.35, -76.5],
  [0.15, -75.85],
  [-0.1, -75.2],
  [-0.55, -75.18],
  [-1.05, -75.4],
  [-1.6, -75.85],
  [-2.15, -76.35],
  [-2.6, -76.75],
  [-3.05, -77.45],
  [-3.55, -78.15],
  [-4.1, -78.4],
  [-4.65, -78.65],
  [-5.02, -79.0],
  [-4.72, -79.45],
  [-4.48, -80.32],
  [-4.05, -80.48],
  [-3.72, -80.22],
  [-3.42, -80.28],
  [-3.1, -80.35],
  [-2.65, -80.6],
  [-2.22, -81.08],
  [-1.5, -80.95],
  [-1.05, -80.98],
  [-0.55, -80.65],
  [0.15, -80.15],
  [0.85, -80.05],
  [1.15, -79.55],
];

/** Límites del Archipiélago de Galápagos (evita aceptar mar abierto entre las islas y la costa). */
const GALAPAGOS_BOUNDS = {
  minLat: -1.45,
  maxLat: 0.7,
  minLng: -91.75,
  maxLng: -89.2,
} as const;

function pointInPolygon(lat: number, lng: number, polygon: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [yi, xi] = polygon[i]!;
    const [yj, xj] = polygon[j]!;
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function isWithinGalapagos(latitude: number, longitude: number): boolean {
  return (
    latitude >= GALAPAGOS_BOUNDS.minLat &&
    latitude <= GALAPAGOS_BOUNDS.maxLat &&
    longitude >= GALAPAGOS_BOUNDS.minLng &&
    longitude <= GALAPAGOS_BOUNDS.maxLng
  );
}

/**
 * Valida que una coordenada caiga estrictamente dentro del territorio de Ecuador
 * (Ecuador continental o Archipiélago de Galápagos), rechazando Colombia, Perú y mar abierto.
 */
export function isWithinEcuador(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return false;
  }
  if (
    latitude < ECUADOR_BOUNDS.minLat ||
    latitude > ECUADOR_BOUNDS.maxLat ||
    longitude < ECUADOR_BOUNDS.minLng ||
    longitude > ECUADOR_BOUNDS.maxLng
  ) {
    return false;
  }
  return (
    isWithinGalapagos(latitude, longitude) ||
    pointInPolygon(latitude, longitude, CONTINENTAL_ECUADOR_POLYGON)
  );
}

/** Distancia de gran circulo en km (haversine), la misma formula que usa el backend. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

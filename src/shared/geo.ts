/** Limites de Ecuador (incluye Galapagos), iguales a los del backend. */
const ECUADOR_LAT = { min: -5.1, max: 1.5 } as const;
const ECUADOR_LNG = { min: -92.5, max: -75.0 } as const;

export function isWithinEcuador(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= ECUADOR_LAT.min &&
    latitude <= ECUADOR_LAT.max &&
    longitude >= ECUADOR_LNG.min &&
    longitude <= ECUADOR_LNG.max
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

import { ECUADOR_BOUNDS, isWithinEcuador } from '../../../features/store/domain/storeTypes.js';

export const MAP_TILE_SIZE = 256;
export const MAP_MIN_ZOOM = 6;
export const MAP_MAX_ZOOM = 18;

export type MapLayerStyle = 'osm' | 'satellite';

export interface LatLng {
  readonly lat: number;
  readonly lng: number;
}

export interface EcuadorCityPreset {
  readonly id: string;
  readonly name: string;
  readonly lat: number;
  readonly lng: number;
  readonly zoom: number;
}

export const ECUADOR_CITIES: readonly EcuadorCityPreset[] = [
  { id: 'quito', name: 'Quito', lat: -0.1807, lng: -78.4678, zoom: 13 },
  { id: 'ambato', name: 'Ambato', lat: -1.2491, lng: -78.6167, zoom: 14 },
  { id: 'guayaquil', name: 'Guayaquil', lat: -2.1894, lng: -79.8891, zoom: 13 },
  { id: 'cuenca', name: 'Cuenca', lat: -2.9001, lng: -79.0059, zoom: 14 },
  { id: 'riobamba', name: 'Riobamba', lat: -1.6635, lng: -78.6546, zoom: 14 },
];

export const DEFAULT_ECUADOR_CENTER: LatLng = { lat: -0.1807, lng: -78.4678 };

export function latLngToWorld(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = MAP_TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.min(Math.max(sinLat, -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function worldToLatLng(x: number, y: number, zoom: number): LatLng {
  const scale = MAP_TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

export function clampEcuadorLatLng(lat: number, lng: number): LatLng {
  return {
    lat: Math.min(ECUADOR_BOUNDS.maxLat, Math.max(ECUADOR_BOUNDS.minLat, Number(lat.toFixed(6)))),
    lng: Math.min(ECUADOR_BOUNDS.maxLng, Math.max(ECUADOR_BOUNDS.minLng, Number(lng.toFixed(6)))),
  };
}

export function tileUrlFor(layer: MapLayerStyle, z: number, x: number, y: number): string {
  if (layer === 'satellite') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

export function computeFitView(
  points: readonly LatLng[],
  viewportWidth: number,
  viewportHeight: number,
  fallback: LatLng = DEFAULT_ECUADOR_CENTER,
): { center: LatLng; zoom: number } {
  const valid = points.filter((p) => isWithinEcuador(p.lat, p.lng));
  if (valid.length === 0) {
    return { center: fallback, zoom: 13 };
  }
  if (valid.length === 1) {
    const only = valid[0]!;
    return { center: { lat: only.lat, lng: only.lng }, zoom: 15 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const p of valid) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const center: LatLng = {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };

  const usableW = Math.max(160, viewportWidth - 110);
  const usableH = Math.max(120, viewportHeight - 110);

  for (let z = 16; z >= MAP_MIN_ZOOM; z -= 1) {
    const sw = latLngToWorld(minLat, minLng, z);
    const ne = latLngToWorld(maxLat, maxLng, z);
    const spanX = Math.abs(ne.x - sw.x);
    const spanY = Math.abs(sw.y - ne.y);
    if (spanX <= usableW && spanY <= usableH) {
      return { center, zoom: z };
    }
  }

  return { center, zoom: MAP_MIN_ZOOM };
}

export function googleMapsMultiStopUrl(points: readonly LatLng[]): string | null {
  const valid = points.filter((p) => isWithinEcuador(p.lat, p.lng));
  if (valid.length === 0) return null;
  if (valid.length === 1) {
    const only = valid[0]!;
    return `https://www.google.com/maps/dir/?api=1&destination=${only.lat},${only.lng}&travelmode=driving`;
  }
  const origin = valid[0]!;
  const destination = valid[valid.length - 1]!;
  const waypoints = valid.slice(1, -1).slice(0, 9);
  const params = new URLSearchParams({
    api: '1',
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'driving',
  });
  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.map((w) => `${w.lat},${w.lng}`).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export interface DrivingRouteGeometry {
  readonly points: readonly LatLng[];
  readonly distanceMeters: number | null;
  readonly durationSeconds: number | null;
  readonly isRoadGeometry: boolean;
}

const routeGeometryCache = new Map<string, DrivingRouteGeometry>();

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function directFallbackGeometry(waypoints: readonly LatLng[]): DrivingRouteGeometry {
  let meters = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    meters += haversineMeters(waypoints[i - 1]!, waypoints[i]!);
  }
  return {
    points: waypoints,
    distanceMeters: Math.round(meters),
    durationSeconds: null,
    isRoadGeometry: false,
  };
}

/**
 * Consulta la geometría real por calles en OSRM público (gratuito, sin API key).
 * Si no hay conexión o el servicio demora, devuelve la polilínea directa entre paradas.
 */
export async function fetchDrivingRouteGeometry(
  waypoints: readonly LatLng[],
  signal?: AbortSignal,
): Promise<DrivingRouteGeometry> {
  if (waypoints.length < 2) {
    return {
      points: waypoints,
      distanceMeters: null,
      durationSeconds: null,
      isRoadGeometry: false,
    };
  }

  const cacheKey = waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join(';');
  const cached = routeGeometryCache.get(cacheKey);
  if (cached) return cached;

  const coordString = waypoints.map((w) => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, signal ? { signal } : undefined);
    if (!res.ok) return directFallbackGeometry(waypoints);
    const data = (await res.json()) as {
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };
    const first = data.routes?.[0];
    const coords = first?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      return directFallbackGeometry(waypoints);
    }

    const geometry: DrivingRouteGeometry = {
      points: coords.map(([lng, lat]) => ({ lat, lng })),
      distanceMeters: typeof first?.distance === 'number' ? Math.round(first.distance) : null,
      durationSeconds: typeof first?.duration === 'number' ? Math.round(first.duration) : null,
      isRoadGeometry: true,
    };
    routeGeometryCache.set(cacheKey, geometry);
    return geometry;
  } catch {
    return directFallbackGeometry(waypoints);
  }
}

export function formatDistanceKm(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDurationMinutes(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds)) return null;
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

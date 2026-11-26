import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAP_MIN_ZOOM,
  clampEcuadorLatLng,
  computeFitView,
  fetchDrivingRouteGeometry,
  formatDistanceKm,
  formatDurationMinutes,
  googleMapsMultiStopUrl,
  latLngToWorld,
  sampleRouteChevrons,
  tileUrlFor,
  wazeDirectionsUrl,
  worldToLatLng,
} from './ecuadorMapMath.js';

const QUITO = { lat: -0.1807, lng: -78.4678 };
const AMBATO = { lat: -1.2491, lng: -78.6167 };
const GUAYAQUIL = { lat: -2.1894, lng: -79.8891 };

function osrmResponse(coordinates: Array<[number, number]>, distance = 1500, duration = 240): Response {
  return {
    ok: true,
    json: () => Promise.resolve({ routes: [{ distance, duration, geometry: { coordinates } }] }),
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proyección Web Mercator', () => {
  it('convierte coordenadas a mundo y de vuelta sin perder precisión', () => {
    const world = latLngToWorld(QUITO.lat, QUITO.lng, 14);
    const back = worldToLatLng(world.x, world.y, 14);
    expect(back.lat).toBeCloseTo(QUITO.lat, 6);
    expect(back.lng).toBeCloseTo(QUITO.lng, 6);
  });

  it('acota latitudes y longitudes a los límites de Ecuador', () => {
    const clamped = clampEcuadorLatLng(40, 10);
    expect(clamped.lat).toBeLessThan(40);
    expect(clamped.lng).toBeLessThan(10);
    expect(clampEcuadorLatLng(QUITO.lat, QUITO.lng)).toEqual({ lat: QUITO.lat, lng: QUITO.lng });
  });
});

describe('URLs de teselas y navegación', () => {
  it('usa OpenStreetMap para Uber y Calles, y Esri para Satélite', () => {
    expect(tileUrlFor('uber', 13, 2, 3)).toBe('https://tile.openstreetmap.org/13/2/3.png');
    expect(tileUrlFor('osm', 13, 2, 3)).toBe('https://tile.openstreetmap.org/13/2/3.png');
    expect(tileUrlFor('satellite', 13, 2, 3)).toBe(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/13/3/2',
    );
  });

  it('genera el enlace de Waze con la coordenada exacta', () => {
    expect(wazeDirectionsUrl(-0.1765, -78.4852)).toBe('https://waze.com/ul?ll=-0.176500,-78.485200&navigate=yes');
  });

  it('arma la ruta multiparada de Google Maps con origen, destino y paradas intermedias', () => {
    expect(googleMapsMultiStopUrl([])).toBeNull();
    expect(googleMapsMultiStopUrl([{ lat: 10, lng: 10 }])).toBeNull();
    expect(googleMapsMultiStopUrl([QUITO])).toContain('destination=-0.1807,-78.4678');

    const url = googleMapsMultiStopUrl([QUITO, AMBATO, GUAYAQUIL]) ?? '';
    expect(url).toContain('origin=-0.1807%2C-78.4678');
    expect(url).toContain('destination=-2.1894%2C-79.8891');
    expect(url).toContain('waypoints=-1.2491%2C-78.6167');
  });
});

describe('computeFitView', () => {
  it('usa el respaldo cuando no hay puntos válidos dentro de Ecuador', () => {
    expect(computeFitView([], 600, 400)).toEqual({ center: QUITO, zoom: 13 });
    expect(computeFitView([{ lat: 40, lng: 10 }], 600, 400, AMBATO)).toEqual({ center: AMBATO, zoom: 13 });
  });

  it('acerca al máximo cuando hay una sola parada', () => {
    expect(computeFitView([QUITO], 600, 400)).toEqual({ center: QUITO, zoom: 15 });
  });

  it('encuadra varias paradas y reduce el zoom cuando están lejos', () => {
    const near = computeFitView([QUITO, { lat: -0.19, lng: -78.47 }], 700, 420);
    const far = computeFitView([QUITO, GUAYAQUIL], 700, 420);
    expect(near.zoom).toBeGreaterThan(far.zoom);
    expect(far.zoom).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
    expect(far.center.lat).toBeCloseTo((QUITO.lat + GUAYAQUIL.lat) / 2, 6);
  });

  it('cae al zoom mínimo cuando el visor es diminuto', () => {
    expect(computeFitView([QUITO, GUAYAQUIL], 10, 10).zoom).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
  });
});

describe('sampleRouteChevrons', () => {
  it('no dibuja flechas en trazos cortos, vacíos o con maxCount inválido', () => {
    expect(sampleRouteChevrons([])).toEqual([]);
    expect(sampleRouteChevrons([{ x: 0, y: 0 }])).toEqual([]);
    expect(sampleRouteChevrons([{ x: 0, y: 0 }, { x: 40, y: 0 }])).toEqual([]);
    expect(sampleRouteChevrons([{ x: 0, y: 0 }, { x: 400, y: 0 }], 0)).toEqual([]);
  });

  it('reparte flechas a lo largo del trazo con el ángulo del tramo', () => {
    const horizontal = sampleRouteChevrons([{ x: 0, y: 0 }, { x: 600, y: 0 }], 6);
    expect(horizontal.length).toBeGreaterThan(0);
    expect(horizontal.length).toBeLessThanOrEqual(5);
    for (const chevron of horizontal) {
      expect(chevron.angleDeg).toBeCloseTo(0, 6);
      expect(chevron.x).toBeGreaterThan(0);
      expect(chevron.x).toBeLessThan(600);
    }

    const turning = sampleRouteChevrons(
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 300 },
      ],
      3,
    );
    expect(turning.some((chevron) => Math.abs(chevron.angleDeg - 90) < 1e-6)).toBe(true);
  });

  it('ignora tramos de longitud cero sin romper el cálculo', () => {
    const chevrons = sampleRouteChevrons(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 500, y: 0 },
      ],
      2,
    );
    expect(chevrons.every((chevron) => Number.isFinite(chevron.x) && Number.isFinite(chevron.y))).toBe(true);
  });
});

describe('formatos de distancia y duración', () => {
  it('formatea metros, kilómetros y valores no válidos', () => {
    expect(formatDistanceKm(null)).toBeNull();
    expect(formatDistanceKm(Number.NaN)).toBeNull();
    expect(formatDistanceKm(850)).toBe('850 m');
    expect(formatDistanceKm(6400)).toBe('6.4 km');
  });

  it('formatea minutos y horas', () => {
    expect(formatDurationMinutes(null)).toBeNull();
    expect(formatDurationMinutes(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatDurationMinutes(10)).toBe('1 min');
    expect(formatDurationMinutes(960)).toBe('16 min');
    expect(formatDurationMinutes(7200)).toBe('2 h');
    expect(formatDurationMinutes(5400)).toBe('1 h 30 min');
  });
});

describe('fetchDrivingRouteGeometry', () => {
  it('devuelve la polilínea directa sin consultar OSRM con menos de 2 puntos', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await fetchDrivingRouteGeometry([QUITO]);
    expect(result).toMatchObject({ distanceMeters: null, durationSeconds: null, isRoadGeometry: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usa la geometría vial de OSRM y la reutiliza desde la caché', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(osrmResponse([[-78.4678, -0.1807], [-78.5, -0.2], [-78.6167, -1.2491]], 6400, 960)),
    );
    vi.stubGlobal('fetch', fetchMock);
    const waypoints = [
      { lat: -0.1111, lng: -78.1111 },
      { lat: -0.2222, lng: -78.2222 },
    ];

    const first = await fetchDrivingRouteGeometry(waypoints);
    const second = await fetchDrivingRouteGeometry(waypoints);

    expect(first).toMatchObject({ isRoadGeometry: true, distanceMeters: 6400, durationSeconds: 960 });
    expect(first.points).toHaveLength(3);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cae a la línea directa si OSRM responde con error, sin geometría o falla la red', async () => {
    const waypoints = [
      { lat: -0.3333, lng: -78.3333 },
      { lat: -0.4444, lng: -78.4444 },
    ];

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false } as Response)));
    const httpError = await fetchDrivingRouteGeometry(waypoints);
    expect(httpError.isRoadGeometry).toBe(false);
    expect(httpError.distanceMeters).toBeGreaterThan(0);

    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(osrmResponse([]))));
    expect((await fetchDrivingRouteGeometry(waypoints)).isRoadGeometry).toBe(false);

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    expect((await fetchDrivingRouteGeometry(waypoints)).isRoadGeometry).toBe(false);
  });

  it('limita la caché a 40 rutas descartando la menos reciente', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(osrmResponse([[-78.1, -0.1], [-78.2, -0.2]])));
    vi.stubGlobal('fetch', fetchMock);
    const route = (index: number) => [
      { lat: -0.5 - index * 0.001, lng: -78.5 },
      { lat: -0.6 - index * 0.001, lng: -78.6 },
    ];

    for (let index = 0; index < 41; index += 1) {
      await fetchDrivingRouteGeometry(route(index));
    }
    expect(fetchMock).toHaveBeenCalledTimes(41);

    // La más reciente sigue en caché; la primera fue desalojada y se vuelve a consultar.
    await fetchDrivingRouteGeometry(route(40));
    expect(fetchMock).toHaveBeenCalledTimes(41);
    await fetchDrivingRouteGeometry(route(0));
    expect(fetchMock).toHaveBeenCalledTimes(42);
  });
});

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import { ShortIdBadge } from '../ShortIdBadge/ShortIdBadge.js';
import {
  STORE_ORDER_STATUS_LABELS,
  formatCents,
  googleMapsDirectionsUrl,
  isWithinEcuador,
  osmDirectionsUrl,
} from '../../../features/store/domain/storeTypes.js';
import {
  DEFAULT_ECUADOR_CENTER,
  ECUADOR_CITIES,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_SIZE,
  clampEcuadorLatLng,
  computeFitView,
  fetchDrivingRouteGeometry,
  formatDistanceKm,
  formatDurationMinutes,
  googleMapsMultiStopUrl,
  latLngToWorld,
  tileUrlFor,
  worldToLatLng,
  type DrivingRouteGeometry,
  type LatLng,
  type MapLayerStyle,
} from './ecuadorMapMath.js';
import './route-map.css';

export interface RouteMapStop {
  readonly orderId: string;
  readonly position: number;
  readonly address: string;
  readonly status: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly deliveryDate?: string | undefined;
  readonly deliveryTime?: string | undefined;
  readonly recipientName?: string | null | undefined;
  readonly recipientPhone?: string | null | undefined;
  readonly totalCents?: number | null | undefined;
  readonly notes?: string | null | undefined;
}

export interface RouteStopsMapProps {
  readonly stops: readonly RouteMapStop[];
  readonly title?: string | undefined;
  readonly subtitle?: string | undefined;
  readonly selectedOrderId?: string | null | undefined;
  readonly onSelectStop?: ((orderId: string) => void) | undefined;
  readonly showRoutePolyline?: boolean | undefined;
  readonly compact?: boolean | undefined;
  readonly height?: number | undefined;
  readonly emptyMessage?: string | undefined;
}

const STATUS_CLASS: Record<string, string> = {
  pendiente: 'route-map-marker--pendiente',
  asignado_a_ruta: 'route-map-marker--asignado_a_ruta',
  recogido: 'route-map-marker--recogido',
  en_camino: 'route-map-marker--en_camino',
  entregado: 'route-map-marker--entregado',
  entrega_fallida: 'route-map-marker--entrega_fallida',
  cancelado: 'route-map-marker--cancelado',
};

/**
 * Mapa interactivo real de ciudad y ruta (Carto Voyager HD / OpenStreetMap + OSRM)
 * para Repartidor, Administrador y Cliente. Cero dependencias npm externas.
 */
export const RouteStopsMap: FC<RouteStopsMapProps> = ({
  stops,
  title = 'Mapa interactivo de la ruta',
  subtitle,
  selectedOrderId = null,
  onSelectStop,
  showRoutePolyline = true,
  compact = false,
  height,
  emptyMessage = 'Estas paradas se registraron en modo dirección manual (sin pin en mapa). Los pedidos de tienda con pin se trazan aquí automáticamente.',
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: 720,
    h: height ?? (compact ? 260 : 360),
  });
  const [layer, setLayer] = useState<MapLayerStyle>('osm');
  const [activeCityId, setActiveCityId] = useState<string>('quito');
  const [center, setCenter] = useState<LatLng>(DEFAULT_ECUADOR_CENTER);
  const [zoom, setZoom] = useState<number>(13);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [popupDismissed, setPopupDismissed] = useState(false);
  const [geometry, setGeometry] = useState<DrivingRouteGeometry | null>(null);
  const [failedSatellite, setFailedSatellite] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startWorldX: number;
    startWorldY: number;
  }>({ active: false, startX: 0, startY: 0, startWorldX: 0, startWorldY: 0 });

  const geoStops = useMemo(
    () =>
      stops.filter(
        (s): s is RouteMapStop & { readonly latitude: number; readonly longitude: number } =>
          s.latitude !== null && s.longitude !== null && isWithinEcuador(s.latitude, s.longitude),
      ),
    [stops],
  );

  const geoPoints = useMemo<readonly LatLng[]>(
    () => geoStops.map((s) => ({ lat: s.latitude, lng: s.longitude })),
    [geoStops],
  );

  const geoSignature = useMemo(
    () => geoStops.map((s) => `${s.orderId}:${s.position}:${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`).join('|'),
    [geoStops],
  );

  // Medición responsiva del contenedor
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) {
        setViewportSize({ w: rect.width, h: rect.height });
      }
    };
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitRoute = useCallback(() => {
    const fitted = computeFitView(geoPoints, viewportSize.w, viewportSize.h, DEFAULT_ECUADOR_CENTER);
    setCenter(fitted.center);
    setZoom(fitted.zoom);
  }, [geoPoints, viewportSize.h, viewportSize.w]);

  // Encuadre automático cuando cambian las paradas geocodificadas
  useEffect(() => {
    if (geoPoints.length > 0) {
      const fitted = computeFitView(geoPoints, viewportSize.w, viewportSize.h, DEFAULT_ECUADOR_CENTER);
      setCenter(fitted.center);
      setZoom(fitted.zoom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoSignature]);

  // Geometría real de conducción por calles (OSRM público con respaldo directo)
  useEffect(() => {
    if (!showRoutePolyline || geoPoints.length < 2) {
      setGeometry(null);
      return;
    }
    const controller = new AbortController();
    void fetchDrivingRouteGeometry(geoPoints, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setGeometry(result);
      }
    });
    return () => controller.abort();
  }, [geoPoints, showRoutePolyline, geoSignature]);

  // Sincronización con selección externa (por ejemplo al hacer clic en una parada de la lista)
  const effectiveSelectedId = selectedOrderId ?? internalSelectedId;
  const selectedStop = useMemo(
    () => geoStops.find((s) => s.orderId === effectiveSelectedId) ?? null,
    [effectiveSelectedId, geoStops],
  );

  useEffect(() => {
    if (!selectedOrderId) return;
    const target = geoStops.find((s) => s.orderId === selectedOrderId);
    if (target) {
      setCenter({ lat: target.latitude, lng: target.longitude });
      setZoom((z) => Math.max(z, 15));
      setPopupDismissed(false);
    }
  }, [selectedOrderId, geoStops]);

  const centerWorld = useMemo(
    () => latLngToWorld(center.lat, center.lng, zoom),
    [center.lat, center.lng, zoom],
  );

  const activeLayer: MapLayerStyle = failedSatellite ? 'osm' : layer;

  const tiles = useMemo(() => {
    const maxIndex = Math.pow(2, zoom);
    const centerTileX = Math.floor(centerWorld.x / MAP_TILE_SIZE);
    const centerTileY = Math.floor(centerWorld.y / MAP_TILE_SIZE);
    const spanX = Math.ceil(viewportSize.w / (2 * MAP_TILE_SIZE)) + 1;
    const spanY = Math.ceil(viewportSize.h / (2 * MAP_TILE_SIZE)) + 1;
    const result: { key: string; url: string; fallbackUrl: string; left: number; top: number }[] = [];

    for (let dx = -spanX; dx <= spanX; dx += 1) {
      for (let dy = -spanY; dy <= spanY; dy += 1) {
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        if (ty < 0 || ty >= maxIndex) continue;
        const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
        result.push({
          key: `${activeLayer}-${zoom}-${wrappedX}-${ty}`,
          url: tileUrlFor(activeLayer, zoom, wrappedX, ty),
          fallbackUrl: tileUrlFor('osm', zoom, wrappedX, ty),
          left: viewportSize.w / 2 + (tx * MAP_TILE_SIZE - centerWorld.x),
          top: viewportSize.h / 2 + (ty * MAP_TILE_SIZE - centerWorld.y),
        });
      }
    }
    return result;
  }, [activeLayer, centerWorld.x, centerWorld.y, viewportSize.h, viewportSize.w, zoom]);

  const toViewportXY = useCallback(
    (lat: number, lng: number) => {
      const w = latLngToWorld(lat, lng, zoom);
      return {
        x: viewportSize.w / 2 + (w.x - centerWorld.x),
        y: viewportSize.h / 2 + (w.y - centerWorld.y),
      };
    },
    [centerWorld.x, centerWorld.y, viewportSize.h, viewportSize.w, zoom],
  );

  const polylineSvgPath = useMemo(() => {
    const pts = geometry?.points ?? (showRoutePolyline && geoPoints.length >= 2 ? geoPoints : []);
    if (pts.length < 2) return '';
    return pts
      .map((p, idx) => {
        const { x, y } = toViewportXY(p.lat, p.lng);
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [geometry?.points, geoPoints, showRoutePolyline, toViewportXY]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startWorldX: centerWorld.x,
      startWorldY: centerWorld.y,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    const next = worldToLatLng(
      dragRef.current.startWorldX - dx,
      dragRef.current.startWorldY - dy,
      zoom,
    );
    setCenter(clampEcuadorLatLng(next.lat, next.lng));
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) < 4) return;
    event.preventDefault();
    setZoom((prev) =>
      event.deltaY < 0 ? Math.min(MAP_MAX_ZOOM, prev + 1) : Math.max(MAP_MIN_ZOOM, prev - 1),
    );
  };

  const selectCity = (cityId: string) => {
    const found = ECUADOR_CITIES.find((c) => c.id === cityId);
    if (!found) return;
    setActiveCityId(found.id);
    setCenter({ lat: found.lat, lng: found.lng });
    setZoom(found.zoom);
  };

  const handleMarkerClick = (stop: RouteMapStop & { latitude: number; longitude: number }) => {
    setInternalSelectedId(stop.orderId);
    setPopupDismissed(false);
    setCenter({ lat: stop.latitude, lng: stop.longitude });
    setZoom((z) => Math.max(z, 15));
    onSelectStop?.(stop.orderId);
  };

  const gmapsRouteUrl = useMemo(() => googleMapsMultiStopUrl(geoPoints), [geoPoints]);
  const distanceLabel = formatDistanceKm(geometry?.distanceMeters ?? null);
  const durationLabel = formatDurationMinutes(geometry?.durationSeconds ?? null);

  return (
    <div className={'route-map-shell' + (compact ? ' route-map-shell--compact' : '')}>
      <div className="route-map-head">
        <div className="route-map-head__info">
          <h4 className="route-map-head__title">{title}</h4>
          {subtitle && <p className="route-map-head__subtitle">{subtitle}</p>}
        </div>

        <div className="route-map-head__badges">
          <span className="route-map-metric route-map-metric--neutral">
            {geoStops.length} de {stops.length}{' '}
            {stops.length === 1 ? 'parada en mapa' : 'paradas en mapa'}
          </span>
          {distanceLabel && (
            <span className="route-map-metric">
              {distanceLabel}
              {durationLabel ? ` · ~${durationLabel}` : ''}
            </span>
          )}
          {gmapsRouteUrl && (
            <a
              href={gmapsRouteUrl}
              target="_blank"
              rel="noreferrer"
              className="route-map-gmaps-link"
            >
              Abrir ruta en Google Maps ↗
            </a>
          )}
        </div>
      </div>

      <div className="route-map-toolbar">
        <div className="route-map-cities" role="group" aria-label="Centrar en ciudad de Ecuador">
          {ECUADOR_CITIES.map((city) => (
            <button
              key={city.id}
              type="button"
              className={
                'route-map-chip' + (activeCityId === city.id && geoStops.length === 0 ? ' route-map-chip--active' : '')
              }
              onClick={() => selectCity(city.id)}
            >
              {city.name}
            </button>
          ))}
        </div>

        <div className="route-map-tools-right">
          {geoStops.length > 0 && (
            <button type="button" className="route-map-chip route-map-chip--active" onClick={fitRoute}>
              Ajustar ruta
            </button>
          )}
          <button
            type="button"
            className={'route-map-chip' + (activeLayer === 'osm' ? ' route-map-chip--active' : '')}
            onClick={() => setLayer('osm')}
          >
            Calles
          </button>
          <button
            type="button"
            className={'route-map-chip' + (activeLayer === 'satellite' ? ' route-map-chip--active' : '')}
            onClick={() => {
              setFailedSatellite(false);
              setLayer('satellite');
            }}
          >
            Satélite
          </button>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="route-map-viewport"
        style={height ? { height: `${height}px` } : undefined}
        role="region"
        aria-label={title}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={() => setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1))}
      >
        <div className="route-map-tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              className="route-map-tile"
              style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
              onError={(event) => {
                if (activeLayer === 'satellite') {
                  setFailedSatellite(true);
                  event.currentTarget.src = tile.fallbackUrl;
                }
              }}
            />
          ))}
        </div>

        {polylineSvgPath.length > 0 && (
          <svg className="route-map-svg" aria-hidden="true">
            <path
              d={polylineSvgPath}
              fill="none"
              stroke="rgba(255, 255, 255, 0.92)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={polylineSvgPath}
              fill="none"
              stroke="#1668f3"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={geometry?.isRoadGeometry === false ? '8 6' : undefined}
            />
          </svg>
        )}

        <div className="route-map-markers">
          {geoStops.map((stop) => {
            const { x, y } = toViewportXY(stop.latitude, stop.longitude);
            if (x < -40 || x > viewportSize.w + 40 || y < -40 || y > viewportSize.h + 40) {
              return null;
            }
            const isSelected = stop.orderId === effectiveSelectedId;
            const statusClass = STATUS_CLASS[stop.status] ?? '';
            return (
              <button
                key={`${stop.orderId}-${stop.position}`}
                type="button"
                className={
                  `route-map-marker ${statusClass}` + (isSelected ? ' route-map-marker--selected' : '')
                }
                style={{ left: `${x}px`, top: `${y}px` }}
                aria-label={`Parada ${stop.position}: ${stop.address}`}
                title={`Parada #${stop.position} · ${stop.address}`}
                onClick={() => handleMarkerClick(stop)}
              >
                <span className="route-map-marker__bubble">{stop.position}</span>
                <span className="route-map-marker__tip" aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {geoStops.length === 0 && (
          <div className="route-map-empty-pill" role="status">
            {emptyMessage}
          </div>
        )}

        <div className="route-map-controls">
          <button
            type="button"
            className="route-map-ctrl-btn"
            aria-label="Acercar mapa"
            onClick={() => setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1))}
          >
            +
          </button>
          <button
            type="button"
            className="route-map-ctrl-btn"
            aria-label="Alejar mapa"
            onClick={() => setZoom((z) => Math.max(MAP_MIN_ZOOM, z - 1))}
          >
            −
          </button>
        </div>

        {selectedStop && !popupDismissed && (
          <div className="route-map-popup" role="dialog" aria-label={`Detalle de parada ${selectedStop.position}`}>
            <div className="route-map-popup__head">
              <div className="route-map-popup__tags">
                <span className="route-map-metric">Parada #{selectedStop.position}</span>
                <ShortIdBadge id={selectedStop.orderId} prefix="PED" />
                <span className="route-map-metric route-map-metric--neutral">
                  {STORE_ORDER_STATUS_LABELS[selectedStop.status] ?? selectedStop.status}
                </span>
                {selectedStop.totalCents !== null && selectedStop.totalCents !== undefined && (
                  <span className="route-map-metric">
                    COD: {formatCents(selectedStop.totalCents)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="route-map-popup__close"
                aria-label="Cerrar detalle de parada"
                onClick={() => setPopupDismissed(true)}
              >
                ×
              </button>
            </div>
            <p className="route-map-popup__address">{selectedStop.address}</p>
            <p className="route-map-popup__meta">
              {selectedStop.deliveryDate ? `${selectedStop.deliveryDate}` : ''}
              {selectedStop.deliveryTime ? ` · ${selectedStop.deliveryTime}` : ''}
              {selectedStop.recipientName
                ? ` · ${selectedStop.recipientName}${selectedStop.recipientPhone ? ` (${selectedStop.recipientPhone})` : ''}`
                : ''}
              {` · (${selectedStop.latitude.toFixed(5)}, ${selectedStop.longitude.toFixed(5)})`}
            </p>
            <div className="route-map-popup__links">
              <a
                href={googleMapsDirectionsUrl(selectedStop.latitude, selectedStop.longitude)}
                target="_blank"
                rel="noreferrer"
                className="route-map-popup__link"
              >
                Cómo llegar en Google Maps ↗
              </a>
              <a
                href={osmDirectionsUrl(selectedStop.latitude, selectedStop.longitude)}
                target="_blank"
                rel="noreferrer"
                className="route-map-popup__link"
              >
                OpenStreetMap ↗
              </a>
            </div>
          </div>
        )}

        <span className="route-map-attribution">
          {activeLayer === 'satellite' ? '© Esri World Imagery' : '© OpenStreetMap'}
        </span>
      </div>

      <div className="route-map-legend">
        <div className="route-map-legend__items">
          <span>
            <span className="route-map-legend__dot" style={{ backgroundColor: '#d97706' }} />
            Pendiente / Asignado
          </span>
          <span>
            <span className="route-map-legend__dot" style={{ backgroundColor: '#1668f3' }} />
            En camino
          </span>
          <span>
            <span className="route-map-legend__dot" style={{ backgroundColor: '#15803d' }} />
            Entregado
          </span>
          <span>
            <span className="route-map-legend__dot" style={{ backgroundColor: '#dc2626' }} />
            Fallida / Cancelada
          </span>
        </div>
        <span>Arrastra para mover · Rueda o +/− para zoom · Clic en un pin para ver detalle</span>
      </div>
    </div>
  );
};

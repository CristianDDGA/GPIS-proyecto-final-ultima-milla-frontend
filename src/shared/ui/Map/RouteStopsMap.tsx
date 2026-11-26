import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
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
  sampleRouteChevrons,
  tileUrlFor,
  wazeDirectionsUrl,
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

const DRAG_COMMIT_THRESHOLD_PX = 128;

/**
 * Mapa interactivo estilo Uber / Uber Eats (OpenStreetMap + grading Uber Minimal / Esri Satélite + OSRM).
 * Arrastre GPU 60-120fps con translate3d, HUD flotante ETA/km, dock inferior navegable,
 * polilínea dual con flechas direccionales y puck vehicular — cero dependencias npm.
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
  const panStageRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: 720,
    h: height ?? (compact ? 260 : 380),
  });
  const [layer, setLayer] = useState<MapLayerStyle>('uber');
  const [activeCityId, setActiveCityId] = useState<string>('quito');
  const [center, setCenter] = useState<LatLng>(DEFAULT_ECUADOR_CENTER);
  const [zoom, setZoom] = useState<number>(13);
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [dockVisible, setDockVisible] = useState<boolean>(!compact);
  const [geometry, setGeometry] = useState<DrivingRouteGeometry | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [failedSatellite, setFailedSatellite] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startWorldX: number;
    startWorldY: number;
    dx: number;
    dy: number;
    rafId: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    startWorldX: 0,
    startWorldY: 0,
    dx: 0,
    dy: 0,
    rafId: 0,
  });

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

  const deliveredCount = useMemo(
    () => stops.filter((s) => s.status === 'entregado').length,
    [stops],
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
  }, [isExpanded]);

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
      setIsLoadingRoute(false);
      return;
    }
    const controller = new AbortController();
    setIsLoadingRoute(true);
    void fetchDrivingRouteGeometry(geoPoints, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setGeometry(result);
        setIsLoadingRoute(false);
      }
    });
    return () => controller.abort();
  }, [geoPoints, showRoutePolyline, geoSignature]);

  // Selección activa: externa > interna > parada en_camino > primera parada
  const effectiveSelectedId = useMemo(() => {
    if (selectedOrderId && geoStops.some((s) => s.orderId === selectedOrderId)) {
      return selectedOrderId;
    }
    if (internalSelectedId && geoStops.some((s) => s.orderId === internalSelectedId)) {
      return internalSelectedId;
    }
    if (!compact && geoStops.length > 0) {
      const activeStop = geoStops.find((s) => s.status === 'en_camino') ?? geoStops[0]!;
      return activeStop.orderId;
    }
    return null;
  }, [compact, geoStops, internalSelectedId, selectedOrderId]);

  const selectedIndex = useMemo(
    () => geoStops.findIndex((s) => s.orderId === effectiveSelectedId),
    [effectiveSelectedId, geoStops],
  );

  const selectedStop = selectedIndex >= 0 ? geoStops[selectedIndex]! : null;

  // Parada activa del vehículo (en_camino)
  const activeVehicleStop = useMemo(
    () => geoStops.find((s) => s.status === 'en_camino') ?? null,
    [geoStops],
  );

  useEffect(() => {
    if (!selectedOrderId) return;
    const target = geoStops.find((s) => s.orderId === selectedOrderId);
    if (target) {
      setCenter({ lat: target.latitude, lng: target.longitude });
      setZoom((z) => Math.max(z, 15));
      setDockVisible(true);
    }
  }, [selectedOrderId, geoStops]);

  const centerWorld = useMemo(
    () => latLngToWorld(center.lat, center.lng, zoom),
    [center.lat, center.lng, zoom],
  );

  const activeLayer: MapLayerStyle = failedSatellite && layer === 'satellite' ? 'uber' : layer;

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
        const cacheLayer = activeLayer === 'satellite' ? 'sat' : 'osm';
        result.push({
          key: `${cacheLayer}-${zoom}-${wrappedX}-${ty}`,
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

  const routeScreenPoints = useMemo(() => {
    const pts = geometry?.points ?? (showRoutePolyline && geoPoints.length >= 2 ? geoPoints : []);
    if (pts.length < 2) return [];
    return pts.map((p) => toViewportXY(p.lat, p.lng));
  }, [geometry?.points, geoPoints, showRoutePolyline, toViewportXY]);

  const polylineSvgPath = useMemo(() => {
    if (routeScreenPoints.length < 2) return '';
    return routeScreenPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }, [routeScreenPoints]);

  const routeChevrons = useMemo(
    () => (showRoutePolyline ? sampleRouteChevrons(routeScreenPoints, compact ? 3 : 6) : []),
    [compact, routeScreenPoints, showRoutePolyline],
  );

  const resetStageTransform = () => {
    if (panStageRef.current) {
      panStageRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
  };

  useEffect(() => {
    return () => {
      if (dragRef.current.rafId) {
        cancelAnimationFrame(dragRef.current.rafId);
      }
    };
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      startWorldX: centerWorld.x,
      startWorldY: centerWorld.y,
      dx: 0,
      dy: 0,
      rafId: dragRef.current.rafId,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    d.dx = dx;
    d.dy = dy;

    if (Math.hypot(dx, dy) >= DRAG_COMMIT_THRESHOLD_PX) {
      // Recarga fluida de tiles en arrastres largos sin perder el ritmo 60fps
      const next = worldToLatLng(d.startWorldX - dx, d.startWorldY - dy, zoom);
      const clamped = clampEcuadorLatLng(next.lat, next.lng);
      const nextWorld = latLngToWorld(clamped.lat, clamped.lng, zoom);
      d.startX = event.clientX;
      d.startY = event.clientY;
      d.startWorldX = nextWorld.x;
      d.startWorldY = nextWorld.y;
      d.dx = 0;
      d.dy = 0;
      resetStageTransform();
      setCenter(clamped);
      return;
    }

    if (!d.rafId) {
      d.rafId = requestAnimationFrame(() => {
        d.rafId = 0;
        if (panStageRef.current && d.active) {
          panStageRef.current.style.transform = `translate3d(${d.dx}px, ${d.dy}px, 0px)`;
        }
      });
    }
  };

  const commitDragEnd = () => {
    const d = dragRef.current;
    if (!d.active) return;
    d.active = false;
    setIsDragging(false);
    if (d.rafId) {
      cancelAnimationFrame(d.rafId);
      d.rafId = 0;
    }
    const finalDx = d.dx;
    const finalDy = d.dy;
    d.dx = 0;
    d.dy = 0;
    resetStageTransform();
    if (Math.abs(finalDx) > 1 || Math.abs(finalDy) > 1) {
      const next = worldToLatLng(d.startWorldX - finalDx, d.startWorldY - finalDy, zoom);
      setCenter(clampEcuadorLatLng(next.lat, next.lng));
    }
  };

  // La rueda hace zoom sin mover la página: el listener nativo no es pasivo (en React onWheel sí lo es).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (event: globalThis.WheelEvent) => {
      if (Math.abs(event.deltaY) < 4) return;
      event.preventDefault();
      setZoom((prev) =>
        event.deltaY < 0 ? Math.min(MAP_MAX_ZOOM, prev + 1) : Math.max(MAP_MIN_ZOOM, prev - 1),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const stepPx = 64;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1));
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      setZoom((z) => Math.max(MAP_MIN_ZOOM, z - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const next = worldToLatLng(centerWorld.x, centerWorld.y - stepPx, zoom);
      setCenter(clampEcuadorLatLng(next.lat, next.lng));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = worldToLatLng(centerWorld.x, centerWorld.y + stepPx, zoom);
      setCenter(clampEcuadorLatLng(next.lat, next.lng));
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = worldToLatLng(centerWorld.x - stepPx, centerWorld.y, zoom);
      setCenter(clampEcuadorLatLng(next.lat, next.lng));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      const next = worldToLatLng(centerWorld.x + stepPx, centerWorld.y, zoom);
      setCenter(clampEcuadorLatLng(next.lat, next.lng));
    }
  };

  const selectCity = (cityId: string) => {
    const found = ECUADOR_CITIES.find((c) => c.id === cityId);
    if (!found) return;
    setActiveCityId(found.id);
    setCenter({ lat: found.lat, lng: found.lng });
    setZoom(found.zoom);
  };

  const focusStop = useCallback(
    (stop: RouteMapStop & { readonly latitude: number; readonly longitude: number }) => {
      setInternalSelectedId(stop.orderId);
      setDockVisible(true);
      setCenter({ lat: stop.latitude, lng: stop.longitude });
      setZoom((z) => Math.max(z, 15));
      onSelectStop?.(stop.orderId);
    },
    [onSelectStop],
  );

  const stepStop = (delta: -1 | 1) => {
    if (geoStops.length === 0) return;
    const base = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIdx = (base + delta + geoStops.length) % geoStops.length;
    const target = geoStops[nextIdx];
    if (target) {
      focusStop(target);
    }
  };

  const handleLocateMe = () => {
    setGeoNotice(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoNotice('Tu navegador no soporta geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!isWithinEcuador(lat, lng)) {
          setGeoNotice('Tu ubicación GPS actual está fuera de Ecuador.');
          return;
        }
        const clamped = clampEcuadorLatLng(lat, lng);
        setUserLocation(clamped);
        setCenter(clamped);
        setZoom((z) => Math.max(z, 15));
      },
      () => {
        setGeoNotice('No se pudo obtener tu ubicación GPS.');
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const gmapsRouteUrl = useMemo(() => googleMapsMultiStopUrl(geoPoints), [geoPoints]);
  const distanceLabel = formatDistanceKm(geometry?.distanceMeters ?? null);
  const durationLabel = formatDurationMinutes(geometry?.durationSeconds ?? null);

  const effectiveHeight = isExpanded ? 560 : height ?? (compact ? 250 : 380);
  const tilesLayerClass =
    activeLayer === 'uber'
      ? 'route-map-tiles route-map-tiles--uber'
      : 'route-map-tiles';

  const vehicleXY = useMemo(() => {
    if (userLocation) return toViewportXY(userLocation.lat, userLocation.lng);
    if (activeVehicleStop) return toViewportXY(activeVehicleStop.latitude, activeVehicleStop.longitude);
    return null;
  }, [activeVehicleStop, toViewportXY, userLocation]);

  return (
    <div
      className={
        'route-map-shell' +
        (compact ? ' route-map-shell--compact' : '') +
        (isExpanded ? ' route-map-shell--expanded' : '')
      }
      data-map-layer={activeLayer}
    >
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

        <div className="route-map-tools-right" role="group" aria-label="Estilo y encuadre del mapa">
          {geoStops.length > 0 && (
            <button type="button" className="route-map-chip route-map-chip--dark" onClick={fitRoute}>
              Ajustar ruta
            </button>
          )}
          <button
            type="button"
            className={'route-map-chip' + (activeLayer === 'uber' ? ' route-map-chip--active' : '')}
            onClick={() => setLayer('uber')}
          >
            Uber
          </button>
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
        className={'route-map-viewport' + (isDragging ? ' route-map-viewport--dragging' : '')}
        style={{ height: `${effectiveHeight}px` }}
        role="region"
        tabIndex={0}
        aria-label={`${title}. Usa flechas para mover y + o - para acercar o alejar.`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={commitDragEnd}
        onPointerCancel={commitDragEnd}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1))}
      >
        {/* Escenario GPU: tiles + ruta + marcadores se mueven juntos en 1 solo translate3d */}
        <div ref={panStageRef} className="route-map-stage">
          <div className={tilesLayerClass} aria-hidden="true">
            {tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.url}
                alt=""
                draggable={false}
                className="route-map-tile"
                style={{ left: `${tile.left}px`, top: `${tile.top}px` }}
                onLoad={(event) => {
                  event.currentTarget.classList.add('route-map-tile--loaded');
                }}
                onError={(event) => {
                  if (activeLayer === 'satellite') {
                    setFailedSatellite(true);
                    event.currentTarget.src = tile.fallbackUrl;
                  } else {
                    event.currentTarget.classList.add('route-map-tile--loaded');
                  }
                }}
              />
            ))}
          </div>

          {polylineSvgPath.length > 0 && (
            <svg className="route-map-svg" aria-hidden="true">
              {/* Casing oscuro Uber + núcleo azul eléctrico */}
              <path
                d={polylineSvgPath}
                fill="none"
                stroke="#0b132b"
                strokeOpacity="0.82"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={polylineSvgPath}
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.92"
                strokeWidth="6.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={polylineSvgPath}
                fill="none"
                stroke="#1668f3"
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={geometry?.isRoadGeometry === false ? '8 6' : undefined}
              />
              {routeChevrons.map((ch, idx) => (
                <g
                  key={idx}
                  transform={`translate(${ch.x.toFixed(1)}, ${ch.y.toFixed(1)}) rotate(${ch.angleDeg.toFixed(1)})`}
                >
                  <path
                    d="M -3.5 -2.8 L 2.2 0 L -3.5 2.8"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              ))}
            </svg>
          )}

          {/* Puck vehicular Uber / GPS en vivo */}
          {vehicleXY &&
            vehicleXY.x >= -36 &&
            vehicleXY.x <= viewportSize.w + 36 &&
            vehicleXY.y >= -36 &&
            vehicleXY.y <= viewportSize.h + 36 && (
              <div
                className="route-map-vehicle-puck"
                style={{ left: `${vehicleXY.x}px`, top: `${vehicleXY.y}px` }}
                aria-hidden="true"
              >
                <span className="route-map-vehicle-puck__halo" />
                <span className="route-map-vehicle-puck__core">
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
                    <path d="M8 2L13 13L8 10.6L3 13L8 2Z" fill="#ffffff" />
                  </svg>
                </span>
              </div>
            )}

          <div className="route-map-markers">
            {geoStops.map((stop) => {
              const { x, y } = toViewportXY(stop.latitude, stop.longitude);
              if (x < -48 || x > viewportSize.w + 48 || y < -48 || y > viewportSize.h + 48) {
                return null;
              }
              const isSelected = stop.orderId === effectiveSelectedId;
              const statusClass = STATUS_CLASS[stop.status] ?? '';
              const isDelivered = stop.status === 'entregado';
              const isFailed = stop.status === 'entrega_fallida' || stop.status === 'cancelado';
              const pillSub =
                stop.deliveryTime ??
                (stop.totalCents !== null && stop.totalCents !== undefined
                  ? formatCents(stop.totalCents)
                  : null);

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
                  onClick={() => focusStop(stop)}
                >
                  {isSelected && (
                    <span className="route-map-marker__callout" aria-hidden="true">
                      #{stop.position}
                      {pillSub ? ` · ${pillSub}` : ''}
                    </span>
                  )}
                  <span className="route-map-marker__bubble">
                    {isDelivered ? '✓' : isFailed ? '!' : stop.position}
                  </span>
                  <span className="route-map-marker__stem" aria-hidden="true" />
                  <span className="route-map-marker__shadow" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Floating Uber Top-Left HUD */}
        {geoStops.length > 0 && (
          <div className="route-map-hud" role="status" aria-live="polite">
            <span className="route-map-hud__dot" aria-hidden="true" />
            {isLoadingRoute ? (
              <span className="route-map-hud__label">Trazando ruta vial…</span>
            ) : durationLabel || distanceLabel ? (
              <span className="route-map-hud__label">
                {durationLabel ? <strong>{durationLabel}</strong> : null}
                {durationLabel && distanceLabel ? ' · ' : ''}
                {distanceLabel ?? ''}
                {stops.length > 1 ? ` · ${deliveredCount}/${stops.length} entregadas` : ''}
              </span>
            ) : (
              <span className="route-map-hud__label">
                <strong>{geoStops.length}</strong>{' '}
                {geoStops.length === 1 ? 'destino en mapa' : 'destinos en mapa'}
                {stops.length > 1 ? ` · ${deliveredCount}/${stops.length} entregadas` : ''}
              </span>
            )}
          </div>
        )}

        {geoStops.length === 0 && (
          <div className="route-map-empty-pill" role="status">
            {emptyMessage}
          </div>
        )}

        {geoNotice && (
          <div className="route-map-geo-notice" role="status">
            <span>{geoNotice}</span>
            <button
              type="button"
              className="route-map-geo-notice__close"
              aria-label="Cerrar aviso de ubicación"
              onClick={() => setGeoNotice(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* Controles flotantes Uber (derecha) */}
        <div className="route-map-controls">
          <button
            type="button"
            className="route-map-ctrl-btn"
            aria-label="Acercar mapa"
            title="Acercar (+)"
            onClick={() => setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1))}
          >
            +
          </button>
          <button
            type="button"
            className="route-map-ctrl-btn"
            aria-label="Alejar mapa"
            title="Alejar (−)"
            onClick={() => setZoom((z) => Math.max(MAP_MIN_ZOOM, z - 1))}
          >
            −
          </button>
          {geoStops.length > 0 && (
            <button
              type="button"
              className="route-map-ctrl-btn"
              aria-label="Encuadrar ruta"
              title="Encuadrar todas las paradas"
              onClick={fitRoute}
            >
              <svg viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true">
                <path
                  d="M3 6.5V3h3.5M15 6.5V3h-3.5M3 11.5V15h3.5M15 11.5V15h-3.5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <button
            type="button"
            className={'route-map-ctrl-btn' + (userLocation ? ' route-map-ctrl-btn--active' : '')}
            aria-label="Mi ubicación"
            title="Centrar en mi ubicación GPS"
            onClick={handleLocateMe}
          >
            <svg viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M9 2.2v2.2M9 13.6v2.2M2.2 9h2.2M13.6 9h2.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {!compact && (
            <button
              type="button"
              className={'route-map-ctrl-btn' + (isExpanded ? ' route-map-ctrl-btn--active' : '')}
              aria-label={isExpanded ? 'Contraer mapa' : 'Expandir mapa'}
              aria-pressed={isExpanded}
              title={isExpanded ? 'Vista normal' : 'Expandir mapa'}
              onClick={() => setIsExpanded((prev) => !prev)}
            >
              {isExpanded ? (
                <svg viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true">
                  <path
                    d="M7 3v4H3M11 15v-4h4M15 7h-4V3M3 11h4v4"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 18 18" width="15" height="15" fill="none" aria-hidden="true">
                  <path
                    d="M11.5 3H15v3.5M6.5 15H3v-3.5M15 3l-4.5 4.5M3 15l4.5-4.5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Uber Bottom Interactive Stop Dock */}
        {selectedStop && dockVisible && (
          <div
            className="route-map-dock route-map-popup"
            role="region"
            aria-label={`Parada ${selectedStop.position} seleccionada`}
          >
            <div className="route-map-dock__head">
              <div className="route-map-dock__tags">
                <span className="route-map-dock__index">
                  #{selectedStop.position}
                  {geoStops.length > 1 ? ` / ${geoStops.length}` : ''}
                </span>
                <ShortIdBadge id={selectedStop.orderId} prefix="PED" />
                <span className="route-map-metric route-map-metric--neutral">
                  {STORE_ORDER_STATUS_LABELS[selectedStop.status] ?? selectedStop.status}
                </span>
                {selectedStop.totalCents !== null && selectedStop.totalCents !== undefined && (
                  <span className="route-map-metric">
                    COD {formatCents(selectedStop.totalCents)}
                  </span>
                )}
              </div>

              <div className="route-map-dock__nav">
                {geoStops.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="route-map-dock__step-btn"
                      aria-label="Parada anterior"
                      title="Parada anterior"
                      onClick={() => stepStop(-1)}
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      className="route-map-dock__step-btn"
                      aria-label="Parada siguiente"
                      title="Parada siguiente"
                      onClick={() => stepStop(1)}
                    >
                      ›
                    </button>
                  </>
                )}
                <button
                  type="button"
                  className="route-map-popup__close"
                  aria-label="Cerrar detalle de parada"
                  onClick={() => setDockVisible(false)}
                >
                  ×
                </button>
              </div>
            </div>

            <p className="route-map-popup__address">{selectedStop.address}</p>
            <p className="route-map-popup__meta">
              {selectedStop.deliveryDate ? `${selectedStop.deliveryDate}` : ''}
              {selectedStop.deliveryTime ? ` · ${selectedStop.deliveryTime}` : ''}
              {selectedStop.recipientName
                ? ` · ${selectedStop.recipientName}${selectedStop.recipientPhone ? ` (${selectedStop.recipientPhone})` : ''}`
                : ''}
            </p>

            <div className="route-map-popup__links">
              <a
                href={googleMapsDirectionsUrl(selectedStop.latitude, selectedStop.longitude)}
                target="_blank"
                rel="noreferrer"
                className="route-map-popup__link route-map-popup__link--primary"
              >
                Google Maps ↗
              </a>
              <a
                href={wazeDirectionsUrl(selectedStop.latitude, selectedStop.longitude)}
                target="_blank"
                rel="noreferrer"
                className="route-map-popup__link"
              >
                Waze ↗
              </a>
              <a
                href={osmDirectionsUrl(selectedStop.latitude, selectedStop.longitude)}
                target="_blank"
                rel="noreferrer"
                className="route-map-popup__link"
              >
                OSM ↗
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
        <span>Arrastra para explorar · Rueda o +/− para zoom · Toca un pin o usa ‹ ›</span>
      </div>
    </div>
  );
};

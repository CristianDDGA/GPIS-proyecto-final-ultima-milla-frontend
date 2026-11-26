import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import {
  Button,
  DEFAULT_ECUADOR_CENTER,
  ECUADOR_CITIES,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_SIZE,
  TextInput,
  clampEcuadorLatLng,
  latLngToWorld,
  tileUrlFor,
  worldToLatLng,
  type MapLayerStyle,
} from '../../../../shared/ui/index.js';
import {
  isWithinEcuador,
  sanitizeBackendText,
} from '../../domain/storeTypes.js';

export interface EcuadorMapPickerProps {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly onChange: (coords: { readonly latitude: number | null; readonly longitude: number | null }) => void;
  readonly onAddressSuggested?: ((address: string) => void) | undefined;
  readonly disabled?: boolean | undefined;
  /** Radio en km del círculo de cobertura dibujado alrededor del pin (editor de zonas). */
  readonly radiusKm?: number | null | undefined;
  /** Coberturas de otras zonas, dibujadas como referencia. */
  readonly overlays?: readonly MapCoverageOverlay[] | undefined;
  /** Texto cuando aún no hay pin; por defecto el de dirección de entrega. */
  readonly emptyHint?: string | undefined;
  /** Alto del mapa en px (por defecto lo fija el CSS: 230). */
  readonly height?: number | undefined;
}

export interface MapCoverageOverlay {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly radiusKm: number;
}

/** Metros que representa un píxel del mapa a esa latitud y zoom (proyección Web Mercator). */
export function metersPerPixel(latitude: number, zoom: number): number {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
}

interface NominatimHit {
  readonly display_name: string;
  readonly lat: string;
  readonly lon: string;
}

/**
 * Selector interactivo de coordenadas en mapa real de calles de Ecuador (cero dependencias).
 * Soporta selector de ciudad, capas Calles HD / OpenStreetMap, zoom con rueda/doble clic,
 * clic para fijar pin, arrastre para desplazar, búsqueda Nominatim y geocodificación inversa.
 */
export const EcuadorMapPicker: FC<EcuadorMapPickerProps> = ({
  latitude,
  longitude,
  onChange,
  onAddressSuggested,
  disabled = false,
  radiusKm = null,
  emptyHint = 'Sin pin en el mapa (modo dirección manual). Haz clic en el mapa para marcar el destino.',
  overlays,
  height,
}) => {
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() =>
    latitude !== null && longitude !== null && isWithinEcuador(latitude, longitude)
      ? { lat: latitude, lng: longitude }
      : DEFAULT_ECUADOR_CENTER,
  );
  const [zoom, setZoom] = useState(14);
  const [layer, setLayer] = useState<MapLayerStyle>('osm');
  const [failedSatellite, setFailedSatellite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly NominatimHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    startWorldX: number;
    startWorldY: number;
  }>({ active: false, moved: false, startX: 0, startY: 0, startWorldX: 0, startWorldY: 0 });
  const lastNominatimRef = useRef(0);

  useEffect(() => {
    if (latitude !== null && longitude !== null && isWithinEcuador(latitude, longitude)) {
      setCenter({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude]);

  // El último punto pedido gana: si el pin se mueve varias veces seguidas, solo se busca la dirección del último
  // (respetando el límite de 1 consulta por segundo de Nominatim) y nunca se pierde la actualización.
  const pendingPointRef = useRef<{ lat: number; lng: number } | null>(null);
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(
    () => () => {
      if (reverseTimerRef.current !== null) clearTimeout(reverseTimerRef.current);
    },
    [],
  );

  const runReverseGeocode = useCallback(async () => {
    const point = pendingPointRef.current;
    if (!onAddressSuggested || point === null) return;
    pendingPointRef.current = null;
    lastNominatimRef.current = Date.now();
    const seq = ++requestSeqRef.current;
    setIsReversing(true);
    setMapNotice(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lng}&accept-language=es`,
      );
      if (!res.ok || seq !== requestSeqRef.current) return;
      const data = (await res.json()) as { display_name?: string };
      if (seq !== requestSeqRef.current) return;
      if (typeof data.display_name === 'string') {
        const clean = sanitizeBackendText(data.display_name, 160);
        if (clean.length >= 6) onAddressSuggested(clean);
      }
    } catch {
      setMapNotice('Punto guardado. Escribe la dirección o ajústala a mano.');
    } finally {
      if (seq === requestSeqRef.current) setIsReversing(false);
    }
  }, [onAddressSuggested]);

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!onAddressSuggested) return;
      pendingPointRef.current = { lat, lng };
      if (reverseTimerRef.current !== null) clearTimeout(reverseTimerRef.current);
      const wait = Math.max(350, 1050 - (Date.now() - lastNominatimRef.current));
      reverseTimerRef.current = setTimeout(() => {
        reverseTimerRef.current = null;
        void runReverseGeocode();
      }, wait);
    },
    [onAddressSuggested, runReverseGeocode],
  );

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 3 || isSearching) return;
    const now = Date.now();
    if (now - lastNominatimRef.current < 1050) {
      setMapNotice('Espera un segundo antes de buscar de nuevo.');
      return;
    }
    lastNominatimRef.current = now;
    setIsSearching(true);
    setMapNotice(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=ec&limit=4&accept-language=es&q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) {
        setSearchResults([]);
        return;
      }
      const hits = (await res.json()) as NominatimHit[];
      setSearchResults(Array.isArray(hits) ? hits : []);
      if (!Array.isArray(hits) || hits.length === 0) {
        setMapNotice('No se encontraron direcciones en Ecuador para esa búsqueda.');
      }
    } catch {
      setMapNotice('No se pudo consultar el buscador del mapa. Puedes fijar el pin manualmente.');
    } finally {
      setIsSearching(false);
    }
  };

  const applySearchHit = (hit: NominatimHit) => {
    const lat = Number.parseFloat(hit.lat);
    const lng = Number.parseFloat(hit.lon);
    if (!isWithinEcuador(lat, lng)) {
      setMapNotice('La ubicación seleccionada queda fuera de Ecuador.');
      return;
    }
    const clamped = clampEcuadorLatLng(lat, lng);
    setCenter(clamped);
    setZoom(16);
    setSearchResults([]);
    onChange({ latitude: clamped.lat, longitude: clamped.lng });
    if (onAddressSuggested) {
      const clean = sanitizeBackendText(hit.display_name, 160);
      if (clean.length >= 6) onAddressSuggested(clean);
    }
  };

  const centerWorld = useMemo(
    () => latLngToWorld(center.lat, center.lng, zoom),
    [center.lat, center.lng, zoom],
  );

  const activeLayer: MapLayerStyle = failedSatellite ? 'osm' : layer;

  const tiles = useMemo(() => {
    const maxIndex = Math.pow(2, zoom);
    const centerTileX = Math.floor(centerWorld.x / MAP_TILE_SIZE);
    const centerTileY = Math.floor(centerWorld.y / MAP_TILE_SIZE);
    const result: { key: string; url: string; fallbackUrl: string; left: number; top: number }[] = [];

    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        if (ty < 0 || ty >= maxIndex) continue;
        const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
        const pixelLeft = tx * MAP_TILE_SIZE - centerWorld.x;
        const pixelTop = ty * MAP_TILE_SIZE - centerWorld.y;
        result.push({
          key: `${activeLayer}-${zoom}-${wrappedX}-${ty}`,
          url: tileUrlFor(activeLayer, zoom, wrappedX, ty),
          fallbackUrl: tileUrlFor('osm', zoom, wrappedX, ty),
          left: pixelLeft,
          top: pixelTop,
        });
      }
    }
    return result;
  }, [activeLayer, centerWorld.x, centerWorld.y, zoom]);

  const pinOffset = useMemo(() => {
    if (latitude === null || longitude === null) return null;
    const pinWorld = latLngToWorld(latitude, longitude, zoom);
    return {
      dx: pinWorld.x - centerWorld.x,
      dy: pinWorld.y - centerWorld.y,
    };
  }, [centerWorld.x, centerWorld.y, latitude, longitude, zoom]);

  const circleFor = (lat: number, lng: number, km: number) => {
    const world = latLngToWorld(lat, lng, zoom);
    const diameter = (2 * km * 1000) / metersPerPixel(lat, zoom);
    return {
      dx: world.x - centerWorld.x,
      dy: world.y - centerWorld.y,
      diameter: Math.max(2, diameter),
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      active: true,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      startWorldX: centerWorld.x,
      startWorldY: centerWorld.y,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || disabled) return;
    const dx = event.clientX - dragRef.current.startX;
    const dy = event.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }
    const next = worldToLatLng(
      dragRef.current.startWorldX - dx,
      dragRef.current.startWorldY - dy,
      zoom,
    );
    setCenter(clampEcuadorLatLng(next.lat, next.lng));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current.active = false;
    if (!wasDrag && viewportRef.current && !disabled) {
      const rect = viewportRef.current.getBoundingClientRect();
      const offsetX = event.clientX - rect.left - rect.width / 2;
      const offsetY = event.clientY - rect.top - rect.height / 2;
      const picked = worldToLatLng(centerWorld.x + offsetX, centerWorld.y + offsetY, zoom);
      if (!isWithinEcuador(picked.lat, picked.lng)) {
        setMapNotice('El punto debe estar dentro de Ecuador.');
        return;
      }
      const clamped = clampEcuadorLatLng(picked.lat, picked.lng);
      setMapNotice(null);
      onChange({ latitude: clamped.lat, longitude: clamped.lng });
      reverseGeocode(clamped.lat, clamped.lng);
    }
  };

  // La rueda hace zoom sin mover la página: el listener nativo no es pasivo (en React onWheel sí lo es).
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (event: globalThis.WheelEvent) => {
      if (disabled || Math.abs(event.deltaY) < 4) return;
      event.preventDefault();
      setZoom((prev) =>
        event.deltaY < 0 ? Math.min(MAP_MAX_ZOOM, prev + 1) : Math.max(MAP_MIN_ZOOM, prev - 1),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [disabled]);

  const stopBtn = (e: MouseEvent<HTMLButtonElement>) => e.stopPropagation();

  return (
    <div className="wl-map-picker">
      <div className="wl-map-picker__search">
        <TextInput
          id="map-search-ecuador"
          label="Buscar calle o lugar en Ecuador (opcional)"
          placeholder="Ej. Av. Amazonas, Quito o Parque Cevallos, Ambato"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void handleSearch()}
          isLoading={isSearching}
          disabled={disabled || searchQuery.trim().length < 3}
        >
          Buscar
        </Button>
      </div>

      <div className="route-map-toolbar">
        <div className="route-map-cities" role="group" aria-label="Ir a ciudad de Ecuador">
          {ECUADOR_CITIES.map((city) => (
            <button
              key={city.id}
              type="button"
              className="route-map-chip"
              disabled={disabled}
              onClick={() => {
                setCenter({ lat: city.lat, lng: city.lng });
                setZoom(city.zoom);
              }}
            >
              {city.name}
            </button>
          ))}
        </div>
        <div className="route-map-tools-right">
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

      {searchResults.length > 0 && (
        <ul className="wl-map-picker__results" aria-label="Resultados de mapa">
          {searchResults.map((hit, idx) => (
            <li key={`${hit.lat}-${hit.lon}-${idx}`}>
              <button
                type="button"
                className="wl-map-picker__result-btn"
                onClick={() => applySearchHit(hit)}
              >
                {hit.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        ref={viewportRef}
        className="wl-map-picker__viewport"
        style={height === undefined ? undefined : { height }}
        role="application"
        aria-label="Mapa de Ecuador para elegir punto de entrega. Haz clic para fijar el pin o arrastra para mover."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="wl-map-picker__tiles" aria-hidden="true">
          {tiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              draggable={false}
              className="wl-map-picker__tile"
              style={{
                transform: `translate3d(${Math.round(tile.left)}px, ${Math.round(tile.top)}px, 0)`,
              }}
              onError={(event) => {
                if (activeLayer === 'satellite') {
                  setFailedSatellite(true);
                  event.currentTarget.src = tile.fallbackUrl;
                }
              }}
            />
          ))}
        </div>

        {overlays?.map((zone) => {
          const circle = circleFor(zone.latitude, zone.longitude, zone.radiusKm);
          return (
            <div
              key={zone.id}
              className="wl-map-picker__circle wl-map-picker__circle--other"
              aria-hidden="true"
              title={zone.name}
              style={{
                width: circle.diameter,
                height: circle.diameter,
                transform: `translate3d(${Math.round(circle.dx - circle.diameter / 2)}px, ${Math.round(circle.dy - circle.diameter / 2)}px, 0)`,
              }}
            >
              <span className="wl-map-picker__circle-label">{zone.name}</span>
            </div>
          );
        })}

        {latitude !== null && longitude !== null && radiusKm !== null && radiusKm > 0 && (
          (() => {
            const circle = circleFor(latitude, longitude, radiusKm);
            return (
              <div
                className="wl-map-picker__circle"
                aria-hidden="true"
                data-testid="coverage-circle"
                style={{
                  width: circle.diameter,
                  height: circle.diameter,
                  transform: `translate3d(${Math.round(circle.dx - circle.diameter / 2)}px, ${Math.round(circle.dy - circle.diameter / 2)}px, 0)`,
                }}
              />
            );
          })()
        )}

        {pinOffset !== null && (
          <div
            className="wl-map-picker__pin"
            aria-hidden="true"
            style={{
              transform: `translate3d(${Math.round(pinOffset.dx)}px, ${Math.round(pinOffset.dy)}px, 0)`,
            }}
          >
            <span className="wl-map-picker__pin-dot" />
          </div>
        )}

        <div className="wl-map-picker__zoom">
          <button
            type="button"
            className="wl-map-picker__zoom-btn"
            aria-label="Acercar mapa"
            onClick={(e) => {
              stopBtn(e);
              setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1));
            }}
          >
            +
          </button>
          <button
            type="button"
            className="wl-map-picker__zoom-btn"
            aria-label="Alejar mapa"
            onClick={(e) => {
              stopBtn(e);
              setZoom((z) => Math.max(MAP_MIN_ZOOM, z - 1));
            }}
          >
            −
          </button>
        </div>

        <span className="wl-map-picker__attribution">
          {activeLayer === 'satellite' ? '© Esri World Imagery' : '© OpenStreetMap'}
        </span>
      </div>

      <div className="wl-map-picker__footer">
        <span className="wl-map-picker__coords">
          {latitude !== null && longitude !== null
            ? `Pin fijado: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${isReversing ? ' · leyendo dirección...' : ''}`
            : emptyHint}
        </span>

        {latitude !== null && longitude !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange({ latitude: null, longitude: null })}
          >
            Quitar pin
          </Button>
        )}
      </div>

      {mapNotice && <p className="wl-map-picker__notice">{mapNotice}</p>}
    </div>
  );
};

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type MouseEvent,
} from 'react';
import {
  Button,
  DEFAULT_ECUADOR_CENTER,
  MAP_TILE_SIZE,
  MapTileLayer,
  MapToolbar,
  TextInput,
  buildMapTiles,
  clampEcuadorLatLng,
  latLngToWorld,
  requestEcuadorGpsLocation,
  useEcuadorMapViewport,
  worldToLatLng,
} from '../../../../shared/ui/index.js';
import '../../../../shared/ui/Map/route-map.css';
import '../../../../shared/ui/Map/ecuador-map-picker.css';
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
 * Selector interactivo de coordenadas estilo Uber Pickup en Ecuador (cero dependencias).
 * - Capas [Uber | Calles | Satélite] con grading Uber Minimal sin API key
 * - Arrastre GPU 60-120fps con translate3d + física de elevación del pin al arrastrar
 * - Geolocalización GPS ("Mi ubicación") validada dentro de Ecuador
 * - Búsqueda en vivo (debounce 450ms) + botón Buscar + geocodificación inversa Nominatim
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<readonly NominatimHit[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);

  const lastNominatimRef = useRef(0);
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

  const commitPickedPoint = useCallback(
    (lat: number, lng: number) => {
      if (!isWithinEcuador(lat, lng)) {
        setMapNotice('Solo se permiten zonas y ubicaciones dentro del Ecuador.');
        return;
      }
      const clamped = clampEcuadorLatLng(lat, lng);
      setMapNotice(null);
      onChange({ latitude: clamped.lat, longitude: clamped.lng });
      reverseGeocode(clamped.lat, clamped.lng);
    },
    [onChange, reverseGeocode],
  );

  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({
    w: 760,
    h: height ?? 360,
  });

  const map = useEcuadorMapViewport({
    initialCenter:
      latitude !== null && longitude !== null && isWithinEcuador(latitude, longitude)
        ? { lat: latitude, lng: longitude }
        : DEFAULT_ECUADOR_CENTER,
    initialZoom: 13,
    disabled,
    ignorePointerSelector: 'button',
    onTap: (clientX, clientY) => {
      if (!map.viewportRef.current || disabled) return;
      const rect = map.viewportRef.current.getBoundingClientRect();
      const offsetX = clientX - rect.left - rect.width / 2;
      const offsetY = clientY - rect.top - rect.height / 2;
      const picked = worldToLatLng(map.centerWorld.x + offsetX, map.centerWorld.y + offsetY, map.zoom);
      commitPickedPoint(picked.lat, picked.lng);
    },
    onActivateKey: (clamped) => commitPickedPoint(clamped.lat, clamped.lng),
  });
  const { setCenter, setZoom, viewportRef } = map;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 20 && rect.height > 20) {
        setViewportSize({ w: rect.width, h: rect.height });
      }
    };
    sync();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, viewportRef]);

  useEffect(() => {
    if (latitude !== null && longitude !== null && isWithinEcuador(latitude, longitude)) {
      setCenter({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude, setCenter]);

  const runSearch = useCallback(
    async (queryText: string, silentThrottle = false) => {
      const q = queryText.trim();
      if (q.length < 3) return;
      const now = Date.now();
      if (now - lastNominatimRef.current < 1050) {
        if (!silentThrottle) {
          setMapNotice('Espera un segundo antes de buscar de nuevo.');
        }
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
    },
    [],
  );

  // Búsqueda automática con debounce de 450ms para >= 4 caracteres
  useEffect(() => {
    const q = searchQuery.trim();
    if (disabled || q.length < 4) {
      if (q.length === 0) setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void runSearch(q, true);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [disabled, runSearch, searchQuery]);

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

  const handleLocateMe = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled) return;
    setMapNotice(null);
    requestEcuadorGpsLocation({
      outOfBoundsMessage: 'Tu ubicación GPS actual queda fuera de Ecuador.',
      failedMessage: 'No se pudo obtener tu ubicación GPS. Fija el pin manualmente.',
      onError: setMapNotice,
      onLocated: (clamped) => {
        setCenter(clamped);
        setZoom(16);
        onChange({ latitude: clamped.lat, longitude: clamped.lng });
        reverseGeocode(clamped.lat, clamped.lng);
      },
    });
  };

  const tiles = useMemo(() => {
    const spanX = Math.max(2, Math.ceil(viewportSize.w / (2 * MAP_TILE_SIZE)) + 1);
    const spanY = Math.max(2, Math.ceil(viewportSize.h / (2 * MAP_TILE_SIZE)) + 1);
    return buildMapTiles(map.centerWorld, map.zoom, map.activeLayer, spanX, spanY);
  }, [map.activeLayer, map.centerWorld, map.zoom, viewportSize.h, viewportSize.w]);

  const pinOffset = useMemo(() => {
    if (latitude === null || longitude === null) return null;
    const pinWorld = latLngToWorld(latitude, longitude, map.zoom);
    return {
      dx: pinWorld.x - map.centerWorld.x,
      dy: pinWorld.y - map.centerWorld.y,
    };
  }, [latitude, longitude, map.centerWorld.x, map.centerWorld.y, map.zoom]);

  const circleFor = (lat: number, lng: number, km: number) => {
    const world = latLngToWorld(lat, lng, map.zoom);
    const diameter = (2 * km * 1000) / metersPerPixel(lat, map.zoom);
    return {
      dx: world.x - map.centerWorld.x,
      dy: world.y - map.centerWorld.y,
      diameter: Math.max(2, diameter),
    };
  };

  const stopBtn = (e: MouseEvent<HTMLButtonElement>) => e.stopPropagation();

  return (
    <div className="wl-map-picker" data-map-layer={map.activeLayer}>
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
          onClick={() => void runSearch(searchQuery, false)}
          isLoading={isSearching}
          disabled={disabled || searchQuery.trim().length < 3}
        >
          Buscar
        </Button>
      </div>

      <MapToolbar
        activeLayer={map.activeLayer}
        onSelectLayer={map.selectLayer}
        disabled={disabled}
        citiesAriaLabel="Ir a ciudad de Ecuador"
        onSelectCity={(city) => {
          setCenter({ lat: city.lat, lng: city.lng });
          setZoom(city.zoom);
        }}
      />

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
        ref={map.viewportRef}
        className={'wl-map-picker__viewport' + (map.isDragging ? ' wl-map-picker__viewport--dragging' : '')}
        style={height === undefined ? undefined : { height }}
        role="region"
        aria-label="Mapa de Ecuador para elegir punto de entrega"
        {...map.viewportHandlers}
      >
        <span className="wl-map-picker__bounds-badge" aria-hidden="true">
          Solo territorio de Ecuador
        </span>
        <button
          type="button"
          className="wl-map-picker__kbd"
          disabled={disabled}
          aria-label="Mover el mapa o fijar pin con el teclado: flechas para desplazar, Enter para fijar el pin, más y menos para acercar o alejar"
        />
        <div ref={map.panStageRef} className="wl-map-picker__stage">
          <MapTileLayer
            tiles={tiles}
            activeLayer={map.activeLayer}
            containerClass="wl-map-picker__tiles"
            uberClass="wl-map-picker__tiles--uber"
            tileClass="wl-map-picker__tile"
            loadedTileClass="wl-map-picker__tile--loaded"
            positioning="transform"
            onSatelliteError={() => map.setFailedSatellite(true)}
          />

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
              className={'wl-map-picker__pin' + (map.isDragging ? ' wl-map-picker__pin--lifted' : '')}
              aria-hidden="true"
              style={{
                transform: `translate3d(${Math.round(pinOffset.dx)}px, ${Math.round(pinOffset.dy)}px, 0)`,
              }}
            >
              <span className="wl-map-picker__pin-head">
                <span className="wl-map-picker__pin-core" />
              </span>
              <span className="wl-map-picker__pin-stem" />
              <span className="wl-map-picker__pin-shadow" />
            </div>
          )}
        </div>

        <div className="wl-map-picker__zoom">
          <button
            type="button"
            className="wl-map-picker__zoom-btn"
            aria-label="Acercar mapa"
            onClick={(e) => {
              stopBtn(e);
              map.zoomIn();
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
              map.zoomOut();
            }}
          >
            −
          </button>
          <button
            type="button"
            className="wl-map-picker__zoom-btn"
            aria-label="Usar mi ubicación GPS"
            title="Usar mi ubicación GPS"
            onClick={handleLocateMe}
          >
            <svg viewBox="0 0 18 18" width="14" height="14" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
              <path
                d="M9 2.2v2.2M9 13.6v2.2M2.2 9h2.2M13.6 9h2.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <span className="wl-map-picker__attribution">
          {map.activeLayer === 'satellite' ? '© Esri World Imagery' : '© OpenStreetMap'}
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

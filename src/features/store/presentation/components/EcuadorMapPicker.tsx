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
import { Button, TextInput } from '../../../../shared/ui/index.js';
import {
  ECUADOR_BOUNDS,
  isWithinEcuador,
  sanitizeBackendText,
} from '../../domain/storeTypes.js';

export interface EcuadorMapPickerProps {
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly onChange: (coords: { readonly latitude: number | null; readonly longitude: number | null }) => void;
  readonly onAddressSuggested?: ((address: string) => void) | undefined;
  readonly disabled?: boolean | undefined;
}

const DEFAULT_CENTER = { lat: -0.1807, lng: -78.4678 }; // Quito, Ecuador
const TILE_SIZE = 256;
const MIN_ZOOM = 6;
const MAX_ZOOM = 17;

function latLngToWorld(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const clamped = Math.min(Math.max(sinLat, -0.9999), 0.9999);
  const y = (0.5 - Math.log((1 + clamped) / (1 - clamped)) / (4 * Math.PI)) * scale;
  return { x, y };
}

function worldToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const scale = TILE_SIZE * Math.pow(2, zoom);
  const lng = (x / scale) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / scale;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

function clampEcuador(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.min(ECUADOR_BOUNDS.maxLat, Math.max(ECUADOR_BOUNDS.minLat, Number(lat.toFixed(6)))),
    lng: Math.min(ECUADOR_BOUNDS.maxLng, Math.max(ECUADOR_BOUNDS.minLng, Number(lng.toFixed(6)))),
  };
}

interface NominatimHit {
  readonly display_name: string;
  readonly lat: string;
  readonly lon: string;
}

/**
 * Selector interactivo de coordenadas en mapa OpenStreetMap (Ecuador, cero dependencias).
 * Soporta clic para fijar pin, arrastre para desplazar, zoom, búsqueda con Nominatim
 * (debounce >= 600ms) y geocodificación inversa limpiada a la lista blanca del backend.
 */
export const EcuadorMapPicker: FC<EcuadorMapPickerProps> = ({
  latitude,
  longitude,
  onChange,
  onAddressSuggested,
  disabled = false,
}) => {
  const [center, setCenter] = useState<{ lat: number; lng: number }>(() =>
    latitude !== null && longitude !== null && isWithinEcuador(latitude, longitude)
      ? { lat: latitude, lng: longitude }
      : DEFAULT_CENTER,
  );
  const [zoom, setZoom] = useState(13);
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

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      if (!onAddressSuggested) return;
      const now = Date.now();
      if (now - lastNominatimRef.current < 1050) return;
      lastNominatimRef.current = now;
      setIsReversing(true);
      setMapNotice(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { display_name?: string };
        if (typeof data.display_name === 'string') {
          const clean = sanitizeBackendText(data.display_name, 160);
          if (clean.length >= 6) {
            onAddressSuggested(clean);
          }
        }
      } catch {
        setMapNotice('Pin guardado. Puedes escribir o ajustar la dirección manualmente.');
      } finally {
        setIsReversing(false);
      }
    },
    [onAddressSuggested],
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
    const clamped = clampEcuador(lat, lng);
    setCenter(clamped);
    setZoom(15);
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

  const tiles = useMemo(() => {
    const maxIndex = Math.pow(2, zoom);
    const centerTileX = Math.floor(centerWorld.x / TILE_SIZE);
    const centerTileY = Math.floor(centerWorld.y / TILE_SIZE);
    const result: { key: string; url: string; left: number; top: number }[] = [];

    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        const tx = centerTileX + dx;
        const ty = centerTileY + dy;
        if (ty < 0 || ty >= maxIndex) continue;
        const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
        const pixelLeft = tx * TILE_SIZE - centerWorld.x;
        const pixelTop = ty * TILE_SIZE - centerWorld.y;
        result.push({
          key: `${zoom}-${wrappedX}-${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left: pixelLeft,
          top: pixelTop,
        });
      }
    }
    return result;
  }, [centerWorld.x, centerWorld.y, zoom]);

  const pinOffset = useMemo(() => {
    if (latitude === null || longitude === null) return null;
    const pinWorld = latLngToWorld(latitude, longitude, zoom);
    return {
      dx: pinWorld.x - centerWorld.x,
      dy: pinWorld.y - centerWorld.y,
    };
  }, [centerWorld.x, centerWorld.y, latitude, longitude, zoom]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
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
    setCenter(clampEcuador(next.lat, next.lng));
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
      const clamped = clampEcuador(picked.lat, picked.lng);
      setMapNotice(null);
      onChange({ latitude: clamped.lat, longitude: clamped.lng });
      void reverseGeocode(clamped.lat, clamped.lng);
    }
  };

  const stopBtn = (e: MouseEvent<HTMLButtonElement>) => e.stopPropagation();

  return (
    <div className="wl-map-picker">
      <div className="wl-map-picker__search">
        <TextInput
          id="map-search-ecuador"
          label="Buscar lugar en Ecuador (opcional)"
          placeholder="Ej. Parque La Carolina, Quito"
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
        role="application"
        aria-label="Mapa de Ecuador para elegir punto de entrega. Haz clic para fijar el pin o arrastra para mover."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
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
            />
          ))}
        </div>

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
              setZoom((z) => Math.min(MAX_ZOOM, z + 1));
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
              setZoom((z) => Math.max(MIN_ZOOM, z - 1));
            }}
          >
            −
          </button>
        </div>

        <span className="wl-map-picker__attribution">© OpenStreetMap</span>
      </div>

      <div className="wl-map-picker__footer">
        <span className="wl-map-picker__coords">
          {latitude !== null && longitude !== null
            ? `Pin fijado: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}${isReversing ? ' · leyendo dirección...' : ''}`
            : 'Sin pin en el mapa (modo dirección manual). Haz clic en el mapa para marcar el destino.'}
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

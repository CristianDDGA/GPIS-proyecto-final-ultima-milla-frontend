import { useMemo, type FC, type ReactNode } from 'react';
import { CONTINENTAL_ECUADOR_POLYGON, GALAPAGOS_POLYGON } from '../../geo.js';
import {
  ECUADOR_CITIES,
  clipPolygonToRect,
  latLngToWorld,
  type ClipRect,
  type EcuadorCityPreset,
} from './ecuadorMapMath.js';
import type { MapTileItem } from './useEcuadorMapViewport.js';

export interface MapTileLayerProps {
  readonly tiles: readonly MapTileItem[];
  readonly containerClass: string;
  readonly uberClass: string;
  readonly tileClass: string;
  readonly loadedTileClass: string;
  readonly positioning: 'offset' | 'transform';
}

export const MapTileLayer: FC<MapTileLayerProps> = ({
  tiles,
  containerClass,
  uberClass,
  tileClass,
  loadedTileClass,
  positioning,
}) => (
  <div className={`${containerClass} ${uberClass}`} aria-hidden="true">
    {tiles.map((tile) => (
      <img
        key={tile.key}
        ref={(img) => {
          if (img && img.complete && img.naturalWidth > 0) {
            img.classList.add(loadedTileClass);
          }
        }}
        src={tile.url}
        alt=""
        draggable={false}
        decoding="async"
        className={tileClass}
        style={
          positioning === 'transform'
            ? { transform: `translate3d(${Math.round(tile.left)}px, ${Math.round(tile.top)}px, 0)` }
            : { left: `${Math.round(tile.left)}px`, top: `${Math.round(tile.top)}px` }
        }
        onLoad={(event) => {
          event.currentTarget.classList.add(loadedTileClass);
        }}
        onError={(event) => {
          event.currentTarget.classList.add(loadedTileClass);
        }}
      />
    ))}
  </div>
);

export interface EcuadorTerritoryMaskProps {
  readonly centerWorld: { readonly x: number; readonly y: number };
  readonly zoom: number;
  readonly offsetX?: number | undefined;
  readonly offsetY?: number | undefined;
  readonly className?: string | undefined;
}

function projectClippedPolygonPath(
  polygon: readonly (readonly [number, number])[],
  centerWorld: { readonly x: number; readonly y: number },
  zoom: number,
  offsetX: number,
  offsetY: number,
  clipRect: ClipRect,
): string {
  const projected = polygon.map(([lat, lng]) => {
    const w = latLngToWorld(lat, lng, zoom);
    return {
      x: offsetX + (w.x - centerWorld.x),
      y: offsetY + (w.y - centerWorld.y),
    };
  });
  const clipped = clipPolygonToRect(projected, clipRect);
  if (clipped.length < 3) return '';
  return (
    clipped
      .map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ') + ' Z'
  );
}

/**
 * Capa SVG liviana que sombrea con un tono distinto todo territorio fuera de Ecuador
 * (Colombia, Perú y océano) y delinea sutilmente la frontera, desplazándose junto al
 * escenario GPU sin costo de CPU durante el arrastre.
 */
export const EcuadorTerritoryMask: FC<EcuadorTerritoryMaskProps> = ({
  centerWorld,
  zoom,
  offsetX = 0,
  offsetY = 0,
  className = 'route-map-territory-mask',
}) => {
  const { maskPath, borderPath } = useMemo(() => {
    const clipMargin = 1600;
    const clipRect: ClipRect = {
      minX: offsetX - clipMargin,
      maxX: offsetX + clipMargin,
      minY: offsetY - clipMargin,
      maxY: offsetY + clipMargin,
    };
    const outerMargin = clipMargin + 200;
    const worldFrame = `M ${offsetX - outerMargin} ${offsetY - outerMargin} H ${offsetX + outerMargin} V ${offsetY + outerMargin} H ${offsetX - outerMargin} Z`;

    const continental = projectClippedPolygonPath(
      CONTINENTAL_ECUADOR_POLYGON,
      centerWorld,
      zoom,
      offsetX,
      offsetY,
      clipRect,
    );
    const galapagos = projectClippedPolygonPath(
      GALAPAGOS_POLYGON,
      centerWorld,
      zoom,
      offsetX,
      offsetY,
      clipRect,
    );
    const holes = [continental, galapagos].filter(Boolean).join(' ');
    return {
      maskPath: holes.length > 0 ? `${worldFrame} ${holes}` : worldFrame,
      borderPath: holes,
    };
  }, [centerWorld, offsetX, offsetY, zoom]);

  return (
    <svg className={className} aria-hidden="true" overflow="visible">
      <path d={maskPath} fill="rgba(180, 62, 74, 0.24)" fillRule="evenodd" />
      {borderPath.length > 0 && (
        <path
          d={borderPath}
          fill="none"
          stroke="#be123c"
          strokeOpacity="0.58"
          strokeWidth="2"
          strokeDasharray="6 4"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
};

export interface MapToolbarProps {
  readonly onSelectCity: (city: EcuadorCityPreset) => void;
  readonly activeCityId?: string | null | undefined;
  readonly disabled?: boolean | undefined;
  readonly citiesAriaLabel?: string | undefined;
  readonly rightGroupAriaLabel?: string | undefined;
  readonly leadingRightAction?: ReactNode | undefined;
}

export const MapToolbar: FC<MapToolbarProps> = ({
  onSelectCity,
  activeCityId = null,
  disabled = false,
  citiesAriaLabel = 'Centrar en ciudad',
  rightGroupAriaLabel = 'Encuadre del mapa',
  leadingRightAction,
}) => (
  <div className="route-map-toolbar">
    <div className="route-map-cities" role="group" aria-label={citiesAriaLabel}>
      {ECUADOR_CITIES.map((city) => (
        <button
          key={city.id}
          type="button"
          className={'route-map-chip' + (activeCityId === city.id ? ' route-map-chip--active' : '')}
          disabled={disabled}
          onClick={() => onSelectCity(city)}
        >
          {city.name}
        </button>
      ))}
    </div>

    {leadingRightAction && (
      <div className="route-map-tools-right" role="group" aria-label={rightGroupAriaLabel}>
        {leadingRightAction}
      </div>
    )}
  </div>
);

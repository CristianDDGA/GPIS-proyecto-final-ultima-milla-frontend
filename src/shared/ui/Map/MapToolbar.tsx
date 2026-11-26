import type { FC, ReactNode } from 'react';
import { ECUADOR_CITIES, type EcuadorCityPreset, type MapLayerStyle } from './ecuadorMapMath.js';
import type { MapTileItem } from './useEcuadorMapViewport.js';

const LAYER_OPTIONS: readonly { readonly id: MapLayerStyle; readonly label: string }[] = [
  { id: 'uber', label: 'Uber' },
  { id: 'osm', label: 'Calles' },
  { id: 'satellite', label: 'Satélite' },
];

export interface MapTileLayerProps {
  readonly tiles: readonly MapTileItem[];
  readonly activeLayer: MapLayerStyle;
  readonly containerClass: string;
  readonly uberClass: string;
  readonly tileClass: string;
  readonly loadedTileClass: string;
  readonly positioning: 'offset' | 'transform';
  readonly onSatelliteError: () => void;
}

export const MapTileLayer: FC<MapTileLayerProps> = ({
  tiles,
  activeLayer,
  containerClass,
  uberClass,
  tileClass,
  loadedTileClass,
  positioning,
  onSatelliteError,
}) => (
  <div
    className={activeLayer === 'uber' ? `${containerClass} ${uberClass}` : containerClass}
    aria-hidden="true"
  >
    {tiles.map((tile) => (
      <img
        key={tile.key}
        src={tile.url}
        alt=""
        draggable={false}
        className={tileClass}
        style={
          positioning === 'transform'
            ? { transform: `translate3d(${Math.round(tile.left)}px, ${Math.round(tile.top)}px, 0)` }
            : { left: `${tile.left}px`, top: `${tile.top}px` }
        }
        onLoad={(event) => {
          event.currentTarget.classList.add(loadedTileClass);
        }}
        onError={(event) => {
          if (activeLayer === 'satellite') {
            onSatelliteError();
            event.currentTarget.src = tile.fallbackUrl;
          } else {
            event.currentTarget.classList.add(loadedTileClass);
          }
        }}
      />
    ))}
  </div>
);

export interface MapToolbarProps {
  readonly activeLayer: MapLayerStyle;
  readonly onSelectLayer: (layer: MapLayerStyle) => void;
  readonly onSelectCity: (city: EcuadorCityPreset) => void;
  readonly activeCityId?: string | null | undefined;
  readonly disabled?: boolean | undefined;
  readonly citiesAriaLabel?: string | undefined;
  readonly rightGroupAriaLabel?: string | undefined;
  readonly leadingRightAction?: ReactNode | undefined;
}

export const MapToolbar: FC<MapToolbarProps> = ({
  activeLayer,
  onSelectLayer,
  onSelectCity,
  activeCityId = null,
  disabled = false,
  citiesAriaLabel = 'Centrar en ciudad de Ecuador',
  rightGroupAriaLabel = 'Estilo y encuadre del mapa',
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

    <div className="route-map-tools-right" role="group" aria-label={rightGroupAriaLabel}>
      {leadingRightAction}
      {LAYER_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          className={'route-map-chip' + (activeLayer === option.id ? ' route-map-chip--active' : '')}
          onClick={() => onSelectLayer(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

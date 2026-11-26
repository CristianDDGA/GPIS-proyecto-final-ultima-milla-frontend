import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { isWithinEcuador } from '../../../features/store/domain/storeTypes.js';
import {
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  MAP_TILE_SIZE,
  clampEcuadorLatLng,
  latLngToWorld,
  tileUrlFor,
  worldToLatLng,
  type LatLng,
} from './ecuadorMapMath.js';

const WHEEL_ZOOM_THROTTLE_MS = 110;

export interface MapTileItem {
  readonly key: string;
  readonly url: string;
  readonly left: number;
  readonly top: number;
}

export interface UseEcuadorMapViewportOptions {
  readonly initialCenter: LatLng;
  readonly initialZoom: number;
  readonly disabled?: boolean | undefined;
  readonly ignorePointerSelector?: string | undefined;
  readonly onTap?: ((clientX: number, clientY: number) => void) | undefined;
  readonly onActivateKey?: ((center: LatLng) => void) | undefined;
}

export function buildMapTiles(
  centerWorld: { readonly x: number; readonly y: number },
  zoom: number,
  spanX: number,
  spanY: number,
  offsetX = 0,
  offsetY = 0,
): readonly MapTileItem[] {
  const maxIndex = Math.pow(2, zoom);
  const centerTileX = Math.floor(centerWorld.x / MAP_TILE_SIZE);
  const centerTileY = Math.floor(centerWorld.y / MAP_TILE_SIZE);
  const result: MapTileItem[] = [];

  for (let dx = -spanX; dx <= spanX; dx += 1) {
    for (let dy = -spanY; dy <= spanY; dy += 1) {
      const tx = centerTileX + dx;
      const ty = centerTileY + dy;
      if (ty < 0 || ty >= maxIndex) continue;
      const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
      result.push({
        key: `osm-${zoom}-${wrappedX}-${ty}`,
        url: tileUrlFor('uber', zoom, wrappedX, ty),
        left: offsetX + (tx * MAP_TILE_SIZE - centerWorld.x),
        top: offsetY + (ty * MAP_TILE_SIZE - centerWorld.y),
      });
    }
  }
  return result;
}

export function requestEcuadorGpsLocation(callbacks: {
  readonly onLocated: (coords: LatLng) => void;
  readonly onError: (message: string) => void;
  readonly outOfBoundsMessage: string;
  readonly failedMessage: string;
}): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    callbacks.onError('Tu navegador no soporta geolocalización.');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      if (!isWithinEcuador(lat, lng)) {
        callbacks.onError(callbacks.outOfBoundsMessage);
        return;
      }
      callbacks.onLocated(clampEcuadorLatLng(lat, lng));
    },
    () => callbacks.onError(callbacks.failedMessage),
    { enableHighAccuracy: true, timeout: 6000 },
  );
}

/**
 * Motor compartido de viewport para mapas interactivos en Ecuador:
 * arrastre 100% GPU con translate3d sin re-renders intermedios y confirmación atómica al soltar.
 */
export function useEcuadorMapViewport({
  initialCenter,
  initialZoom,
  disabled = false,
  ignorePointerSelector = 'button, a',
  onTap,
  onActivateKey,
}: UseEcuadorMapViewportOptions) {
  const [center, setCenter] = useState<LatLng>(initialCenter);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [isDragging, setIsDragging] = useState(false);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panStageRef = useRef<HTMLDivElement | null>(null);
  const lastWheelRef = useRef(0);
  const dragRef = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startWorldX: 0,
    startWorldY: 0,
    dx: 0,
    dy: 0,
    rafId: 0,
  });

  const centerWorld = useMemo(
    () => latLngToWorld(center.lat, center.lng, zoom),
    [center.lat, center.lng, zoom],
  );

  const resetStageTransform = useCallback(() => {
    if (panStageRef.current) {
      panStageRef.current.style.transform = 'translate3d(0px, 0px, 0px)';
    }
  }, []);

  // Restablece la traslación GPU en el mismo paint en que React actualiza las coordenadas de las teselas.
  useLayoutEffect(() => {
    resetStageTransform();
  }, [centerWorld.x, centerWorld.y, zoom, resetStageTransform]);

  useEffect(() => {
    const drag = dragRef.current;
    return () => {
      if (drag.rafId) cancelAnimationFrame(drag.rafId);
    };
  }, []);

  // La rueda hace zoom sin mover la página y con throttle suave para evitar saltos en trackpad.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return undefined;
    const onWheel = (event: globalThis.WheelEvent) => {
      if (disabled || Math.abs(event.deltaY) < 4) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheelRef.current < WHEEL_ZOOM_THROTTLE_MS) return;
      lastWheelRef.current = now;
      setZoom((prev) =>
        event.deltaY < 0 ? Math.min(MAP_MAX_ZOOM, prev + 1) : Math.max(MAP_MIN_ZOOM, prev - 1),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [disabled]);

  const zoomIn = useCallback(() => setZoom((z) => Math.min(MAP_MAX_ZOOM, z + 1)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(MAP_MIN_ZOOM, z - 1)), []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(ignorePointerSelector)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragRef.current = {
      active: true,
      moved: false,
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
    if (!d.active || disabled) return;
    const dx = event.clientX - d.startX;
    const dy = event.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    d.dx = dx;
    d.dy = dy;

    if (!d.rafId) {
      d.rafId = requestAnimationFrame(() => {
        d.rafId = 0;
        if (panStageRef.current && d.active) {
          panStageRef.current.style.transform = `translate3d(${d.dx}px, ${d.dy}px, 0px)`;
        }
      });
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active) return;
    const wasDrag = d.moved;
    const finalDx = d.dx;
    const finalDy = d.dy;
    d.active = false;
    d.dx = 0;
    d.dy = 0;
    setIsDragging(false);
    if (d.rafId) {
      cancelAnimationFrame(d.rafId);
      d.rafId = 0;
    }

    if (wasDrag || !onTap) {
      if (Math.abs(finalDx) > 1 || Math.abs(finalDy) > 1) {
        const next = worldToLatLng(d.startWorldX - finalDx, d.startWorldY - finalDy, zoom);
        const clamped = clampEcuadorLatLng(next.lat, next.lng);
        if (clamped.lat === center.lat && clamped.lng === center.lng) {
          resetStageTransform();
        } else {
          setCenter(clamped);
        }
      } else {
        resetStageTransform();
      }
      return;
    }

    resetStageTransform();
    onTap(event.clientX, event.clientY);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const stepPx = 64;
    const panDeltas: Record<string, readonly [number, number]> = {
      ArrowUp: [0, -stepPx],
      ArrowDown: [0, stepPx],
      ArrowLeft: [-stepPx, 0],
      ArrowRight: [stepPx, 0],
    };

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomOut();
    } else if (event.key in panDeltas) {
      event.preventDefault();
      const [dx, dy] = panDeltas[event.key]!;
      const next = worldToLatLng(centerWorld.x + dx, centerWorld.y + dy, zoom);
      setCenter(clampEcuadorLatLng(next.lat, next.lng));
    } else if ((event.key === 'Enter' || event.key === ' ') && onActivateKey) {
      event.preventDefault();
      onActivateKey(clampEcuadorLatLng(center.lat, center.lng));
    }
  };

  return {
    center,
    setCenter,
    zoom,
    setZoom,
    isDragging,
    centerWorld,
    viewportRef,
    panStageRef,
    zoomIn,
    zoomOut,
    viewportHandlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
      onKeyDown: handleKeyDown,
    },
  };
}

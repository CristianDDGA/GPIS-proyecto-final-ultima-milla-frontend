import type { FC } from 'react';
import { isoBox } from './iso.js';
import './IsometricCapacityCube.css';

export interface IsometricCapacityCubeProps {
  readonly occupied: number;
  readonly capacity: number;
  /** Estado de la ruta o del pedido; define la paleta de las ranuras. */
  readonly status?: string | undefined;
  /** Oculta el pie "x/y cupos" cuando el contador ya está en la tabla. */
  readonly showCaption?: boolean | undefined;
  readonly className?: string | undefined;
}

const MAX_VISUAL_SLOTS = 6;
const SLOT_SIZE = 0.55;
const SLOT_GAP = 0.62;
const COLUMNS = 3;

interface SlotGeometry {
  readonly index: number;
  readonly filled: boolean;
  readonly top: string;
  readonly left: string;
  readonly right: string;
}

function buildSlots(slotCount: number, occupied: number): SlotGeometry[] {
  const slots: SlotGeometry[] = [];

  for (let index = 0; index < slotCount; index += 1) {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const filled = index < occupied;
    const box = isoBox(
      column * SLOT_GAP,
      row * SLOT_GAP,
      SLOT_SIZE,
      SLOT_SIZE,
      filled ? 0.46 : 0.05,
      0,
      0,
    );

    slots.push({ index, filled, top: box.top, left: box.left, right: box.right });
  }

  return slots;
}

/**
 * Cubo isométrico de ocupación de carga: dibuja las ranuras de la ruta en
 * perspectiva 2.5D y colorea cada ranura ocupada según el estado real.
 */
export const IsometricCapacityCube: FC<IsometricCapacityCubeProps> = ({
  occupied,
  capacity,
  status,
  showCaption = true,
  className = '',
}) => {
  const safeCapacity = Math.max(0, Math.floor(capacity));
  const safeOccupied = Math.min(Math.max(0, Math.floor(occupied)), safeCapacity);
  const slots = buildSlots(Math.min(safeCapacity, MAX_VISUAL_SLOTS), safeOccupied);
  const pad = isoBox(-0.2, -0.2, 2.05, 2.05, 0.16, 0, 0);

  return (
    <div
      className={`iso-cube ${status !== undefined ? `iso-cube--${status}` : ''} ${className}`.trim()}
      role="img"
      aria-label={`Ocupación de carga: ${safeOccupied} de ${safeCapacity} cupos`}
    >
      <svg className="iso-cube__svg" viewBox="0 0 132 112" aria-hidden="true">
        <g transform="translate(66 30) scale(30)">
          <polygon className="iso-cube__face iso-cube__face--left iso-cube__pad" points={pad.left} />
          <polygon className="iso-cube__face iso-cube__face--right iso-cube__pad" points={pad.right} />
          <polygon className="iso-cube__face iso-cube__face--top iso-cube__pad" points={pad.top} />

          {slots.map((slot) => (
            <g key={slot.index} className={slot.filled ? 'iso-cube__slot iso-cube__slot--filled' : 'iso-cube__slot'}>
              <polygon className="iso-cube__face iso-cube__face--left" points={slot.left} />
              <polygon className="iso-cube__face iso-cube__face--right" points={slot.right} />
              <polygon className="iso-cube__face iso-cube__face--top" points={slot.top} />
            </g>
          ))}
        </g>
      </svg>

      {showCaption && (
        <p className="iso-cube__caption">
          <span className="iso-cube__count">
            {safeOccupied}
            <span className="iso-cube__separator">/</span>
            {safeCapacity}
          </span>
          <span className="iso-cube__unit">cupos</span>
        </p>
      )}
    </div>
  );
};

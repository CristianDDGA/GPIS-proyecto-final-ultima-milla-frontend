import type { FC } from 'react';
import { isoBox } from '../../../../shared/ui/Isometric/iso.js';

export interface IsometricFloatingCubeProps {
  readonly tone?: 'sapphire' | 'cyan' | 'steel' | undefined;
  readonly className?: string | undefined;
  /** Tamaño relativo del prisma decorativo. */
  readonly size?: 'sm' | 'md' | 'lg' | undefined;
}

const CUBE = isoBox(0, 0, 1, 1, 1, 0, 0);
const ORIGIN_X = 28;
const ORIGIN_Y = 34;
const SCALE = 16;

/**
 * Prisma isométrico satélite de vidrio sólido translúcido (sin gradientes).
 * Se usa como isla decorativa alrededor del hub o como acento de la tarjeta.
 */
export const IsometricFloatingCube: FC<IsometricFloatingCubeProps> = ({
  tone = 'sapphire',
  className = '',
  size = 'md',
}) => (
  <span
    className={'iso-float-cube iso-float-cube--' + tone + ' iso-float-cube--' + size + ' ' + className}
    aria-hidden="true"
  >
    <svg viewBox="0 0 56 52" role="presentation" focusable="false">
      <g transform={'translate(' + ORIGIN_X + ' ' + ORIGIN_Y + ') scale(' + SCALE + ')'}>
        <polygon className="iso-float-cube__face iso-float-cube__face--left" points={CUBE.left} />
        <polygon className="iso-float-cube__face iso-float-cube__face--right" points={CUBE.right} />
        <polygon className="iso-float-cube__face iso-float-cube__face--top" points={CUBE.top} />
      </g>
    </svg>
  </span>
);

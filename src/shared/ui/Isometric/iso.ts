/**
 * Proyección isométrica 2.5D reutilizable por las ilustraciones de logística.
 * El ángulo es el estándar de 30°: x crece hacia la derecha-abajo e y hacia la
 * izquierda-abajo, mientras z se proyecta en vertical.
 */

const COS_30 = Math.sqrt(3) / 2;
const SIN_30 = 0.5;

export type IsoPoint = readonly [number, number];

export interface IsoBox {
  readonly top: string;
  readonly left: string;
  readonly right: string;
}

export function projectIso(x: number, y: number, z: number, originX: number, originY: number): IsoPoint {
  return [originX + (x - y) * COS_30, originY + (x + y) * SIN_30 - z];
}

function toPoints(points: readonly IsoPoint[]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/**
 * Devuelve las tres caras visibles de una caja con base (x, y) de tamaño
 * (width, depth) y altura height.
 */
export function isoBox(
  x: number,
  y: number,
  width: number,
  depth: number,
  height: number,
  originX: number,
  originY: number,
): IsoBox {
  const p = (px: number, py: number, pz: number): IsoPoint =>
    projectIso(px, py, pz, originX, originY);

  const top = toPoints([
    p(x, y, height),
    p(x + width, y, height),
    p(x + width, y + depth, height),
    p(x, y + depth, height),
  ]);

  const left = toPoints([
    p(x, y + depth, height),
    p(x + width, y + depth, height),
    p(x + width, y + depth, 0),
    p(x, y + depth, 0),
  ]);

  const right = toPoints([
    p(x + width, y, height),
    p(x + width, y + depth, height),
    p(x + width, y + depth, 0),
    p(x + width, y, 0),
  ]);

  return { top, left, right };
}

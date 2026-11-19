import type { FC } from 'react';
import { isoBox, projectIso } from '../../../../../shared/ui/Isometric/iso.js';

interface IsoNodeSpec {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly height: number;
  readonly delayMs: number;
  readonly tone: 'origin' | 'stop' | 'hub' | 'target';
}

const PLATFORM_SIZE = 3.2;
const ORIGIN_X = 160;
const ORIGIN_Y = 58;
const SCALE = 44;

const ISO_NODES: readonly IsoNodeSpec[] = [
  { id: 'origin', x: 0.35, y: 2.3, size: 0.48, height: 0.48, delayMs: 60, tone: 'origin' },
  { id: 'stop-a', x: 0.72, y: 1.32, size: 0.44, height: 0.34, delayMs: 130, tone: 'stop' },
  { id: 'hub', x: 1.62, y: 1.65, size: 0.52, height: 0.62, delayMs: 200, tone: 'hub' },
  { id: 'target', x: 2.35, y: 0.45, size: 0.52, height: 0.84, delayMs: 270, tone: 'target' },
];

function buildGridLines(): readonly string[] {
  const lines: string[] = [];
  const step = 0.8;

  for (let i = 1; i < 4; i += 1) {
    const pos = i * step;
    const [x1, y1] = projectIso(pos, 0, 0.12, 0, 0);
    const [x2, y2] = projectIso(pos, PLATFORM_SIZE, 0.12, 0, 0);
    lines.push(`M${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)}`);

    const [yX1, yY1] = projectIso(0, pos, 0.12, 0, 0);
    const [yX2, yY2] = projectIso(PLATFORM_SIZE, pos, 0.12, 0, 0);
    lines.push(`M${yX1.toFixed(2)} ${yY1.toFixed(2)} L${yX2.toFixed(2)} ${yY2.toFixed(2)}`);
  }

  return lines;
}

function buildRoutePath(): { readonly path: string; readonly pulsePoint: readonly [number, number] } {
  const waypoints: readonly (readonly [number, number, number])[] = [
    [0.59, 2.54, 0.14],
    [0.94, 1.54, 0.14],
    [1.88, 1.89, 0.14],
    [2.61, 0.69, 0.14],
  ];

  const projected = waypoints.map(([x, y, z]) => projectIso(x, y, z, 0, 0));
  const [p0, p1, p2, p3] = projected;
  const path =
    `M${p0![0].toFixed(2)} ${p0![1].toFixed(2)} ` +
    `L${p1![0].toFixed(2)} ${p1![1].toFixed(2)} ` +
    `L${p2![0].toFixed(2)} ${p2![1].toFixed(2)} ` +
    `L${p3![0].toFixed(2)} ${p3![1].toFixed(2)}`;

  return { path, pulsePoint: p3! };
}

const GRID_LINES = buildGridLines();
const ROUTE_GEOMETRY = buildRoutePath();
const PLATFORM_BASE = isoBox(0, 0, PLATFORM_SIZE, PLATFORM_SIZE, 0.12, 0, 0);

/**
 * Composición isométrica 2.5D paramétrica (reutiliza `isoBox` / `projectIso`
 * de `shared/ui/Isometric`) sobre la paleta Webflow Studio (#ffffff, #f0f0f0,
 * #d8d8d8, #080808 y #146ef5). Decorativa y sin texto redundante.
 */
export const IsometricRouteSculpture: FC = () => (
  <div className="wf-iso-sculpture" aria-hidden="true">
    <svg viewBox="0 0 320 206" className="wf-iso-svg" focusable="false">
      <g transform={`translate(${ORIGIN_X} ${ORIGIN_Y}) scale(${SCALE})`}>
        {/* Placa base isométrica */}
        <polygon className="wf-iso-plate__left" points={PLATFORM_BASE.left} />
        <polygon className="wf-iso-plate__right" points={PLATFORM_BASE.right} />
        <polygon className="wf-iso-plate__top" points={PLATFORM_BASE.top} />

        {/* Retícula proyectada en el plano superior */}
        <g className="wf-iso-grid">
          {GRID_LINES.map((d, index) => (
            <path key={index} d={d} />
          ))}
        </g>

        {/* Ruta óptima proyectada entre nodos */}
        <path className="wf-iso-route-track" d={ROUTE_GEOMETRY.path} />
        <path className="wf-iso-route-draw" d={ROUTE_GEOMETRY.path} pathLength={100} />

        {/* Anillo de destino */}
        <ellipse
          className="wf-iso-beacon"
          cx={ROUTE_GEOMETRY.pulsePoint[0]}
          cy={ROUTE_GEOMETRY.pulsePoint[1]}
          rx="0.28"
          ry="0.16"
        />

        {/* Bloques isométricos de origen, paradas y destino */}
        {ISO_NODES.map((node) => {
          const box = isoBox(node.x, node.y, node.size, node.size, node.height, 0, 0);
          return (
            <g
              key={node.id}
              className={`wf-iso-node wf-iso-node--${node.tone}`}
              style={{ animationDelay: `${node.delayMs}ms` }}
            >
              <polygon className="wf-iso-node__left" points={box.left} />
              <polygon className="wf-iso-node__right" points={box.right} />
              <polygon className="wf-iso-node__top" points={box.top} />
            </g>
          );
        })}
      </g>
    </svg>
  </div>
);

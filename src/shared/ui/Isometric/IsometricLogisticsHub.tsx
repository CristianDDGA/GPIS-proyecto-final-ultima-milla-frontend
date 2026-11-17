import type { FC } from 'react';
import { isoBox, projectIso } from './iso.js';
import './IsometricLogisticsHub.css';

export type HubHealth = 'checking' | 'online' | 'offline';

export interface IsometricLogisticsHubProps {
  readonly healthStatus?: HubHealth | undefined;
  /** Rol activo: resalta la capa operativa que ese perfil controla. */
  readonly role?: 'personal' | 'repartidor' | 'cliente' | undefined;
  readonly className?: string | undefined;
}

const ORIGIN_X = 258;
const ORIGIN_Y = 96;
const SCALE = 19;

interface BlockSpec {
  readonly key: string;
  readonly className: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

const BUILDINGS: readonly BlockSpec[] = [
  { key: 'hub', className: 'iso-hub__block iso-hub__block--hub', x: 0.5, y: 0.5, width: 3.3, depth: 3.3, height: 1.45 },
  { key: 'hub-roof', className: 'iso-hub__block iso-hub__block--hub-roof', x: 0.9, y: 0.9, width: 2.5, depth: 2.5, height: 1.72 },
  { key: 'dock', className: 'iso-hub__block iso-hub__block--dock', x: 0.5, y: 4.4, width: 1.5, depth: 1.9, height: 0.95 },
  { key: 'north', className: 'iso-hub__block iso-hub__block--tower', x: 5.1, y: 0.6, width: 1.6, depth: 1.6, height: 2.1 },
  { key: 'east', className: 'iso-hub__block iso-hub__block--tower-soft', x: 5.1, y: 2.7, width: 1.6, depth: 1.5, height: 1.4 },
  { key: 'south', className: 'iso-hub__block iso-hub__block--zone', x: 4.9, y: 4.7, width: 1.5, depth: 1.5, height: 1.05 },
  { key: 'west', className: 'iso-hub__block iso-hub__block--zone-soft', x: 2.4, y: 4.9, width: 1.4, depth: 1.4, height: 0.85 },
];

const PACKAGES: readonly BlockSpec[] = [
  { key: 'p1', className: 'iso-hub__package', x: 4.05, y: 3.35, width: 0.6, depth: 0.6, height: 0.42 },
  { key: 'p2', className: 'iso-hub__package', x: 4.05, y: 4.05, width: 0.6, depth: 0.6, height: 0.42 },
  { key: 'p3', className: 'iso-hub__package iso-hub__package--accent', x: 4.75, y: 3.5, width: 0.55, depth: 0.55, height: 0.35 },
];

const ROUTE_POINTS: readonly (readonly [number, number])[] = [
  [2.15, 2.05],
  [4.35, 3.1],
  [5.75, 4.35],
  [4.9, 5.4],
  [2.95, 5.55],
  [1.25, 5.35],
];

function routePath(): string {
  return ROUTE_POINTS.map(([x, y], index) => {
    const [px, py] = projectIso(x, y, 0.22, 0, 0);
    return `${index === 0 ? 'M' : 'L'} ${px.toFixed(2)} ${py.toFixed(2)}`;
  }).join(' ');
}

/**
 * Ilustración isométrica del centro de distribución urbano: bloques 2.5D de
 * cobertura, paquetes, nodos de parada y rutas animadas conectadas al estado
 * real del servidor (online = pulso esmeralda, offline = ámbar/rojo).
 */
export const IsometricLogisticsHub: FC<IsometricLogisticsHubProps> = ({
  healthStatus = 'checking',
  role,
  className = '',
}) => {
  const ground = isoBox(-0.6, -0.6, 9.4, 9.4, 0.16, 0, 0);
  const ring = isoBox(0.35, 0.35, 3.6, 3.6, 0.06, 0, 0);

  return (
    <figure
      className={`iso-hub iso-hub--${healthStatus} ${role !== undefined ? `iso-hub--role-${role}` : ''} ${className}`.trim()}
      aria-label="Ilustración isométrica del centro de distribución de última milla"
    >
      <svg className="iso-hub__svg" viewBox="0 0 520 336" role="presentation">
        <g transform={`translate(${ORIGIN_X} ${ORIGIN_Y}) scale(${SCALE})`}>
          <polygon className="iso-hub__ground iso-hub__face--left" points={ground.left} />
          <polygon className="iso-hub__ground iso-hub__face--right" points={ground.right} />
          <polygon className="iso-hub__ground iso-hub__face--top" points={ground.top} />

          <polygon className="iso-hub__ring iso-hub__face--top" points={ring.top} />

          {BUILDINGS.map((block) => {
            const box = isoBox(block.x, block.y, block.width, block.depth, block.height, 0, 0);
            return (
              <g key={block.key} className={block.className}>
                <polygon className="iso-hub__face--left" points={box.left} />
                <polygon className="iso-hub__face--right" points={box.right} />
                <polygon className="iso-hub__face--top" points={box.top} />
              </g>
            );
          })}

          {PACKAGES.map((block) => {
            const box = isoBox(block.x, block.y, block.width, block.depth, block.height, 0, 0);
            return (
              <g key={block.key} className={block.className}>
                <polygon className="iso-hub__face--left" points={box.left} />
                <polygon className="iso-hub__face--right" points={box.right} />
                <polygon className="iso-hub__face--top" points={box.top} />
              </g>
            );
          })}

          <path className="iso-hub__route" d={routePath()} vectorEffect="non-scaling-stroke" />

          {ROUTE_POINTS.map(([x, y], index) => {
            const [px, py] = projectIso(x, y, 0.26, 0, 0);
            return (
              <g key={`node-${index}`}>
                <circle className="iso-hub__node-halo" cx={px} cy={py} r={0.34} />
                <circle
                  className={`iso-hub__node ${index === 0 ? 'iso-hub__node--origin' : ''}`}
                  cx={px}
                  cy={py}
                  r={index === 0 ? 0.19 : 0.145}
                />
              </g>
            );
          })}

          <circle className="iso-hub__signal" cx={projectIso(2.15, 2.05, 0.26, 0, 0)[0]} cy={projectIso(2.15, 2.05, 0.26, 0, 0)[1]} r={0.7} />
        </g>
      </svg>

      <figcaption className="iso-hub__caption">
        <span className={`iso-hub__status iso-hub__status--${healthStatus}`}>
          <span className="iso-hub__status-dot" aria-hidden="true" />
          {healthStatus === 'online'
            ? 'Red operativa conectada'
            : healthStatus === 'offline'
              ? 'Sin conexión con el servidor'
              : 'Verificando conexión'}
        </span>
        <span className="iso-hub__legend">Torre de control · 5 etapas de última milla</span>
      </figcaption>
    </figure>
  );
};

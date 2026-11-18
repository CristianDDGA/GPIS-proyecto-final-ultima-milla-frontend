import type { FC } from 'react';

export interface MillastMarkProps {
  readonly className?: string | undefined;
}

/**
 * Emblema Millast: placa de mapa con una ruta óptima trazada desde el origen
 * hasta el destino, con un waypoint de reparto. Paleta AuthKit (ice/frost/
 * blueprint), sin violeta (reservado al CTA).
 */
export const MillastMark: FC<MillastMarkProps> = ({ className = '' }) => (
  <svg
    className={'millast-mark ' + className}
    viewBox="0 0 56 56"
    role="presentation"
    aria-hidden="true"
    focusable="false"
  >
    <defs>
      <linearGradient id="millast-route" x1="11" y1="44" x2="42" y2="14" gradientUnits="userSpaceOnUse">
        <stop stopColor="#8fb9ee" />
        <stop offset="1" stopColor="#eef7ff" />
      </linearGradient>
      <linearGradient id="millast-tile" x1="6" y1="3" x2="50" y2="54" gradientUnits="userSpaceOnUse">
        <stop stopColor="#3d5177" />
        <stop offset="0.55" stopColor="#1b2842" />
        <stop offset="1" stopColor="#0d1526" />
      </linearGradient>
      <linearGradient id="millast-sheen" x1="28" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
        <stop stopColor="rgba(216, 236, 248, 0.22)" />
        <stop offset="1" stopColor="rgba(216, 236, 248, 0)" />
      </linearGradient>
      <filter id="millast-route-glow" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
    </defs>

    {/* Placa del mapa */}
    <rect x="1" y="1" width="54" height="54" rx="16" fill="url(#millast-tile)" />
    <rect x="1.75" y="1.75" width="52.5" height="52.5" rx="15.4" fill="none" stroke="rgba(186, 215, 247, 0.58)" strokeWidth="1.6" />
    <rect x="2" y="2" width="52" height="52" rx="15" fill="url(#millast-sheen)" />

    {/* Calles del mapa */}
    <g stroke="rgba(186, 215, 247, 0.18)" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 4">
      <path d="M9 19 H47" />
      <path d="M9 38 H47" />
      <path d="M20 8 V48" opacity="0.7" />
      <path d="M36 8 V48" opacity="0.7" />
    </g>

    {/* Halo de la ruta */}
    <path
      d="M11.5 43.5 C18.5 43.5 16.5 32.5 25 29.5 C33 26.7 31 17.5 40 14.5"
      fill="none"
      stroke="rgba(152, 192, 239, 0.6)"
      strokeWidth="6"
      strokeLinecap="round"
      filter="url(#millast-route-glow)"
    />

    {/* Ruta óptima */}
    <path
      d="M11.5 43.5 C18.5 43.5 16.5 32.5 25 29.5 C33 26.7 31 17.5 40 14.5"
      fill="none"
      stroke="url(#millast-route)"
      strokeWidth="3.1"
      strokeLinecap="round"
    />

    {/* Waypoint de reparto */}
    <circle cx="25" cy="29.5" r="2.8" fill="#0b1322" stroke="#b6d9fc" strokeWidth="1.7" />

    {/* Origen */}
    <circle cx="11.5" cy="43.5" r="7.5" fill="rgba(186, 215, 247, 0.12)" />
    <circle cx="11.5" cy="43.5" r="4.3" fill="none" stroke="rgba(228, 241, 252, 0.75)" strokeWidth="1.6" />
    <circle cx="11.5" cy="43.5" r="2.1" fill="#eef7ff" />

    {/* Destino */}
    <circle cx="40" cy="14.5" r="9" fill="rgba(140, 190, 246, 0.18)" />
    <circle cx="40" cy="14.5" r="4.6" fill="none" stroke="#eef7ff" strokeWidth="1.8" />
    <circle cx="40" cy="14.5" r="2.2" fill="#eef7ff" />
  </svg>
);

import type { FC } from 'react';

export interface MillastMarkProps {
  readonly className?: string | undefined;
  readonly variant?: 'dark' | 'light' | undefined;
}

/**
 * Emblema Millast (DESIGN.md Webflow Studio):
 * Placa plana de 4px de radio en #146ef5 con ruta óptima trazada en #ffffff
 * (origen, waypoint intermedio y destino). Cero degradados ni filtros blur.
 */
export const MillastMark: FC<MillastMarkProps> = ({ className = '' }) => (
  <svg
    className={'millast-mark ' + className}
    viewBox="0 0 32 32"
    role="presentation"
    aria-hidden="true"
    focusable="false"
  >
    <rect x="0" y="0" width="32" height="32" rx="4" fill="#146ef5" />
    <path
      d="M7 23 C11.5 23 11 17 16 15.5 C21 14 20.5 9 25 9"
      fill="none"
      stroke="#ffffff"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle cx="7" cy="23" r="2.2" fill="#ffffff" />
    <circle cx="16" cy="15.5" r="2" fill="#146ef5" stroke="#ffffff" strokeWidth="1.75" />
    <circle cx="25" cy="9" r="2.2" fill="#ffffff" />
  </svg>
);

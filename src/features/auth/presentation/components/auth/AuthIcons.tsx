import type { FC } from 'react';

interface IconProps {
  readonly className?: string | undefined;
}

/** Isotipo compacto "Camino en formación" para la cabecera Millast */
export const MillastBrandGlyph: FC = () => (
  <svg width="17" height="17" viewBox="0 0 320 320" fill="none" aria-hidden="true" focusable="false">
    <circle cx="66" cy="242" r="22" stroke="#ffffff" strokeWidth="24" />
    <path
      d="M 128 242 L 196 242 A 41 41 0 0 0 196 160 L 124 160 A 41 41 0 0 1 124 78 L 196 78"
      stroke="#ffffff"
      strokeWidth="30"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="256" cy="78" r="26" fill="#ffffff" />
  </svg>
);

export const ShieldCheckIcon: FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const AlertCircleIcon: FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

export const CheckCircleIcon: FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

export const ArrowLeftIcon: FC<IconProps> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

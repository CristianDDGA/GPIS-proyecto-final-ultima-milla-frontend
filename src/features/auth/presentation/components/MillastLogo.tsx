import type { FC } from 'react';
import { isoBox } from '../../../../shared/ui/Isometric/iso.js';
import './MillastLogo.css';

export interface MillastLogoProps {
  readonly className?: string | undefined;
  /** Oculta el wordmark y deja solo el emblema isométrico. */
  readonly markOnly?: boolean | undefined;
}

const ORIGIN_X = 36;
const ORIGIN_Y = 68;
const SCALE = 20;

const STRUCTURE_A = isoBox(0, 0.85, 0.9, 0.9, 1.05, 0, 0);
const STRUCTURE_B = isoBox(0.95, 0, 0.9, 0.9, 1.55, 0, 0);
const BRIDGE = isoBox(0.45, 0.45, 0.55, 0.55, 0.45, 0, 0);
const LAST_CUBE = isoBox(2.05, 0.35, 0.62, 0.62, 0.62, 0, 0);

interface EmblemBlockProps {
  readonly box: { readonly top: string; readonly left: string; readonly right: string };
  readonly tone: 'sapphire' | 'steel' | 'bridge' | 'last';
}

const EmblemBlock: FC<EmblemBlockProps> = ({ box, tone }) => (
  <g className={'millast-logo__block millast-logo__block--' + tone}>
    <polygon className="millast-logo__face millast-logo__face--left" points={box.left} />
    <polygon className="millast-logo__face millast-logo__face--right" points={box.right} />
    <polygon className="millast-logo__face millast-logo__face--top" points={box.top} />
  </g>
);

/**
 * Emblema de marca Millast: dos pilares isométricos de planos sólidos que
 * escalonan una `M` hacia el cubo flotante de destino (Milla + Last = Millast).
 * Sin gradientes: solo caras top/left/right en colores sólidos.
 */
export const MillastLogo: FC<MillastLogoProps> = ({ className = '', markOnly = false }) => (
  <span className={'millast-logo ' + className}>
    <svg className="millast-logo__mark" viewBox="2 40 80 60" role="presentation" aria-hidden="true" focusable="false">
      <g transform={'translate(' + ORIGIN_X + ' ' + ORIGIN_Y + ') scale(' + SCALE + ')'}>
        <EmblemBlock box={STRUCTURE_A} tone="sapphire" />
        <EmblemBlock box={BRIDGE} tone="bridge" />
        <EmblemBlock box={STRUCTURE_B} tone="steel" />
        <g transform="translate(0 -0.85)">
          <EmblemBlock box={LAST_CUBE} tone="last" />
        </g>
      </g>
    </svg>

    {!markOnly && <span className="millast-logo__word">Millast</span>}
  </span>
);

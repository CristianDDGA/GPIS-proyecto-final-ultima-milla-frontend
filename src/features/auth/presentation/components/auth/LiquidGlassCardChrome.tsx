import type { FC, RefObject } from 'react';

export interface LiquidGlassCardChromeProps {
  readonly cardRef: RefObject<HTMLDivElement | null>;
  readonly glintRef: RefObject<HTMLDivElement | null>;
}

/**
 * Capa óptica ligera Waterline Porcelain (0 fps en reposo):
 * elimina filtros SVG feTurbulence y burbujas blur(50px) infinitas,
 * conservando bisel especular nítido y destello sutil reactivo al puntero.
 */
export const LiquidGlassCardChrome: FC<LiquidGlassCardChromeProps> = ({ glintRef }) => (
  <div aria-hidden="true" className="mlg-chrome">
    <div
      ref={glintRef}
      className="mlg-pointer-glint"
      style={{ transform: 'translate3d(-999px, -999px, 0)' }}
    />
  </div>
);

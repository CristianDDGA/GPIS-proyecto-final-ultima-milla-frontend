import type { FC } from 'react';
import { MillastBrandGlyph } from './AuthIcons.js';

/**
 * Cabecera superior izquierda minimalista:
 * cuadrado 28×28 en #1668f3 con el isotipo "Camino en formación" + wordmark Millast.
 */
export const AuthTopNav: FC = () => (
  <header className="mlg-header mlg-enter mlg-delay-1">
    <div className="mlg-brand">
      <div className="mlg-brand__badge">
        <MillastBrandGlyph />
      </div>
      <span className="mlg-brand__name">Millast</span>
    </div>
  </header>
);

import type { FC } from 'react';
import { IsometricRouteSculpture } from './IsometricRouteSculpture.js';
import { KineticText } from './KineticText.js';

/**
 * Columna izquierda minimalista: únicamente el slogan con tipografía cinética
 * y la composición geométrica isométrica 2.5D de ruta.
 */
export const AuthStudioShowcase: FC = () => (
  <div className="wf-showcase">
    <KineticText
      as="h1"
      text="Planifica rutas. Despacha a tiempo."
      className="wf-display-title"
      staggerMs={65}
    />

    <IsometricRouteSculpture />
  </div>
);

import type { FC } from 'react';

/**
 * Columna izquierda editorial del acceso Millast.
 * Limpia y directa: titular + síntesis operativa sin ruido visual.
 */
export const AuthStudioShowcase: FC = () => (
  <section className="mlg-showcase" aria-label="Identidad Millast">
    <h1 className="mlg-enter mlg-delay-1 mlg-display mlg-hero-title">
      <span className="mlg-hero-title__line">Planifica rutas.</span>
      <span className="mlg-hero-title__line">Despacha a tiempo.</span>
    </h1>
    <p className="mlg-enter mlg-delay-2 mlg-hero-desc">
      Un solo entorno de alta velocidad para administrar zonas, trazado vial, entregas contra
      entrega y seguimiento de pedidos.
    </p>
  </section>
);

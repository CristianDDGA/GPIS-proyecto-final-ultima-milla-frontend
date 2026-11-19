import type { FC } from 'react';
import { GlassIconReveal } from './GlassIconReveal.js';
import { PATH_MARK_SVG } from './glassRevealEngine.js';

const LOGO_REVEAL_TUNING = {
  startZoom: 2.35,
  glide: 2.75,
  present: 2.85,
  response: 0.5,
  dispersion: 1.85,
  colorBleed: 1.35,
  sheen: 1.0,
  lightTurn: 1.0,
} as const;

/**
 * Columna izquierda del login: titular display limpio + logotipo WebGL2 Liquid Glass
 * en bucle autónomo lento sobre blanco puro (#ffffff).
 */
export const AuthStudioShowcase: FC = () => (
  <section className="mlg-showcase" aria-label="Identidad Millast">
    <h1 className="mlg-enter mlg-delay-2 mlg-display mlg-hero-title">
      <span className="mlg-hero-title__line">Planifica rutas.</span>
      <span className="mlg-hero-title__line">Despacha a tiempo.</span>
    </h1>

    <div className="mlg-enter mlg-delay-3 mlg-reveal-stage">
      <GlassIconReveal
        logo={PATH_MARK_SVG}
        label="Millast — Camino en formación Liquid Glass"
        look="light"
        background="#ffffff"
        logoColor="#1668f3"
        tileSize={230}
        logoScale={0.62}
        finalScale={0.8}
        loop={true}
        speed={0.46}
        hold={1.45}
        tuning={LOGO_REVEAL_TUNING}
        className="mlg-reveal-stage__canvas"
      />
    </div>
  </section>
);

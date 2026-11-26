import { useState, type FC } from 'react';
import { GlassIconReveal } from './GlassIconReveal.js';
import { PATH_MARK_SVG } from './glassRevealEngine.js';

const LOGO_REVEAL_TUNING = {
  startZoom: 2.2,
  glide: 2.6,
  present: 2.75,
  response: 0.52,
  dispersion: 1.65,
  colorBleed: 1.25,
  sheen: 1.0,
  lightTurn: 1.0,
} as const;

/**
 * Columna izquierda del login unificada con el lenguaje Millast Waterline:
 * titular editorial + emblema WebGL2 one-shot (0 fps en reposo tras revelarse)
 * + cápsulas de capacidades operativas de los 3 roles.
 */
export const AuthStudioShowcase: FC = () => {
  const [replayKey, setReplayKey] = useState(0);

  return (
    <section className="mlg-showcase" aria-label="Identidad Millast">
      <p className="mlg-enter mlg-delay-1 mlg-eyebrow">Plataforma de logística y tienda COD</p>
      <h1 className="mlg-enter mlg-delay-2 mlg-display mlg-hero-title">
        <span className="mlg-hero-title__line">Planifica rutas.</span>
        <span className="mlg-hero-title__line">Despacha a tiempo.</span>
      </h1>
      <p className="mlg-enter mlg-delay-2 mlg-hero-desc">
        Un solo entorno de alta velocidad para administrar zonas, trazado vial en Ecuador, entregas
        contra entrega y seguimiento de pedidos.
      </p>

      <div className="mlg-enter mlg-delay-3 mlg-showcase-chips" aria-label="Capacidades principales">
        <span className="mlg-showcase-chip">Rutas viales Ecuador</span>
        <span className="mlg-showcase-chip">Cobro contra entrega</span>
        <span className="mlg-showcase-chip">3 roles integrados</span>
      </div>

      <button
        type="button"
        className="mlg-enter mlg-delay-3 mlg-reveal-stage"
        onClick={() => setReplayKey((k) => k + 1)}
        title="Repetir revelado del emblema Millast"
        aria-label="Emblema Millast — clic para repetir el revelado"
      >
        <GlassIconReveal
          key={replayKey}
          logo={PATH_MARK_SVG}
          label="Millast — Camino en formación"
          look="light"
          background="#e8f0f9"
          logoColor="#1668f3"
          tileSize={220}
          logoScale={0.62}
          finalScale={0.8}
          loop={false}
          speed={0.82}
          hold={0.6}
          tuning={LOGO_REVEAL_TUNING}
          className="mlg-reveal-stage__canvas"
        />
      </button>
    </section>
  );
};

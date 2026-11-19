import { useEffect, useMemo, useRef, useState, type CSSProperties, type FC } from 'react';
import {
  GLASS_LOOKS,
  LOGO_BOX_FRACTION,
  loadLogoAsset,
  logoToDataUrl,
  startGlassRevealEngine,
  type GlassLook,
  type GlassRevealEngineHandle,
  type GlassRevealSettings,
  type GlassRevealTuning,
  type LiveRevealState,
} from './glassRevealEngine.js';

export interface GlassIconRevealProps {
  readonly logo: string;
  readonly look?: GlassLook | undefined;
  readonly background?: string | undefined;
  readonly logoColor?: string | undefined;
  readonly plateColor?: string | undefined;
  readonly iconPlate?: boolean | undefined;
  readonly keepPlate?: boolean | undefined;
  readonly originalColors?: boolean | undefined;
  readonly tileSize?: number | undefined;
  readonly logoScale?: number | undefined;
  readonly finalScale?: number | undefined;
  readonly logoOffset?: readonly [number, number] | undefined;
  readonly loop?: boolean | undefined;
  readonly hold?: number | undefined;
  readonly speed?: number | undefined;
  readonly time?: number | undefined;
  readonly tuning?: GlassRevealTuning | undefined;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}

/**
 * Componente autónomo en bucle WebGL2 Liquid Glass con respaldo limpio por máscara CSS
 * cuando WebGL2 no está disponible.
 */
export const GlassIconReveal: FC<GlassIconRevealProps> = ({
  logo,
  look = 'light',
  background = '#ffffff',
  logoColor = '#1668f3',
  plateColor,
  iconPlate,
  keepPlate,
  originalColors,
  tileSize,
  logoScale,
  finalScale,
  logoOffset,
  loop = true,
  hold = 0.85,
  speed = 1,
  time,
  tuning,
  label = 'Millast — Camino en formación',
  className = '',
  style,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GlassRevealEngineHandle | null>(null);
  const [fallback, setFallback] = useState(false);

  const tuningKey = JSON.stringify(tuning ?? {});
  const offsetKey = logoOffset ? logoOffset.join(',') : '';

  const settings = useMemo<GlassRevealSettings>(() => {
    const base = GLASS_LOOKS[look];
    const parsedTuning = JSON.parse(tuningKey) as GlassRevealTuning;
    const parsedOffset: readonly [number, number] | undefined = offsetKey
      ? (() => {
          const parts = offsetKey.split(',').map(Number);
          return [parts[0] ?? 0, parts[1] ?? 0] as const;
        })()
      : undefined;

    return {
      ...base,
      ...(background !== undefined ? { background } : {}),
      ...(logoColor !== undefined ? { logoColor } : {}),
      ...(plateColor !== undefined ? { plateColor } : {}),
      ...(iconPlate !== undefined ? { iconPlate } : {}),
      ...(keepPlate !== undefined ? { keepPlate } : {}),
      ...(originalColors !== undefined ? { originalColors } : {}),
      ...(tileSize !== undefined ? { tileSize } : {}),
      ...(logoScale !== undefined ? { logoScale } : {}),
      ...(finalScale !== undefined ? { finalScale } : {}),
      ...(hold !== undefined ? { hold } : {}),
      ...(parsedOffset !== undefined ? { logoOffset: parsedOffset } : {}),
      ...parsedTuning,
    };
  }, [
    look,
    background,
    logoColor,
    plateColor,
    iconPlate,
    keepPlate,
    originalColors,
    tileSize,
    logoScale,
    finalScale,
    hold,
    offsetKey,
    tuningKey,
  ]);

  const liveRef = useRef<LiveRevealState>({ settings, loop, speed, time });
  liveRef.current = { settings, loop, speed, time };

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const engine = startGlassRevealEngine(wrap, liveRef);
    if (!engine) {
      setFallback(true);
      return;
    }
    engineRef.current = engine;
    return () => {
      engineRef.current = null;
      engine.dispose();
    };
  }, []);

  useEffect(() => {
    engineRef.current?.invalidate();
  }, [settings, loop, speed, time]);

  useEffect(() => {
    let cancelled = false;
    loadLogoAsset(logo).then(
      (data) => {
        if (cancelled) return;
        engineRef.current?.setLogo(data);
      },
      (err) => console.error(err),
    );
    return () => {
      cancelled = true;
    };
  }, [logo]);

  const fallbackUrl = useMemo(() => (fallback ? logoToDataUrl(logo) : ''), [fallback, logo]);
  const fallbackSize = settings.tileSize * settings.logoScale * settings.finalScale * LOGO_BOX_FRACTION;

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={label}
      className={`mlg-glass-reveal ${className}`.trim()}
      style={{ backgroundColor: settings.background, ...style }}
    >
      {fallback && (
        <span
          aria-hidden="true"
          className="mlg-glass-reveal__fallback"
          style={{
            width: fallbackSize,
            height: fallbackSize,
            backgroundColor: settings.logoColor,
            maskImage: `url("${fallbackUrl}")`,
            WebkitMaskImage: `url("${fallbackUrl}")`,
          }}
        />
      )}
    </div>
  );
};

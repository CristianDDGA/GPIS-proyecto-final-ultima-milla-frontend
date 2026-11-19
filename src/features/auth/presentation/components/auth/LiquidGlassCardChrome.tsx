import { useEffect, useState, type CSSProperties, type FC, type RefObject } from 'react';

export interface LiquidGlassCardChromeProps {
  readonly cardRef: RefObject<HTMLDivElement | null>;
  readonly glintRef: RefObject<HTMLDivElement | null>;
}

/**
 * Capa óptica viva de la tarjeta Liquid Glass (100% colores sólidos + blur, cero degradados):
 * - 3 burbujas sólidas desenfocadas en movimiento lento tras la lámina esmerilada.
 * - Barrido diagonal especular y destello reactivo al puntero.
 * - Bisel perimetral con filtro SVG sRGB y doble haz especular orbital sincronizado vía ResizeObserver.
 */
export const LiquidGlassCardChrome: FC<LiquidGlassCardChromeProps> = ({ cardRef, glintRef }) => {
  const [size, setSize] = useState({ w: 436, h: 520 });

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const update = (): void => {
      const w = Math.max(240, Math.round(el.clientWidth || 436));
      const h = Math.max(280, Math.round(el.clientHeight || 520));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cardRef]);

  const radius = 24;
  const inset = 1;
  const rw = Math.max(10, size.w - inset * 2);
  const rh = Math.max(10, size.h - inset * 2);
  const perim = 2 * (rw - 2 * radius + (rh - 2 * radius)) + 2 * Math.PI * radius;

  const rimStyle = {
    '--m-perim': `${perim.toFixed(2)}px`,
  } as CSSProperties;

  return (
    <>
      <svg className="mlg-svg-defs" aria-hidden="true" focusable="false">
        <defs>
          <filter
            id="millast-liquid-rim"
            x="-6%"
            y="-6%"
            width="112%"
            height="112%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.02"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feGaussianBlur in="noise" stdDeviation="1.3" result="softNoise" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="softNoise"
              scale="7"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div aria-hidden="true" className="mlg-chrome">
        <div className="mlg-orb mlg-orb--1" />
        <div className="mlg-orb mlg-orb--2" />
        <div className="mlg-orb mlg-orb--3" />

        <div className="mlg-frosted-veil" />
        <div className="mlg-glass-sheen" />

        <div
          ref={glintRef}
          className="mlg-pointer-glint"
          style={{ transform: 'translate3d(-999px, -999px, 0)' }}
        />

        <div className="mlg-liquid-rim" />

        <svg
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          fill="none"
          className="mlg-rim-svg"
          style={rimStyle}
        >
          <rect
            x={inset}
            y={inset}
            width={rw}
            height={rh}
            rx={radius}
            ry={radius}
            stroke="rgba(148, 163, 184, 0.24)"
            strokeWidth="1"
          />
          <rect
            x={inset}
            y={inset}
            width={rw}
            height={rh}
            rx={radius}
            ry={radius}
            stroke="rgba(22, 104, 243, 0.36)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeDasharray={`110 ${Math.max(10, perim - 110).toFixed(2)}`}
            className="mlg-rim-orbit-a"
          />
          <rect
            x={inset}
            y={inset}
            width={rw}
            height={rh}
            rx={radius}
            ry={radius}
            stroke="rgba(56, 189, 248, 0.34)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeDasharray={`82 ${Math.max(10, perim - 82).toFixed(2)}`}
            className="mlg-rim-orbit-b"
          />
        </svg>
      </div>
    </>
  );
};

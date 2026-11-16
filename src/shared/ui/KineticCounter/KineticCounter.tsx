import type { FC } from 'react';
import './KineticCounter.css';

export interface KineticCounterProps {
  /** Valor numérico o texto corto que se muestra con tipografía cinética. */
  readonly value: number | string;
  readonly label?: string | undefined;
  /** Contenido secundario: unidad, delta o aclaración. */
  readonly hint?: string | undefined;
  readonly tone?: 'neutral' | 'accent' | 'transit' | 'delivered' | undefined;
  readonly className?: string | undefined;
}

/**
 * Contador operativo con efecto odómetro: cuando el valor cambia, los dígitos
 * se deslizan verticalmente. Respeta prefers-reduced-motion gracias a las
 * curvas de animación definidas en tokens.css.
 */
export const KineticCounter: FC<KineticCounterProps> = ({
  value,
  label,
  hint,
  tone = 'neutral',
  className = '',
}) => {
  return (
    <div className={`kinetic-counter kinetic-counter--${tone} ${className}`.trim()}>
      {label !== undefined && <span className="kinetic-counter__label">{label}</span>}
      <span className="kinetic-counter__value" key={String(value)}>
        {value}
      </span>
      {hint !== undefined && <span className="kinetic-counter__hint">{hint}</span>}
    </div>
  );
};

import type { FC } from 'react';
import type { PasswordStrength } from '../../../domain/index.js';

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: 'Débil',
  medium: 'Media',
  strong: 'Fuerte',
};

const STRENGTH_LEVEL: Record<PasswordStrength, number> = {
  weak: 1,
  medium: 2,
  strong: 3,
};

export interface PasswordStrengthMeterProps {
  readonly strength: PasswordStrength;
}

/** Medidor de fortaleza compacto en 3 segmentos alineado con la paleta Liquid Glass. */
export const PasswordStrengthMeter: FC<PasswordStrengthMeterProps> = ({ strength }) => (
  <div className="mlg-strength" data-strength={strength} aria-live="polite">
    <span className="mlg-strength__bars" aria-hidden="true">
      {[1, 2, 3].map((level) => (
        <span
          key={level}
          className={
            'mlg-strength__bar' +
            (level <= STRENGTH_LEVEL[strength] ? ' mlg-strength__bar--on' : '')
          }
        />
      ))}
    </span>
    <span className="mlg-strength__label">Seguridad: {STRENGTH_LABELS[strength]}</span>
  </div>
);

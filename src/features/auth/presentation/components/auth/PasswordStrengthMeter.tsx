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

/**
 * Medidor de fortaleza en 3 segmentos rectangulares (4 px) sobre tinta
 * acromática y azul #146ef5 para el nivel fuerte.
 */
export const PasswordStrengthMeter: FC<PasswordStrengthMeterProps> = ({ strength }) => (
  <div className="wf-strength" data-strength={strength} aria-live="polite">
    <span className="wf-strength__bars" aria-hidden="true">
      {[1, 2, 3].map((level) => (
        <span
          key={level}
          className={
            'wf-strength__bar ' + (level <= STRENGTH_LEVEL[strength] ? 'wf-strength__bar--on' : '')
          }
        />
      ))}
    </span>
    <span className="wf-strength__label">Seguridad: {STRENGTH_LABELS[strength]}</span>
  </div>
);

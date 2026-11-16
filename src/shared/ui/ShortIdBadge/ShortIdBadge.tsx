import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import './ShortIdBadge.css';

export interface ShortIdBadgeProps {
  /** Identificador UUID completo; se conserva íntegro en el tooltip y al copiar. */
  readonly id: string;
  /** Prefijo legible de negocio: PED, RUT, ZON, REP. */
  readonly prefix: string;
  /** Si es false se muestra solo el código, sin acción de copia. */
  readonly copyable?: boolean;
  /** Etiqueta accesible opcional para distinguir varias insignias. */
  readonly ariaLabel?: string;
  readonly className?: string;
}

const COMPACT_PATTERN = /[^0-9a-z]/gi;

/**
 * Código corto y estable derivado del UUID. Apple HIG pide mostrar nombres
 * reconocibles en lugar de identificadores técnicos de 36 caracteres.
 */
export function toShortCode(id: string): string {
  const compact = id.replace(COMPACT_PATTERN, '').toUpperCase();
  if (compact.length === 0) {
    return 'SIN-ID';
  }
  return compact.length <= 4 ? compact : compact.slice(0, 4);
}

export const ShortIdBadge: FC<ShortIdBadgeProps> = ({
  id,
  prefix,
  copyable = true,
  ariaLabel,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleCopy = useCallback(() => {
    if (!copyable) {
      return;
    }

    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined) {
      return;
    }

    void clipboard.writeText(id).then(() => {
      setCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), 1600);
    }).catch(() => undefined);
  }, [copyable, id]);

  return (
    <span className={`short-id ${className}`.trim()} title={id}>
      <code className="short-id__code">
        <span className="short-id__prefix">#{prefix}-</span>
        {toShortCode(id)}
      </code>
      {copyable && (
        <button
          type="button"
          className={`short-id__copy ${copied ? 'short-id__copy--done' : ''}`.trim()}
          onClick={handleCopy}
          aria-label={ariaLabel ?? `Copiar identificador completo ${id}`}
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      )}
      <span className="sr-only">{id}</span>
    </span>
  );
};

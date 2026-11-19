import { Fragment, type FC } from 'react';

export interface KineticTextProps {
  readonly text: string;
  readonly as?: 'h1' | 'h2' | 'h3' | undefined;
  readonly id?: string | undefined;
  readonly tabIndex?: number | undefined;
  readonly className?: string | undefined;
  readonly staggerMs?: number | undefined;
  readonly elementRef?: React.RefObject<HTMLHeadingElement | null> | undefined;
}

/**
 * Tipografía cinética reutilizable: revela el texto palabra por palabra con
 * desplazamiento vertical suave (easing expo) conservando espacios reales
 * entre nodos inline-block y desactivación automática en reduced-motion.
 */
export const KineticText: FC<KineticTextProps> = ({
  text,
  as = 'h2',
  id,
  tabIndex,
  className = '',
  staggerMs = 55,
  elementRef,
}) => {
  const words = text.split(' ').filter((word) => word.length > 0);
  const Tag = as;

  return (
    <Tag
      ref={elementRef}
      id={id}
      tabIndex={tabIndex}
      className={`wf-kinetic ${className}`.trim()}
    >
      {words.map((word, index) => (
        <Fragment key={`${text}-${word}-${index}`}>
          <span
            className="wf-kinetic__word"
            style={{ animationDelay: `${index * staggerMs}ms` }}
          >
            {word}
          </span>
          {index < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </Tag>
  );
};

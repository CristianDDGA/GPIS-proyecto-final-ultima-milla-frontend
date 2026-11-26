import { useRef, type FC, type HTMLAttributes, type PointerEvent } from 'react';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'flat' | undefined;
}

export const Card: FC<CardProps> = ({
  children,
  variant = 'elevated',
  className = '',
  onPointerEnter,
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const sheenRef = useRef<HTMLDivElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    onPointerEnter?.(event);
    if (event.pointerType === 'touch') return;
    rectRef.current = event.currentTarget.getBoundingClientRect();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.pointerType === 'touch') return;
    const sheen = sheenRef.current;
    if (!sheen) return;
    const rect = rectRef.current ?? event.currentTarget.getBoundingClientRect();
    rectRef.current = rect;
    const x = event.clientX - rect.left - 110;
    const y = event.clientY - rect.top - 110;
    sheen.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    sheen.style.opacity = '1';
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    rectRef.current = null;
    if (sheenRef.current) {
      sheenRef.current.style.opacity = '0';
    }
  };

  return (
    <div
      className={`ui-card ui-card--${variant} ${className}`.trim()}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...rest}
    >
      <div ref={sheenRef} className="wl-card-sheen" aria-hidden="true" />
      {children}
    </div>
  );
};

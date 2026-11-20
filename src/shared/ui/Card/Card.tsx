import { useRef, type FC, type HTMLAttributes, type PointerEvent } from 'react';
import './Card.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined' | 'flat' | undefined;
}

export const Card: FC<CardProps> = ({
  children,
  variant = 'elevated',
  className = '',
  onPointerMove,
  onPointerLeave,
  ...rest
}) => {
  const sheenRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    if (event.pointerType === 'touch') return;
    const sheen = sheenRef.current;
    if (!sheen) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - 120;
    const y = event.clientY - rect.top - 120;
    sheen.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    sheen.style.opacity = '1';
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    onPointerLeave?.(event);
    if (sheenRef.current) {
      sheenRef.current.style.opacity = '0';
    }
  };

  return (
    <div
      className={`ui-card ui-card--${variant} ${className}`.trim()}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      {...rest}
    >
      <div ref={sheenRef} className="wl-card-sheen" aria-hidden="true" />
      {children}
    </div>
  );
};

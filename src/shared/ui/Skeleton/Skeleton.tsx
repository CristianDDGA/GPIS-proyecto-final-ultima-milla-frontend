import type { FC } from 'react';
import './Skeleton.css';

export interface SkeletonProps {
  readonly height?: number | string | undefined;
  readonly width?: number | string | undefined;
  readonly radius?: number | undefined;
  readonly className?: string | undefined;
}

export const Skeleton: FC<SkeletonProps> = ({
  height = 16,
  width = '100%',
  radius,
  className = '',
}) => (
  <span
    aria-hidden="true"
    className={`ui-skeleton ${className}`.trim()}
    style={{
      height: typeof height === 'number' ? `${height}px` : height,
      width: typeof width === 'number' ? `${width}px` : width,
      borderRadius: radius !== undefined ? `${radius}px` : undefined,
    }}
  />
);

export const TopRefetchBar: FC<{ readonly active: boolean; readonly label?: string | undefined }> = ({
  active,
  label = 'Actualizando datos...',
}) =>
  active ? (
    <div className="ui-refetch-bar" role="status" aria-label={label}>
      <span className="ui-refetch-bar__runner" aria-hidden="true" />
    </div>
  ) : null;

export const KpiStripSkeleton: FC<{ readonly count?: number | undefined }> = ({ count = 4 }) => (
  <div className="ui-skeleton-kpis" role="status" aria-label="Cargando métricas">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="ui-skeleton-kpi">
        <Skeleton height={11} width="52%" radius={6} />
        <Skeleton height={26} width="42%" radius={8} />
        <Skeleton height={12} width="72%" radius={6} />
      </div>
    ))}
  </div>
);

export const ProductGridSkeleton: FC<{ readonly count?: number | undefined }> = ({ count = 6 }) => (
  <div className="ui-skeleton-grid" role="status" aria-label="Cargando catálogo de productos">
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="ui-skeleton-card">
        <Skeleton height={164} radius={16} />
        <Skeleton height={14} width="46%" radius={8} />
        <Skeleton height={18} width="84%" radius={8} />
        <Skeleton height={22} width="38%" radius={8} />
        <Skeleton height={34} width="100%" radius={999} />
      </div>
    ))}
  </div>
);

export const TableRowsSkeleton: FC<{
  readonly rows?: number | undefined;
  readonly label?: string | undefined;
}> = ({ rows = 5, label = 'Cargando registros...' }) => (
  <div className="ui-skeleton-table" role="status" aria-label={label}>
    <div className="ui-skeleton-table__head">
      <Skeleton height={12} width="24%" radius={6} />
      <Skeleton height={12} width="18%" radius={6} />
      <Skeleton height={12} width="16%" radius={6} />
      <Skeleton height={12} width="14%" radius={6} />
    </div>
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="ui-skeleton-table__row">
        <div className="ui-skeleton-table__col">
          <Skeleton height={14} width={idx % 2 === 0 ? '74%' : '62%'} radius={7} />
          <Skeleton height={11} width="38%" radius={6} />
        </div>
        <Skeleton height={24} width={92} radius={999} />
        <Skeleton height={13} width={104} radius={6} />
        <Skeleton height={32} width={88} radius={999} />
      </div>
    ))}
  </div>
);

export const StopCardsSkeleton: FC<{
  readonly count?: number | undefined;
  readonly label?: string | undefined;
}> = ({ count = 3, label = 'Cargando paradas de ruta...' }) => (
  <div className="ui-skeleton-stops" role="status" aria-label={label}>
    {Array.from({ length: count }).map((_, idx) => (
      <div key={idx} className="ui-skeleton-stop">
        <div className="ui-skeleton-stop__top">
          <Skeleton height={24} width={86} radius={999} />
          <Skeleton height={24} width={96} radius={999} />
          <Skeleton height={24} width={102} radius={999} />
        </div>
        <Skeleton height={18} width="68%" radius={8} />
        <Skeleton height={13} width="46%" radius={6} />
      </div>
    ))}
  </div>
);

export const MapCanvasSkeleton: FC<{ readonly height?: number | undefined }> = ({ height = 380 }) => (
  <div
    className="ui-skeleton-map"
    style={{ height: `${height}px` }}
    role="status"
    aria-label="Preparando mapa de ruta"
  >
    <span className="ui-skeleton-map__pill">Trazando mapa y ruta…</span>
  </div>
);

export const ModuleFallbackSkeleton: FC = () => (
  <div className="ui-skeleton-module" role="status" aria-label="Cargando módulo">
    <div className="ui-skeleton-module__head">
      <Skeleton height={12} width={140} radius={6} />
      <Skeleton height={30} width={280} radius={10} />
    </div>
    <KpiStripSkeleton count={3} />
    <TableRowsSkeleton rows={4} />
  </div>
);

export const AppBootSkeleton: FC = () => (
  <div className="ui-boot-skeleton" role="status" aria-label="Restaurando la sesión activa">
    <div className="ui-boot-skeleton__nav">
      <Skeleton height={32} width={116} radius={999} />
      <div className="ui-boot-skeleton__tabs">
        <Skeleton height={30} width={82} radius={999} />
        <Skeleton height={30} width={82} radius={999} />
        <Skeleton height={30} width={82} radius={999} />
      </div>
      <Skeleton height={32} width={132} radius={999} />
    </div>
    <div className="ui-boot-skeleton__body">
      <ModuleFallbackSkeleton />
    </div>
  </div>
);

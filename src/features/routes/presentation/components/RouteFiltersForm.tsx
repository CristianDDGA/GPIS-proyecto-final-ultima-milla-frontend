import type { FC, FormEvent } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import type { RouteFilters } from '../../domain/index.js';
import { Button, Select, TextInput } from '../../../../shared/ui/index.js';

export interface RouteFiltersFormProps {
  filters: RouteFilters;
  zones: readonly Zone[];
  isLoading: boolean;
  onChange: (filters: RouteFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onRefresh: () => void;
}

export const RouteFiltersForm: FC<RouteFiltersFormProps> = ({
  filters,
  zones,
  isLoading,
  onChange,
  onApply,
  onReset,
  onRefresh,
}) => {
  const zoneOptions = [
    { value: '', label: 'Todas las zonas' },
    ...zones.map((zone) => ({ value: zone.id, label: zone.name })),
  ];

  const handleServiceDate = (serviceDate: string) => {
    onChange({ ...filters, serviceDate: serviceDate.length > 0 ? serviceDate : undefined });
  };

  const handleZone = (zoneId: string) => {
    onChange({ ...filters, zoneId: zoneId.length > 0 ? zoneId : undefined });
  };

  const handleLimit = (rawLimit: string) => {
    if (rawLimit.trim().length === 0) {
      onChange({ ...filters, limit: undefined });
      return;
    }
    const parsed = Number(rawLimit);
    onChange({ ...filters, limit: Number.isFinite(parsed) ? parsed : undefined });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onApply();
  };

  return (
    <form className="routes-filters" onSubmit={handleSubmit} aria-label="Filtrar rutas planificadas">
      <div className="routes-filters__grid">
        <TextInput
          label="Fecha de servicio"
          type="date"
          value={filters.serviceDate ?? ''}
          onChange={(event) => handleServiceDate(event.target.value)}
        />
        <Select
          label="Zona"
          options={zoneOptions}
          value={filters.zoneId ?? ''}
          onChange={(event) => handleZone(event.target.value)}
        />
        <TextInput
          label="Límite de resultados"
          type="number"
          min={1}
          max={100}
          value={filters.limit === undefined ? '' : String(filters.limit)}
          onChange={(event) => handleLimit(event.target.value)}
          helperText="Entre 1 y 100 rutas; vacío usa el valor del servidor."
        />
      </div>

      <div className="routes-filters__actions">
        <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
          Filtrar
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onReset} disabled={isLoading}>
          Limpiar filtros
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRefresh} isLoading={isLoading}>
          ↻ Actualizar
        </Button>
      </div>
    </form>
  );
};

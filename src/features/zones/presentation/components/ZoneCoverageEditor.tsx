import { useMemo, useState, type FC } from 'react';
import { Alert, Button, Modal, TextInput } from '../../../../shared/ui/index.js';
import {
  EcuadorMapPicker,
  type MapCoverageOverlay,
} from '../../../store/presentation/components/EcuadorMapPicker.js';
import {
  MAX_COVERAGE_RADIUS_KM,
  MIN_COVERAGE_RADIUS_KM,
  parseRadius,
  validateCoverage,
  type Zone,
  type ZoneCoverage,
} from '../../domain/index.js';

export interface ZoneCoverageEditorProps {
  readonly zone: Zone;
  /** Todas las zonas: las demás con cobertura se dibujan como referencia. */
  readonly zones: readonly Zone[];
  /** Devuelve `true` si se guardó. `null` quita la cobertura. */
  readonly onSave: (zoneId: string, coverage: ZoneCoverage | null) => Promise<boolean>;
  readonly onClose: () => void;
}

const DEFAULT_RADIUS_KM = 3;

export const ZoneCoverageEditor: FC<ZoneCoverageEditorProps> = ({ zone, zones, onSave, onClose }) => {
  const [latitude, setLatitude] = useState<number | null>(zone.coverage?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(zone.coverage?.longitude ?? null);
  const [radiusText, setRadiusText] = useState(String(zone.coverage?.radiusKm ?? DEFAULT_RADIUS_KM));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radiusKm = parseRadius(radiusText);

  const overlays = useMemo<readonly MapCoverageOverlay[]>(() => {
    const result: MapCoverageOverlay[] = [];
    for (const other of zones) {
      if (other.id !== zone.id && other.coverage) {
        result.push({
          id: other.id,
          name: other.name,
          latitude: other.coverage.latitude,
          longitude: other.coverage.longitude,
          radiusKm: other.coverage.radiusKm,
        });
      }
    }
    return result;
  }, [zones, zone.id]);

  const save = async (coverage: ZoneCoverage | null) => {
    setError(null);
    setIsSaving(true);
    try {
      const saved = await onSave(zone.id, coverage);
      if (saved) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = () => {
    if (latitude === null || longitude === null) {
      setError('Haz clic en el mapa para marcar el centro de la zona.');
      return;
    }
    const coverage = { latitude, longitude, radiusKm };
    const validation = validateCoverage(coverage);
    if (!validation.isValid) {
      setError(validation.error ?? 'Cobertura inválida.');
      return;
    }
    void save(coverage);
  };

  return (
    <Modal
      title={`Cobertura de ${zone.name}`}
      description="Marca el centro de la zona en el mapa y elige hasta cuántos km llega. Los pedidos dentro del círculo se asignarán solos a esta zona."
      size="lg"
      onClose={() => !isSaving && onClose()}
      footer={
        <>
          {zone.coverage && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={isSaving}
              onClick={() => void save(null)}
            >
              Quitar cobertura
            </Button>
          )}
          <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" isLoading={isSaving} onClick={handleSave}>
            Guardar cobertura
          </Button>
        </>
      }
    >
      <div className="zones-coverage">
        {error && (
          <Alert type="error" title="Revisa la cobertura" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <EcuadorMapPicker
          latitude={latitude}
          longitude={longitude}
          onChange={(coords) => {
            setLatitude(coords.latitude);
            setLongitude(coords.longitude);
          }}
          radiusKm={Number.isFinite(radiusKm) ? radiusKm : null}
          overlays={overlays}
          height={320}
          disabled={isSaving}
        />

        <div className="zones-coverage__radius">
          <TextInput
            id="zone-coverage-radius"
            label={`Radio de cobertura en km (${MIN_COVERAGE_RADIUS_KM} a ${MAX_COVERAGE_RADIUS_KM})`}
            type="text"
            inputMode="decimal"
            value={radiusText}
            onChange={(event) => setRadiusText(event.target.value)}
            disabled={isSaving}
          />
          <input
            type="range"
            aria-label="Ajustar el radio con el deslizador"
            min={MIN_COVERAGE_RADIUS_KM}
            max={20}
            step={0.1}
            value={Number.isFinite(radiusKm) ? Math.min(radiusKm, 20) : DEFAULT_RADIUS_KM}
            onChange={(event) => setRadiusText(event.target.value)}
            disabled={isSaving}
          />
        </div>

        {overlays.length > 0 && (
          <p className="zones-coverage__hint">
            En naranja se ven las otras zonas con cobertura, para que no se solapen ni dejen huecos.
          </p>
        )}
      </div>
    </Modal>
  );
};

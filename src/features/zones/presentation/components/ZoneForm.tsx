import { useMemo, useState, type FormEvent, type FC } from 'react';
import {
  MAX_COVERAGE_RADIUS_KM,
  MIN_COVERAGE_RADIUS_KM,
  parseRadius,
  findOverlappingZones,
  type Zone,
  validateCoverage,
  validateZoneName,
  ZONE_NAME_MAX_LENGTH,
  type ZoneCoverage,
} from '../../domain/index.js';
import { Alert, Button, TextInput } from '../../../../shared/ui/index.js';
import {
  EcuadorMapPicker,
  type MapCoverageOverlay,
} from '../../../store/presentation/components/EcuadorMapPicker.js';

export interface ZoneFormProps {
  /** Zonas existentes: se usan para avisar si la nueva se solapa con otra. */
  existingZones?: readonly Zone[] | undefined;
  /** Crea la zona con su cobertura. Devuelve `true` si se guardó. */
  onSubmit: (name: string, coverage: ZoneCoverage) => Promise<boolean>;
  isSubmitting?: boolean | undefined;
}

const DEFAULT_RADIUS_KM = 3;

export const ZoneForm: FC<ZoneFormProps> = ({ onSubmit, isSubmitting = false, existingZones = [] }) => {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [radiusText, setRadiusText] = useState(String(DEFAULT_RADIUS_KM));
  const [validationError, setValidationError] = useState<string | undefined>(undefined);
  const [mapError, setMapError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const radiusKm = parseRadius(radiusText);
  const overlaps =
    latitude !== null && longitude !== null && Number.isFinite(radiusKm)
      ? findOverlappingZones({ latitude, longitude, radiusKm }, existingZones)
      : [];

  const existingOverlays = useMemo<readonly MapCoverageOverlay[]>(
    () =>
      existingZones
        .filter((z): z is Zone & { coverage: ZoneCoverage } => z.coverage != null)
        .map((z) => ({
          id: z.id,
          name: z.name,
          latitude: z.coverage.latitude,
          longitude: z.coverage.longitude,
          radiusKm: z.coverage.radiusKm,
        })),
    [existingZones],
  );

  const handleNameChange = (value: string) => {
    setName(value);
    if (touched) {
      const validation = validateZoneName(value);
      setValidationError(validation.isValid ? undefined : validation.error);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    const nameValidation = validateZoneName(name);
    setValidationError(nameValidation.isValid ? undefined : nameValidation.error);
    if (!nameValidation.isValid) return;

    if (latitude === null || longitude === null) {
      setMapError('Busca el lugar o haz clic en el mapa para marcar el centro de la zona.');
      return;
    }
    const coverage = { latitude, longitude, radiusKm };
    const coverageValidation = validateCoverage(coverage);
    if (!coverageValidation.isValid) {
      setMapError(coverageValidation.error ?? 'Cobertura inválida.');
      return;
    }

    setMapError(null);
    const success = await onSubmit(name.trim(), coverage);

    if (success) {
      setName('');
      setLatitude(null);
      setLongitude(null);
      setRadiusText(String(DEFAULT_RADIUS_KM));
      setTouched(false);
    }
  };

  return (
    <form className="zones-form" onSubmit={handleSubmit} noValidate>
      <TextInput
        id="zone-name-input"
        label="Nombre de la Zona"
        placeholder="Ej. Ambato Centro"
        value={name}
        onChange={(e) => handleNameChange(e.target.value)}
        onBlur={() => {
          setTouched(true);
          const validation = validateZoneName(name);
          setValidationError(validation.isValid ? undefined : validation.error);
        }}
        error={validationError}
        isRequired
        disabled={isSubmitting}
        maxLength={ZONE_NAME_MAX_LENGTH}
        autoComplete="off"
      />

      <p className="zones-form__hint">
        Una zona existe en el mapa: busca el lugar, marca su centro y elige hasta cuántos km llega. Sin cobertura no
        recibe pedidos.
      </p>

      {mapError && (
        <Alert type="error" title="Falta la cobertura">
          {mapError}
        </Alert>
      )}

      <EcuadorMapPicker
        latitude={latitude}
        longitude={longitude}
        onChange={(coords) => {
          setLatitude(coords.latitude);
          setLongitude(coords.longitude);
          setMapError(null);
        }}
        onAddressSuggested={(suggested) => {
          if (name.trim().length === 0) {
            const proposal = suggested.split(',')[0]?.trim() ?? '';
            if (proposal.length > 0) handleNameChange(proposal.slice(0, ZONE_NAME_MAX_LENGTH));
          }
        }}
        radiusKm={Number.isFinite(radiusKm) ? radiusKm : null}
        overlays={existingOverlays}
        emptyHint="Aún no marcas el centro de la zona. Haz clic en el mapa o busca el lugar dentro de Ecuador."
        height={360}
        disabled={isSubmitting}
      />

      {overlaps.length > 0 && (
        <Alert type="warning" title="Se solapa con otra zona">
          Esta área se cruza con {overlaps.map((zone) => zone.name).join(', ')}. Un punto en la parte compartida se asigna a la zona
          de centro más cercano.
        </Alert>
      )}

      <div className="zones-coverage__radius">
        <TextInput
          id="zone-new-radius"
          label={`Radio de cobertura en km (${MIN_COVERAGE_RADIUS_KM} a ${MAX_COVERAGE_RADIUS_KM})`}
          type="text"
          inputMode="decimal"
          value={radiusText}
          onChange={(event) => setRadiusText(event.target.value)}
          disabled={isSubmitting}
        />
        <input
          type="range"
          aria-label="Ajustar el radio con el deslizador"
          min={MIN_COVERAGE_RADIUS_KM}
          max={20}
          step={0.1}
          value={Number.isFinite(radiusKm) ? Math.min(radiusKm, 20) : DEFAULT_RADIUS_KM}
          onChange={(event) => setRadiusText(event.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="zones-form__actions">
        <Button type="submit" variant="primary" isLoading={isSubmitting} disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : 'Crear Zona'}
        </Button>
      </div>
    </form>
  );
};

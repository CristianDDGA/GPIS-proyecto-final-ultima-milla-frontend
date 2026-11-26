import { useMemo, useState, type FormEvent, type FC } from 'react';
import { isPointInCoverage, isZoneActive, type Zone } from '../../../zones/domain/index.js';
import {
  validateOrder,
  type CreateOrderInput,
  type OrderValidationErrors,
} from '../../domain/index.js';
import { Button, TextInput, Select, Alert } from '../../../../shared/ui/index.js';
import {
  EcuadorMapPicker,
  type MapCoverageOverlay,
} from '../../../store/presentation/components/EcuadorMapPicker.js';

export interface OrderFormProps {
  zones: Zone[];
  isLoadingZones: boolean;
  onSubmit: (input: CreateOrderInput) => Promise<boolean>;
  isSubmitting?: boolean | undefined;
}

type TextField = 'zoneId' | 'deliveryAddress' | 'deliveryDate' | 'deliveryTime';

const initialFormState: CreateOrderInput = {
  zoneId: '',
  deliveryAddress: '',
  deliveryDate: '',
  deliveryTime: '',
};

export const OrderForm: FC<OrderFormProps> = ({
  zones,
  isLoadingZones,
  onSubmit,
  isSubmitting = false,
}) => {
  const [formData, setFormData] = useState<CreateOrderInput>(initialFormState);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [errors, setErrors] = useState<OrderValidationErrors>({});
  const [touched, setTouched] = useState<Partial<Record<TextField, boolean>>>({});

  const hasNoZones = !isLoadingZones && zones.length === 0;
  const selectedZone = zones.find((zone) => zone.id === formData.zoneId);

  /** Reglas de dominio más la comprobación contra el círculo de cobertura de la zona elegida. */
  const validateAll = (data: CreateOrderInput, lat: number | null, lng: number | null): OrderValidationErrors => {
    const result = validateOrder({ ...data, latitude: lat, longitude: lng }, { requirePin: true }).errors;
    if (
      result.location === undefined &&
      lat !== null &&
      lng !== null &&
      selectedZone?.coverage &&
      !isPointInCoverage(selectedZone.coverage, lat, lng)
    ) {
      result.location = `El punto marcado queda fuera de la zona "${selectedZone.name}". Elige otro punto o cambia de zona.`;
    }
    return result;
  };

  const validateField = (field: TextField, value: string) => {
    const validation = validateAll({ ...formData, [field]: value }, latitude, longitude);
    setErrors((prev) => ({
      ...prev,
      [field]: validation[field],
      ...(field === 'zoneId' ? { location: validation.location } : {}),
    }));
  };

  const handleChange = (field: TextField, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const handleBlur = (field: TextField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  const handlePinChange = (lat: number | null, lng: number | null) => {
    setLatitude(lat);
    setLongitude(lng);
    setErrors((prev) => ({ ...prev, location: validateAll(formData, lat, lng).location }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setTouched({
      zoneId: true,
      deliveryAddress: true,
      deliveryDate: true,
      deliveryTime: true,
    });

    const validation = validateAll(formData, latitude, longitude);
    if (Object.values(validation).some(Boolean)) {
      setErrors(validation);
      return;
    }

    setErrors({});
    const success = await onSubmit({ ...formData, latitude, longitude });

    if (success) {
      setFormData(initialFormState);
      setLatitude(null);
      setLongitude(null);
      setTouched({});
    }
  };

  // Una zona inactiva no recibe pedidos: no se ofrece al crear uno.
  const zoneOptions = zones.filter(isZoneActive).map((z) => ({
    value: z.id,
    label: z.name,
  }));

  // La cobertura de la zona elegida se dibuja como referencia para marcar el punto dentro.
  const overlays = useMemo<readonly MapCoverageOverlay[]>(
    () =>
      selectedZone?.coverage
        ? [
            {
              id: selectedZone.id,
              name: selectedZone.name,
              latitude: selectedZone.coverage.latitude,
              longitude: selectedZone.coverage.longitude,
              radiusKm: selectedZone.coverage.radiusKm,
            },
          ]
        : [],
    [selectedZone],
  );

  return (
    <form className="orders-form" onSubmit={handleSubmit} noValidate>
      {hasNoZones && (
        <Alert type="warning" title="Sin zonas registradas">
          Debes registrar al menos una zona de distribución en la pestaña &quot;Zonas de Entrega&quot;
          antes de poder generar pedidos.
        </Alert>
      )}

      <Select
        id="order-zone-select"
        label="Zona de Cobertura"
        placeholder={isLoadingZones ? 'Cargando zonas...' : 'Selecciona una zona...'}
        options={zoneOptions}
        value={formData.zoneId}
        onChange={(e) => handleChange('zoneId', e.target.value)}
        onBlur={() => handleBlur('zoneId')}
        error={touched.zoneId ? errors.zoneId : undefined}
        isRequired
        disabled={isSubmitting || isLoadingZones || hasNoZones}
      />

      <div className="orders-form__map">
        <EcuadorMapPicker
          latitude={latitude}
          longitude={longitude}
          onChange={(coords) => handlePinChange(coords.latitude, coords.longitude)}
          onAddressSuggested={(suggested) => {
            if (formData.deliveryAddress.trim().length === 0) handleChange('deliveryAddress', suggested.slice(0, 200));
          }}
          overlays={overlays}
          emptyHint="Marca en el mapa el punto exacto de entrega: debe quedar dentro del círculo de la zona."
          height={340}
          disabled={isSubmitting || hasNoZones}
        />
        {errors.location && (
          <p className="orders-form__map-error" role="alert">
            {errors.location}
          </p>
        )}
      </div>

      <TextInput
        id="order-address-input"
        label="Dirección de Entrega"
        placeholder="Ej. Calle 10 de Agosto N24-102 y Orellana"
        value={formData.deliveryAddress}
        onChange={(e) => handleChange('deliveryAddress', e.target.value)}
        onBlur={() => handleBlur('deliveryAddress')}
        error={touched.deliveryAddress ? errors.deliveryAddress : undefined}
        isRequired
        disabled={isSubmitting || hasNoZones}
        maxLength={200}
        autoComplete="street-address"
      />

      <div className="orders-form__row">
        <TextInput
          id="order-date-input"
          type="date"
          label="Fecha de Entrega"
          value={formData.deliveryDate}
          onChange={(e) => handleChange('deliveryDate', e.target.value)}
          onBlur={() => handleBlur('deliveryDate')}
          error={touched.deliveryDate ? errors.deliveryDate : undefined}
          isRequired
          disabled={isSubmitting || hasNoZones}
        />

        <TextInput
          id="order-time-input"
          type="time"
          label="Hora de Entrega"
          value={formData.deliveryTime}
          onChange={(e) => handleChange('deliveryTime', e.target.value)}
          onBlur={() => handleBlur('deliveryTime')}
          error={touched.deliveryTime ? errors.deliveryTime : undefined}
          isRequired
          disabled={isSubmitting || hasNoZones}
        />
      </div>

      <div className="orders-form__actions">
        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting || hasNoZones}
        >
          {isSubmitting ? 'Registrando...' : 'Crear Pedido'}
        </Button>
      </div>
    </form>
  );
};

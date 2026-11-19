import type { FC, FormEvent } from 'react';
import {
  LICENSE_CATEGORIES,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  type ApplicationDraftInput,
  type VehicleType,
} from '../../domain/index.js';
import { Button, Card, Select, TextInput } from '../../../../shared/ui/index.js';

export interface ClientApplicationFormCardProps {
  readonly draft: ApplicationDraftInput;
  readonly errors: Record<string, string>;
  readonly hasExistingDraft: boolean;
  readonly isSaving: boolean;
  readonly onUpdateField: <K extends keyof ApplicationDraftInput>(
    field: K,
    value: ApplicationDraftInput[K],
  ) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

const VEHICLE_OPTIONS = VEHICLE_TYPES.map((type) => ({
  value: type,
  label: VEHICLE_TYPE_LABELS[type],
}));

const LICENSE_CATEGORY_OPTIONS = LICENSE_CATEGORIES.map((category) => ({
  value: category,
  label: `Categoría ${category}`,
}));

export const ClientApplicationFormCard: FC<ClientApplicationFormCardProps> = ({
  draft,
  errors,
  hasExistingDraft,
  isSaving,
  onUpdateField,
  onSubmit,
}) => (
  <Card variant="elevated" className="wf-client-card">
    <h3 className="wf-client-card__title">Datos personales y licencia</h3>
    <form className="wf-client-form" onSubmit={onSubmit} noValidate>
      <TextInput
        id="client-app-fullname"
        label="Nombre completo"
        placeholder="Nombres y apellidos"
        value={draft.fullName}
        onChange={(event) => onUpdateField('fullName', event.target.value)}
        error={errors['fullName']}
        isRequired
        maxLength={120}
        disabled={isSaving}
        autoComplete="name"
      />

      <div className="wf-client-form__row">
        <TextInput
          id="client-app-national-id"
          label="Cédula ecuatoriana"
          placeholder="10 dígitos"
          value={draft.nationalId}
          onChange={(event) => onUpdateField('nationalId', event.target.value)}
          error={errors['nationalId']}
          isRequired
          maxLength={10}
          inputMode="numeric"
          disabled={isSaving}
        />

        <TextInput
          id="client-app-phone"
          label="Teléfono"
          placeholder="0991234567"
          value={draft.phone}
          onChange={(event) => onUpdateField('phone', event.target.value)}
          error={errors['phone']}
          isRequired
          maxLength={20}
          inputMode="tel"
          disabled={isSaving}
          autoComplete="tel"
        />
      </div>

      <div className="wf-client-form__row">
        <TextInput
          id="client-app-birthdate"
          label="Fecha de nacimiento"
          type="date"
          value={draft.birthDate}
          onChange={(event) => onUpdateField('birthDate', event.target.value)}
          error={errors['birthDate']}
          isRequired
          disabled={isSaving}
        />

        <Select
          id="client-app-vehicle"
          label="Tipo de vehículo"
          options={VEHICLE_OPTIONS}
          value={draft.vehicleType}
          onChange={(event) => onUpdateField('vehicleType', event.target.value as VehicleType)}
          error={errors['vehicleType']}
          isRequired
          disabled={isSaving}
        />
      </div>

      <div className="wf-client-form__row">
        <TextInput
          id="client-app-license-number"
          label="Número de licencia"
          placeholder="Ej. EC-17234567"
          value={draft.licenseNumber}
          onChange={(event) => onUpdateField('licenseNumber', event.target.value)}
          error={errors['licenseNumber']}
          isRequired
          maxLength={20}
          disabled={isSaving}
        />

        <Select
          id="client-app-license-category"
          label="Categoría"
          options={LICENSE_CATEGORY_OPTIONS}
          value={draft.licenseCategory}
          onChange={(event) => onUpdateField('licenseCategory', event.target.value)}
          error={errors['licenseCategory']}
          isRequired
          disabled={isSaving}
        />
      </div>

      <TextInput
        id="client-app-license-expires"
        label="Fecha de caducidad de la licencia"
        type="date"
        value={draft.licenseExpiresOn}
        onChange={(event) => onUpdateField('licenseExpiresOn', event.target.value)}
        error={errors['licenseExpiresOn']}
        isRequired
        disabled={isSaving}
      />

      <div className="wf-client-form__actions">
        <Button type="submit" variant="primary" isLoading={isSaving} disabled={isSaving}>
          {hasExistingDraft ? 'Guardar cambios' : 'Guardar borrador'}
        </Button>
      </div>
    </form>
  </Card>
);

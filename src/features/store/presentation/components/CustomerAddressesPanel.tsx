import { useCallback, useEffect, useState, type FC, type FormEvent } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Modal,
  Select,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import {
  MAX_ADDRESSES,
  googleMapsDirectionsUrl,
  osmDirectionsUrl,
  type StoreAddress,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';
import { EcuadorMapPicker } from './EcuadorMapPicker.js';

export interface CustomerAddressesPanelProps {
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
  readonly onAddressesChanged?: ((items: readonly StoreAddress[]) => void) | undefined;
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export const CustomerAddressesPanel: FC<CustomerAddressesPanelProps> = ({
  storeGateway,
  zones,
  onAddressesChanged,
}) => {
  const [addresses, setAddresses] = useState<readonly StoreAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState<StoreAddress | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await storeGateway.listAddresses();
      setAddresses(items);
      onAddressesChanged?.(items);
    } catch (err) {
      setError(errMsg(err, 'No se pudo cargar tu libreta de direcciones.'));
    } finally {
      setIsLoading(false);
    }
  }, [storeGateway, onAddressesChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setLabel('');
    setZoneId(zones[0]?.id ?? '');
    setAddress('');
    setRecipientName('');
    setRecipientPhone('');
    setIsDefault(addresses.length === 0);
    setLatitude(null);
    setLongitude(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEdit = (item: StoreAddress) => {
    setEditing(item);
    setLabel(item.label);
    setZoneId(item.zoneId);
    setAddress(item.address);
    setRecipientName(item.recipientName ?? '');
    setRecipientPhone(item.recipientPhone ?? '');
    setIsDefault(item.isDefault);
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (label.trim().length < 2 || zoneId.length === 0 || address.trim().length < 6) {
      setFormError('Completa el nombre, la zona y una dirección válida (mínimo 6 caracteres).');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await storeGateway.updateAddress(editing.id, {
          expectedVersion: editing.version,
          label,
          zoneId,
          address,
          recipientName,
          recipientPhone,
          ...(isDefault && !editing.isDefault ? { isDefault: true } : {}),
          latitude,
          longitude,
        });
        setNotice('Dirección actualizada correctamente.');
      } else {
        await storeGateway.createAddress({
          label,
          zoneId,
          address,
          recipientName,
          recipientPhone,
          isDefault,
          latitude,
          longitude,
        });
        setNotice('Dirección guardada en tu libreta.');
      }
      setIsModalOpen(false);
      await load();
    } catch (err) {
      setFormError(errMsg(err, 'No se pudo guardar la dirección.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      await storeGateway.deleteAddress(id);
      setNotice('Dirección eliminada.');
      await load();
    } catch (err) {
      setError(errMsg(err, 'No se pudo eliminar la dirección.'));
    } finally {
      setDeletingId(null);
    }
  };

  const zoneNameOf = (id: string) => zones.find((z) => z.id === id)?.name ?? 'Zona';

  return (
    <Card className="store-card">
      <div className="store-card__header">
        <div>
          <h3 className="store-card__title">Libreta de direcciones</h3>
          <p className="store-card__subtitle">
            Guarda hasta {MAX_ADDRESSES} direcciones frecuentes con pin opcional en el mapa de Ecuador.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={addresses.length >= MAX_ADDRESSES || zones.length === 0}
          onClick={openCreate}
        >
          + Nueva dirección
        </Button>
      </div>

      {error && (
        <Alert type="error" title="Atención" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert type="success" title="Libreta actualizada" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {isLoading && addresses.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}>
          <Spinner size="md" label="Cargando libreta..." />
        </div>
      ) : addresses.length === 0 ? (
        <EmptyState
          title="Aún no tienes direcciones guardadas"
          description="Agrega tu casa u oficina para acelerar tus compras y fijar el punto exacto en el mapa."
          action={
            <Button type="button" variant="primary" size="sm" onClick={openCreate} disabled={zones.length === 0}>
              Agregar primera dirección
            </Button>
          }
        />
      ) : (
        <ul className="store-stop-list" aria-label="Direcciones guardadas">
          {addresses.map((item) => (
            <li key={item.id} className="store-stop-card">
              <div className="store-stop-card__head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong>{item.label}</strong>
                    {item.isDefault && <span className="store-pill store-pill--blue">Predeterminada</span>}
                    <span className="store-pill">{zoneNameOf(item.zoneId)}</span>
                  </div>
                  <p style={{ marginTop: '6px' }}>{item.address}</p>
                  {(item.recipientName || item.recipientPhone) && (
                    <p className="store-card__subtitle" style={{ marginTop: '2px' }}>
                      {item.recipientName ?? ''}
                      {item.recipientPhone ? ` · ${item.recipientPhone}` : ''}
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {item.latitude !== null && item.longitude !== null && (
                    <>
                      <a
                        href={osmDirectionsUrl(item.latitude, item.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        className="store-map-link"
                      >
                        Ver en mapa
                      </a>
                      <a
                        href={googleMapsDirectionsUrl(item.latitude, item.longitude)}
                        target="_blank"
                        rel="noreferrer"
                        className="store-map-link"
                      >
                        Google Maps
                      </a>
                    </>
                  )}
                  <Button type="button" variant="secondary" size="sm" onClick={() => openEdit(item)}>
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    isLoading={deletingId === item.id}
                    onClick={() => void handleDelete(item.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isModalOpen && (
        <Modal
          title={editing ? 'Editar dirección' : 'Nueva dirección'}
          size="lg"
          onClose={() => !isSaving && setIsModalOpen(false)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isSaving}
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="customer-address-form"
                variant="primary"
                size="sm"
                isLoading={isSaving}
              >
                {editing ? 'Guardar cambios' : 'Guardar dirección'}
              </Button>
            </>
          }
        >
          <form id="customer-address-form" className="store-form" onSubmit={handleSave}>
            {formError && (
              <Alert type="error" title="Revisa los datos">
                {formError}
              </Alert>
            )}

            <div className="store-form__row">
              <TextInput
                id="addr-label"
                label="Nombre de la dirección"
                placeholder="Ej. Casa, Oficina"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                isRequired
                maxLength={60}
              />
              <Select
                id="addr-zone"
                label="Zona de cobertura"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                options={zones.map((z) => ({ value: z.id, label: z.name }))}
                isRequired
              />
            </div>

            <TextInput
              id="addr-line"
              label="Dirección exacta"
              placeholder="Ej. Av. Amazonas N34-120 y República"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              isRequired
              maxLength={200}
            />

            <div className="store-form__row">
              <TextInput
                id="addr-recipient"
                label="Destinatario (opcional)"
                placeholder="Ej. Sofía Montalvo"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                maxLength={100}
              />
              <TextInput
                id="addr-phone"
                label="Teléfono (opcional)"
                placeholder="Ej. +593 99 123 4567"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                maxLength={30}
              />
            </div>

            <EcuadorMapPicker
              latitude={latitude}
              longitude={longitude}
              onChange={({ latitude: lat, longitude: lng }) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
              onAddressSuggested={(suggested) => {
                if (address.trim().length === 0) setAddress(suggested);
              }}
              disabled={isSaving}
            />

            <label className="store-checkbox">
              <input
                type="checkbox"
                checked={isDefault}
                disabled={Boolean(editing?.isDefault)}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span>Usar como dirección predeterminada</span>
            </label>
          </form>
        </Modal>
      )}
    </Card>
  );
};

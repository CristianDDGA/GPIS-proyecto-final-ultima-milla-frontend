import { useCallback, useEffect, useState, type FC, type FormEvent } from 'react';
import type { AuthUseCases, UserProfile } from '../../../auth/index.js';
import type { Zone } from '../../../zones/domain/index.js';
import { Alert, Button, Card, Modal, SectionHeader, Spinner, TextInput } from '../../../../shared/ui/index.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';
import { CustomerAddressesPanel } from './CustomerAddressesPanel.js';
import '../styles/store.css';
import '../styles/client.css';

export interface ClientProfileViewProps {
  readonly authUseCases: Pick<AuthUseCases, 'getProfile' | 'updateProfile'>;
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
  readonly onOpenOrders: () => void;
  readonly onOpenPassword: () => void;
  readonly onOpenCourierApplication: () => void;
  readonly onLogout: () => void;
  /** Avisa que cambió el nombre, para refrescar el saludo de la barra. */
  readonly onProfileUpdated?: (() => void) | undefined;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return '·';
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '')).toUpperCase();
}

function memberSince(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', { timeZone: 'America/Guayaquil', month: 'long', year: 'numeric' }).format(date);
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export const ClientProfileView: FC<ClientProfileViewProps> = ({
  authUseCases,
  storeGateway,
  zones,
  onOpenOrders,
  onOpenPassword,
  onOpenCourierApplication,
  onLogout,
  onProfileUpdated,
}) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProfile(await authUseCases.getProfile.execute());
    } catch (err) {
      setError(errMsg(err, 'No pudimos cargar tu perfil.'));
    }
  }, [authUseCases]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = () => {
    setName(profile?.displayName ?? '');
    setPhone(profile?.phone ?? '');
    setEditError(null);
    setEditOpen(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setEditError(null);
    try {
      const updated = await authUseCases.updateProfile.execute({ displayName: name, phone });
      setProfile(updated);
      setEditOpen(false);
      setNotice('Guardamos tus datos.');
      onProfileUpdated?.();
    } catch (err) {
      setEditError(errMsg(err, 'No pudimos guardar tus datos.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (profile === null) {
    return error ? (
      <Alert type="error" title="Atención" onClose={() => void load()}>
        {error}
      </Alert>
    ) : (
      <div className="wf-loading-card wf-loading-card--inline">
        <Spinner size="md" label="Cargando tu perfil" />
        <p role="status">Cargando tu perfil...</p>
      </div>
    );
  }

  const fullName = profile.displayName?.trim() || profile.email;

  return (
    <section className="client-stack" aria-labelledby="client-profile-title">
      <SectionHeader title="Mi perfil" />
      {notice && (
        <Alert type="success" title="Listo" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      <div className="client-grid">
        <aside className="client-grid__side">
          <Card className="store-card client-profile-hero">
            <span className="client-avatar-lg" aria-hidden="true">
              {initialsOf(fullName)}
            </span>
            <h2 id="client-profile-title" className="client-heading">
              {fullName}
            </h2>
            <p className="client-muted">Cliente desde {memberSince(profile.createdAt)}</p>
            <div className="client-filter" style={{ justifyContent: 'center' }}>
              {profile.emailVerified && <span className="store-pill store-pill--green">Correo verificado</span>}
              {profile.googleLinked && <span className="store-pill store-pill--blue">Conectado con Google</span>}
            </div>
            <div className="client-stack" style={{ width: '100%', gap: '10px' }}>
              <Button type="button" variant="secondary" onClick={onOpenOrders}>
                Mis pedidos
              </Button>
              <Button type="button" variant="secondary" onClick={onLogout}>
                Cerrar sesión
              </Button>
            </div>
          </Card>
        </aside>

        <div className="client-grid__main">
          <Card className="store-card">
            <div className="store-card__header">
              <h3 className="store-card__title">Mis datos</h3>
              <Button type="button" variant="ghost" size="sm" onClick={openEdit}>
                Editar
              </Button>
            </div>
            <div className="client-fields">
              <div>
                <p className="client-label">Nombre</p>
                <p>{profile.displayName ?? 'Sin nombre'}</p>
              </div>
              <div>
                <p className="client-label">Correo</p>
                <p style={{ overflowWrap: 'anywhere' }}>{profile.email}</p>
              </div>
              <div>
                <p className="client-label">Teléfono</p>
                <p className={profile.phone ? '' : 'client-muted'}>
                  {profile.phone ?? 'Agrégalo para que el repartidor pueda llamarte'}
                </p>
              </div>
              <div>
                <p className="client-label">Inicio de sesión</p>
                <p>
                  {profile.hasPassword && profile.googleLinked
                    ? 'Con contraseña y con Google'
                    : profile.googleLinked
                      ? 'Con Google'
                      : 'Con contraseña'}
                </p>
              </div>
            </div>
          </Card>

          <CustomerAddressesPanel storeGateway={storeGateway} zones={zones} />

          <Card className="store-card">
            <h3 className="store-card__title">Seguridad</h3>
            {profile.hasPassword ? (
              <>
                <p className="client-muted">Cambia tu contraseña cuando quieras.</p>
                <div>
                  <Button type="button" variant="secondary" size="sm" onClick={onOpenPassword}>
                    Cambiar contraseña
                  </Button>
                </div>
              </>
            ) : (
              <p className="client-muted">Entras con tu cuenta de Google, así que no necesitas una contraseña aquí.</p>
            )}
          </Card>

          <Card className="store-card">
            <div className="store-card__header">
              <div>
                <h3 className="store-card__title">¿Quieres repartir con Millast?</h3>
                <p className="store-card__subtitle">Llena tus datos y sube tu licencia. Te respondemos por correo.</p>
              </div>
              <Button type="button" variant="primary" size="sm" onClick={onOpenCourierApplication}>
                Postular
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {editOpen && (
        <Modal
          title="Editar mis datos"
          size="sm"
          onClose={() => !isSaving && setEditOpen(false)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isSaving} onClick={() => setEditOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="client-profile-form" variant="primary" size="sm" isLoading={isSaving}>
                Guardar
              </Button>
            </>
          }
        >
          <form id="client-profile-form" className="store-form" onSubmit={save} noValidate>
            {editError && <Alert type="error" title="Revisa tus datos">{editError}</Alert>}
            <TextInput
              id="client-profile-name"
              label="Nombre y apellido"
              value={name}
              maxLength={120}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
            />
            <TextInput
              id="client-profile-phone"
              label="Teléfono"
              placeholder="Ej. 099 123 4567"
              helperText="Lo usamos solo para coordinar tus entregas."
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              maxLength={20}
              onChange={(event) => setPhone(event.target.value)}
            />
          </form>
        </Modal>
      )}
    </section>
  );
};

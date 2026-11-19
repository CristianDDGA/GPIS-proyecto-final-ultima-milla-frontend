import { useState, type FC, type FormEvent } from 'react';
import type { CourierApplicationUseCases } from '../../application/index.js';
import {
  APPLICATION_STATUS_LABELS,
  FILE_KINDS,
  FILE_KIND_LABELS,
  VEHICLE_TYPE_LABELS,
} from '../../domain/index.js';
import { Alert, Button, Card, KineticHeader, Spinner } from '../../../../shared/ui/index.js';
import { useMyCourierApplication } from '../hooks/useMyCourierApplication.js';
import { ClientApplicationDocumentsCard } from './ClientApplicationDocumentsCard.js';
import { ClientApplicationFormCard } from './ClientApplicationFormCard.js';
import '../styles/client-application.css';

export interface ClientCourierApplicationViewProps {
  readonly useCases: CourierApplicationUseCases;
  readonly defaultFullName?: string | undefined;
}

function formatDate(isoDate: string | null): string {
  if (isoDate === null) {
    return '—';
  }
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date);
}

/**
 * Vista de autopostulación a repartidor para cuentas con rol Cliente:
 * gestiona borrador, documentos JPEG/PNG, envío, revisión y cancelación.
 */
export const ClientCourierApplicationView: FC<ClientCourierApplicationViewProps> = ({
  useCases,
  defaultFullName = '',
}) => {
  const {
    application,
    draft,
    fieldErrors,
    fileUrls,
    isLoading,
    isSavingDraft,
    uploadingKind,
    isSubmitting,
    isCancelling,
    error,
    successMessage,
    updateField,
    reload,
    saveDraft,
    uploadFile,
    submitApplication,
    cancelApplication,
    clearFeedback,
  } = useMyCourierApplication(useCases, defaultFullName);

  const [confirmCancelPending, setConfirmCancelPending] = useState(false);

  const status = application?.status ?? null;
  const isReadOnlyStatus = status === 'pendiente' || status === 'aprobada';

  const handleSaveSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void saveDraft();
  };

  return (
    <section className="wf-client-layout" aria-labelledby="client-application-title">
      <KineticHeader
        id="client-application-title"
        level="h2"
        title="Postulación a repartidor"
        actions={
          <div className="wf-client-header-actions">
            {status !== null && (
              <span className={`wf-client-status wf-client-status--${status}`}>
                {APPLICATION_STATUS_LABELS[status]}
              </span>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={isLoading}
              onClick={() => void reload()}
            >
              {isLoading ? 'Actualizando...' : '↻ Actualizar'}
            </Button>
          </div>
        }
      />

      {error !== null && (
        <Alert type="error" title="Atención" onClose={clearFeedback}>
          {error}
        </Alert>
      )}

      {successMessage !== null && (
        <Alert type="success" title="Actualización" onClose={clearFeedback}>
          {successMessage}
        </Alert>
      )}

      {isLoading && application === null ? (
        <Card variant="outlined" className="wf-client-loading">
          <Spinner size="md" label="Consultando solicitud..." />
          <p role="status">Consultando el estado de tu solicitud...</p>
        </Card>
      ) : isReadOnlyStatus && application !== null ? (
        <div className="wf-client-grid">
          <Card variant="elevated" className="wf-client-card">
            <h3 className="wf-client-card__title">
              {status === 'aprobada' ? 'Solicitud aprobada' : 'Solicitud en revisión'}
            </h3>

            {status === 'aprobada' ? (
              <Alert type="success" title="Cuenta promovida a repartidor">
                Tu postulación fue aprobada con capacidad de{' '}
                <strong>{application.approvedCapacity ?? 10}</strong> pedidos por viaje. Cierra
                sesión y vuelve a ingresar para activar la vista de repartidor.
              </Alert>
            ) : (
              <Alert type="info" title="Pendiente de revisión">
                Tu solicitud fue enviada el {formatDate(application.submittedAt)} y está siendo
                revisada por el equipo administrador.
              </Alert>
            )}

            <dl className="wf-client-detail">
              <div>
                <dt>Nombre completo</dt>
                <dd>{application.fullName}</dd>
              </div>
              <div>
                <dt>Cédula</dt>
                <dd>{application.nationalId}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{application.phone}</dd>
              </div>
              <div>
                <dt>Nacimiento</dt>
                <dd>{application.birthDate}</dd>
              </div>
              <div>
                <dt>Vehículo</dt>
                <dd>{VEHICLE_TYPE_LABELS[application.vehicleType]}</dd>
              </div>
              <div>
                <dt>Licencia</dt>
                <dd>
                  {application.licenseCategory} · {application.licenseNumber}
                </dd>
              </div>
              <div>
                <dt>Caducidad</dt>
                <dd>{application.licenseExpiresOn}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{APPLICATION_STATUS_LABELS[application.status]}</dd>
              </div>
            </dl>

            {status === 'pendiente' && (
              <div className="wf-client-cancel-bar">
                {confirmCancelPending ? (
                  <div className="wf-client-confirm">
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      isLoading={isCancelling}
                      onClick={() => {
                        void cancelApplication().then((cancelled) => {
                          if (cancelled) {
                            setConfirmCancelPending(false);
                          }
                        });
                      }}
                    >
                      Sí, cancelar solicitud
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isCancelling}
                      onClick={() => setConfirmCancelPending(false)}
                    >
                      Volver
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmCancelPending(true)}
                  >
                    Cancelar solicitud
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card variant="elevated" className="wf-client-card">
            <h3 className="wf-client-card__title">Documentos enviados</h3>
            <div className="wf-client-files">
              {FILE_KINDS.map((kind) => (
                <div key={kind} className="wf-client-file">
                  <p className="wf-client-file__title">{FILE_KIND_LABELS[kind]}</p>
                  {fileUrls[kind] !== undefined ? (
                    <img
                      className="wf-client-file__preview"
                      src={fileUrls[kind]}
                      alt={FILE_KIND_LABELS[kind]}
                    />
                  ) : (
                    <p className="wf-client-file__meta">Documento adjuntado</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      ) : (
        <>
          {application?.status === 'rechazada' && (
            <Alert type="warning" title="Solicitud rechazada anteriormente">
              {application.rejectionReason !== null
                ? `Motivo registrado: ${application.rejectionReason}. Puedes corregir los datos y guardar un nuevo borrador.`
                : 'Puedes corregir tus datos y guardar un nuevo borrador para postularte nuevamente.'}
            </Alert>
          )}

          {application?.status === 'cancelada' && (
            <Alert type="info" title="Solicitud anterior cancelada">
              Puedes actualizar tus datos y guardar un nuevo borrador cuando desees postularte.
            </Alert>
          )}

          <div className="wf-client-grid">
            <ClientApplicationFormCard
              draft={draft}
              errors={fieldErrors}
              hasExistingDraft={status === 'borrador'}
              isSaving={isSavingDraft}
              onUpdateField={updateField}
              onSubmit={handleSaveSubmit}
            />

            <ClientApplicationDocumentsCard
              application={application}
              fileUrls={fileUrls}
              uploadingKind={uploadingKind}
              isSubmitting={isSubmitting}
              isCancelling={isCancelling}
              onUploadFile={uploadFile}
              onSubmitApplication={submitApplication}
              onCancelApplication={cancelApplication}
            />
          </div>
        </>
      )}
    </section>
  );
};

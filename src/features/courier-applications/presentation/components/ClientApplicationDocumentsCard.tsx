import { useState, type ChangeEvent, type FC } from 'react';
import {
  FILE_KINDS,
  FILE_KIND_LABELS,
  type CourierApplication,
  type FileKind,
} from '../../domain/index.js';
import { Alert, Button, Card } from '../../../../shared/ui/index.js';

export interface ClientApplicationDocumentsCardProps {
  readonly application: CourierApplication | null;
  readonly fileUrls: Partial<Record<FileKind, string>>;
  readonly uploadingKind: FileKind | null;
  readonly isSubmitting: boolean;
  readonly isCancelling: boolean;
  readonly onUploadFile: (kind: FileKind, file: File) => Promise<void>;
  readonly onSubmitApplication: () => Promise<boolean>;
  readonly onCancelApplication: () => Promise<boolean>;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.round(kb)} KB`;
}

export const ClientApplicationDocumentsCard: FC<ClientApplicationDocumentsCardProps> = ({
  application,
  fileUrls,
  uploadingKind,
  isSubmitting,
  isCancelling,
  onUploadFile,
  onSubmitApplication,
  onCancelApplication,
}) => {
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const isDraft = application?.status === 'borrador';
  const uploadedFiles = application?.files ?? [];
  const hasLicense = uploadedFiles.some((file) => file.kind === 'license');
  const hasPhoto = uploadedFiles.some((file) => file.kind === 'photo');
  const canSubmit = isDraft && hasLicense && hasPhoto && !isSubmitting && uploadingKind === null;

  const handleFileChange = (kind: FileKind, event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file !== undefined) {
      void onUploadFile(kind, file);
    }
  };

  return (
    <Card variant="elevated" className="wf-client-card">
      <div className="wf-client-card__head">
        <h3 className="wf-client-card__title">Documentos requeridos</h3>
        <span className="wf-client-docs-hint">JPEG o PNG · máx. 5 MB</span>
      </div>

      {!isDraft && (
        <Alert type="info" title="Borrador requerido">
          Guarda primero tus datos personales para habilitar la carga de documentos.
        </Alert>
      )}

      <div className="wf-client-files">
        {FILE_KINDS.map((kind) => {
          const info = uploadedFiles.find((file) => file.kind === kind);
          const previewUrl = fileUrls[kind];
          const isUploadingThis = uploadingKind === kind;
          const inputId = `client-app-file-${kind}`;

          return (
            <div key={kind} className="wf-client-file">
              <div className="wf-client-file__header">
                <div>
                  <p className="wf-client-file__title">{FILE_KIND_LABELS[kind]}</p>
                  <p className="wf-client-file__meta">
                    {info !== undefined
                      ? `${info.contentType === 'image/png' ? 'PNG' : 'JPEG'} · ${formatFileSize(info.sizeBytes)}`
                      : 'Pendiente de carga'}
                  </p>
                </div>
                <span
                  className={
                    'wf-client-badge ' +
                    (info !== undefined ? 'wf-client-badge--ok' : 'wf-client-badge--pending')
                  }
                >
                  {info !== undefined ? 'Cargado' : 'Requerido'}
                </span>
              </div>

              {previewUrl !== undefined && (
                <img
                  className="wf-client-file__preview"
                  src={previewUrl}
                  alt={FILE_KIND_LABELS[kind]}
                />
              )}

              <div className="wf-client-file__control">
                <input
                  id={inputId}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="sr-only"
                  disabled={!isDraft || isUploadingThis}
                  onChange={(event) => handleFileChange(kind, event)}
                />
                <label
                  htmlFor={inputId}
                  className={
                    'ui-btn ui-btn--secondary ui-btn--sm wf-client-file__button' +
                    (!isDraft || isUploadingThis ? ' wf-client-file__button--disabled' : '')
                  }
                >
                  {isUploadingThis
                    ? 'Subiendo...'
                    : info !== undefined
                      ? 'Reemplazar imagen'
                      : 'Seleccionar imagen'}
                </label>
              </div>
            </div>
          );
        })}
      </div>

      {isDraft && (
        <div className="wf-client-submit-box">
          {(!hasLicense || !hasPhoto) && (
            <p className="wf-client-submit-box__note">
              Sube ambos documentos para enviar tu solicitud a revisión.
            </p>
          )}

          <div className="wf-client-submit-box__actions">
            <Button
              type="button"
              variant="primary"
              isLoading={isSubmitting}
              disabled={!canSubmit || isCancelling}
              onClick={() => void onSubmitApplication()}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar solicitud'}
            </Button>

            {confirmingCancel ? (
              <div className="wf-client-confirm">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  isLoading={isCancelling}
                  onClick={() => {
                    void onCancelApplication().then((cancelled) => {
                      if (cancelled) {
                        setConfirmingCancel(false);
                      }
                    });
                  }}
                >
                  Confirmar cancelación
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isCancelling}
                  onClick={() => setConfirmingCancel(false)}
                >
                  Volver
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting || isCancelling}
                onClick={() => setConfirmingCancel(true)}
              >
                Cancelar borrador
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
};

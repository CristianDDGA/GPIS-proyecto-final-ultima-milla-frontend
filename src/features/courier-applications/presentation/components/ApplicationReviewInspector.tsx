import type { FC, FormEvent } from 'react';
import {
  APPLICATION_STATUS_LABELS,
  FILE_KIND_LABELS,
  VEHICLE_TYPE_LABELS,
  type ApplicationDetail,
  type FileKind,
} from '../../domain/index.js';
import { Alert, Button } from '../../../../shared/ui/index.js';

export function formatApplicationDate(isoDate: string | null): string {
  if (isoDate === null) {
    return '—';
  }
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' }).format(date);
}

export interface ApplicationReviewInspectorProps {
  readonly detail: ApplicationDetail;
  readonly detailLoading: boolean;
  readonly detailError: string | null;
  readonly actionError: string | null;
  readonly fileUrls: Partial<Record<FileKind, string>>;
  readonly capacity: string;
  readonly reason: string;
  readonly isApproving: boolean;
  readonly isRejecting: boolean;
  readonly onCapacityChange: (value: string) => void;
  readonly onReasonChange: (value: string) => void;
  readonly onClearDetailError: () => void;
  readonly onClearActionError: () => void;
  readonly onClose: () => void;
  readonly onApprove: (event: FormEvent<HTMLFormElement>) => void;
  readonly onReject: (event: FormEvent<HTMLFormElement>) => void;
}

export const ApplicationReviewInspector: FC<ApplicationReviewInspectorProps> = ({
  detail,
  detailLoading,
  detailError,
  actionError,
  fileUrls,
  capacity,
  reason,
  isApproving,
  isRejecting,
  onCapacityChange,
  onReasonChange,
  onClearDetailError,
  onClearActionError,
  onClose,
  onApprove,
  onReject,
}) => (
  <aside className="wf-application-detail" aria-label="Detalle de la solicitud">
    <header className="wf-application-detail__header">
      <div>
        <h3 className="wf-application-detail__title">{detail.fullName}</h3>
        <p className="wf-application-detail__email">{detail.applicantEmail}</p>
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onClose}>
        Cerrar
      </Button>
    </header>

    {detailError !== null && (
      <Alert type="error" title="No se pudo consultar" onClose={onClearDetailError}>
        {detailError}
      </Alert>
    )}
    {actionError !== null && (
      <Alert type="error" title="No se pudo completar la revisión" onClose={onClearActionError}>
        {actionError}
      </Alert>
    )}
    {detailLoading && <p role="status">Cargando documentos…</p>}

    <dl className="wf-detail-list">
      <div>
        <dt>Cédula</dt>
        <dd className="wf-table__mono">{detail.nationalId}</dd>
      </div>
      <div>
        <dt>Teléfono</dt>
        <dd>{detail.phone}</dd>
      </div>
      <div>
        <dt>Nacimiento</dt>
        <dd className="wf-table__mono">{detail.birthDate}</dd>
      </div>
      <div>
        <dt>Vehículo</dt>
        <dd>{VEHICLE_TYPE_LABELS[detail.vehicleType]}</dd>
      </div>
      <div>
        <dt>Licencia</dt>
        <dd>
          {detail.licenseCategory} · {detail.licenseNumber}
        </dd>
      </div>
      <div>
        <dt>Caducidad</dt>
        <dd className="wf-table__mono">{detail.licenseExpiresOn}</dd>
      </div>
      <div>
        <dt>Estado</dt>
        <dd>{APPLICATION_STATUS_LABELS[detail.status]}</dd>
      </div>
      <div>
        <dt>Enviada</dt>
        <dd className="wf-table__mono">{formatApplicationDate(detail.submittedAt)}</dd>
      </div>
    </dl>

    {detail.rejectionReason !== null && (
      <p className="wf-application-detail__reason">Motivo registrado: {detail.rejectionReason}</p>
    )}

    <div className="wf-application-files">
      {(['license', 'photo'] as const).map((kind) => (
        <div key={kind} className="wf-application-file">
          <p className="wf-application-file__label">{FILE_KIND_LABELS[kind]}</p>
          {fileUrls[kind] !== undefined ? (
            <img
              className="wf-application-file__image"
              src={fileUrls[kind]}
              alt={FILE_KIND_LABELS[kind]}
            />
          ) : (
            <p className="wf-application-file__empty">Sin documento cargado</p>
          )}
        </div>
      ))}
    </div>

    {detail.status === 'pendiente' && (
      <div className="wf-application-review">
        <form className="wf-review-box" onSubmit={onApprove}>
          <p className="wf-review-box__title">Aprobar y promover</p>
          <label className="wf-field-inline" htmlFor="wf-approve-capacity">
            Capacidad de ruta
            <input
              id="wf-approve-capacity"
              type="number"
              min="1"
              max="200"
              value={capacity}
              onChange={(event) => onCapacityChange(event.target.value)}
            />
          </label>
          <Button type="submit" variant="primary" size="sm" isLoading={isApproving}>
            Aprobar solicitud
          </Button>
        </form>

        <form className="wf-review-box" onSubmit={onReject}>
          <p className="wf-review-box__title">Rechazar</p>
          <label
            className="wf-field-inline wf-field-inline--column"
            htmlFor="wf-reject-reason"
          >
            Motivo (5–500 caracteres)
            <textarea
              id="wf-reject-reason"
              rows={3}
              value={reason}
              maxLength={500}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </label>
          <Button type="submit" variant="danger" size="sm" isLoading={isRejecting}>
            Rechazar solicitud
          </Button>
        </form>
      </div>
    )}
  </aside>
);

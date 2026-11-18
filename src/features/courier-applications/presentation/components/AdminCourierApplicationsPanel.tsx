import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { FC } from 'react';
import type { CourierApplicationUseCases } from '../../application/index.js';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  FILE_KIND_LABELS,
  VEHICLE_TYPE_LABELS,
  type ApplicationDetail,
  type ApplicationFilters,
  type ApplicationStatus,
  type FileKind,
} from '../../domain/index.js';
import { Alert, Button, EmptyState, Select, TextInput } from '../../../../shared/ui/index.js';

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos los estados' },
  ...APPLICATION_STATUSES.map((status) => ({
    value: status,
    label: APPLICATION_STATUS_LABELS[status],
  })),
];

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
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

export const AdminCourierApplicationsPanel: FC<{ useCases: CourierApplicationUseCases }> = ({ useCases }) => {
  const [statusFilter, setStatusFilter] = useState('pendiente');
  const [query, setQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<ApplicationFilters>({ status: 'pendiente' });
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<readonly ApplicationDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Partial<Record<FileKind, string>>>({});

  const [capacity, setCapacity] = useState('10');
  const [reason, setReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const urlsRef = useRef<string[]>([]);

  const resetFileUrls = useCallback((): void => {
    for (const url of urlsRef.current) {
      URL.revokeObjectURL(url);
    }
    urlsRef.current = [];
    setFileUrls({});
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      resetFileUrls();
    };
  }, [resetFileUrls]);

  const loadPage = useCallback(
    async (filters: ApplicationFilters) => {
      setIsLoading(true);
      setRequestError(null);
      try {
        const page = await useCases.list.execute({
          ...filters,
          limit: PAGE_SIZE,
          offset: filters.offset ?? 0,
        });
        if (!mountedRef.current) {
          return;
        }
        setItems(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (error_) {
        if (mountedRef.current) {
          setRequestError(toErrorMessage(error_, 'No se pudieron cargar las solicitudes.'));
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [useCases],
  );

  useEffect(() => {
    void loadPage({ ...appliedFilters, offset: 0 });
  }, [appliedFilters, loadPage]);

  const openDetail = async (application: ApplicationDetail): Promise<void> => {
    setSelectedId(application.id);
    setDetail(application);
    setDetailError(null);
    setActionError(null);
    setCapacity(String(application.approvedCapacity ?? 10));
    setReason(application.rejectionReason ?? '');
    resetFileUrls();

    setDetailLoading(true);
    try {
      const fresh = await useCases.get.execute(application.id);
      if (!mountedRef.current) {
        return;
      }
      setDetail(fresh);

      const kinds: readonly FileKind[] = ['license', 'photo'];
      const urls: Partial<Record<FileKind, string>> = {};
      await Promise.all(
        kinds.map(async (kind) => {
          if (!fresh.files.some((file) => file.kind === kind)) {
            return;
          }
          try {
            const blob = await useCases.getFile.execute(fresh.id, kind);
            const url = URL.createObjectURL(blob);
            urls[kind] = url;
            urlsRef.current.push(url);
          } catch {
            // La previsualización es opcional: el panel sigue operativo sin ella.
          }
        }),
      );

      if (mountedRef.current) {
        setFileUrls(urls);
      }
    } catch (error_) {
      if (mountedRef.current) {
        setDetailError(toErrorMessage(error_, 'No se pudo consultar la solicitud.'));
      }
    } finally {
      if (mountedRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const refreshAfterAction = async (message: string): Promise<void> => {
    setNotice(message);
    setDetail(null);
    setSelectedId(null);
    resetFileUrls();
    await loadPage({ ...appliedFilters, offset });
  };

  const handleApprove = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (detail === null) {
      return;
    }
    const parsedCapacity = Number(capacity);
    setIsApproving(true);
    setActionError(null);
    try {
      await useCases.approve.execute(detail.id, parsedCapacity);
      await refreshAfterAction('Solicitud aprobada: la cuenta fue promovida a repartidor.');
    } catch (error_) {
      setActionError(toErrorMessage(error_, 'No se pudo aprobar la solicitud.'));
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (detail === null) {
      return;
    }
    setIsRejecting(true);
    setActionError(null);
    try {
      await useCases.reject.execute(detail.id, reason);
      await refreshAfterAction('Solicitud rechazada con el motivo indicado.');
    } catch (error_) {
      setActionError(toErrorMessage(error_, 'No se pudo rechazar la solicitud.'));
    } finally {
      setIsRejecting(false);
    }
  };

  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + items.length, total);

  return (
    <section className="mk-admin mk-applications" aria-labelledby="mk-admin-applications-title">
      <div className="mk-toolbar">
        <form
          className="mk-toolbar__filters"
          onSubmit={(event) => {
            event.preventDefault();
            setAppliedFilters({
              ...(statusFilter !== 'all' ? { status: statusFilter as ApplicationStatus } : {}),
              ...(query.trim().length > 0 ? { q: query.trim() } : {}),
            });
          }}
        >
          <TextInput
            id="admin-applications-q"
            label="Buscar"
            type="search"
            placeholder="Nombre, correo o cédula"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={100}
          />
          <Select
            id="admin-applications-status"
            label="Estado"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          />
          <div className="mk-toolbar__filter-actions">
            <Button type="submit" variant="secondary" size="sm">
              Filtrar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
                setAppliedFilters({});
              }}
            >
              Limpiar
            </Button>
          </div>
        </form>
      </div>

      {requestError !== null && (
        <Alert type="error" title="Solicitudes" onClose={() => setRequestError(null)}>
          {requestError}
        </Alert>
      )}
      {notice !== null && (
        <Alert type="success" title="Revisión completada" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className={'mk-applications__layout' + (detail !== null ? ' mk-applications__layout--detail' : '')}>
        <div className="mk-table-wrap">
          <table className="mk-table" aria-label="Solicitudes de repartidor">
            <thead>
              <tr>
                <th scope="col">Solicitante</th>
                <th scope="col">Vehículo</th>
                <th scope="col">Estado</th>
                <th scope="col">Enviada</th>
                <th scope="col" className="mk-table__actions-head">
                  Revisión
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((application) => (
                <tr
                  key={application.id}
                  className={selectedId === application.id ? 'mk-table__row--selected' : ''}
                >
                  <td>
                    <div className="mk-table__identity">
                      <span className="mk-table__name">
                        {application.applicantName ?? application.fullName}
                      </span>
                      <span className="mk-table__email">{application.applicantEmail}</span>
                    </div>
                  </td>
                  <td>{VEHICLE_TYPE_LABELS[application.vehicleType]}</td>
                  <td>
                    <span className={'mk-badge mk-badge--status-' + application.status}>
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </span>
                  </td>
                  <td className="mk-table__mono">{formatDate(application.submittedAt)}</td>
                  <td>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void openDetail(application);
                      }}
                    >
                      Revisar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isLoading && items.length === 0 && (
            <EmptyState
              title="Sin solicitudes"
              description="No hay postulaciones que coincidan con el estado o la búsqueda actual."
            />
          )}
          {isLoading && items.length === 0 && (
            <p className="mk-table__loading" role="status">
              Consultando solicitudes…
            </p>
          )}
        </div>

        {detail !== null && (
          <aside className="mk-application-detail" aria-label="Detalle de la solicitud">
            <header className="mk-application-detail__header">
              <div>
                <p className="mk-eyebrow">Solicitud</p>
                <h3 className="mk-application-detail__title">{detail.fullName}</h3>
                <p className="mk-application-detail__email">{detail.applicantEmail}</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </header>

            {detailError !== null && (
              <Alert type="error" title="No se pudo consultar" onClose={() => setDetailError(null)}>
                {detailError}
              </Alert>
            )}
            {actionError !== null && (
              <Alert type="error" title="No se pudo completar la revisión" onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            )}
            {detailLoading && <p role="status">Cargando documentos…</p>}

            <dl className="mk-detail-list">
              <div>
                <dt>Cédula</dt>
                <dd className="mk-table__mono">{detail.nationalId}</dd>
              </div>
              <div>
                <dt>Teléfono</dt>
                <dd>{detail.phone}</dd>
              </div>
              <div>
                <dt>Nacimiento</dt>
                <dd className="mk-table__mono">{detail.birthDate}</dd>
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
                <dd className="mk-table__mono">{detail.licenseExpiresOn}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>{APPLICATION_STATUS_LABELS[detail.status]}</dd>
              </div>
              <div>
                <dt>Enviada</dt>
                <dd className="mk-table__mono">{formatDate(detail.submittedAt)}</dd>
              </div>
            </dl>

            {detail.rejectionReason !== null && (
              <p className="mk-application-detail__reason">
                Motivo registrado: {detail.rejectionReason}
              </p>
            )}

            <div className="mk-application-files">
              {(['license', 'photo'] as const).map((kind) => (
                <div key={kind} className="mk-application-file">
                  <p className="mk-application-file__label">{FILE_KIND_LABELS[kind]}</p>
                  {fileUrls[kind] !== undefined ? (
                    <img className="mk-application-file__image" src={fileUrls[kind]} alt={FILE_KIND_LABELS[kind]} />
                  ) : (
                    <p className="mk-application-file__empty">Sin documento cargado</p>
                  )}
                </div>
              ))}
            </div>

            {detail.status === 'pendiente' && (
              <div className="mk-application-review">
                <form className="mk-review-box" onSubmit={handleApprove}>
                  <p className="mk-review-box__title">Aprobar y promover</p>
                  <label className="mk-field-inline" htmlFor="mk-approve-capacity">
                    Capacidad de ruta
                    <input
                      id="mk-approve-capacity"
                      type="number"
                      min="1"
                      max="200"
                      value={capacity}
                      onChange={(event) => setCapacity(event.target.value)}
                    />
                  </label>
                  <Button type="submit" variant="primary" size="sm" isLoading={isApproving}>
                    Aprobar solicitud
                  </Button>
                </form>

                <form className="mk-review-box" onSubmit={handleReject}>
                  <p className="mk-review-box__title">Rechazar</p>
                  <label className="mk-field-inline mk-field-inline--column" htmlFor="mk-reject-reason">
                    Motivo (5–500 caracteres)
                    <textarea
                      id="mk-reject-reason"
                      rows={3}
                      value={reason}
                      maxLength={500}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </label>
                  <Button type="submit" variant="danger" size="sm" isLoading={isRejecting}>
                    Rechazar solicitud
                  </Button>
                </form>
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="mk-pagination">
        <span className="mk-pagination__info">
          {rangeStart}–{rangeEnd} de {total}
        </span>
        <div className="mk-pagination__actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset === 0 || isLoading}
            onClick={() => {
              void loadPage({ ...appliedFilters, offset: Math.max(0, offset - PAGE_SIZE) });
            }}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={offset + PAGE_SIZE >= total || isLoading}
            onClick={() => {
              void loadPage({ ...appliedFilters, offset: offset + PAGE_SIZE });
            }}
          >
            Siguiente
          </Button>
        </div>
      </footer>
    </section>
  );
};

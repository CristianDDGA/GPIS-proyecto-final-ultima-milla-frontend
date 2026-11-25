import { useCallback, useEffect, useRef, useState, type FC, type FormEvent } from 'react';
import type { CourierApplicationUseCases } from '../../application/index.js';
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  type ApplicationDetail,
  type ApplicationFilters,
  type ApplicationStatus,
  type FileKind,
} from '../../domain/index.js';
import { Alert, Button, EmptyState, Select, TextInput } from '../../../../shared/ui/index.js';
import {
  ApplicationReviewInspector,
  formatApplicationDate,
} from './ApplicationReviewInspector.js';

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

export const AdminCourierApplicationsPanel: FC<{ useCases: CourierApplicationUseCases }> = ({
  useCases,
}) => {
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
    <section className="wf-admin wf-applications" aria-label="Solicitudes de repartidor">
      <div className="wf-toolbar">
        <form
          className="wf-toolbar__filters"
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
          <div className="wf-toolbar__filter-actions">
            <Button type="submit" variant="primary" size="sm">
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

      <div
        className={
          'wf-applications__layout' + (detail !== null ? ' wf-applications__layout--detail' : '')
        }
      >
        <div className="wf-table-wrap">
          <table className="wf-table" aria-label="Solicitudes de repartidor">
            <thead>
              <tr>
                <th scope="col">Solicitante</th>
                <th scope="col">Vehículo</th>
                <th scope="col">Estado</th>
                <th scope="col">Enviada</th>
                <th scope="col" className="wf-table__actions-head">
                  Revisión
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((application) => (
                <tr
                  key={application.id}
                  className={selectedId === application.id ? 'wf-table__row--selected' : ''}
                >
                  <td>
                    <div className="wf-table__identity">
                      <span className="wf-table__name">
                        {application.applicantName ?? application.fullName}
                      </span>
                      <span className="wf-table__email">{application.applicantEmail}</span>
                    </div>
                  </td>
                  <td>{VEHICLE_TYPE_LABELS[application.vehicleType]}</td>
                  <td>
                    <span className={'wf-badge wf-badge--status-' + application.status}>
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </span>
                  </td>
                  <td className="wf-table__mono">
                    {formatApplicationDate(application.submittedAt)}
                  </td>
                  <td>
                    <div className="wf-table__actions">
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
                    </div>
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
            <p className="wf-table__loading" role="status">
              Consultando solicitudes…
            </p>
          )}
        </div>

        {detail !== null && (
          <ApplicationReviewInspector
            detail={detail}
            detailLoading={detailLoading}
            detailError={detailError}
            actionError={actionError}
            fileUrls={fileUrls}
            capacity={capacity}
            reason={reason}
            isApproving={isApproving}
            isRejecting={isRejecting}
            onCapacityChange={setCapacity}
            onReasonChange={setReason}
            onClearDetailError={() => setDetailError(null)}
            onClearActionError={() => setActionError(null)}
            onClose={() => {
              setDetail(null);
              setSelectedId(null);
            }}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>

      <footer className="wf-pagination">
        <span className="wf-pagination__info">
          {rangeStart}–{rangeEnd} de {total}
        </span>
        <div className="wf-pagination__actions">
          <Button
            type="button"
            variant="secondary"
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
            variant="secondary"
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

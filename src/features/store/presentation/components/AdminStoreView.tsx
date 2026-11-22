import { useCallback, useEffect, useState, type CSSProperties, type FC } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  SectionHeader,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import {
  CANCEL_REASON_LABELS,
  FAILURE_REASON_LABELS,
  STORE_ORDER_STATUS_LABELS,
  formatCents,
  todayInEcuador,
  type CancelReason,
  type FailureReason,
  type LowStockItem,
  type SalesSummary,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';
import { AdminStoreCatalogPanel } from './AdminStoreCatalogPanel.js';
import {
  AdminStoreCashPanel,
  AdminStoreOrdersPanel,
  AdminStoreSettingsPanel,
} from './AdminStoreOpsPanel.js';
import '../styles/store.css';

export interface AdminStoreViewProps {
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
}

type AdminStoreTab = 'summary' | 'catalog' | 'orders' | 'cash' | 'settings';

const ADMIN_STORE_TABS: readonly { readonly id: AdminStoreTab; readonly label: string }[] = [
  { id: 'summary', label: 'Resumen' },
  { id: 'catalog', label: 'Catálogo' },
  { id: 'orders', label: 'Pedidos' },
  { id: 'cash', label: 'Caja' },
  { id: 'settings', label: 'Franjas' },
];

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export const AdminStoreView: FC<AdminStoreViewProps> = ({ storeGateway, zones }) => {
  const [tab, setTab] = useState<AdminStoreTab>('summary');
  const [fromDate, setFromDate] = useState(() => todayInEcuador());
  const [toDate, setToDate] = useState(() => todayInEcuador());
  const [threshold, setThreshold] = useState('5');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [lowStock, setLowStock] = useState<readonly LowStockItem[]>([]);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    setSummaryError(null);
    try {
      const thr = Math.max(0, Number.parseInt(threshold, 10) || 5);
      const [sum, low] = await Promise.all([
        storeGateway.adminSummary(fromDate, toDate),
        storeGateway.adminLowStock(thr, 50),
      ]);
      setSummary(sum);
      setLowStock(low.items);
    } catch (err) {
      setSummaryError(errMsg(err, 'No se pudo cargar el resumen de tienda.'));
    } finally {
      setIsLoadingSummary(false);
    }
  }, [storeGateway, fromDate, toDate, threshold]);

  useEffect(() => {
    if (tab === 'summary') {
      void loadSummary();
    }
  }, [tab, loadSummary]);

  const segmentedStyle = {
    '--seg-index': ADMIN_STORE_TABS.findIndex((t) => t.id === tab),
    '--seg-count': ADMIN_STORE_TABS.length,
  } as CSSProperties;

  return (
    <section className="store-layout" aria-labelledby="admin-store-title">
      <SectionHeader
        title="Administración de tienda"
        actions={
          <div
            className="segmented store-tabs"
            role="tablist"
            aria-label="Módulos de tienda"
            style={segmentedStyle}
          >
            <span className="segmented__thumb" aria-hidden="true" />
            {ADMIN_STORE_TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`store-tab ${tab === item.id ? 'store-tab--active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />
      <h2 id="admin-store-title" className="sr-only">
        Administración de tienda y catálogo
      </h2>

      {tab === 'summary' && (
        <>
          <Card className="store-card">
            <div className="store-filters">
              <TextInput
                id="sum-from"
                type="date"
                label="Desde"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <TextInput
                id="sum-to"
                type="date"
                label="Hasta"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
              <TextInput
                id="sum-threshold"
                type="number"
                min={0}
                label="Umbral stock bajo"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              <div className="store-filters__actions">
                <Button type="button" size="sm" isLoading={isLoadingSummary} onClick={() => void loadSummary()}>
                  Actualizar métricas
                </Button>
              </div>
            </div>

            {summaryError && (
              <Alert type="error" title="No se pudo cargar el resumen" onClose={() => setSummaryError(null)}>
                {summaryError}
              </Alert>
            )}

            {isLoadingSummary && !summary ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}>
                <Spinner size="md" label="Calculando resumen..." />
              </div>
            ) : summary ? (
              <>
                <div className="store-kpi-grid">
                  <div className="store-kpi-card">
                    <span className="store-kpi-card__label">Ventas brutas (sin cancelados)</span>
                    <span className="store-kpi-card__value">{formatCents(summary.grossCents)}</span>
                    <span className="store-kpi-card__meta">
                      {summary.from} → {summary.to}
                    </span>
                  </div>
                  <div className="store-kpi-card">
                    <span className="store-kpi-card__label">Efectivo cobrado (COD)</span>
                    <span className="store-kpi-card__value">{formatCents(summary.collectedCents)}</span>
                    <span className="store-kpi-card__meta">{summary.orders.total} pedidos totales</span>
                  </div>
                  <div className="store-kpi-card">
                    <span className="store-kpi-card__label">Cancelaciones / Fallas</span>
                    <span className="store-kpi-card__value">
                      {summary.cancellations.count} / {summary.failures.count}
                    </span>
                    <span className="store-kpi-card__meta">Registradas en el rango</span>
                  </div>
                  <div className="store-kpi-card">
                    <span className="store-kpi-card__label">Alertas de stock bajo</span>
                    <span className="store-kpi-card__value">{summary.lowStockCount}</span>
                    <span className="store-kpi-card__meta">Productos con stock ≤ {threshold}</span>
                  </div>
                </div>

                <div className="store-two-col--equal">
                  <div className="store-card">
                    <h3 className="store-card__title">Top 5 productos más vendidos</h3>
                    {summary.topProducts.length === 0 ? (
                      <p className="store-card__subtitle">Sin ventas en el periodo seleccionado.</p>
                    ) : (
                      <div className="orders-table-wrapper">
                        <table className="orders-table">
                          <thead>
                            <tr>
                              <th scope="col">Producto</th>
                              <th scope="col">Unidades</th>
                              <th scope="col">Ingresos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summary.topProducts.map((p) => (
                              <tr key={p.productId}>
                                <td><strong>{p.name}</strong></td>
                                <td>{p.units}</td>
                                <td><strong>{formatCents(p.revenueCents)}</strong></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="store-card">
                    <h3 className="store-card__title">Desglose por estado y motivos</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.entries(summary.orders.byStatus).map(([st, count]) => (
                        <span key={st} className="store-pill store-pill--blue">
                          {STORE_ORDER_STATUS_LABELS[st] ?? st}: {count}
                        </span>
                      ))}
                      {Object.entries(summary.cancellations.byReason).map(([r, count]) => (
                        <span key={`c-${r}`} className="store-pill store-pill--red">
                          Cancelado ({CANCEL_REASON_LABELS[r as CancelReason] ?? r}): {count}
                        </span>
                      ))}
                      {Object.entries(summary.failures.byReason).map(([r, count]) => (
                        <span key={`f-${r}`} className="store-pill store-pill--amber">
                          Falla ({FAILURE_REASON_LABELS[r as FailureReason] ?? r}): {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </Card>

          <Card className="store-card">
            <div className="store-card__header">
              <div>
                <h3 className="store-card__title">Productos con stock bajo</h3>
                <p className="store-card__subtitle">
                  Reabastece directamente desde la pestaña Catálogo → Stock.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => setTab('catalog')}>
                Ir al catálogo →
              </Button>
            </div>
            {lowStock.length === 0 ? (
              <EmptyState
                title="Inventario saludable"
                description="No hay productos por debajo del umbral de stock configurado."
              />
            ) : (
              <div className="orders-table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th scope="col">SKU</th>
                      <th scope="col">Producto</th>
                      <th scope="col">Stock actual</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((item) => (
                      <tr key={item.id}>
                        <td><code>{item.sku}</code></td>
                        <td><strong>{item.name}</strong></td>
                        <td>
                          <span className={`store-pill ${item.stockQuantity <= 0 ? 'store-pill--red' : 'store-pill--amber'}`}>
                            {item.stockQuantity} u.
                          </span>
                        </td>
                        <td>{item.isActive ? 'Activo' : 'Inactivo'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {tab === 'catalog' && <AdminStoreCatalogPanel storeGateway={storeGateway} />}
      {tab === 'orders' && <AdminStoreOrdersPanel storeGateway={storeGateway} zones={zones} />}
      {tab === 'cash' && <AdminStoreCashPanel storeGateway={storeGateway} />}
      {tab === 'settings' && <AdminStoreSettingsPanel storeGateway={storeGateway} />}
    </section>
  );
};

import { useCallback, useEffect, useState, type ChangeEvent, type FC, type FormEvent } from 'react';
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
  STOCK_REASON_LABELS,
  formatCents,
  parseDollarsToCents,
  type AdminProduct,
  type ProductEvent,
  type ProductStatusFilter,
  type StockReason,
  type StoreCategory,
} from '../../domain/storeTypes.js';
import type { HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';

export interface AdminStoreCatalogPanelProps {
  readonly storeGateway: HttpStoreGateway;
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

export const AdminStoreCatalogPanel: FC<AdminStoreCatalogPanelProps> = ({ storeGateway }) => {
  const [categories, setCategories] = useState<readonly StoreCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const [products, setProducts] = useState<readonly AdminProduct[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [filterCatId, setFilterCatId] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modal crear / editar producto
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [compareDollars, setCompareDollars] = useState('');
  const [initialStock, setInitialStock] = useState('10');
  const [isActive, setIsActive] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState<string | null>(null);

  // Modal ajuste de stock
  const [stockTarget, setStockTarget] = useState<AdminProduct | null>(null);
  const [stockDelta, setStockDelta] = useState('5');
  const [stockReason, setStockReason] = useState<StockReason>('restock');
  const [isAdjustingStock, setIsAdjustingStock] = useState(false);

  // Modal historial de eventos
  const [eventsTarget, setEventsTarget] = useState<AdminProduct | null>(null);
  const [events, setEvents] = useState<readonly ProductEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const [busyImageId, setBusyImageId] = useState<string | null>(null);

  const pageSize = 15;

  const loadAll = useCallback(
    async (targetPage: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const [cats, pageRes] = await Promise.all([
          storeGateway.adminListCategories(),
          storeGateway.adminListProducts({
            q,
            categoryId: filterCatId || undefined,
            status: statusFilter,
            page: targetPage,
            pageSize,
          }),
        ]);
        setCategories(cats);
        setProducts(pageRes.items);
        setTotal(pageRes.total);
      } catch (err) {
        setError(errMsg(err, 'No se pudo cargar el catálogo administrativo.'));
      } finally {
        setIsLoading(false);
      }
    },
    [storeGateway, q, filterCatId, statusFilter],
  );

  useEffect(() => {
    void loadAll(page);
  }, [loadAll, page]);

  const handleCreateCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newCategoryName.trim().length < 2 || isSavingCategory) return;
    setIsSavingCategory(true);
    setError(null);
    try {
      await storeGateway.adminCreateCategory(newCategoryName);
      setNewCategoryName('');
      setNotice('Categoría creada correctamente.');
      await loadAll(page);
    } catch (err) {
      setError(errMsg(err, 'No se pudo crear la categoría.'));
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleToggleCategory = async (cat: StoreCategory) => {
    setError(null);
    try {
      await storeGateway.adminUpdateCategory(cat.id, {
        expectedVersion: cat.version,
        isActive: !cat.isActive,
      });
      setNotice(`Categoría "${cat.name}" ${cat.isActive ? 'desactivada' : 'activada'}.`);
      await loadAll(page);
    } catch (err) {
      setError(errMsg(err, 'No se pudo actualizar la categoría.'));
    }
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setSku('');
    setName('');
    setBrand('');
    setDescription('');
    setCategoryId(categories[0]?.id ?? '');
    setPriceDollars('');
    setCompareDollars('');
    setInitialStock('10');
    setIsActive(true);
    setProductFormError(null);
    setProductModalOpen(true);
  };

  const openEditProduct = async (id: string) => {
    setError(null);
    try {
      const fresh = await storeGateway.adminGetProduct(id);
      setEditingProduct(fresh);
      setSku(fresh.sku);
      setName(fresh.name);
      setBrand(fresh.brand ?? '');
      setDescription(fresh.description ?? '');
      setCategoryId(fresh.category.id);
      setPriceDollars((fresh.priceCents / 100).toFixed(2));
      setCompareDollars(
        fresh.compareAtPriceCents !== null ? (fresh.compareAtPriceCents / 100).toFixed(2) : '',
      );
      setIsActive(fresh.isActive);
      setProductFormError(null);
      setProductModalOpen(true);
    } catch (err) {
      setError(errMsg(err, 'No se pudo consultar el producto.'));
    }
  };

  const handleSaveProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSavingProduct) return;
    const priceCents = parseDollarsToCents(priceDollars);
    const compareAtPriceCents =
      compareDollars.trim().length > 0 ? parseDollarsToCents(compareDollars) : null;
    if (priceCents === null || priceCents <= 0) {
      setProductFormError('Ingresa un precio de venta válido mayor a 0.');
      return;
    }
    if (compareDollars.trim().length > 0 && compareAtPriceCents === null) {
      setProductFormError('El precio de lista no es válido.');
      return;
    }

    setIsSavingProduct(true);
    setProductFormError(null);
    try {
      if (editingProduct) {
        await storeGateway.adminUpdateProduct(editingProduct.id, {
          expectedVersion: editingProduct.version,
          name,
          brand: brand.trim().length > 0 ? brand : null,
          description: description.trim().length > 0 ? description : null,
          categoryId,
          priceCents,
          compareAtPriceCents,
          isActive,
        });
        setNotice(`Producto "${name}" actualizado.`);
      } else {
        const stockNum = Number.parseInt(initialStock, 10);
        if (!Number.isInteger(stockNum) || stockNum < 0) {
          setProductFormError('El stock inicial debe ser un entero mayor o igual a 0.');
          setIsSavingProduct(false);
          return;
        }
        await storeGateway.adminCreateProduct({
          sku,
          name,
          brand: brand.trim().length > 0 ? brand : null,
          description: description.trim().length > 0 ? description : null,
          categoryId,
          priceCents,
          compareAtPriceCents,
          stock: stockNum,
          isActive,
        });
        setNotice(`Producto "${name}" creado.`);
      }
      setProductModalOpen(false);
      await loadAll(page);
    } catch (err) {
      setProductFormError(errMsg(err, 'No se pudo guardar el producto.'));
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleAdjustStock = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!stockTarget || isAdjustingStock) return;
    const delta = Number.parseInt(stockDelta, 10);
    if (!Number.isInteger(delta) || delta === 0) {
      setError('El ajuste de stock debe ser un número entero distinto de 0.');
      return;
    }
    setIsAdjustingStock(true);
    setError(null);
    try {
      const res = await storeGateway.adminAdjustStock(stockTarget.id, delta, stockReason);
      setStockTarget(null);
      setNotice(`Stock actualizado: ${res.stock} unidades en inventario.`);
      await loadAll(page);
    } catch (err) {
      setError(errMsg(err, 'No se pudo ajustar el stock.'));
    } finally {
      setIsAdjustingStock(false);
    }
  };

  const handleImageUpload = async (product: AdminProduct, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusyImageId(product.id);
    setError(null);
    try {
      const updated = await storeGateway.adminUploadProductImage(product.id, product.version, file);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setNotice(`Imagen de "${updated.name}" actualizada (versión ${updated.version}).`);
    } catch (err) {
      setError(errMsg(err, 'No se pudo subir la imagen (usa JPEG o PNG de hasta 5 MB).'));
    } finally {
      setBusyImageId(null);
    }
  };

  const handleImageDelete = async (product: AdminProduct) => {
    setBusyImageId(product.id);
    setError(null);
    try {
      const updated = await storeGateway.adminRemoveProductImage(product.id, product.version);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setNotice(`Imagen eliminada de "${updated.name}".`);
    } catch (err) {
      setError(errMsg(err, 'No se pudo eliminar la imagen.'));
    } finally {
      setBusyImageId(null);
    }
  };

  const openEvents = async (product: AdminProduct) => {
    setEventsTarget(product);
    setEvents([]);
    setIsLoadingEvents(true);
    try {
      setEvents(await storeGateway.adminProductEvents(product.id));
    } catch (err) {
      setError(errMsg(err, 'No se pudo cargar el historial del producto.'));
    } finally {
      setIsLoadingEvents(false);
    }
  };

  return (
    <div className="store-two-col">
      <Card className="store-card">
        <h3 className="store-card__title">Categorías</h3>
        <form className="store-form" onSubmit={handleCreateCategory}>
          <TextInput
            id="admin-new-cat"
            label="Nueva categoría"
            placeholder="Ej. Tecnología, Hogar"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            maxLength={60}
            isRequired
          />
          <div className="store-form__actions">
            <Button type="submit" size="sm" isLoading={isSavingCategory} disabled={newCategoryName.trim().length < 2}>
              Crear categoría
            </Button>
          </div>
        </form>

        <ul className="store-stop-list" aria-label="Categorías registradas">
          {categories.map((cat) => (
            <li key={cat.id} className="store-cart-item">
              <div className="store-cart-item__info">
                <span className="store-cart-item__name">{cat.name}</span>
                <span className="store-cart-item__meta">v{cat.version}</span>
              </div>
              <span className={`store-pill ${cat.isActive ? 'store-pill--green' : 'store-pill--red'}`}>
                {cat.isActive ? 'Activa' : 'Inactiva'}
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={() => void handleToggleCategory(cat)}>
                {cat.isActive ? 'Desactivar' : 'Activar'}
              </Button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="store-card">
        <div className="store-card__header">
          <div>
            <h3 className="store-card__title">Productos de la tienda</h3>
            <p className="store-card__subtitle">
              Control de versión optimista, carga de imágenes JPEG/PNG, ajustes de stock y auditoría.
            </p>
          </div>
          <Button type="button" variant="primary" size="sm" disabled={categories.length === 0} onClick={openCreateProduct}>
            + Nuevo producto
          </Button>
        </div>

        {error && <Alert type="error" title="Atención" onClose={() => setError(null)}>{error}</Alert>}
        {notice && <Alert type="success" title="Catálogo actualizado" onClose={() => setNotice(null)}>{notice}</Alert>}

        <form
          className="store-filters"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            void loadAll(1);
          }}
        >
          <TextInput
            id="admin-prod-q"
            label="Buscar"
            placeholder="Nombre, SKU o marca"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            id="admin-prod-cat"
            label="Categoría"
            value={filterCatId}
            onChange={(e) => {
              setFilterCatId(e.target.value);
              setPage(1);
            }}
            options={[
              { value: '', label: 'Todas' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Select
            id="admin-prod-status"
            label="Estado"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ProductStatusFilter);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'active', label: 'Activos' },
              { value: 'inactive', label: 'Inactivos' },
            ]}
          />
          <div className="store-filters__actions">
            <Button type="submit" size="sm" isLoading={isLoading}>Filtrar</Button>
          </div>
        </form>

        {isLoading && products.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '28px' }}>
            <Spinner size="md" label="Cargando productos..." />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            title="Sin productos registrados"
            description="Crea una categoría y agrega tu primer producto al catálogo."
          />
        ) : (
          <div className="orders-table-wrapper">
            <table className="orders-table" aria-label="Catálogo administrativo de productos">
              <thead>
                <tr>
                  <th scope="col">Producto</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="orders-table__actions-head">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const imgSrc = storeGateway.resolveImageUrl(product.imageUrl);
                  return (
                    <tr key={product.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {imgSrc ? (
                            <img src={imgSrc} alt={product.name} className="store-thumb" />
                          ) : (
                            <div className="store-thumb" aria-hidden="true" />
                          )}
                          <div>
                            <strong>{product.name}</strong>
                            <span style={{ display: 'block', fontSize: '12px', color: '#475569' }}>
                              {product.sku} · {product.category.name} · v{product.version}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{formatCents(product.priceCents)}</strong>
                        {product.compareAtPriceCents !== null && (
                          <span style={{ display: 'block', fontSize: '11.5px', textDecoration: 'line-through', color: '#64748b' }}>
                            {formatCents(product.compareAtPriceCents)}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`store-pill ${
                            product.stockQuantity <= 0
                              ? 'store-pill--red'
                              : product.stockQuantity <= 5
                                ? 'store-pill--amber'
                                : 'store-pill--green'
                          }`}
                        >
                          {product.stockQuantity} u.
                        </span>
                      </td>
                      <td>
                        <span className={`store-pill ${product.isActive ? 'store-pill--green' : 'store-pill--red'}`}>
                          {product.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="orders-table__actions">
                        <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Button type="button" variant="secondary" size="sm" onClick={() => void openEditProduct(product.id)}>
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              setStockTarget(product);
                              setStockDelta('5');
                              setStockReason('restock');
                            }}
                          >
                            Stock
                          </Button>
                          <label className="ui-btn ui-btn--secondary ui-btn--sm" style={{ cursor: 'pointer' }}>
                            {busyImageId === product.id ? 'Subiendo...' : 'Foto'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png"
                              style={{ display: 'none' }}
                              disabled={busyImageId === product.id}
                              onChange={(e) => void handleImageUpload(product, e)}
                            />
                          </label>
                          {product.imageUrl && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busyImageId === product.id}
                              onClick={() => void handleImageDelete(product)}
                            >
                              Quitar foto
                            </Button>
                          )}
                          <Button type="button" variant="ghost" size="sm" onClick={() => void openEvents(product)}>
                            Historial
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div className="store-pagination">
            <span className="store-pagination__info">Página {page} · {total} productos</span>
            <div className="store-pagination__actions">
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {productModalOpen && (
        <Modal
          title={editingProduct ? `Editar ${editingProduct.sku}` : 'Nuevo producto'}
          size="lg"
          onClose={() => !isSavingProduct && setProductModalOpen(false)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isSavingProduct} onClick={() => setProductModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" form="admin-product-form" variant="primary" size="sm" isLoading={isSavingProduct}>
                {editingProduct ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </>
          }
        >
          <form id="admin-product-form" className="store-form" onSubmit={handleSaveProduct}>
            {productFormError && <Alert type="error" title="Revisa los datos">{productFormError}</Alert>}
            <div className="store-form__row">
              <TextInput
                id="prod-sku"
                label="SKU"
                placeholder="Ej. AUD-100"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={Boolean(editingProduct)}
                isRequired
              />
              <Select
                id="prod-cat"
                label="Categoría"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                isRequired
              />
            </div>
            <TextInput id="prod-name" label="Nombre del producto" value={name} onChange={(e) => setName(e.target.value)} isRequired />
            <div className="store-form__row">
              <TextInput id="prod-brand" label="Marca (opcional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
              {!editingProduct && (
                <TextInput
                  id="prod-stock"
                  type="number"
                  min={0}
                  label="Stock inicial"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  isRequired
                />
              )}
            </div>
            <div className="store-form__row">
              <TextInput
                id="prod-price"
                label="Precio venta (USD)"
                placeholder="69.99"
                inputMode="decimal"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                isRequired
              />
              <TextInput
                id="prod-compare"
                label="Precio lista / antes (USD, opcional)"
                placeholder="89.99"
                inputMode="decimal"
                value={compareDollars}
                onChange={(e) => setCompareDollars(e.target.value)}
              />
            </div>
            <TextInput id="prod-desc" label="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
            <label className="store-checkbox">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              <span>Producto visible en el catálogo</span>
            </label>
          </form>
        </Modal>
      )}

      {stockTarget && (
        <Modal
          title={`Ajustar stock · ${stockTarget.name}`}
          description={`Stock actual: ${stockTarget.stockQuantity} unidades. Usa valores positivos (+10) o negativos (-2).`}
          onClose={() => !isAdjustingStock && setStockTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" disabled={isAdjustingStock} onClick={() => setStockTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="admin-stock-form" variant="primary" size="sm" isLoading={isAdjustingStock}>
                Aplicar ajuste
              </Button>
            </>
          }
        >
          <form id="admin-stock-form" className="store-form" onSubmit={handleAdjustStock}>
            <TextInput
              id="stock-delta"
              type="number"
              label="Variación (delta)"
              value={stockDelta}
              onChange={(e) => setStockDelta(e.target.value)}
              isRequired
            />
            <Select
              id="stock-reason"
              label="Motivo del movimiento"
              value={stockReason}
              onChange={(e) => setStockReason(e.target.value as StockReason)}
              options={(Object.keys(STOCK_REASON_LABELS) as StockReason[]).map((key) => ({
                value: key,
                label: STOCK_REASON_LABELS[key],
              }))}
              isRequired
            />
          </form>
        </Modal>
      )}

      {eventsTarget && (
        <Modal
          title={`Historial · ${eventsTarget.name}`}
          size="lg"
          onClose={() => setEventsTarget(null)}
          footer={
            <Button type="button" variant="secondary" size="sm" onClick={() => setEventsTarget(null)}>
              Cerrar
            </Button>
          }
        >
          {isLoadingEvents ? (
            <Spinner size="md" label="Cargando historial..." />
          ) : events.length === 0 ? (
            <p className="wf-modal__paragraph">Sin movimientos registrados todavía.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="store-lines-table">
                <thead>
                  <tr>
                    <th scope="col">Acción</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Cambios</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id}>
                      <td><strong>{ev.action}</strong></td>
                      <td>{new Date(ev.createdAt).toLocaleString('es-EC')}</td>
                      <td><code>{JSON.stringify(ev.changes)}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

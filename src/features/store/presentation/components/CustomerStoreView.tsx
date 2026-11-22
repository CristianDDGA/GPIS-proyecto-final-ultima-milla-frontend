import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FC,
  type FormEvent,
} from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Modal,
  SectionHeader,
  Select,
  Spinner,
  TextInput,
} from '../../../../shared/ui/index.js';
import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  PRODUCT_SORT_OPTIONS,
  formatCents,
  generateIdempotencyKey,
  parseDollarsToCents,
  todayInEcuador,
  type CartItem,
  type CustomerProduct,
  type DeliverySlot,
  type OrderConflict,
  type ProductSort,
  type StoreAddress,
  type StoreCategory,
} from '../../domain/storeTypes.js';
import {
  extractOrderConflicts,
  type HttpStoreGateway,
} from '../../infrastructure/http/httpStoreGateway.js';
import { CustomerAddressesPanel } from './CustomerAddressesPanel.js';
import { CustomerStoreOrdersPanel } from './CustomerStoreOrdersPanel.js';
import { EcuadorMapPicker } from './EcuadorMapPicker.js';
import '../styles/store.css';

export interface CustomerStoreViewProps {
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
  readonly onOrderPlaced?: (() => void) | undefined;
}

type CustomerStoreTab = 'catalog' | 'cart' | 'orders' | 'addresses';

const CART_STORAGE_KEY = 'millast.store.cart.v1';

function loadStoredCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

function saveStoredCart(items: readonly CartItem[]): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
}

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function describeConflict(conflict: OrderConflict, cart: readonly CartItem[]): string {
  const name = cart.find((c) => c.productId === conflict.productId)?.name ?? 'Producto';
  switch (conflict.reason) {
    case 'price_changed':
      return `${name}: el precio cambió a ${formatCents(conflict.currentPriceCents ?? 0)}.`;
    case 'insufficient_stock':
      return `${name}: solo quedan ${conflict.available ?? 0} unidades disponibles.`;
    case 'unavailable':
      return `${name}: ya no está disponible en el catálogo.`;
    case 'slot_full':
      return 'La franja horaria elegida se llenó. Elige otro horario.';
    case 'slot_unavailable':
      return 'La franja horaria elegida ya no está disponible.';
    case 'slot_invalid':
      return 'La hora de entrega elegida no es válida.';
    case 'zone_inactive':
      return 'La zona de entrega no está activa.';
  }
}

export const CustomerStoreView: FC<CustomerStoreViewProps> = ({
  storeGateway,
  zones,
  onOrderPlaced,
}) => {
  const [tab, setTab] = useState<CustomerStoreTab>('catalog');
  const [categories, setCategories] = useState<readonly StoreCategory[]>([]);
  const [products, setProducts] = useState<readonly CustomerProduct[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Filtros del catálogo
  const [searchText, setSearchText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [minPriceDollars, setMinPriceDollars] = useState('');
  const [maxPriceDollars, setMaxPriceDollars] = useState('');
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sort, setSort] = useState<ProductSort>('relevance');

  // Detalle de producto
  const [selectedProduct, setSelectedProduct] = useState<CustomerProduct | null>(null);
  const [isLoadingProductDetail, setIsLoadingProductDetail] = useState(false);

  // Carrito persistido en localStorage
  const [cart, setCart] = useState<CartItem[]>(loadStoredCart);
  const [cartAlerts, setCartAlerts] = useState<string[]>([]);
  const [isSyncingCart, setIsSyncingCart] = useState(false);

  // Checkout y libreta
  const [savedAddresses, setSavedAddresses] = useState<readonly StoreAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [zoneId, setZoneId] = useState(() => zones[0]?.id ?? '');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(() => todayInEcuador());
  const [slots, setSlots] = useState<readonly DeliverySlot[]>([]);
  const [deliveryTime, setDeliveryTime] = useState('');
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);
  const [ordersRefreshToken, setOrdersRefreshToken] = useState(0);

  const pageSize = 12;

  useEffect(() => {
    saveStoredCart(cart);
  }, [cart]);

  useEffect(() => {
    if (zoneId.length === 0 && zones[0]) {
      setZoneId(zones[0].id);
    }
  }, [zones, zoneId]);

  const loadCategories = useCallback(async () => {
    try {
      setCategories(await storeGateway.listCategories());
    } catch {
      // Silencioso; el catálogo aún puede listar sin categorías
    }
  }, [storeGateway]);

  const loadProducts = useCallback(
    async (targetPage: number) => {
      setIsLoadingProducts(true);
      setCatalogError(null);
      try {
        const minCents = minPriceDollars.trim().length > 0 ? parseDollarsToCents(minPriceDollars) : null;
        const maxCents = maxPriceDollars.trim().length > 0 ? parseDollarsToCents(maxPriceDollars) : null;
        const res = await storeGateway.listProducts({
          q: searchText,
          categoryId: categoryId || undefined,
          minPriceCents: minCents ?? undefined,
          maxPriceCents: maxCents ?? undefined,
          onSale: onSaleOnly ? true : undefined,
          sort,
          page: targetPage,
          pageSize,
        });
        setProducts(res.items);
        setTotal(res.total);
      } catch (err) {
        setCatalogError(errMsg(err, 'No se pudo cargar el catálogo de productos.'));
      } finally {
        setIsLoadingProducts(false);
      }
    },
    [storeGateway, searchText, categoryId, minPriceDollars, maxPriceDollars, onSaleOnly, sort],
  );

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadProducts(page);
  }, [loadProducts, page]);

  // Cargar libreta para selector rápido en checkout
  const loadAddressesForCheckout = useCallback(async () => {
    try {
      const items = await storeGateway.listAddresses();
      setSavedAddresses(items);
    } catch {
      // No bloquear checkout si falla libreta
    }
  }, [storeGateway]);

  useEffect(() => {
    if (tab === 'cart') {
      void loadAddressesForCheckout();
    }
  }, [tab, loadAddressesForCheckout]);

  // Al abrir el carrito, re-verificar productos via GET /store/products/:id (docs/contracts/store.md)
  const syncCartPricesAndStock = useCallback(async () => {
    if (cart.length === 0) return;
    setIsSyncingCart(true);
    const notices: string[] = [];
    const updated: CartItem[] = [];

    for (const item of cart) {
      try {
        const fresh = await storeGateway.getProduct(item.productId);
        if (fresh.availability === 'out_of_stock') {
          notices.push(`"${fresh.name}" se agotó y fue retirado del carrito.`);
          continue;
        }
        let qty = item.quantity;
        if (fresh.lowStockRemaining !== null && qty > fresh.lowStockRemaining) {
          qty = fresh.lowStockRemaining;
          notices.push(`"${fresh.name}": cantidad ajustada al stock disponible (${qty}).`);
        }
        if (fresh.priceCents !== item.unitPriceCents) {
          notices.push(
            `"${fresh.name}": precio actualizado de ${formatCents(item.unitPriceCents)} a ${formatCents(fresh.priceCents)}.`,
          );
        }
        updated.push({
          ...item,
          name: fresh.name,
          imageUrl: fresh.imageUrl,
          quantity: qty,
          unitPriceCents: fresh.priceCents,
        });
      } catch {
        notices.push(`"${item.name}" ya no está disponible y fue retirado del carrito.`);
      }
    }

    if (notices.length > 0) {
      setCart(updated);
      setCartAlerts(notices);
      setIdempotencyKey(generateIdempotencyKey());
    }
    setIsSyncingCart(false);
  }, [cart, storeGateway]);

  useEffect(() => {
    if (tab === 'cart' && cart.length > 0) {
      void syncCartPricesAndStock();
    }
    // Solo al abrir la pestaña del carrito
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Cargar franjas en vivo al elegir zona y fecha
  const loadSlots = useCallback(
    async (zId: string, date: string) => {
      if (!zId || !date) {
        setSlots([]);
        setDeliveryTime('');
        return;
      }
      setIsLoadingSlots(true);
      try {
        const res = await storeGateway.getDeliverySlots(zId, date);
        setSlots(res.items);
        setDeliveryTime((prev) => {
          if (res.items.some((s) => s.time === prev && s.available)) return prev;
          return res.items.find((s) => s.available)?.time ?? '';
        });
      } catch {
        setSlots([]);
        setDeliveryTime('');
      } finally {
        setIsLoadingSlots(false);
      }
    },
    [storeGateway],
  );

  useEffect(() => {
    if (tab === 'cart' && zoneId && deliveryDate) {
      void loadSlots(zoneId, deliveryDate);
    }
  }, [tab, zoneId, deliveryDate, loadSlots]);

  const addToCart = (product: CustomerProduct) => {
    if (product.availability === 'out_of_stock') return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        const maxQty =
          product.lowStockRemaining !== null
            ? Math.min(MAX_LINE_QUANTITY, product.lowStockRemaining)
            : MAX_LINE_QUANTITY;
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                unitPriceCents: product.priceCents,
                quantity: Math.min(maxQty, item.quantity + 1),
              }
            : item,
        );
      }
      if (prev.length >= MAX_ORDER_LINES) return prev;
      return [
        ...prev,
        {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          imageUrl: product.imageUrl,
          quantity: 1,
          unitPriceCents: product.priceCents,
        },
      ];
    });
    setIdempotencyKey(generateIdempotencyKey());
  };

  const updateCartQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
    setIdempotencyKey(generateIdempotencyKey());
  };

  const openProductDetail = async (productId: string) => {
    setIsLoadingProductDetail(true);
    try {
      setSelectedProduct(await storeGateway.getProduct(productId));
    } catch (err) {
      setCatalogError(errMsg(err, 'No se pudo cargar el detalle del producto.'));
    } finally {
      setIsLoadingProductDetail(false);
    }
  };

  const applySavedAddress = (addrId: string) => {
    setSelectedAddressId(addrId);
    const chosen = savedAddresses.find((a) => a.id === addrId);
    if (!chosen) return;
    setZoneId(chosen.zoneId);
    setDeliveryAddress(chosen.address);
    setRecipientName(chosen.recipientName ?? '');
    setRecipientPhone(chosen.recipientPhone ?? '');
    setLatitude(chosen.latitude);
    setLongitude(chosen.longitude);
    setIdempotencyKey(generateIdempotencyKey());
  };

  const handleCheckoutSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingOrder || cart.length === 0) return;
    if (!zoneId || deliveryAddress.trim().length < 6 || !deliveryDate || !deliveryTime) {
      setCheckoutError('Completa la zona, dirección, fecha y una franja horaria disponible.');
      return;
    }

    setIsSubmittingOrder(true);
    setCheckoutError(null);
    setCheckoutSuccess(null);

    try {
      const order = await storeGateway.placeOrder(
        {
          zoneId,
          deliveryAddress,
          deliveryDate,
          deliveryTime,
          recipientName,
          recipientPhone,
          notes,
          latitude,
          longitude,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
          })),
        },
        idempotencyKey,
      );
      setCart([]);
      setCartAlerts([]);
      setNotes('');
      setIdempotencyKey(generateIdempotencyKey());
      setOrdersRefreshToken((n) => n + 1);
      setCheckoutSuccess(
        `¡Pedido confirmado por ${formatCents(order.totalCents)} contra entrega para ${order.deliveryDate} a las ${order.deliveryTime}!`,
      );
      onOrderPlaced?.();
    } catch (err) {
      const conflicts = extractOrderConflicts(err);
      if (conflicts.length > 0) {
        const lines = conflicts.map((c) => describeConflict(c, cart));
        setCheckoutError(lines.join(' '));
        await syncCartPricesAndStock();
        if (zoneId && deliveryDate) await loadSlots(zoneId, deliveryDate);
        // Tras un 409 ORDER_CONFLICT se rota la clave para el próximo intento corregido
        setIdempotencyKey(generateIdempotencyKey());
      } else {
        setCheckoutError(errMsg(err, 'No se pudo completar tu pedido. Puedes reintentar con seguridad.'));
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const cartUnits = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  const cartTotalCents = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity * item.unitPriceCents, 0),
    [cart],
  );

  const tabIndex = ['catalog', 'cart', 'orders', 'addresses'].indexOf(tab);
  const segmentedStyle = {
    '--seg-index': tabIndex,
    '--seg-count': 4,
  } as CSSProperties;

  return (
    <section className="store-layout" aria-labelledby="customer-store-title">
      <SectionHeader
        title="Tienda Millast"
        actions={
          <div
            className="segmented store-tabs"
            role="tablist"
            aria-label="Secciones de la tienda"
            style={segmentedStyle}
          >
            <span className="segmented__thumb" aria-hidden="true" />
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'catalog'}
              className={`store-tab ${tab === 'catalog' ? 'store-tab--active' : ''}`}
              onClick={() => setTab('catalog')}
            >
              Catálogo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'cart'}
              className={`store-tab ${tab === 'cart' ? 'store-tab--active' : ''}`}
              onClick={() => setTab('cart')}
            >
              Carrito ({cartUnits})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'orders'}
              className={`store-tab ${tab === 'orders' ? 'store-tab--active' : ''}`}
              onClick={() => setTab('orders')}
            >
              Mis compras
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'addresses'}
              className={`store-tab ${tab === 'addresses' ? 'store-tab--active' : ''}`}
              onClick={() => setTab('addresses')}
            >
              Direcciones
            </button>
          </div>
        }
      />
      <h2 id="customer-store-title" className="sr-only">
        Tienda Millast para clientes
      </h2>

      {tab === 'catalog' && (
        <Card className="store-card">
          <form
            className="store-filters"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              void loadProducts(1);
            }}
          >
            <TextInput
              id="store-search-q"
              label="Buscar productos"
              placeholder="Nombre, marca o categoría"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              maxLength={60}
            />
            <Select
              id="store-filter-category"
              label="Categoría"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setPage(1);
              }}
              options={[
                { value: '', label: 'Todas las categorías' },
                ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
              ]}
            />
            <TextInput
              id="store-min-price"
              label="Precio mín. (USD)"
              placeholder="0.00"
              inputMode="decimal"
              value={minPriceDollars}
              onChange={(e) => setMinPriceDollars(e.target.value)}
            />
            <TextInput
              id="store-max-price"
              label="Precio máx. (USD)"
              placeholder="500.00"
              inputMode="decimal"
              value={maxPriceDollars}
              onChange={(e) => setMaxPriceDollars(e.target.value)}
            />
            <Select
              id="store-sort"
              label="Ordenar por"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as ProductSort);
                setPage(1);
              }}
              options={[...PRODUCT_SORT_OPTIONS]}
            />
            <label className="store-checkbox">
              <input
                type="checkbox"
                checked={onSaleOnly}
                onChange={(e) => {
                  setOnSaleOnly(e.target.checked);
                  setPage(1);
                }}
              />
              <span>Solo ofertas</span>
            </label>
            <div className="store-filters__actions">
              <Button type="submit" size="sm" isLoading={isLoadingProducts}>
                Buscar
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchText('');
                  setCategoryId('');
                  setMinPriceDollars('');
                  setMaxPriceDollars('');
                  setOnSaleOnly(false);
                  setSort('relevance');
                  setPage(1);
                }}
              >
                Limpiar
              </Button>
            </div>
          </form>

          {catalogError && (
            <Alert type="error" title="Catálogo no disponible" onClose={() => setCatalogError(null)}>
              {catalogError}
            </Alert>
          )}

          {isLoadingProducts && products.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '36px' }}>
              <Spinner size="lg" label="Cargando catálogo..." />
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              title="No se encontraron productos"
              description="Prueba ajustando los filtros de búsqueda, categoría o rango de precios."
            />
          ) : (
            <>
              <div className="store-product-grid">
                {products.map((product) => {
                  const imgSrc = storeGateway.resolveImageUrl(product.imageUrl);
                  const out = product.availability === 'out_of_stock';
                  const inCart = cart.find((c) => c.productId === product.id)?.quantity ?? 0;

                  return (
                    <article key={product.id} className="store-product-card">
                      <div className="store-product-card__media">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={product.name}
                            className="store-product-card__img"
                            loading="lazy"
                          />
                        ) : (
                          <span className="store-product-card__placeholder">{product.category.name}</span>
                        )}
                        {product.discountPercent !== null && product.discountPercent > 0 && (
                          <span className="store-product-card__discount">-{product.discountPercent}%</span>
                        )}
                      </div>

                      <div className="store-product-card__body">
                        <div className="store-product-card__meta">
                          <span>{product.category.name}</span>
                          {product.availability === 'in_stock' && (
                            <span className="store-pill store-pill--green">Disponible</span>
                          )}
                          {product.availability === 'low_stock' && (
                            <span className="store-pill store-pill--amber">
                              Quedan {product.lowStockRemaining}
                            </span>
                          )}
                          {out && <span className="store-pill store-pill--red">Agotado</span>}
                        </div>

                        <h3 className="store-product-card__name">{product.name}</h3>
                        {product.brand && <span className="store-card__subtitle">{product.brand}</span>}

                        <div className="store-product-card__price-row">
                          <span className="store-price">{formatCents(product.priceCents)}</span>
                          {product.compareAtPriceCents !== null && (
                            <span className="store-price--compare">
                              {formatCents(product.compareAtPriceCents)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="store-product-card__actions">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          isLoading={isLoadingProductDetail}
                          onClick={() => void openProductDetail(product.id)}
                        >
                          Detalle
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          disabled={out}
                          onClick={() => addToCart(product)}
                        >
                          {inCart > 0 ? `+ Agregar (${inCart})` : 'Agregar'}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {total > pageSize && (
                <div className="store-pagination">
                  <span className="store-pagination__info">
                    Página {page} · {total} productos
                  </span>
                  <div className="store-pagination__actions">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={page <= 1 || isLoadingProducts}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={page * pageSize >= total || isLoadingProducts}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {tab === 'cart' && (
        <div className="store-checkout-grid">
          <Card className="store-card">
            <div className="store-card__header">
              <h3 className="store-card__title">Tu carrito</h3>
              <span className="store-pill store-pill--blue">
                {cartUnits} {cartUnits === 1 ? 'unidad' : 'unidades'}
              </span>
            </div>

            {isSyncingCart && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Spinner size="sm" label="Verificando precios y stock..." />
                <span className="store-card__subtitle">Verificando precios y disponibilidad actuales...</span>
              </div>
            )}

            {cartAlerts.length > 0 && (
              <Alert type="warning" title="Actualizaciones en tu carrito" onClose={() => setCartAlerts([])}>
                {cartAlerts.join(' ')}
              </Alert>
            )}

            {checkoutSuccess && (
              <Alert type="success" title="Compra registrada" onClose={() => setCheckoutSuccess(null)}>
                {checkoutSuccess}
              </Alert>
            )}

            {cart.length === 0 ? (
              <EmptyState
                title="Tu carrito está vacío"
                description="Agrega productos desde el catálogo para programar tu entrega contra entrega."
                action={
                  <Button type="button" variant="primary" size="sm" onClick={() => setTab('catalog')}>
                    Explorar catálogo
                  </Button>
                }
              />
            ) : (
              <>
                <ul className="store-cart-list">
                  {cart.map((item) => (
                    <li key={item.productId} className="store-cart-item">
                      <div className="store-cart-item__info">
                        <span className="store-cart-item__name">{item.name}</span>
                        <span className="store-cart-item__meta">
                          {item.sku} · {formatCents(item.unitPriceCents)} c/u
                        </span>
                      </div>
                      <div className="store-qty">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          aria-label={`Reducir cantidad de ${item.name}`}
                          onClick={() => updateCartQty(item.productId, -1)}
                        >
                          −
                        </Button>
                        <span className="store-qty__value">{item.quantity}</span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={item.quantity >= MAX_LINE_QUANTITY}
                          aria-label={`Aumentar cantidad de ${item.name}`}
                          onClick={() => updateCartQty(item.productId, 1)}
                        >
                          +
                        </Button>
                      </div>
                      <strong>{formatCents(item.quantity * item.unitPriceCents)}</strong>
                    </li>
                  ))}
                </ul>

                <div className="store-total-bar">
                  <div>
                    <span className="store-card__subtitle">Pago contra entrega (efectivo)</span>
                    <p style={{ fontWeight: 700, marginTop: '2px' }}>Total a pagar</p>
                  </div>
                  <span className="store-price">{formatCents(cartTotalCents)}</span>
                </div>
              </>
            )}
          </Card>

          <Card className="store-card">
            <h3 className="store-card__title">Entrega y confirmación</h3>
            <form className="store-form" onSubmit={handleCheckoutSubmit} noValidate>
              {checkoutError && (
                <Alert type="error" title="No se pudo completar el pedido" onClose={() => setCheckoutError(null)}>
                  {checkoutError}
                </Alert>
              )}

              {savedAddresses.length > 0 && (
                <Select
                  id="checkout-saved-addr"
                  label="Usar dirección guardada (opcional)"
                  value={selectedAddressId}
                  onChange={(e) => applySavedAddress(e.target.value)}
                  options={[
                    { value: '', label: 'Escribir o elegir en el mapa...' },
                    ...savedAddresses.map((addr) => ({
                      value: addr.id,
                      label: `${addr.label}${addr.isDefault ? ' (Predeterminada)' : ''} · ${addr.address}`,
                    })),
                  ]}
                />
              )}

              <div className="store-form__row">
                <Select
                  id="checkout-zone"
                  label="Zona de entrega"
                  value={zoneId}
                  onChange={(e) => {
                    setZoneId(e.target.value);
                    setIdempotencyKey(generateIdempotencyKey());
                  }}
                  options={zones.map((z) => ({ value: z.id, label: z.name }))}
                  isRequired
                  disabled={isSubmittingOrder}
                />
                <TextInput
                  id="checkout-date"
                  type="date"
                  label="Fecha de entrega"
                  value={deliveryDate}
                  onChange={(e) => {
                    setDeliveryDate(e.target.value);
                    setIdempotencyKey(generateIdempotencyKey());
                  }}
                  isRequired
                  disabled={isSubmittingOrder}
                />
              </div>

              <div>
                <p className="ui-input-label" style={{ marginBottom: '6px' }}>
                  Franja horaria disponible *
                </p>
                {isLoadingSlots ? (
                  <Spinner size="sm" label="Consultando cupos..." />
                ) : slots.length === 0 ? (
                  <p className="store-card__subtitle">
                    No hay franjas disponibles para la zona y fecha elegidas.
                  </p>
                ) : (
                  <div className="store-slots-grid" role="group" aria-label="Franjas horarias">
                    {slots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available || isSubmittingOrder}
                        className={`store-slot-btn ${deliveryTime === slot.time ? 'store-slot-btn--selected' : ''}`}
                        onClick={() => {
                          setDeliveryTime(slot.time);
                          setIdempotencyKey(generateIdempotencyKey());
                        }}
                      >
                        <span className="store-slot-btn__time">{slot.time}</span>
                        <span className="store-slot-btn__cap">
                          {slot.available ? `${slot.capacity - slot.reserved} libres` : 'Llena'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <TextInput
                id="checkout-address"
                label="Dirección de entrega"
                placeholder="Ej. Av. Amazonas N34-120 y República"
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  setIdempotencyKey(generateIdempotencyKey());
                }}
                isRequired
                maxLength={200}
                disabled={isSubmittingOrder}
              />

              <EcuadorMapPicker
                latitude={latitude}
                longitude={longitude}
                onChange={({ latitude: lat, longitude: lng }) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  setIdempotencyKey(generateIdempotencyKey());
                }}
                onAddressSuggested={(suggested) => {
                  if (deliveryAddress.trim().length === 0) setDeliveryAddress(suggested);
                }}
                disabled={isSubmittingOrder}
              />

              <div className="store-form__row">
                <TextInput
                  id="checkout-recipient"
                  label="Destinatario (opcional)"
                  placeholder="Ej. Sofía Montalvo"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  maxLength={100}
                  disabled={isSubmittingOrder}
                />
                <TextInput
                  id="checkout-phone"
                  label="Teléfono (opcional)"
                  placeholder="Ej. +593 99 123 4567"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  maxLength={30}
                  disabled={isSubmittingOrder}
                />
              </div>

              <TextInput
                id="checkout-notes"
                label="Indicaciones de entrega (opcional)"
                placeholder="Ej. Tocar el timbre dos veces"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={200}
                disabled={isSubmittingOrder}
              />

              <div className="store-form__actions">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingOrder}
                  disabled={cart.length === 0 || deliveryTime.length === 0 || isSubmittingOrder}
                >
                  Confirmar pedido ({formatCents(cartTotalCents)})
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {tab === 'orders' && (
        <CustomerStoreOrdersPanel
          storeGateway={storeGateway}
          zones={zones}
          refreshToken={ordersRefreshToken}
        />
      )}

      {tab === 'addresses' && (
        <CustomerAddressesPanel
          storeGateway={storeGateway}
          zones={zones}
          onAddressesChanged={setSavedAddresses}
        />
      )}

      {selectedProduct && (
        <Modal
          title={selectedProduct.name}
          description={`${selectedProduct.category.name} · SKU ${selectedProduct.sku}`}
          onClose={() => setSelectedProduct(null)}
          footer={
            <>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedProduct(null)}>
                Cerrar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={selectedProduct.availability === 'out_of_stock'}
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                }}
              >
                Agregar al carrito ({formatCents(selectedProduct.priceCents)})
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {storeGateway.resolveImageUrl(selectedProduct.imageUrl) && (
              <img
                src={storeGateway.resolveImageUrl(selectedProduct.imageUrl) ?? ''}
                alt={selectedProduct.name}
                style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '16px' }}
              />
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <span className="store-price">{formatCents(selectedProduct.priceCents)}</span>
              {selectedProduct.compareAtPriceCents !== null && (
                <span className="store-price--compare">
                  {formatCents(selectedProduct.compareAtPriceCents)}
                </span>
              )}
              {selectedProduct.discountPercent !== null && (
                <span className="store-pill store-pill--blue">-{selectedProduct.discountPercent}%</span>
              )}
            </div>
            {selectedProduct.brand && (
              <p className="wf-modal__paragraph">
                <strong>Marca:</strong> {selectedProduct.brand}
              </p>
            )}
            <p className="wf-modal__paragraph">
              {selectedProduct.description ?? 'Sin descripción adicional registrada.'}
            </p>
          </div>
        </Modal>
      )}
    </section>
  );
};

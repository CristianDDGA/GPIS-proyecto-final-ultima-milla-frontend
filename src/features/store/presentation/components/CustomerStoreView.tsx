import { useCallback, useEffect, useRef, useState, type FC, type FormEvent, type ReactNode } from 'react';
import type { Zone } from '../../../zones/domain/index.js';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ProductGridSkeleton,
  Select,
  Skeleton,
  TextInput,
  TopRefetchBar,
} from '../../../../shared/ui/index.js';
import {
  MAX_LINE_QUANTITY,
  MAX_ORDER_LINES,
  PRODUCT_SORT_OPTIONS,
  formatCents,
  generateIdempotencyKey,
  todayInEcuador,
  type CartItem,
  type CustomerProduct,
  type DeliverySlot,
  type OrderConflict,
  type ProductSort,
  type StoreOrderDetail,
} from '../../domain/storeTypes.js';
import { extractOrderConflicts, type HttpStoreGateway } from '../../infrastructure/http/httpStoreGateway.js';
import { describeDelivery, orderCode } from './ClientOrdersView.js';
import { EcuadorMapPicker } from './EcuadorMapPicker.js';
import { useClientShop } from '../ClientShopContext.js';
import '../styles/store.css';
import '../styles/client.css';

export interface CustomerStoreViewProps {
  readonly storeGateway: HttpStoreGateway;
  readonly zones: readonly Zone[];
  readonly onOrderPlaced?: (() => void) | undefined;
  /** Abre el seguimiento del pedido recién confirmado. */
  readonly onViewOrder?: ((orderId: string) => void) | undefined;
}

type StoreScreen = 'catalog' | 'product' | 'cart' | 'checkout';
type CheckoutStep = 1 | 2 | 3;

const PAGE_SIZE = 12;

function errMsg(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function describeConflict(conflict: OrderConflict, cart: readonly CartItem[]): string {
  const name = cart.find((c) => c.productId === conflict.productId)?.name ?? 'Un producto';
  switch (conflict.reason) {
    case 'price_changed':
      return `${name} cambió de precio a ${formatCents(conflict.currentPriceCents ?? 0)}.`;
    case 'insufficient_stock':
      return `De ${name} solo quedan ${conflict.available ?? 0}.`;
    case 'unavailable':
      return `${name} ya no está disponible.`;
    case 'slot_full':
      return 'Ese horario se llenó. Elige otro.';
    case 'slot_unavailable':
      return 'Ese horario ya no está disponible. Elige otro.';
    case 'slot_invalid':
      return 'Ese horario no es válido. Elige otro.';
    case 'zone_inactive':
      return 'Por ahora no llegamos a ese sector.';
  }
}

/** Hoy y los dos días siguientes (Ecuador), para elegir el día con un toque. */
function nextDays(today: string): ReadonlyArray<{ date: string; label: string; detail: string }> {
  return [0, 1, 2].map((offset) => {
    const day = new Date(`${today}T12:00:00Z`);
    day.setUTCDate(day.getUTCDate() + offset);
    const date = day.toISOString().slice(0, 10);
    const detail = new Intl.DateTimeFormat('es-EC', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(day);
    const raw = offset === 0 ? 'hoy' : offset === 1 ? 'mañana' : (detail.split(' ')[0] ?? detail).replace(/[.,]/g, '');
    return { date, label: raw.charAt(0).toUpperCase() + raw.slice(1), detail };
  });
}

/** Icono de bolsa para productos sin foto. */
const BagGlyph: FC<{ readonly size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M6 8h12l-1 12H7L6 8z" />
    <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
  </svg>
);

export const CustomerStoreView: FC<CustomerStoreViewProps> = ({ storeGateway, zones, onOrderPlaced, onViewOrder }) => {
  const [screen, setScreen] = useState<StoreScreen>('catalog');

  const shop = useClientShop();
  const { cart, setCart, categories, searchText, categoryId } = shop;
  const savedAddresses = shop.addresses;

  // Catálogo
  const [products, setProducts] = useState<readonly CustomerProduct[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [sort, setSort] = useState<ProductSort>('relevance');

  // Producto abierto
  const [selectedProduct, setSelectedProduct] = useState<CustomerProduct | null>(null);
  const [qtySel, setQtySel] = useState(1);

  // Carrito (compartido con la barra superior)
  const [cartAlerts, setCartAlerts] = useState<string[]>([]);
  const [isSyncingCart, setIsSyncingCart] = useState(false);

  // Compra
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [useOtherAddress, setUseOtherAddress] = useState(false);
  const [addressTyped, setAddressTyped] = useState(false);
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
  // Detección automática de zona por el pin (solo si el negocio ya definió la cobertura de alguna zona).
  const [zoneLookup, setZoneLookup] = useState<'idle' | 'loading' | 'found' | 'outside' | 'error'>('idle');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => generateIdempotencyKey());
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>(1);
  const [placedOrder, setPlacedOrder] = useState<StoreOrderDetail | null>(null);

  // Promesa de entrega en las tarjetas ("Llega hoy desde las 17:00"), con los cupos reales del sector.
  const [promise, setPromise] = useState<string | null>(null);
  const skippedTodayRef = useRef(false);

  const rotateKey = () => setIdempotencyKey(generateIdempotencyKey());
  const go = (next: StoreScreen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (zoneId.length === 0 && zones[0]) setZoneId(zones[0].id);
  }, [zones, zoneId]);

  const loadProducts = useCallback(
    async (targetPage: number) => {
      setIsLoadingProducts(true);
      setCatalogError(null);
      try {
        const res = await storeGateway.listProducts({
          q: searchText,
          categoryId: categoryId || undefined,
          onSale: onSaleOnly ? true : undefined,
          sort,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setProducts(res.items);
        setTotal(res.total);
      } catch (err) {
        setCatalogError(errMsg(err, 'No pudimos cargar los productos.'));
      } finally {
        setIsLoadingProducts(false);
      }
    },
    [storeGateway, searchText, categoryId, onSaleOnly, sort],
  );

  const coverageMode = zones.some((zone) => zone.coverage);

  // Con el pin puesto, el sistema decide la zona: el cliente ya no la elige a mano.
  useEffect(() => {
    if (!coverageMode || latitude === null || longitude === null) {
      setZoneLookup('idle');
      return undefined;
    }
    let cancelled = false;
    setZoneLookup('loading');
    const timer = setTimeout(() => {
      storeGateway
        .lookupZone(latitude, longitude)
        .then((zone) => {
          if (cancelled) return;
          if (zone) {
            setZoneId(zone.id);
            setZoneLookup('found');
          } else {
            setZoneLookup('outside');
          }
        })
        .catch(() => {
          if (!cancelled) setZoneLookup('error');
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coverageMode, latitude, longitude, storeGateway]);

  useEffect(() => {
    void loadProducts(page);
  }, [loadProducts, page]);

  // Sin direcciones guardadas, la compra empieza con el mapa.
  useEffect(() => {
    if (savedAddresses.length === 0) setUseOtherAddress(true);
  }, [savedAddresses]);

  const applySavedAddress = useCallback(
    (addrId: string) => {
      const chosen = savedAddresses.find((a) => a.id === addrId);
      if (!chosen) return;
      setSelectedAddressId(addrId);
      setUseOtherAddress(false);
      setZoneId(chosen.zoneId);
      setDeliveryAddress(chosen.address);
      setRecipientName(chosen.recipientName ?? '');
      setRecipientPhone(chosen.recipientPhone ?? '');
      setLatitude(chosen.latitude);
      setLongitude(chosen.longitude);
      setIdempotencyKey(generateIdempotencyKey());
    },
    [savedAddresses],
  );

  // La dirección elegida en la barra ("Entregar a…"), o la predeterminada, queda elegida al comprar.
  useEffect(() => {
    if (savedAddresses.length === 0) return;
    const fromBar = savedAddresses.find((address) => address.id === shop.preferredAddressId);
    if (fromBar) {
      if (fromBar.id !== selectedAddressId) applySavedAddress(fromBar.id);
      return;
    }
    if (selectedAddressId || useOtherAddress) return;
    const preferred = savedAddresses.find((address) => address.isDefault) ?? savedAddresses[0];
    if (preferred) applySavedAddress(preferred.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedAddresses, shop.preferredAddressId]);

  // La barra superior pide ir al carrito o al catálogo.
  useEffect(() => {
    const requested = shop.takeScreenRequest();
    if (requested === null) return;
    setPlacedOrder(null);
    if (requested === 'cart') {
      go('cart');
      void syncCart();
    } else {
      go('catalog');
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.screenRequest.seq]);

  useEffect(() => {
    if (!zoneId) {
      setPromise(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await storeGateway.getDeliverySlots(zoneId, todayInEcuador());
        const first = res.items.find((slot) => slot.available);
        if (!cancelled) setPromise(first ? `Llega hoy desde las ${first.time}` : 'Llega mañana');
      } catch {
        if (!cancelled) setPromise(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeGateway, zoneId]);

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
        // Si hoy ya no quedan horarios, se pasa solo a mañana (una vez) para no mostrar una pantalla vacía.
        if (date === todayInEcuador() && !res.items.some((s) => s.available) && !skippedTodayRef.current) {
          skippedTodayRef.current = true;
          const tomorrow = new Date(`${date}T12:00:00Z`);
          tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
          setDeliveryDate(tomorrow.toISOString().slice(0, 10));
        }
        setSlots(res.items);
        setDeliveryTime((prev) => (res.items.some((s) => s.time === prev && s.available) ? prev : (res.items.find((s) => s.available)?.time ?? '')));
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
    if (screen === 'checkout' && zoneId && deliveryDate) void loadSlots(zoneId, deliveryDate);
  }, [screen, zoneId, deliveryDate, loadSlots]);

  // Al abrir el carrito se revisan precio y disponibilidad de cada producto.
  const syncCart = useCallback(async () => {
    if (cart.length === 0) return;
    setIsSyncingCart(true);
    const notices: string[] = [];
    const updated: CartItem[] = [];
    for (const item of cart) {
      try {
        const fresh = await storeGateway.getProduct(item.productId);
        if (fresh.availability === 'out_of_stock') {
          notices.push(`${fresh.name} se agotó y lo quitamos del carrito.`);
          continue;
        }
        let qty = item.quantity;
        if (fresh.lowStockRemaining !== null && qty > fresh.lowStockRemaining) {
          qty = fresh.lowStockRemaining;
          notices.push(`De ${fresh.name} solo quedan ${qty}; ajustamos la cantidad.`);
        }
        if (fresh.priceCents !== item.unitPriceCents) {
          notices.push(`${fresh.name} ahora cuesta ${formatCents(fresh.priceCents)}.`);
        }
        updated.push({ ...item, name: fresh.name, imageUrl: fresh.imageUrl, quantity: qty, unitPriceCents: fresh.priceCents });
      } catch {
        notices.push(`${item.name} ya no está disponible y lo quitamos del carrito.`);
      }
    }
    if (notices.length > 0) {
      setCart(updated);
      setCartAlerts(notices);
      setIdempotencyKey(generateIdempotencyKey());
    }
    setIsSyncingCart(false);
  }, [cart, setCart, storeGateway]);

  const maxQtyFor = (product: Pick<CustomerProduct, 'lowStockRemaining'>) =>
    product.lowStockRemaining !== null ? Math.min(MAX_LINE_QUANTITY, product.lowStockRemaining) : MAX_LINE_QUANTITY;

  const addToCart = (product: CustomerProduct, quantity = 1) => {
    if (product.availability === 'out_of_stock') return;
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, unitPriceCents: product.priceCents, quantity: Math.min(maxQtyFor(product), item.quantity + quantity) }
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
          quantity: Math.min(maxQtyFor(product), quantity),
          unitPriceCents: product.priceCents,
        },
      ];
    });
    rotateKey();
  };

  const setCartQty = (productId: string, quantity: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.productId === productId ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, quantity) } : item))
        .filter((item) => item.quantity > 0),
    );
    rotateKey();
  };

  const openProduct = async (productId: string) => {
    try {
      const fresh = await storeGateway.getProduct(productId);
      setSelectedProduct(fresh);
      setQtySel(1);
      go('product');
    } catch (err) {
      setCatalogError(errMsg(err, 'No pudimos abrir el producto.'));
    }
  };

  const openCart = () => {
    go('cart');
    void syncCart();
  };

  const openCheckout = () => {
    setCheckoutStep(1);
    setCheckoutError(null);
    go('checkout');
  };

  const handleCheckoutSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmittingOrder || cart.length === 0) return;
    if (!zoneId || deliveryAddress.trim().length < 6 || !deliveryDate || !deliveryTime) {
      setCheckoutError('Revisa la dirección y elige un horario disponible.');
      return;
    }
    setIsSubmittingOrder(true);
    setCheckoutError(null);
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
          items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity, unitPriceCents: item.unitPriceCents })),
        },
        idempotencyKey,
      );
      setPlacedOrder(order);
      setCart([]);
      setCartAlerts([]);
      setNotes('');
      setCheckoutStep(1);
      setIdempotencyKey(generateIdempotencyKey());
      onOrderPlaced?.();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const conflicts = extractOrderConflicts(err);
      if (conflicts.length > 0) {
        setCheckoutError(conflicts.map((c) => describeConflict(c, cart)).join(' '));
        await syncCart();
        if (zoneId && deliveryDate) await loadSlots(zoneId, deliveryDate);
        setIdempotencyKey(generateIdempotencyKey());
      } else {
        setCheckoutError(errMsg(err, 'No pudimos completar tu pedido. Puedes intentarlo de nuevo sin riesgo.'));
      }
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  const { cartUnits, cartTotalCents } = shop;
  const days = nextDays(todayInEcuador());
  const availableSlots = slots.filter((slot) => slot.available);
  const chosenAddress = savedAddresses.find((address) => address.id === selectedAddressId) ?? null;
  const zoneName = zones.find((zone) => zone.id === zoneId)?.name ?? '';
  const whenText = deliveryTime ? describeDelivery(deliveryDate, deliveryTime) : '';
  // Con cobertura definida, una dirección nueva exige pin y que una zona lo cubra; si la consulta falla se
  // permite elegir el sector a mano para no frenar la compra.
  const zoneBlocked =
    coverageMode &&
    latitude !== null &&
    (zoneLookup === 'outside' || zoneLookup === 'loading' || zoneLookup === 'idle');
  const needsPin = coverageMode && useOtherAddress && latitude === null;
  const addressReady =
    zoneId.length > 0 && deliveryAddress.trim().length >= 6 && !zoneBlocked && !needsPin;
  const listTitle = categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? 'Productos') : searchText ? `Resultados para «${searchText}»` : 'Recomendado para ti';

  const productTile = (imageUrl: string | null, name: string, size: 'card' | 'large' | 'thumb'): ReactNode => {
    const src = storeGateway.resolveImageUrl(imageUrl);
    return (
      <div className={`client-tile client-tile--${size}`}>
        {src ? <img src={src} alt={name} loading="lazy" /> : <BagGlyph size={size === 'thumb' ? 28 : size === 'large' ? 120 : 56} />}
      </div>
    );
  };

  const summaryCard = (
    <Card className="store-card">
      <h3 className="store-card__title">Resumen</h3>
      <ul className="client-lines">
        {cart.map((item) => (
          <li key={item.productId}>
            <span className="client-muted">
              {item.quantity} × {item.name}
            </span>
            <span>{formatCents(item.quantity * item.unitPriceCents)}</span>
          </li>
        ))}
        <li>
          <span className="client-muted">Envío</span>
          <span style={{ color: '#047857', fontWeight: 650 }}>Sin costo</span>
        </li>
      </ul>
      <div className="client-total-row">
        <strong>Total</strong>
        <span className="store-price">{formatCents(cartTotalCents)}</span>
      </div>
      <p className="client-muted">Pagas en efectivo al repartidor.</p>
    </Card>
  );

  // ------------------------------------------------------------------ pedido confirmado
  if (placedOrder !== null) {
    const lines = placedOrder.items ?? [];
    const when = describeDelivery(placedOrder.deliveryDate, placedOrder.deliveryTime);
    return (
      <section className="client-stack client-narrow" aria-labelledby="client-confirm-title">
        <Card className="store-card client-success">
          <span className="client-success__icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 id="client-confirm-title" className="client-heading" style={{ fontSize: '26px' }}>
            ¡Listo! Recibimos tu pedido
          </h2>
          <p className="client-muted" style={{ fontSize: '15px' }}>
            Pedido <span className="store-pill">{orderCode(placedOrder.id)}</span> · te enviamos el detalle a tu correo.
          </p>
          <p className="client-success__eta">Llega {when}</p>
        </Card>

        <Card className="store-card">
          <h3 className="store-card__title">Lo que pediste</h3>
          <ul className="client-lines">
            {lines.map((line) => (
              <li key={line.productId}>
                <span>
                  {line.quantity} × {line.name}
                </span>
                <strong>{formatCents(line.lineTotalCents)}</strong>
              </li>
            ))}
          </ul>
          <div className="client-summary-blocks">
            <div className="client-block">
              <p className="client-label">Dirección</p>
              <p>{placedOrder.deliveryAddress}</p>
            </div>
            <div className="client-block">
              <p className="client-label">Cuándo</p>
              <p className="client-capitalize">{when}</p>
            </div>
            <div className="client-block">
              <p className="client-label">Pago</p>
              <p>
                Efectivo al recibir · <strong>{formatCents(placedOrder.totalCents)}</strong>
              </p>
            </div>
          </div>
        </Card>

        <Card className="store-card">
          <h3 className="store-card__title">¿Qué pasa ahora?</h3>
          <ol className="client-next-steps">
            <li>Preparamos tu pedido y le asignamos un repartidor.</li>
            <li>Te avisamos por correo cuando salga a entregarlo.</li>
            <li>Pagas en efectivo al recibirlo.</li>
          </ol>
          <p className="client-muted">Puedes cancelarlo sin costo hasta que salga a entregarse.</p>
        </Card>

        <div className="client-actions" style={{ justifyContent: 'center' }}>
          {onViewOrder && (
            <Button type="button" variant="primary" onClick={() => onViewOrder(placedOrder.id)}>
              Ver estado del pedido
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setPlacedOrder(null);
              go('catalog');
            }}
          >
            Seguir comprando
          </Button>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------ detalle del producto
  if (screen === 'product' && selectedProduct !== null) {
    const product = selectedProduct;
    const out = product.availability === 'out_of_stock';
    const maxQty = maxQtyFor(product);
    return (
      <section className="client-stack" aria-labelledby="client-product-title">
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={() => go('catalog')}>
            ← Volver a los productos
          </Button>
        </div>
        <div className="client-grid">
          <Card className="store-card client-product-media">{productTile(product.imageUrl, product.name, 'large')}</Card>
          <div className="client-grid__main client-product-info">
            <p className="client-label">{product.category.name}</p>
            <h2 id="client-product-title" className="client-heading" style={{ fontSize: '28px' }}>
              {product.name}
            </h2>
            {product.brand && <p className="client-muted">Marca: {product.brand}</p>}
            <p className="client-body">{product.description ?? 'Producto disponible en la tienda Millast.'}</p>
            <ul className="client-bullets">
              <li>Pagas en efectivo cuando te lo entregan.</li>
              <li>Eliges el día y la hora de entrega.</li>
              <li>Puedes cancelar mientras no haya salido.</li>
            </ul>
          </div>
          <aside className="client-grid__side">
            <Card className="store-card client-buybox">
              <div className="client-price-row">
                <span className="client-price-lg">{formatCents(product.priceCents)}</span>
                {product.compareAtPriceCents !== null && <span className="store-price--compare">{formatCents(product.compareAtPriceCents)}</span>}
                {product.discountPercent !== null && product.discountPercent > 0 && (
                  <span className="client-sale-badge">-{product.discountPercent}%</span>
                )}
              </div>
              {out ? (
                <p className="client-stock client-stock--out">Agotado por ahora</p>
              ) : product.availability === 'low_stock' ? (
                <p className="client-stock client-stock--low">¡Quedan {product.lowStockRemaining}!</p>
              ) : (
                <p className="client-stock">Disponible</p>
              )}
              {promise && !out && <p className="client-promise">{promise}</p>}
              {!out && (
                <div className="client-qty-row">
                  <span className="client-label" style={{ margin: 0 }}>
                    Cantidad
                  </span>
                  <div className="store-qty">
                    <Button type="button" variant="secondary" size="sm" aria-label="Quitar uno" disabled={qtySel <= 1} onClick={() => setQtySel((q) => Math.max(1, q - 1))}>
                      −
                    </Button>
                    <span className="store-qty__value">{qtySel}</span>
                    <Button type="button" variant="secondary" size="sm" aria-label="Agregar uno" disabled={qtySel >= maxQty} onClick={() => setQtySel((q) => Math.min(maxQty, q + 1))}>
                      +
                    </Button>
                  </div>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                disabled={out}
                onClick={() => {
                  addToCart(product, qtySel);
                  openCart();
                }}
              >
                Agregar al carrito
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={out}
                onClick={() => {
                  addToCart(product, qtySel);
                  openCheckout();
                }}
              >
                Comprar ahora
              </Button>
            </Card>
          </aside>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------ carrito
  if (screen === 'cart') {
    return (
      <section className="client-stack" aria-labelledby="client-cart-title">
        <div className="client-page-head">
          <h2 id="client-cart-title" className="client-page-title">
            Tu carrito
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={() => go('catalog')}>
            ← Seguir comprando
          </Button>
        </div>
        {isSyncingCart && (
          <p className="client-muted" role="status">
            Revisando precios y disponibilidad...
          </p>
        )}
        {cartAlerts.length > 0 && (
          <Alert type="warning" title="Actualizamos tu carrito" onClose={() => setCartAlerts([])}>
            {cartAlerts.join(' ')}
          </Alert>
        )}
        {cart.length === 0 ? (
          <Card className="store-card">
            <EmptyState
              title="Tu carrito está vacío"
              description="Agrega productos y aparecerán aquí."
              action={
                <Button type="button" variant="primary" size="sm" onClick={() => go('catalog')}>
                  Ver productos
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="client-grid">
            <Card className="store-card client-grid__main">
              <ul className="client-cart-list">
                {cart.map((item) => (
                  <li key={item.productId} className="client-cart-line">
                    {productTile(item.imageUrl, item.name, 'thumb')}
                    <div className="client-cart-line__info">
                      <p className="client-cart-line__name">{item.name}</p>
                      <p className="client-muted">{formatCents(item.unitPriceCents)} c/u</p>
                    </div>
                    <div className="store-qty">
                      <Button type="button" variant="secondary" size="sm" aria-label={`Quitar uno de ${item.name}`} onClick={() => setCartQty(item.productId, item.quantity - 1)}>
                        −
                      </Button>
                      <span className="store-qty__value">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        aria-label={`Agregar uno de ${item.name}`}
                        disabled={item.quantity >= MAX_LINE_QUANTITY}
                        onClick={() => setCartQty(item.productId, item.quantity + 1)}
                      >
                        +
                      </Button>
                    </div>
                    <strong className="client-cart-line__total">{formatCents(item.quantity * item.unitPriceCents)}</strong>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCartQty(item.productId, 0)}>
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
              <p className="client-subtotal">
                Subtotal ({cartUnits} {cartUnits === 1 ? 'producto' : 'productos'}): <strong>{formatCents(cartTotalCents)}</strong>
              </p>
            </Card>
            <aside className="client-grid__side">
              <Card className="store-card">
                <p className="client-muted" style={{ fontSize: '15px' }}>
                  Total ({cartUnits} {cartUnits === 1 ? 'producto' : 'productos'})
                </p>
                <span className="client-price-lg">{formatCents(cartTotalCents)}</span>
                <p className="client-promise">Sin costo de envío · pagas al recibir</p>
                <Button type="button" variant="primary" onClick={openCheckout}>
                  Continuar con la compra
                </Button>
                <Button type="button" variant="secondary" onClick={() => go('catalog')}>
                  Seguir comprando
                </Button>
              </Card>
            </aside>
          </div>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------------ compra en 3 pasos
  if (screen === 'checkout') {
    return (
      <section className="client-stack" aria-labelledby="client-checkout-title">
        <div className="client-page-head">
          <h2 id="client-checkout-title" className="client-page-title">
            Finalizar compra
          </h2>
          <ol className="client-steps" aria-label="Pasos de la compra">
            {(
              [
                [1, 'Dirección'],
                [2, 'Día y hora'],
                [3, 'Confirmar'],
              ] as const
            ).map(([step, label]) => (
              <li
                key={step}
                className={`client-step ${checkoutStep === step ? 'client-step--current' : ''} ${checkoutStep > step ? 'client-step--done' : ''}`}
                aria-current={checkoutStep === step ? 'step' : undefined}
              >
                <span className="client-step__dot">{step}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>

        {cart.length === 0 ? (
          <Card className="store-card">
            <EmptyState
              title="Tu carrito está vacío"
              description="Agrega productos para continuar."
              action={
                <Button type="button" variant="primary" size="sm" onClick={() => go('catalog')}>
                  Ver productos
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="client-grid">
            <div className="client-grid__main">
              {checkoutError && (
                <Alert type="error" title="No se pudo completar el pedido" onClose={() => setCheckoutError(null)}>
                  {checkoutError}
                </Alert>
              )}
              <Card className="store-card">
                {checkoutStep === 1 && (
                  <div className="client-stack">
                    <div>
                      <h3 className="client-heading" style={{ fontSize: '19px' }}>
                        ¿Dónde lo entregamos?
                      </h3>
                      <p className="client-muted">Elige una dirección guardada o marca otra en el mapa.</p>
                    </div>
                    <div className="client-options" role="radiogroup" aria-label="Dirección de entrega">
                      {savedAddresses.map((address) => {
                        const selected = !useOtherAddress && selectedAddressId === address.id;
                        return (
                          <button
                            key={address.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            className={`client-option ${selected ? 'client-option--selected' : ''}`}
                            onClick={() => applySavedAddress(address.id)}
                          >
                            <span className="client-option__radio" aria-hidden="true" />
                            <span className="client-option__body">
                              <span className="client-option__title">
                                {address.label}
                                {address.isDefault && (
                                  <span className="store-pill store-pill--blue" style={{ marginLeft: '8px' }}>
                                    Predeterminada
                                  </span>
                                )}
                              </span>
                              <span className="client-option__text">{address.address}</span>
                              {address.recipientName && <span className="client-option__text">Recibe: {address.recipientName}</span>}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        role="radio"
                        aria-checked={useOtherAddress}
                        className={`client-option ${useOtherAddress ? 'client-option--selected' : ''}`}
                        onClick={() => {
                          setUseOtherAddress(true);
                          setSelectedAddressId('');
                          setDeliveryAddress('');
                          setAddressTyped(false);
                          setLatitude(null);
                          setLongitude(null);
                          rotateKey();
                        }}
                      >
                        <span className="client-option__radio" aria-hidden="true" />
                        <span className="client-option__body">
                          <span className="client-option__title">Otra dirección</span>
                          <span className="client-option__text">Marca el punto exacto en el mapa</span>
                        </span>
                      </button>
                    </div>

                    {useOtherAddress && (
                      <div className="client-stack">
                        <EcuadorMapPicker
                          latitude={latitude}
                          longitude={longitude}
                          onChange={({ latitude: lat, longitude: lng }) => {
                            setLatitude(lat);
                            setLongitude(lng);
                            rotateKey();
                          }}
                          onAddressSuggested={(suggested) => {
                            // Si la persona no escribió la dirección a mano, cada nuevo punto la actualiza.
                            if (!addressTyped) setDeliveryAddress(suggested);
                          }}
                          disabled={isSubmittingOrder}
                        />
                        <TextInput
                          id="checkout-address"
                          label="Dirección"
                          placeholder="Ej. Av. Cevallos y Montalvo, casa verde"
                          helperText={
                            addressTyped
                              ? 'La escribiste tú: el mapa ya no la cambia. Bórrala para que vuelva a completarse sola.'
                              : 'Se completa con el punto del mapa. Agrega calle, número o una referencia.'
                          }
                          value={deliveryAddress}
                          onChange={(e) => {
                            setDeliveryAddress(e.target.value);
                            setAddressTyped(e.target.value.trim().length > 0);
                            rotateKey();
                          }}
                          isRequired
                          maxLength={200}
                        />
                        {coverageMode && zoneLookup !== 'error' ? (
                          <p
                            className={`client-muted ${zoneLookup === 'outside' ? 'client-zone-note--bad' : ''}`}
                            role="status"
                            data-testid="zone-lookup-status"
                          >
                            {latitude === null && 'Marca tu ubicación en el mapa para saber si llegamos a tu dirección.'}
                            {latitude !== null && zoneLookup === 'loading' && 'Buscando tu sector...'}
                            {latitude !== null && zoneLookup === 'found' && `Entregamos en tu zona: ${zoneName}.`}
                            {latitude !== null && zoneLookup === 'outside' && 'Aún no llegamos a esta dirección. Prueba con otro punto del mapa.'}
                          </p>
                        ) : (
                          <Select
                            id="checkout-zone"
                            label="Sector"
                            value={zoneId}
                            onChange={(e) => {
                              setZoneId(e.target.value);
                              rotateKey();
                            }}
                            options={zones.map((z) => ({ value: z.id, label: z.name }))}
                            isRequired
                          />
                        )}
                      </div>
                    )}

                    {!useOtherAddress && coverageMode && zoneLookup === 'outside' && (
                      <p className="client-muted client-zone-note--bad" role="alert">
                        Aún no llegamos a esta dirección. Elige otra dirección guardada o marca un punto distinto en el mapa.
                      </p>
                    )}

                    <div className="client-actions" style={{ justifyContent: 'flex-end' }}>
                      <Button type="button" variant="primary" disabled={!addressReady} onClick={() => setCheckoutStep(2)}>
                        Entregar aquí y continuar
                      </Button>
                    </div>
                  </div>
                )}

                {checkoutStep === 2 && (
                  <div className="client-stack">
                    <div>
                      <h3 className="client-heading" style={{ fontSize: '19px' }}>
                        ¿Cuándo te lo llevamos?
                      </h3>
                      <p className="client-muted">Solo te mostramos los horarios con cupo.</p>
                    </div>
                    <div className="client-days" role="radiogroup" aria-label="Día de entrega">
                      {days.map((day) => (
                        <button
                          key={day.date}
                          type="button"
                          role="radio"
                          aria-checked={deliveryDate === day.date}
                          className={`client-day ${deliveryDate === day.date ? 'client-day--selected' : ''}`}
                          onClick={() => {
                            setDeliveryDate(day.date);
                            rotateKey();
                          }}
                        >
                          <strong>{day.label}</strong>
                          <span>{day.detail}</span>
                        </button>
                      ))}
                    </div>
                    {isLoadingSlots ? (
                      <div className="client-slots" role="status" aria-busy="true" aria-label="Consultando horarios">
                        <Skeleton height={54} radius={16} />
                        <Skeleton height={54} radius={16} />
                        <Skeleton height={54} radius={16} />
                        <Skeleton height={54} radius={16} />
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <p className="client-muted">Ya no quedan horarios ese día. Prueba con otro día.</p>
                    ) : (
                      <div className="client-slots" role="radiogroup" aria-label="Hora de entrega">
                        {availableSlots.map((slot) => {
                          const left = slot.capacity - slot.reserved;
                          const selected = deliveryTime === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              className={`client-slot ${selected ? 'client-slot--selected' : ''}`}
                              onClick={() => {
                                setDeliveryTime(slot.time);
                                rotateKey();
                              }}
                            >
                              <strong>{describeDelivery(deliveryDate, slot.time).split(', ')[1] ?? slot.time}</strong>
                              <span className={left <= 2 ? 'client-slot__low' : ''}>
                                {left <= 2 ? (left === 1 ? 'Queda 1 cupo' : `Quedan ${left} cupos`) : 'Disponible'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="client-actions">
                      <Button type="button" variant="secondary" onClick={() => setCheckoutStep(1)}>
                        Atrás
                      </Button>
                      <Button type="button" variant="primary" disabled={deliveryTime.length === 0} onClick={() => setCheckoutStep(3)}>
                        Continuar
                      </Button>
                    </div>
                  </div>
                )}

                {checkoutStep === 3 && (
                  <form className="client-stack" onSubmit={handleCheckoutSubmit} noValidate>
                    <h3 className="client-heading" style={{ fontSize: '19px' }}>
                      Revisa y confirma
                    </h3>
                    <div className="client-summary-blocks">
                      <div className="client-block">
                        <p className="client-label">Se entrega en</p>
                        <p style={{ fontWeight: 700 }}>{chosenAddress?.label ?? 'Punto en el mapa'}</p>
                        <p className="client-muted">
                          {deliveryAddress}
                          {zoneName ? ` · ${zoneName}` : ''}
                        </p>
                        <button type="button" className="client-link-btn" onClick={() => setCheckoutStep(1)}>
                          Cambiar
                        </button>
                      </div>
                      <div className="client-block">
                        <p className="client-label">Llega</p>
                        <p className="client-capitalize" style={{ fontWeight: 700 }}>
                          {whenText}
                        </p>
                        <p className="client-muted">Te avisamos por correo cuando salga.</p>
                        <button type="button" className="client-link-btn" onClick={() => setCheckoutStep(2)}>
                          Cambiar
                        </button>
                      </div>
                      <div className="client-block">
                        <p className="client-label">Pago</p>
                        <p style={{ fontWeight: 700 }}>Efectivo al recibir</p>
                        <p className="client-muted">Ten listos {formatCents(cartTotalCents)}.</p>
                      </div>
                    </div>
                    <div className="store-form__row">
                      <TextInput
                        id="checkout-recipient"
                        label="¿Quién recibe? (opcional)"
                        placeholder="Ej. Sofía Montalvo"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        maxLength={100}
                        disabled={isSubmittingOrder}
                      />
                      <TextInput
                        id="checkout-phone"
                        label="Teléfono (opcional)"
                        placeholder="Ej. 099 123 4567"
                        value={recipientPhone}
                        onChange={(e) => setRecipientPhone(e.target.value)}
                        maxLength={30}
                        disabled={isSubmittingOrder}
                      />
                    </div>
                    <TextInput
                      id="checkout-notes"
                      label="Indicaciones para el repartidor (opcional)"
                      placeholder="Ej. Tocar el timbre dos veces"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      maxLength={200}
                      disabled={isSubmittingOrder}
                    />
                    <div className="client-actions">
                      <Button type="button" variant="secondary" onClick={() => setCheckoutStep(2)} disabled={isSubmittingOrder}>
                        Atrás
                      </Button>
                      <Button type="submit" variant="primary" isLoading={isSubmittingOrder} disabled={isSubmittingOrder}>
                        Confirmar pedido · {formatCents(cartTotalCents)}
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
            <aside className="client-grid__side">{summaryCard}</aside>
          </div>
        )}
      </section>
    );
  }

  // ------------------------------------------------------------------ catálogo
  return (
    <section className="client-stack" aria-labelledby="client-store-title">
      <div className="client-hero">
        <span className="client-hero__blob client-hero__blob--a" aria-hidden="true" />
        <span className="client-hero__blob client-hero__blob--b" aria-hidden="true" />
        <div className="client-hero__content">
          <p className="client-hero__eyebrow">{zoneName ? `Entregas en ${zoneName}` : 'Entregas en tu ciudad'}</p>
          <h2 id="client-store-title" className="client-hero__title">
            Lo pides para mañana amigo.
          </h2>
          <p className="client-hero__text">Elige tu horario de entrega y pagas en efectivo cuando lo recibes.</p>
        </div>
        {cartUnits > 0 && (
          <Button type="button" variant="secondary" className="client-hero__cart" onClick={openCart}>
            Ver carrito ({cartUnits}) · {formatCents(cartTotalCents)}
          </Button>
        )}
      </div>

      <div className="client-toolbar">
        <div className="client-chips" role="group" aria-label="Filtros">
          <button
            type="button"
            className={`client-chip ${onSaleOnly ? 'client-chip--active' : ''}`}
            aria-pressed={onSaleOnly}
            onClick={() => {
              setOnSaleOnly((value) => !value);
              setPage(1);
            }}
          >
            Solo ofertas
          </button>
          {(searchText || categoryId) && (
            <button
              type="button"
              className="client-chip"
              onClick={() => {
                shop.setSearchText('');
                shop.setCategoryId('');
                setPage(1);
              }}
            >
              Quitar filtros ×
            </button>
          )}
        </div>
        <label className="client-sort">
          <span>Ordenar</span>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as ProductSort);
              setPage(1);
            }}
          >
            {PRODUCT_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="client-page-head">
        <h3 className="client-heading">{listTitle}</h3>
        <span className="client-muted">
          {total} {total === 1 ? 'producto' : 'productos'}
        </span>
      </div>

      {catalogError && (
        <Alert type="error" title="No pudimos cargar la tienda" onClose={() => setCatalogError(null)}>
          {catalogError}
        </Alert>
      )}

      <TopRefetchBar active={isLoadingProducts && products.length > 0} label="Actualizando catálogo" />

      {isLoadingProducts && products.length === 0 ? (
        <ProductGridSkeleton count={6} />
      ) : products.length === 0 ? (
        <Card className="store-card">
          <EmptyState
            title={searchText ? `No encontramos «${searchText}»` : 'No hay productos aquí'}
            description="Prueba con otra palabra o mira todas las categorías."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  shop.setSearchText('');
                  shop.setCategoryId('');
                  setOnSaleOnly(false);
                  setPage(1);
                }}
              >
                Ver todos los productos
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="client-product-grid">
          {products.map((product) => {
            const out = product.availability === 'out_of_stock';
            const inCart = cart.find((c) => c.productId === product.id)?.quantity ?? 0;
            return (
              <article key={product.id} className="client-product">
                <button type="button" className="client-product__open" onClick={() => void openProduct(product.id)}>
                  <span className="client-product__media">
                    {productTile(product.imageUrl, product.name, 'card')}
                    {product.discountPercent !== null && product.discountPercent > 0 && (
                      <span className="client-sale-badge client-product__badge">-{product.discountPercent}%</span>
                    )}
                  </span>
                  <span className="client-product__name">{product.name}</span>
                </button>
                <div className="client-price-row">
                  <span className="client-price">{formatCents(product.priceCents)}</span>
                  {product.compareAtPriceCents !== null && <span className="store-price--compare">{formatCents(product.compareAtPriceCents)}</span>}
                </div>
                {out ? (
                  <p className="client-stock client-stock--out">Agotado por ahora</p>
                ) : product.availability === 'low_stock' ? (
                  <p className="client-stock client-stock--low">¡Quedan {product.lowStockRemaining}!</p>
                ) : (
                  promise && <p className="client-promise">{promise}</p>
                )}
                <div className="client-product__cta">
                  <Button type="button" variant={inCart > 0 ? 'secondary' : 'primary'} disabled={out} onClick={() => addToCart(product)}>
                    {out ? 'Agotado' : inCart > 0 ? `En tu carrito (${inCart}) · agregar otro` : 'Agregar al carrito'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="store-pagination">
          <span className="store-pagination__info">
            Página {page} de {Math.ceil(total / PAGE_SIZE)}
          </span>
          <div className="store-pagination__actions">
            <Button type="button" variant="secondary" size="sm" disabled={page <= 1 || isLoadingProducts} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Anterior
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={page * PAGE_SIZE >= total || isLoadingProducts} onClick={() => setPage((p) => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

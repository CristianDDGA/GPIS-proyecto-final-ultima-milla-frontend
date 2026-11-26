import { ECUADOR_BOUNDS, isWithinEcuador } from '../../../shared/geo.js';

export { ECUADOR_BOUNDS, isWithinEcuador };

export type ProductAvailability = 'in_stock' | 'low_stock' | 'out_of_stock';
export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'discount';
export type ProductStatusFilter = 'active' | 'inactive' | 'all';
export type StockReason = 'restock' | 'correction' | 'damage';

export const PRODUCT_SORT_OPTIONS: readonly { readonly value: ProductSort; readonly label: string }[] = [
  { value: 'relevance', label: 'Relevancia' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'discount', label: 'Mayor descuento' },
];

export const STOCK_REASON_LABELS: Readonly<Record<StockReason, string>> = {
  restock: 'Reposición de inventario',
  correction: 'Corrección de conteo',
  damage: 'Merma o daño',
};

export const CANCEL_REASONS = [
  'cliente_desiste',
  'error_en_pedido',
  'sin_stock',
  'no_localizable',
  'demora',
  'otro',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export const CANCEL_REASON_LABELS: Readonly<Record<CancelReason, string>> = {
  cliente_desiste: 'El cliente desiste de la compra',
  error_en_pedido: 'Error en los datos o productos del pedido',
  sin_stock: 'Sin stock disponible',
  no_localizable: 'Cliente no localizable',
  demora: 'Demora en la entrega',
  otro: 'Otro motivo',
};

export const FAILURE_REASONS = [
  'cliente_ausente',
  'direccion_incorrecta',
  'cliente_rechazo',
  'zona_inaccesible',
  'otro',
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number];

export const FAILURE_REASON_LABELS: Readonly<Record<FailureReason, string>> = {
  cliente_ausente: 'Cliente ausente en el domicilio',
  direccion_incorrecta: 'Dirección incorrecta o incompleta',
  cliente_rechazo: 'Cliente rechazó el pedido',
  zona_inaccesible: 'Zona temporalmente inaccesible',
  otro: 'Otro motivo',
};

export const STORE_ORDER_STATUS_LABELS: Readonly<Record<string, string>> = {
  pendiente: 'Pendiente',
  asignado_a_ruta: 'Asignado a ruta',
  recogido: 'Recogido',
  en_camino: 'En camino',
  entregado: 'Entregado',
  entrega_fallida: 'Entrega fallida',
  cancelado: 'Cancelado',
};

export const MAX_ORDER_LINES = 20;
export const MAX_LINE_QUANTITY = 10;
export const MAX_DELIVERY_ATTEMPTS = 3;
export const MAX_ADDRESSES = 10;

export interface StoreCategory {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly version: number;
}

export interface CustomerProduct {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly brand: string | null;
  readonly description: string | null;
  readonly category: { readonly id: string; readonly name: string };
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly discountPercent: number | null;
  readonly availability: ProductAvailability;
  readonly lowStockRemaining: number | null;
  readonly imageUrl: string | null;
}

export interface AdminProduct {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly brand: string | null;
  readonly description: string | null;
  readonly category: { readonly id: string; readonly name: string };
  readonly priceCents: number;
  readonly compareAtPriceCents: number | null;
  readonly discountPercent: number | null;
  readonly stockQuantity: number;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StorePage<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface CustomerProductFilter {
  readonly q?: string | undefined;
  readonly categoryId?: string | undefined;
  readonly minPriceCents?: number | undefined;
  readonly maxPriceCents?: number | undefined;
  readonly onSale?: boolean | undefined;
  readonly sort?: ProductSort | undefined;
  readonly page?: number | undefined;
  readonly pageSize?: number | undefined;
}

export interface AdminProductFilter extends CustomerProductFilter {
  readonly status?: ProductStatusFilter | undefined;
}

export interface CreateProductInput {
  readonly sku: string;
  readonly name: string;
  readonly brand?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly categoryId: string;
  readonly priceCents: number;
  readonly compareAtPriceCents?: number | null | undefined;
  readonly stock: number;
  readonly isActive?: boolean | undefined;
}

export interface UpdateProductInput {
  readonly expectedVersion: number;
  readonly name?: string | undefined;
  readonly brand?: string | null | undefined;
  readonly description?: string | null | undefined;
  readonly categoryId?: string | undefined;
  readonly priceCents?: number | undefined;
  readonly compareAtPriceCents?: number | null | undefined;
  readonly isActive?: boolean | undefined;
}

export interface ProductEvent {
  readonly id: string;
  readonly action: string;
  readonly actorUserId: string | null;
  readonly changes: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

export interface StoreSettings {
  readonly slotCapacity: number;
  readonly firstSlotHour: number;
  readonly lastSlotHour: number;
  readonly minLeadMinutes: number;
}

export interface DeliverySlot {
  readonly time: string;
  readonly capacity: number;
  readonly reserved: number;
  readonly available: boolean;
}

export interface DeliverySlotsResponse {
  readonly zoneId: string;
  readonly date: string;
  readonly items: readonly DeliverySlot[];
}

export interface CartItem {
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly quantity: number;
  readonly unitPriceCents: number;
}

export interface PlaceOrderInput {
  readonly zoneId: string;
  readonly deliveryAddress: string;
  readonly deliveryDate: string;
  readonly deliveryTime: string;
  readonly recipientName?: string | undefined;
  readonly recipientPhone?: string | undefined;
  readonly notes?: string | undefined;
  readonly latitude?: number | null | undefined;
  readonly longitude?: number | null | undefined;
  readonly items: readonly {
    readonly productId: string;
    readonly quantity: number;
    readonly unitPriceCents: number;
  }[];
}

export type OrderConflictReason =
  | 'unavailable'
  | 'price_changed'
  | 'insufficient_stock'
  | 'slot_invalid'
  | 'slot_unavailable'
  | 'slot_full'
  | 'zone_inactive';

export interface OrderConflict {
  readonly reason: OrderConflictReason;
  readonly productId?: string | undefined;
  readonly currentPriceCents?: number | undefined;
  readonly available?: number | undefined;
  readonly capacity?: number | undefined;
}

export interface StoreOrderLine {
  readonly productId: string;
  readonly sku: string;
  readonly name: string;
  readonly unitPriceCents: number;
  readonly quantity: number;
  readonly lineTotalCents: number;
  readonly imageUrl: string | null;
}

export interface StoreOrderSummary {
  readonly id: string;
  readonly status: string;
  readonly zoneId: string;
  readonly deliveryAddress: string;
  readonly deliveryDate: string;
  readonly deliveryTime: string;
  readonly totalCents: number;
  readonly itemsCount: number;
  readonly paymentMethod: string;
  readonly createdAt: string;
  readonly deliveryLatitude: number | null;
  readonly deliveryLongitude: number | null;
}

export interface StoreOrderDetail extends StoreOrderSummary {
  readonly customerId: string;
  readonly recipientName: string | null;
  readonly recipientPhone: string | null;
  readonly notes: string | null;
  readonly items?: readonly StoreOrderLine[] | undefined;
  /** Cada estado con su hora (ISO UTC), desde la migración 015 del backend. */
  readonly history?: readonly OrderStatusEvent[] | undefined;
  /** Nombre de pila del repartidor mientras el pedido está en una ruta activa. */
  readonly courier?: { readonly firstName: string } | null | undefined;
}

export interface OrderStatusEvent {
  readonly status: string;
  readonly at: string;
}

export interface CancelOrderResponse {
  readonly status: 'cancelado';
  readonly alreadyCancelled: boolean;
  readonly restocked: boolean;
  readonly version: number;
  readonly order: StoreOrderDetail | null;
}

export interface StoreAddress {
  readonly id: string;
  readonly label: string;
  readonly zoneId: string;
  readonly address: string;
  readonly recipientName: string | null;
  readonly recipientPhone: string | null;
  readonly isDefault: boolean;
  readonly version: number;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface CreateAddressInput {
  readonly label: string;
  readonly zoneId: string;
  readonly address: string;
  readonly recipientName?: string | undefined;
  readonly recipientPhone?: string | undefined;
  readonly isDefault?: boolean | undefined;
  readonly latitude?: number | null | undefined;
  readonly longitude?: number | null | undefined;
}

export interface UpdateAddressInput {
  readonly expectedVersion: number;
  readonly label?: string | undefined;
  readonly zoneId?: string | undefined;
  readonly address?: string | undefined;
  readonly recipientName?: string | null | undefined;
  readonly recipientPhone?: string | null | undefined;
  readonly isDefault?: boolean | undefined;
  readonly latitude?: number | null | undefined;
  readonly longitude?: number | null | undefined;
}

export interface CourierOrderLine {
  readonly name: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly lineTotalCents: number;
}

export interface CourierStoreOrder {
  readonly orderId: string;
  readonly version: number;
  readonly status: string;
  readonly routeId: string;
  readonly routeStatus: string;
  readonly position: number;
  readonly deliveryAddress: string;
  readonly deliveryDate: string;
  readonly deliveryTime: string;
  readonly recipientName: string | null;
  readonly recipientPhone: string | null;
  readonly notes: string | null;
  readonly isStoreOrder: boolean;
  readonly totalCents: number | null;
  readonly items: readonly CourierOrderLine[];
  readonly failedAttempts: number;
  readonly deliveryLatitude: number | null;
  readonly deliveryLongitude: number | null;
}

export interface CourierDeliveryOutcome {
  readonly orderId: string;
  readonly status: 'entregado' | 'entrega_fallida';
  readonly version: number;
  readonly collectedCents?: number | undefined;
  readonly attempt?: number | undefined;
  readonly replayed: boolean;
}

export interface CourierCashSummary {
  readonly date: string;
  readonly collectedCents: number;
  readonly ordersCount: number;
  readonly settlement: {
    readonly receivedCents: number;
    readonly differenceCents: number;
    readonly settledAt: string;
  } | null;
}

export interface AdminCashRow extends CourierCashSummary {
  readonly courierUserId: string;
  readonly courierName: string | null;
}

export interface AdminCashResponse {
  readonly date: string;
  readonly items: readonly AdminCashRow[];
}

export interface SettlementResult {
  readonly expectedCents: number;
  readonly receivedCents: number;
  readonly differenceCents: number;
}

export interface LowStockItem {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly stockQuantity: number;
  readonly isActive: boolean;
}

export interface SalesSummary {
  readonly from: string;
  readonly to: string;
  readonly orders: {
    readonly total: number;
    readonly byStatus: Readonly<Record<string, number>>;
  };
  readonly grossCents: number;
  readonly collectedCents: number;
  readonly cancellations: {
    readonly count: number;
    readonly byReason: Readonly<Record<string, number>>;
  };
  readonly failures: {
    readonly count: number;
    readonly byReason: Readonly<Record<string, number>>;
  };
  readonly topProducts: readonly {
    readonly productId: string;
    readonly name: string;
    readonly units: number;
    readonly revenueCents: number;
  }[];
  readonly lowStockCount: number;
}

export interface AdminStoreOrderFilter {
  readonly status?: string | undefined;
  readonly deliveryDate?: string | undefined;
  readonly zoneId?: string | undefined;
  readonly expandItems?: boolean | undefined;
  readonly page?: number | undefined;
  readonly pageSize?: number | undefined;
}

export function formatCents(cents: number): string {
  const safe = Number.isFinite(cents) ? cents : 0;
  const sign = safe < 0 ? '-' : '';
  const abs = Math.abs(safe);
  const dollars = Math.floor(abs / 100);
  const rem = Math.round(abs % 100);
  return `${sign}$${dollars.toLocaleString('es-EC')}.${String(rem).padStart(2, '0')}`;
}

export function parseDollarsToCents(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function todayInEcuador(): string {
  return new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.trunc(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Limpia direcciones devueltas por Nominatim para cumplir la lista blanca estricta del backend
 * (letras latinas con tildes/ñ, números, espacios y puntuación básica).
 */
export function sanitizeBackendText(raw: string, maxLength = 200): string {
  return raw
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9\s.,#\-/():]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function osmDirectionsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?to=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

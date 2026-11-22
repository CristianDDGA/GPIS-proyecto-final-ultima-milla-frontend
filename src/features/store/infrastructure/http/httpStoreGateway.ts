import {
  HttpError,
  type HttpClient,
} from '../../../../shared/infrastructure/http/index.js';
import type {
  AdminCashResponse,
  AdminProduct,
  AdminProductFilter,
  AdminStoreOrderFilter,
  CancelOrderResponse,
  CancelReason,
  CourierCashSummary,
  CourierDeliveryOutcome,
  CourierStoreOrder,
  CreateAddressInput,
  CreateProductInput,
  CustomerProduct,
  CustomerProductFilter,
  DeliverySlotsResponse,
  FailureReason,
  LowStockItem,
  OrderConflict,
  PlaceOrderInput,
  ProductEvent,
  SalesSummary,
  SettlementResult,
  StockReason,
  StoreAddress,
  StoreCategory,
  StoreOrderDetail,
  StoreOrderSummary,
  StorePage,
  StoreSettings,
  UpdateAddressInput,
  UpdateProductInput,
} from '../../domain/storeTypes.js';

function appendProductFilterParams(
  params: URLSearchParams,
  filter: CustomerProductFilter & { readonly status?: string | undefined },
): void {
  const q = filter.q?.trim();
  if (q && q.length > 0) params.set('q', q);
  if (filter.categoryId && filter.categoryId.length > 0) params.set('categoryId', filter.categoryId);
  if (filter.minPriceCents !== undefined && Number.isInteger(filter.minPriceCents)) {
    params.set('minPriceCents', String(filter.minPriceCents));
  }
  if (filter.maxPriceCents !== undefined && Number.isInteger(filter.maxPriceCents)) {
    params.set('maxPriceCents', String(filter.maxPriceCents));
  }
  if (filter.onSale !== undefined) params.set('onSale', String(filter.onSale));
  if (filter.status && filter.status.length > 0) params.set('status', filter.status);
  if (filter.sort && filter.sort.length > 0) params.set('sort', filter.sort);
  if (filter.page !== undefined) params.set('page', String(filter.page));
  if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
}

export function extractOrderConflicts(error: unknown): readonly OrderConflict[] {
  if (!(error instanceof HttpError) || error.code !== 'ORDER_CONFLICT') {
    return [];
  }
  const details = error.details;
  if (typeof details !== 'object' || details === null) return [];
  const record = details as Record<string, unknown>;
  const nested = record['details'];
  const container =
    typeof nested === 'object' && nested !== null
      ? (nested as Record<string, unknown>)
      : record;
  const conflicts = container['conflicts'];
  return Array.isArray(conflicts) ? (conflicts as OrderConflict[]) : [];
}

/**
 * Cliente HTTP completo para los 35 endpoints del módulo /store del backend
 * (catálogo, carrito/checkout idempotente, libreta con mapa, entregas COD/fallas/caja
 * y administración de catálogo, imágenes, stock, pedidos, rendición y resumen).
 */
export class HttpStoreGateway {
  constructor(private readonly httpClient: HttpClient) {}

  public resolveImageUrl(imageUrl: string | null | undefined): string | null {
    if (!imageUrl || imageUrl.trim().length === 0) return null;
    if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
    if (this.httpClient.resolveUrl) return this.httpClient.resolveUrl(imageUrl);
    const base = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
    const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
    return `${base}${path}`;
  }

  // --- Catálogo (cliente y administrador) ----------------------------------

  public async listCategories(): Promise<readonly StoreCategory[]> {
    const res = await this.httpClient.get<{ items: StoreCategory[] }>('/store/categories');
    return res.items ?? [];
  }

  public async listProducts(
    filter: CustomerProductFilter = {},
  ): Promise<StorePage<CustomerProduct>> {
    const params = new URLSearchParams();
    appendProductFilterParams(params, filter);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.httpClient.get<StorePage<CustomerProduct>>(`/store/products${suffix}`);
  }

  public async getProduct(productId: string): Promise<CustomerProduct> {
    return this.httpClient.get<CustomerProduct>(
      `/store/products/${encodeURIComponent(productId)}`,
    );
  }

  public async getDeliverySlots(zoneId: string, date: string): Promise<DeliverySlotsResponse> {
    const params = new URLSearchParams({ zoneId, date });
    return this.httpClient.get<DeliverySlotsResponse>(`/store/delivery-slots?${params.toString()}`);
  }

  // --- Pedidos de tienda (cliente) y flujos cancelar/reprogramar -----------

  public async placeOrder(
    input: PlaceOrderInput,
    idempotencyKey: string,
  ): Promise<StoreOrderDetail> {
    const payload: Record<string, unknown> = {
      zoneId: input.zoneId,
      deliveryAddress: input.deliveryAddress.trim(),
      deliveryDate: input.deliveryDate,
      deliveryTime: input.deliveryTime,
      items: input.items,
    };
    if (input.recipientName && input.recipientName.trim().length > 0) {
      payload['recipientName'] = input.recipientName.trim();
    }
    if (input.recipientPhone && input.recipientPhone.trim().length > 0) {
      payload['recipientPhone'] = input.recipientPhone.trim();
    }
    if (input.notes && input.notes.trim().length > 0) {
      payload['notes'] = input.notes.trim();
    }
    if (
      typeof input.latitude === 'number' &&
      typeof input.longitude === 'number'
    ) {
      payload['latitude'] = input.latitude;
      payload['longitude'] = input.longitude;
    }

    return this.httpClient.post<StoreOrderDetail>('/store/orders', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
  }

  public async listOrders(
    page = 1,
    pageSize = 20,
  ): Promise<StorePage<StoreOrderSummary>> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    return this.httpClient.get<StorePage<StoreOrderSummary>>(
      `/store/orders?${params.toString()}`,
    );
  }

  public async getOrder(orderId: string): Promise<StoreOrderDetail> {
    return this.httpClient.get<StoreOrderDetail>(
      `/store/orders/${encodeURIComponent(orderId)}`,
    );
  }

  public async cancelOrder(
    orderId: string,
    reason: CancelReason,
    note?: string,
  ): Promise<CancelOrderResponse> {
    const payload: Record<string, unknown> = { reason };
    if (note && note.trim().length > 0) {
      payload['note'] = note.trim();
    }
    return this.httpClient.post<CancelOrderResponse>(
      `/store/orders/${encodeURIComponent(orderId)}/cancel`,
      payload,
    );
  }

  public async rescheduleOrder(
    orderId: string,
    deliveryDate: string,
    deliveryTime: string,
  ): Promise<StoreOrderDetail> {
    return this.httpClient.post<StoreOrderDetail>(
      `/store/orders/${encodeURIComponent(orderId)}/reschedule`,
      { deliveryDate, deliveryTime },
    );
  }

  // --- Libreta de direcciones (cliente) ------------------------------------

  public async listAddresses(): Promise<readonly StoreAddress[]> {
    const res = await this.httpClient.get<{ items: StoreAddress[] }>('/store/addresses');
    return res.items ?? [];
  }

  public async createAddress(input: CreateAddressInput): Promise<StoreAddress> {
    const payload: Record<string, unknown> = {
      label: input.label.trim(),
      zoneId: input.zoneId,
      address: input.address.trim(),
    };
    if (input.recipientName && input.recipientName.trim().length > 0) {
      payload['recipientName'] = input.recipientName.trim();
    }
    if (input.recipientPhone && input.recipientPhone.trim().length > 0) {
      payload['recipientPhone'] = input.recipientPhone.trim();
    }
    if (input.isDefault !== undefined) {
      payload['isDefault'] = input.isDefault;
    }
    if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
      payload['latitude'] = input.latitude;
      payload['longitude'] = input.longitude;
    }
    return this.httpClient.post<StoreAddress>('/store/addresses', payload);
  }

  public async updateAddress(
    addressId: string,
    input: UpdateAddressInput,
  ): Promise<StoreAddress> {
    const payload: Record<string, unknown> = {
      expectedVersion: input.expectedVersion,
    };
    if (input.label !== undefined) payload['label'] = input.label.trim();
    if (input.zoneId !== undefined) payload['zoneId'] = input.zoneId;
    if (input.address !== undefined) payload['address'] = input.address.trim();
    if (input.recipientName !== undefined) {
      payload['recipientName'] =
        input.recipientName === null || input.recipientName.trim().length === 0
          ? null
          : input.recipientName.trim();
    }
    if (input.recipientPhone !== undefined) {
      payload['recipientPhone'] =
        input.recipientPhone === null || input.recipientPhone.trim().length === 0
          ? null
          : input.recipientPhone.trim();
    }
    if (input.isDefault !== undefined) payload['isDefault'] = input.isDefault;
    if (input.latitude !== undefined && input.longitude !== undefined) {
      payload['latitude'] = input.latitude;
      payload['longitude'] = input.longitude;
    }

    return this.httpClient.patch<StoreAddress>(
      `/store/addresses/${encodeURIComponent(addressId)}`,
      payload,
    );
  }

  public async deleteAddress(addressId: string): Promise<void> {
    await this.httpClient.delete<void>(`/store/addresses/${encodeURIComponent(addressId)}`);
  }

  // --- Conductor (repartidor): entregas COD, fallas y caja -----------------

  public async getCourierOrders(): Promise<readonly CourierStoreOrder[]> {
    const res = await this.httpClient.get<{ items: CourierStoreOrder[] }>('/store/courier/orders');
    return res.items ?? [];
  }

  public async deliverCourierOrder(
    orderId: string,
    input: { readonly expectedVersion: number; readonly collectedCents: number },
    idempotencyKey: string,
  ): Promise<CourierDeliveryOutcome> {
    return this.httpClient.post<CourierDeliveryOutcome>(
      `/store/courier/orders/${encodeURIComponent(orderId)}/deliver`,
      input,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public async failCourierOrder(
    orderId: string,
    input: {
      readonly expectedVersion: number;
      readonly reason: FailureReason;
      readonly note?: string | undefined;
    },
    idempotencyKey: string,
  ): Promise<CourierDeliveryOutcome> {
    const payload: Record<string, unknown> = {
      expectedVersion: input.expectedVersion,
      reason: input.reason,
    };
    if (input.note && input.note.trim().length > 0) {
      payload['note'] = input.note.trim();
    }
    return this.httpClient.post<CourierDeliveryOutcome>(
      `/store/courier/orders/${encodeURIComponent(orderId)}/fail`,
      payload,
      { headers: { 'Idempotency-Key': idempotencyKey } },
    );
  }

  public async getCourierCash(date?: string): Promise<CourierCashSummary> {
    const suffix = date && date.length > 0 ? `?date=${encodeURIComponent(date)}` : '';
    return this.httpClient.get<CourierCashSummary>(`/store/courier/cash${suffix}`);
  }

  // --- Administrador: catálogo, imágenes, stock, configuración y finanzas --

  public async adminListCategories(): Promise<readonly StoreCategory[]> {
    const res = await this.httpClient.get<{ items: StoreCategory[] }>('/store/admin/categories');
    return res.items ?? [];
  }

  public async adminCreateCategory(name: string): Promise<StoreCategory> {
    return this.httpClient.post<StoreCategory>('/store/admin/categories', { name: name.trim() });
  }

  public async adminUpdateCategory(
    categoryId: string,
    input: {
      readonly expectedVersion: number;
      readonly name?: string | undefined;
      readonly isActive?: boolean | undefined;
    },
  ): Promise<StoreCategory> {
    const payload: Record<string, unknown> = { expectedVersion: input.expectedVersion };
    if (input.name !== undefined) payload['name'] = input.name.trim();
    if (input.isActive !== undefined) payload['isActive'] = input.isActive;
    return this.httpClient.patch<StoreCategory>(
      `/store/admin/categories/${encodeURIComponent(categoryId)}`,
      payload,
    );
  }

  public async adminListProducts(
    filter: AdminProductFilter = {},
  ): Promise<StorePage<AdminProduct>> {
    const params = new URLSearchParams();
    appendProductFilterParams(params, filter);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.httpClient.get<StorePage<AdminProduct>>(`/store/admin/products${suffix}`);
  }

  public async adminCreateProduct(input: CreateProductInput): Promise<AdminProduct> {
    const payload: Record<string, unknown> = {
      sku: input.sku.trim(),
      name: input.name.trim(),
      categoryId: input.categoryId,
      priceCents: input.priceCents,
      stock: input.stock,
    };
    if (input.brand && input.brand.trim().length > 0) payload['brand'] = input.brand.trim();
    if (input.description && input.description.trim().length > 0) {
      payload['description'] = input.description.trim();
    }
    if (input.compareAtPriceCents !== undefined && input.compareAtPriceCents !== null) {
      payload['compareAtPriceCents'] = input.compareAtPriceCents;
    }
    if (input.isActive !== undefined) payload['isActive'] = input.isActive;
    return this.httpClient.post<AdminProduct>('/store/admin/products', payload);
  }

  public async adminGetProduct(productId: string): Promise<AdminProduct> {
    return this.httpClient.get<AdminProduct>(
      `/store/admin/products/${encodeURIComponent(productId)}`,
    );
  }

  public async adminUpdateProduct(
    productId: string,
    input: UpdateProductInput,
  ): Promise<AdminProduct> {
    const payload: Record<string, unknown> = { expectedVersion: input.expectedVersion };
    if (input.name !== undefined) payload['name'] = input.name.trim();
    if (input.brand !== undefined) {
      payload['brand'] =
        input.brand === null || input.brand.trim().length === 0 ? null : input.brand.trim();
    }
    if (input.description !== undefined) {
      payload['description'] =
        input.description === null || input.description.trim().length === 0
          ? null
          : input.description.trim();
    }
    if (input.categoryId !== undefined) payload['categoryId'] = input.categoryId;
    if (input.priceCents !== undefined) payload['priceCents'] = input.priceCents;
    if (input.compareAtPriceCents !== undefined) {
      payload['compareAtPriceCents'] = input.compareAtPriceCents;
    }
    if (input.isActive !== undefined) payload['isActive'] = input.isActive;
    return this.httpClient.patch<AdminProduct>(
      `/store/admin/products/${encodeURIComponent(productId)}`,
      payload,
    );
  }

  public async adminAdjustStock(
    productId: string,
    delta: number,
    reason: StockReason,
  ): Promise<{ readonly id: string; readonly stock: number }> {
    return this.httpClient.post<{ id: string; stock: number }>(
      `/store/admin/products/${encodeURIComponent(productId)}/stock-adjustments`,
      { delta, reason },
    );
  }

  public async adminProductEvents(productId: string): Promise<readonly ProductEvent[]> {
    const res = await this.httpClient.get<{ items: ProductEvent[] }>(
      `/store/admin/products/${encodeURIComponent(productId)}/events`,
    );
    return res.items ?? [];
  }

  public async adminUploadProductImage(
    productId: string,
    expectedVersion: number,
    file: File,
  ): Promise<AdminProduct> {
    const contentType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    return this.httpClient.putBinary<AdminProduct>(
      `/store/admin/products/${encodeURIComponent(productId)}/image?expectedVersion=${expectedVersion}`,
      file,
      contentType,
    );
  }

  public async adminRemoveProductImage(
    productId: string,
    expectedVersion: number,
  ): Promise<AdminProduct> {
    return this.httpClient.delete<AdminProduct>(
      `/store/admin/products/${encodeURIComponent(productId)}/image?expectedVersion=${expectedVersion}`,
    );
  }

  public async adminGetSettings(): Promise<StoreSettings> {
    return this.httpClient.get<StoreSettings>('/store/admin/settings');
  }

  public async adminUpdateSettings(settings: StoreSettings): Promise<StoreSettings> {
    return this.httpClient.put<StoreSettings>('/store/admin/settings', settings);
  }

  public async adminListOrders(
    filter: AdminStoreOrderFilter = {},
  ): Promise<StorePage<StoreOrderDetail>> {
    const params = new URLSearchParams();
    if (filter.status && filter.status.length > 0) params.set('status', filter.status);
    if (filter.deliveryDate && filter.deliveryDate.length > 0) {
      params.set('deliveryDate', filter.deliveryDate);
    }
    if (filter.zoneId && filter.zoneId.length > 0) params.set('zoneId', filter.zoneId);
    if (filter.expandItems) params.set('expand', 'items');
    if (filter.page !== undefined) params.set('page', String(filter.page));
    if (filter.pageSize !== undefined) params.set('pageSize', String(filter.pageSize));
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.httpClient.get<StorePage<StoreOrderDetail>>(`/store/admin/orders${suffix}`);
  }

  public async adminLowStock(
    threshold = 5,
    limit = 50,
  ): Promise<{ readonly threshold: number; readonly items: readonly LowStockItem[] }> {
    const params = new URLSearchParams({
      threshold: String(threshold),
      limit: String(limit),
    });
    return this.httpClient.get<{ threshold: number; items: LowStockItem[] }>(
      `/store/admin/low-stock?${params.toString()}`,
    );
  }

  public async adminSummary(from?: string, to?: string): Promise<SalesSummary> {
    const params = new URLSearchParams();
    if (from && from.length > 0) params.set('from', from);
    if (to && to.length > 0) params.set('to', to);
    const suffix = params.size > 0 ? `?${params.toString()}` : '';
    return this.httpClient.get<SalesSummary>(`/store/admin/summary${suffix}`);
  }

  public async adminCash(date?: string): Promise<AdminCashResponse> {
    const suffix = date && date.length > 0 ? `?date=${encodeURIComponent(date)}` : '';
    return this.httpClient.get<AdminCashResponse>(`/store/admin/cash${suffix}`);
  }

  public async adminSettleCash(input: {
    readonly courierUserId: string;
    readonly date: string;
    readonly receivedCents: number;
    readonly note?: string | undefined;
  }): Promise<SettlementResult> {
    const payload: Record<string, unknown> = {
      courierUserId: input.courierUserId,
      date: input.date,
      receivedCents: input.receivedCents,
    };
    if (input.note && input.note.trim().length > 0) {
      payload['note'] = input.note.trim();
    }
    return this.httpClient.post<SettlementResult>('/store/admin/cash/settlements', payload);
  }
}

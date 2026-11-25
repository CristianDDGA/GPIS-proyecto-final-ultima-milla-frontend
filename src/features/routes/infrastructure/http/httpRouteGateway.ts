import { defaultHttpClient, type HttpClient } from '../../../../shared/infrastructure/http/index.js';
import type {
  CancelRouteResult,
  LateOrderPlacementInput,
  LateOrderPlacementResult,
  MoveOrderInput,
  MoveOrderResult,
  PlanRoutesInput,
  PlanRoutesResult,
  PreviewPlanInput,
  RoutePlanPreview,
  ReorderStopsInput,
  ReorderStopsResult,
  RouteDetail,
  RouteFilters,
  RouteGateway,
  RouteSummary,
} from '../../domain/index.js';
import {
  readCancelResult,
  readLatePlacementResult,
  readMoveResult,
  readPlanPreview, readPlanResult,
  readReorderResult,
  readRouteDetail,
  readRouteSummaryList,
} from './response.js';

function idempotencyOptions(idempotencyKey: string | undefined): { headers: Record<string, string> } {
  return { headers: { 'Idempotency-Key': idempotencyKey ?? crypto.randomUUID() } };
}

/**
 * Implementación HTTP del puerto de rutas contra la API de Última Milla.
 * El token JWT lo inyecta el HttpClient compartido; aquí sólo se añade la
 * cabecera Idempotency-Key de las operaciones no idempotentes.
 */
export class HttpRouteGateway implements RouteGateway {
  constructor(private readonly httpClient: HttpClient = defaultHttpClient) {}

  public async planRoutes(input: PlanRoutesInput): Promise<PlanRoutesResult> {
    const response = await this.httpClient.post<unknown>(
      '/route-plans',
      { serviceDate: input.serviceDate, capacityLimit: Number(input.capacityLimit) },
      idempotencyOptions(input.idempotencyKey),
    );
    return readPlanResult(response);
  }

  public async previewPlan(input: PreviewPlanInput): Promise<RoutePlanPreview> {
    const query = new URLSearchParams({ serviceDate: input.serviceDate, capacityLimit: String(Number(input.capacityLimit)) });
    return readPlanPreview(await this.httpClient.get<unknown>(`/route-plans/preview?${query}`));
  }

  public async getRoutes(filters: RouteFilters = {}): Promise<RouteSummary[]> {
    const query = new URLSearchParams();
    if (filters.serviceDate) {
      query.set('serviceDate', filters.serviceDate);
    }
    if (filters.zoneId) {
      query.set('zoneId', filters.zoneId);
    }
    if (typeof filters.limit === 'number') {
      query.set('limit', String(filters.limit));
    }
    if (typeof filters.offset === 'number') {
      query.set('offset', String(filters.offset));
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    const page = readRouteSummaryList(await this.httpClient.get<unknown>(`/routes${suffix}`));
    return page.items;
  }

  public async getRouteById(id: string): Promise<RouteDetail> {
    return readRouteDetail(await this.httpClient.get<unknown>(`/routes/${encodeURIComponent(id)}`));
  }

  public async reorderStops(input: ReorderStopsInput): Promise<ReorderStopsResult> {
    const response = await this.httpClient.put<unknown>(
      `/routes/${encodeURIComponent(input.routeId)}/stop-order`,
      { orderIds: input.orderIds },
    );
    return readReorderResult(response);
  }

  public async cancelRoute(routeId: string): Promise<CancelRouteResult> {
    return readCancelResult(
      await this.httpClient.post<unknown>(`/routes/${encodeURIComponent(routeId)}/cancel`),
    );
  }

  public async moveOrder(input: MoveOrderInput): Promise<MoveOrderResult> {
    const response = await this.httpClient.post<unknown>('/route-moves', {
      orderId: input.orderId,
      destinationRouteId: input.destinationRouteId,
    });
    return readMoveResult(response);
  }

  public async placeLateOrder(input: LateOrderPlacementInput): Promise<LateOrderPlacementResult> {
    const response = await this.httpClient.post<unknown>(
      '/late-order-placements',
      { orderId: input.orderId, capacityLimit: Number(input.capacityLimit) },
      idempotencyOptions(input.idempotencyKey),
    );
    return readLatePlacementResult(response);
  }
}


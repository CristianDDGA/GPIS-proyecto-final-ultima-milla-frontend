import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import type {
  ActiveCourierRoute,
  AssignCourierInput,
  AssignCourierResult,
  Courier,
  CourierFilters,
  CourierGateway,
  CourierPage,
  CreateCourierInput,
} from '../../domain/index.js';
import {
  readActiveRouteEnvelope,
  readAssignResult,
  readCourier,
  readCourierPage,
} from './response.js';

export class HttpCourierGateway implements CourierGateway {
  constructor(private readonly httpClient: HttpClient) {}

  async createCourier(input: CreateCourierInput): Promise<Courier> {
    const response = await this.httpClient.post<unknown>('/couriers', {
      displayName: input.displayName,
      maxOrdersPerTrip: Number(input.maxOrdersPerTrip),
    });
    return readCourier(response);
  }

  async getCouriers(filters: CourierFilters = {}): Promise<CourierPage> {
    const query = new URLSearchParams();

    if (filters.available !== undefined) {
      query.set('available', filters.available ? 'true' : 'false');
    }
    if (filters.limit !== undefined) {
      query.set('limit', String(filters.limit));
    }
    if (filters.offset !== undefined) {
      query.set('offset', String(filters.offset));
    }

    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return readCourierPage(await this.httpClient.get<unknown>(`/couriers${suffix}`));
  }

  async updateAvailability(courierId: string, isAvailable: boolean): Promise<Courier> {
    const response = await this.httpClient.patch<unknown>(
      `/couriers/${encodeURIComponent(courierId)}/availability`,
      { isAvailable },
    );
    return readCourier(response);
  }

  async assignRoute(input: AssignCourierInput): Promise<AssignCourierResult> {
    const response = await this.httpClient.post<unknown>('/courier-assignments', {
      routeId: input.routeId,
      courierId: input.courierId,
    });
    return readAssignResult(response);
  }

  async getActiveRoute(courierId: string): Promise<ActiveCourierRoute | null> {
    const response = await this.httpClient.get<unknown>(
      `/couriers/${encodeURIComponent(courierId)}/route`,
    );
    return readActiveRouteEnvelope(response);
  }
}


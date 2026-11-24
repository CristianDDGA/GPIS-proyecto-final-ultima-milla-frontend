import type {
  ActiveCourierRoute,
  AssignCourierInput,
  AssignCourierResult,
  Courier,
  CourierFilters,
  CourierPage,
} from './courier.js';

export interface CourierGateway {
  getCouriers(filters?: CourierFilters): Promise<CourierPage>;
  updateAvailability(courierId: string, isAvailable: boolean): Promise<Courier>;
  assignRoute(input: AssignCourierInput): Promise<AssignCourierResult>;
  getActiveRoute(courierId: string): Promise<ActiveCourierRoute | null>;
}

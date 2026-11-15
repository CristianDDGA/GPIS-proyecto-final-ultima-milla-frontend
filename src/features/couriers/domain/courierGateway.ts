import type {
  ActiveCourierRoute,
  AssignCourierInput,
  AssignCourierResult,
  Courier,
  CourierFilters,
  CourierPage,
  CreateCourierInput,
} from './courier.js';

export interface CourierGateway {
  createCourier(input: CreateCourierInput): Promise<Courier>;
  getCouriers(filters?: CourierFilters): Promise<CourierPage>;
  updateAvailability(courierId: string, isAvailable: boolean): Promise<Courier>;
  assignRoute(input: AssignCourierInput): Promise<AssignCourierResult>;
  getActiveRoute(courierId: string): Promise<ActiveCourierRoute | null>;
}

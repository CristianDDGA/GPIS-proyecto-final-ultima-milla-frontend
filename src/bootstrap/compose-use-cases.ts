import {
  defaultHttpClient,
  type HttpClient,
} from '../shared/infrastructure/http/index.js';

import {
  CheckHealthUseCase,
  CreateManagedUserUseCase,
  GetCurrentUserUseCase,
  HttpAuthGateway,
  LoginUseCase,
  LogoutUseCase,
  RegisterCustomerUseCase,
  type AuthUseCases,
} from '../features/auth/index.js';

import {
  CreateOrderUseCase,
  GetOrderByIdUseCase,
  GetOrdersUseCase,
  HttpOrderGateway,
  HttpOrderZoneCatalog,
  type OrderUseCases,
} from '../features/orders/index.js';

import { GetZonesUseCase } from '../features/zones/index.js';

import {
  CancelRouteUseCase,
  GetRouteByIdUseCase,
  GetRoutesUseCase,
  HttpRouteGateway,
  MoveOrderUseCase,
  PlaceLateOrderUseCase,
  PlanRoutesUseCase,
  ReorderRouteStopsUseCase,
  type RouteUseCases,
} from '../features/routes/index.js';

import {
  AssignRouteUseCase,
  CreateCourierUseCase,
  GetActiveCourierRouteUseCase,
  GetCouriersUseCase,
  HttpCourierGateway,
  UpdateCourierAvailabilityUseCase,
  type CourierUseCases,
} from '../features/couriers/index.js';

import {
  ChangeDeliveryStatusUseCase,
  CompleteRouteUseCase,
  GetDeliveryOrderUseCase,
  HttpDeliveryGateway,
  type DeliveryUseCases,
} from '../features/deliveries/index.js';

export interface AppUseCases {
  readonly auth: AuthUseCases;
  readonly orders: OrderUseCases;
  readonly routes: RouteUseCases;
  readonly couriers: CourierUseCases;
  readonly deliveries: DeliveryUseCases;
}

/**
 * Composition root: builds every gateway over the same HTTP client instance so the
 * JWT header injection and the global 401 handler apply to all 27 backend endpoints.
 */
export function composeUseCases(httpClient: HttpClient = defaultHttpClient): AppUseCases {
  const authGateway = new HttpAuthGateway(httpClient);
  const orderGateway = new HttpOrderGateway(httpClient);
  const orderZoneCatalog = new HttpOrderZoneCatalog(httpClient);
  const routeGateway = new HttpRouteGateway(httpClient);
  const courierGateway = new HttpCourierGateway(httpClient);
  const deliveryGateway = new HttpDeliveryGateway(httpClient);

  return {
    auth: {
      checkHealth: new CheckHealthUseCase(authGateway),
      login: new LoginUseCase(authGateway),
      registerCustomer: new RegisterCustomerUseCase(authGateway),
      getCurrentUser: new GetCurrentUserUseCase(authGateway),
      logout: new LogoutUseCase(authGateway),
      createManagedUser: new CreateManagedUserUseCase(authGateway),
    },
    orders: {
      getZones: new GetZonesUseCase(orderZoneCatalog),
      getOrders: new GetOrdersUseCase(orderGateway),
      getOrderById: new GetOrderByIdUseCase(orderGateway),
      registerOrder: new CreateOrderUseCase(orderGateway),
    },
    routes: {
      planRoutes: new PlanRoutesUseCase(routeGateway),
      getRoutes: new GetRoutesUseCase(routeGateway),
      getRouteById: new GetRouteByIdUseCase(routeGateway),
      reorderStops: new ReorderRouteStopsUseCase(routeGateway),
      cancelRoute: new CancelRouteUseCase(routeGateway),
      moveOrder: new MoveOrderUseCase(routeGateway),
      placeLateOrder: new PlaceLateOrderUseCase(routeGateway),
    },
    couriers: {
      createCourier: new CreateCourierUseCase(courierGateway),
      getCouriers: new GetCouriersUseCase(courierGateway),
      updateAvailability: new UpdateCourierAvailabilityUseCase(courierGateway),
      assignRoute: new AssignRouteUseCase(courierGateway),
      getActiveRoute: new GetActiveCourierRouteUseCase(courierGateway),
    },
    deliveries: {
      getDeliveryOrder: new GetDeliveryOrderUseCase(deliveryGateway),
      changeStatus: new ChangeDeliveryStatusUseCase(deliveryGateway),
      completeRoute: new CompleteRouteUseCase(deliveryGateway),
    },
  };
}

import {
  defaultHttpClient,
  type HttpClient,
} from '../shared/infrastructure/http/index.js';

import {
  ChangePasswordUseCase,
  CheckHealthUseCase,
  CreateManagedUserUseCase,
  ForgotPasswordUseCase,
  GetCurrentUserUseCase,
  GetManagedUserUseCase,
  ListManagedUsersUseCase,
  LoginUseCase,
  LoginWithGoogleUseCase,
  LogoutUseCase,
  RegisterCustomerUseCase,
  ResendVerificationUseCase,
  ResetManagedUserPasswordUseCase,
  ResetPasswordUseCase,
  SetManagedUserActiveUseCase,
  VerifyEmailUseCase,
  type AuthUseCases,
} from '../features/auth/application/index.js';
import { HttpAuthGateway } from '../features/auth/infrastructure/http/index.js';

import {
  CreateOrderUseCase,
  GetOrderByIdUseCase,
  GetOrdersUseCase,
  type OrderUseCases,
} from '../features/orders/application/index.js';
import {
  HttpOrderGateway,
  HttpOrderZoneCatalog,
} from '../features/orders/infrastructure/http/index.js';

import { GetZonesUseCase } from '../features/zones/application/index.js';

import {
  CancelRouteUseCase,
  GetRouteByIdUseCase,
  GetRoutesUseCase,
  MoveOrderUseCase,
  PlaceLateOrderUseCase,
  PlanRoutesUseCase,
  ReorderRouteStopsUseCase,
  type RouteUseCases,
} from '../features/routes/application/index.js';
import { HttpRouteGateway } from '../features/routes/infrastructure/http/index.js';

import {
  AssignRouteUseCase,
  CreateCourierUseCase,
  GetActiveCourierRouteUseCase,
  GetCouriersUseCase,
  UpdateCourierAvailabilityUseCase,
  type CourierUseCases,
} from '../features/couriers/application/index.js';
import { HttpCourierGateway } from '../features/couriers/infrastructure/http/index.js';

import {
  ChangeDeliveryStatusUseCase,
  CompleteRouteUseCase,
  GetDeliveryOrderUseCase,
  type DeliveryUseCases,
} from '../features/deliveries/application/index.js';
import { HttpDeliveryGateway } from '../features/deliveries/infrastructure/http/index.js';

import {
  ApproveApplicationUseCase,
  CancelApplicationUseCase,
  GetApplicationFileUseCase,
  GetApplicationUseCase,
  GetMyApplicationFileUseCase,
  GetMyApplicationUseCase,
  ListApplicationsUseCase,
  RejectApplicationUseCase,
  SaveApplicationDraftUseCase,
  SubmitApplicationUseCase,
  UploadApplicationFileUseCase,
  type CourierApplicationUseCases,
} from '../features/courier-applications/application/index.js';
import { HttpCourierApplicationGateway } from '../features/courier-applications/infrastructure/http/index.js';
import { HttpStoreGateway } from '../features/store/infrastructure/http/httpStoreGateway.js';

export interface AppUseCases {
  readonly auth: AuthUseCases;
  readonly courierApplications: CourierApplicationUseCases;
  readonly orders: OrderUseCases;
  readonly routes: RouteUseCases;
  readonly couriers: CourierUseCases;
  readonly deliveries: DeliveryUseCases;
  readonly store: HttpStoreGateway;
}

/**
 * Composition root: builds every gateway over the same HTTP client instance so the
 * JWT header injection and the global 401 handler apply to all backend endpoints.
 */
export function composeUseCases(httpClient: HttpClient = defaultHttpClient): AppUseCases {
  const authGateway = new HttpAuthGateway(httpClient);
  const orderGateway = new HttpOrderGateway(httpClient);
  const orderZoneCatalog = new HttpOrderZoneCatalog(httpClient);
  const routeGateway = new HttpRouteGateway(httpClient);
  const courierGateway = new HttpCourierGateway(httpClient);
  const deliveryGateway = new HttpDeliveryGateway(httpClient);
  const applicationGateway = new HttpCourierApplicationGateway(httpClient);
  const storeGateway = new HttpStoreGateway(httpClient);

  return {
    auth: {
      checkHealth: new CheckHealthUseCase(authGateway),
      login: new LoginUseCase(authGateway),
      loginWithGoogle: new LoginWithGoogleUseCase(authGateway),
      registerCustomer: new RegisterCustomerUseCase(authGateway),
      verifyEmail: new VerifyEmailUseCase(authGateway),
      resendVerification: new ResendVerificationUseCase(authGateway),
      forgotPassword: new ForgotPasswordUseCase(authGateway),
      resetPassword: new ResetPasswordUseCase(authGateway),
      getCurrentUser: new GetCurrentUserUseCase(authGateway),
      logout: new LogoutUseCase(authGateway),
      createManagedUser: new CreateManagedUserUseCase(authGateway),
      changePassword: new ChangePasswordUseCase(authGateway),
      listManagedUsers: new ListManagedUsersUseCase(authGateway),
      getManagedUser: new GetManagedUserUseCase(authGateway),
      setManagedUserActive: new SetManagedUserActiveUseCase(authGateway),
      resetManagedUserPassword: new ResetManagedUserPasswordUseCase(authGateway),
    },
    courierApplications: {
      getMine: new GetMyApplicationUseCase(applicationGateway),
      saveDraft: new SaveApplicationDraftUseCase(applicationGateway),
      uploadFile: new UploadApplicationFileUseCase(applicationGateway),
      getMyFile: new GetMyApplicationFileUseCase(applicationGateway),
      submit: new SubmitApplicationUseCase(applicationGateway),
      cancel: new CancelApplicationUseCase(applicationGateway),
      list: new ListApplicationsUseCase(applicationGateway),
      get: new GetApplicationUseCase(applicationGateway),
      getFile: new GetApplicationFileUseCase(applicationGateway),
      approve: new ApproveApplicationUseCase(applicationGateway),
      reject: new RejectApplicationUseCase(applicationGateway),
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
    store: storeGateway,
  };
}

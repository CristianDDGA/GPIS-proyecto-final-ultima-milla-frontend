import {HttpAuthGateway} from '../features/auth/infrastructure/httpAuthGateway';
import {HttpCourierApplicationGateway} from '../features/courier-applications/infrastructure/httpCourierApplicationGateway';
import {HttpCourierGateway} from '../features/couriers/infrastructure/httpCourierGateway';
import {HttpDeliveryGateway} from '../features/deliveries/infrastructure/httpDeliveryGateway';
import {HttpOrderGateway} from '../features/orders/infrastructure/httpOrderGateway';
import {HttpRouteGateway} from '../features/routes/infrastructure/httpRouteGateway';
import {HttpZoneGateway} from '../features/zones/infrastructure/httpZoneGateway';
import type {MobileHttpClient} from '../shared/infrastructure/http/httpClient';

export interface MobileGateways {
  readonly auth: HttpAuthGateway;
  readonly zones: HttpZoneGateway;
  readonly orders: HttpOrderGateway;
  readonly routes: HttpRouteGateway;
  readonly couriers: HttpCourierGateway;
  readonly deliveries: HttpDeliveryGateway;
  readonly courierApplications: HttpCourierApplicationGateway;
}

export function composeGateways(http: MobileHttpClient): MobileGateways {
  return {
    auth: new HttpAuthGateway(http),
    zones: new HttpZoneGateway(http),
    orders: new HttpOrderGateway(http),
    routes: new HttpRouteGateway(http),
    couriers: new HttpCourierGateway(http),
    deliveries: new HttpDeliveryGateway(http),
    courierApplications: new HttpCourierApplicationGateway(http),
  };
}

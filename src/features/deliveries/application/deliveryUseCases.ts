import type { DeliveryGateway } from '../domain/deliveryGateway.js';
import {
  isUuid,
  validateChangeDeliveryStatusInput,
  type ChangeDeliveryStatusInput,
  type ChangeDeliveryStatusResult,
  type CompleteRouteResult,
  type DeliveryOrder,
} from '../domain/index.js';

function firstValidationError(errors: Record<string, string>): string {
  return Object.values(errors)[0] ?? 'Los datos enviados no son válidos.';
}

export class GetDeliveryOrderUseCase {
  constructor(private readonly gateway: Pick<DeliveryGateway, 'getDeliveryOrder'>) {}

  async execute(orderId: string): Promise<DeliveryOrder> {
    if (!isUuid(orderId)) {
      throw new Error('Se requiere un UUID válido para el pedido de entrega.');
    }

    return this.gateway.getDeliveryOrder(orderId);
  }
}

export class ChangeDeliveryStatusUseCase {
  constructor(private readonly gateway: DeliveryGateway) {}

  async execute(input: ChangeDeliveryStatusInput): Promise<ChangeDeliveryStatusResult> {
    const validation = validateChangeDeliveryStatusInput(input);
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }

    const expectedVersion =
      input.expectedVersion ??
      (await this.gateway.getDeliveryOrder(input.orderId)).version;
    const idempotencyKey = input.idempotencyKey ?? crypto.randomUUID();

    return this.gateway.changeStatus({
      orderId: input.orderId,
      newStatus: input.newStatus,
      expectedVersion,
      idempotencyKey,
    });
  }
}

export class CompleteRouteUseCase {
  constructor(private readonly gateway: Pick<DeliveryGateway, 'completeRoute'>) {}

  async execute(routeId: string): Promise<CompleteRouteResult> {
    if (!isUuid(routeId)) {
      throw new Error('Se requiere un UUID válido para la ruta.');
    }

    return this.gateway.completeRoute(routeId);
  }
}

export interface DeliveryUseCases {
  getDeliveryOrder: Pick<GetDeliveryOrderUseCase, 'execute'>;
  changeStatus: Pick<ChangeDeliveryStatusUseCase, 'execute'>;
  completeRoute: Pick<CompleteRouteUseCase, 'execute'>;
}

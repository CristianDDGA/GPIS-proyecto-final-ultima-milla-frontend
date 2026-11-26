import {
  validateOrder,
  type Order,
  type CreateOrderInput,
  type OrderGateway,
} from '../domain/index.js';

export class CreateOrderUseCase {
  constructor(private readonly orderGateway: OrderGateway) {}

  public async execute(input: CreateOrderInput, options: { requirePin?: boolean } = {}): Promise<Order> {
    const validation = validateOrder(input, options);

    if (!validation.isValid) {
      const firstErrorMessage =
        Object.values(validation.errors).find(Boolean) || 'Datos de pedido inválidos';
      throw new Error(firstErrorMessage);
    }

    const sanitizedInput: CreateOrderInput = {
      zoneId: input.zoneId.trim(),
      deliveryAddress: input.deliveryAddress.trim(),
      deliveryDate: input.deliveryDate.trim(),
      deliveryTime: input.deliveryTime.trim(),
      ...(input.latitude != null && input.longitude != null ? { latitude: input.latitude, longitude: input.longitude } : {}),
    };

    return this.orderGateway.create(sanitizedInput);
  }
}

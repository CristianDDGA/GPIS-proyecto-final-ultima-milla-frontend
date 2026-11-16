import type { CourierGateway } from '../domain/index.js';
import {
  isUuid,
  validateAssignCourierInput,
  validateCreateCourierInput,
  type ActiveCourierRoute,
  type AssignCourierInput,
  type AssignCourierResult,
  type Courier,
  type CourierFilters,
  type CourierPage,
  type CreateCourierInput,
} from '../domain/index.js';

function firstValidationError(errors: Record<string, string>): string {
  return Object.values(errors)[0] ?? 'Los datos enviados no son válidos.';
}

export class CreateCourierUseCase {
  constructor(private readonly gateway: Pick<CourierGateway, 'createCourier'>) {}

  async execute(input: CreateCourierInput): Promise<Courier> {
    const validation = validateCreateCourierInput(input);
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }

    return this.gateway.createCourier({
      displayName: input.displayName.trim(),
      maxOrdersPerTrip: input.maxOrdersPerTrip,
    });
  }
}

export class GetCouriersUseCase {
  constructor(private readonly gateway: Pick<CourierGateway, 'getCouriers'>) {}

  async execute(filters: CourierFilters = {}): Promise<CourierPage> {
    return this.gateway.getCouriers(filters);
  }
}

export class UpdateCourierAvailabilityUseCase {
  constructor(private readonly gateway: Pick<CourierGateway, 'updateAvailability'>) {}

  async execute(courierId: string, isAvailable: boolean): Promise<Courier> {
    if (!isUuid(courierId)) {
      throw new Error('Se requiere un UUID válido para el repartidor.');
    }

    if (typeof isAvailable !== 'boolean') {
      throw new Error('La disponibilidad del repartidor debe ser un valor booleano.');
    }

    return this.gateway.updateAvailability(courierId, isAvailable);
  }
}

export class AssignRouteUseCase {
  constructor(private readonly gateway: Pick<CourierGateway, 'assignRoute'>) {}

  async execute(input: AssignCourierInput): Promise<AssignCourierResult> {
    const validation = validateAssignCourierInput(input);
    if (!validation.isValid) {
      throw new Error(firstValidationError(validation.errors));
    }

    return this.gateway.assignRoute(input);
  }
}

export class GetActiveCourierRouteUseCase {
  constructor(private readonly gateway: Pick<CourierGateway, 'getActiveRoute'>) {}

  async execute(courierId: string): Promise<ActiveCourierRoute | null> {
    if (!isUuid(courierId)) {
      throw new Error('Se requiere un UUID válido para el repartidor.');
    }

    return this.gateway.getActiveRoute(courierId);
  }
}

export interface CourierUseCases {
  createCourier: Pick<CreateCourierUseCase, 'execute'>;
  getCouriers: Pick<GetCouriersUseCase, 'execute'>;
  updateAvailability: Pick<UpdateCourierAvailabilityUseCase, 'execute'>;
  assignRoute: Pick<AssignRouteUseCase, 'execute'>;
  getActiveRoute: Pick<GetActiveCourierRouteUseCase, 'execute'>;
}

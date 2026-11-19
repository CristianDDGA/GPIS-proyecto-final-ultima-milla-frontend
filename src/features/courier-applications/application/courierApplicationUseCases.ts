import type { CourierApplicationGateway } from '../domain/courierApplicationGateway.js';
import {
  validateApplicationDraft,
  type ApplicationDetail,
  type ApplicationDraftInput,
  type ApplicationFilters,
  type ApplicationPage,
  type CourierApplication,
  type FileKind,
} from '../domain/courierApplication.js';

function firstError(errors: Record<string, string>): string | null {
  for (const message of Object.values(errors)) {
    if (message.length > 0) {
      return message;
    }
  }
  return null;
}

function assertValid(errors: Record<string, string>, fallback: string): void {
  if (Object.keys(errors).length > 0) {
    throw new Error(firstError(errors) ?? fallback);
  }
}

export class GetMyApplicationUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(): Promise<CourierApplication | null> {
    return this.gateway.getMine();
  }
}

export class SaveApplicationDraftUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public async execute(input: ApplicationDraftInput): Promise<CourierApplication> {
    const validation = validateApplicationDraft(input);
    assertValid(validation.errors, 'Revisa los datos de la solicitud.');

    return this.gateway.saveDraft(input);
  }
}

export class UploadApplicationFileUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(kind: FileKind, file: Blob, contentType: 'image/jpeg' | 'image/png'): Promise<CourierApplication> {
    return this.gateway.uploadFile(kind, file, contentType);
  }
}

export class GetMyApplicationFileUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(kind: FileKind): Promise<Blob> {
    return this.gateway.getMyFile(kind);
  }
}

export class SubmitApplicationUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(): Promise<CourierApplication> {
    return this.gateway.submit();
  }
}

export class CancelApplicationUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(): Promise<CourierApplication> {
    return this.gateway.cancel();
  }
}

export class ListApplicationsUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(filters: ApplicationFilters = {}): Promise<ApplicationPage> {
    const trimmed = filters.q?.trim() ?? '';
    return this.gateway.list({
      ...(filters.status !== undefined ? { status: filters.status } : {}),
      ...(trimmed.length > 0 ? { q: trimmed } : {}),
      ...(filters.limit !== undefined ? { limit: filters.limit } : {}),
      ...(filters.offset !== undefined ? { offset: filters.offset } : {}),
    });
  }
}

export class GetApplicationUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(id: string): Promise<ApplicationDetail> {
    if (id.trim().length === 0) {
      throw new Error('El identificador de la solicitud no es válido.');
    }
    return this.gateway.get(id);
  }
}

export class GetApplicationFileUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(id: string, kind: FileKind): Promise<Blob> {
    return this.gateway.getFile(id, kind);
  }
}

export class ApproveApplicationUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(id: string, capacity = 10): Promise<ApplicationDetail> {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
      throw new Error('La capacidad debe ser un entero entre 1 y 200.');
    }
    return this.gateway.approve(id, capacity);
  }
}

export class RejectApplicationUseCase {
  constructor(private readonly gateway: CourierApplicationGateway) {}

  public execute(id: string, reason: string): Promise<ApplicationDetail> {
    const trimmed = reason.trim();
    if (trimmed.length < 5 || trimmed.length > 500) {
      throw new Error('El motivo de rechazo debe tener entre 5 y 500 caracteres.');
    }
    return this.gateway.reject(id, trimmed);
  }
}

export interface CourierApplicationUseCases {
  getMine: Pick<GetMyApplicationUseCase, 'execute'>;
  saveDraft: Pick<SaveApplicationDraftUseCase, 'execute'>;
  uploadFile: Pick<UploadApplicationFileUseCase, 'execute'>;
  getMyFile: Pick<GetMyApplicationFileUseCase, 'execute'>;
  submit: Pick<SubmitApplicationUseCase, 'execute'>;
  cancel: Pick<CancelApplicationUseCase, 'execute'>;
  list: Pick<ListApplicationsUseCase, 'execute'>;
  get: Pick<GetApplicationUseCase, 'execute'>;
  getFile: Pick<GetApplicationFileUseCase, 'execute'>;
  approve: Pick<ApproveApplicationUseCase, 'execute'>;
  reject: Pick<RejectApplicationUseCase, 'execute'>;
}

import type {MobileHttpClient} from '../../../shared/infrastructure/http/httpClient';
import type {
  ApplicationDetail,
  ApplicationDraftInput,
  ApplicationFileInfo,
  ApplicationStatus,
  CourierApplication,
  FileKind,
  ImageMimeType,
  VehicleType,
} from '../domain/courierApplication';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStatus(value: unknown): ApplicationStatus {
  if (
    value === 'borrador' ||
    value === 'pendiente' ||
    value === 'aprobada' ||
    value === 'rechazada' ||
    value === 'cancelada'
  ) {
    return value;
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

function asVehicle(value: unknown): VehicleType {
  if (value === 'moto' || value === 'auto' || value === 'camioneta') {
    return value;
  }
  throw new Error('La respuesta del servidor no cumple el contrato de la API.');
}

function parseFileInfo(value: unknown): ApplicationFileInfo {
  if (!isRecord(value)) {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  const kind: FileKind = value.kind === 'photo' ? 'photo' : 'license';
  const contentType: ImageMimeType =
    value.contentType === 'image/png' ? 'image/png' : 'image/jpeg';
  return {
    kind,
    contentType,
    sizeBytes: typeof value.sizeBytes === 'number' ? value.sizeBytes : 0,
    uploadedAt: typeof value.uploadedAt === 'string' ? value.uploadedAt : '',
  };
}

function parseApplication(value: unknown): CourierApplication {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.fullName !== 'string') {
    throw new Error('La respuesta del servidor no cumple el contrato de la API.');
  }
  const files = Array.isArray(value.files) ? value.files.map(parseFileInfo) : [];
  return {
    id: value.id,
    userId: typeof value.userId === 'string' ? value.userId : '',
    status: asStatus(value.status),
    fullName: value.fullName,
    nationalId: String(value.nationalId ?? ''),
    phone: String(value.phone ?? ''),
    birthDate: String(value.birthDate ?? ''),
    vehicleType: asVehicle(value.vehicleType),
    licenseNumber: String(value.licenseNumber ?? ''),
    licenseCategory: String(value.licenseCategory ?? ''),
    licenseExpiresOn: String(value.licenseExpiresOn ?? ''),
    files,
    submittedAt: typeof value.submittedAt === 'string' ? value.submittedAt : null,
    reviewedAt: typeof value.reviewedAt === 'string' ? value.reviewedAt : null,
    rejectionReason: typeof value.rejectionReason === 'string' ? value.rejectionReason : null,
    approvedCapacity:
      typeof value.approvedCapacity === 'number' ? value.approvedCapacity : null,
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
  };
}

function parseDetail(value: unknown): ApplicationDetail {
  const base = parseApplication(value);
  const raw = value as Record<string, unknown>;
  return {
    ...base,
    applicantEmail: typeof raw.applicantEmail === 'string' ? raw.applicantEmail : '',
    applicantName: typeof raw.applicantName === 'string' ? raw.applicantName : null,
  };
}

export class HttpCourierApplicationGateway {
  constructor(private readonly http: MobileHttpClient) {}

  async getMine(): Promise<CourierApplication | null> {
    const payload = await this.http.get<unknown>('/courier-applications/me');
    if (!isRecord(payload) || !('application' in payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    if (payload.application === null) return null;
    return parseApplication(payload.application);
  }

  async saveDraft(input: ApplicationDraftInput): Promise<CourierApplication> {
    const payload = await this.http.put<unknown>('/courier-applications/me', input);
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseApplication(payload.application);
  }

  async uploadFile(
    kind: FileKind,
    base64: string,
    contentType: ImageMimeType,
  ): Promise<CourierApplication> {
    const payload = await this.http.putBinaryBase64<unknown>(
      `/courier-applications/me/files/${kind}`,
      base64,
      contentType,
    );
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseApplication(payload.application);
  }

  async getMyFileDataUri(kind: FileKind): Promise<string> {
    return this.http.getImageDataUri(`/courier-applications/me/files/${kind}`);
  }

  async submitMine(): Promise<CourierApplication> {
    const payload = await this.http.post<unknown>('/courier-applications/me/submit', {});
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseApplication(payload.application);
  }

  async cancelMine(): Promise<CourierApplication> {
    const payload = await this.http.post<unknown>('/courier-applications/me/cancel', {});
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseApplication(payload.application);
  }

  async listApplications(filters?: {
    status?: ApplicationStatus;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{items: readonly ApplicationDetail[]; total: number; limit: number; offset: number}> {
    const query = new URLSearchParams();
    if (filters?.status) query.set('status', filters.status);
    if (filters?.q && filters.q.trim()) query.set('q', filters.q.trim());
    if (filters?.limit !== undefined) query.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) query.set('offset', String(filters.offset));
    const suffix = query.toString();
    const payload = await this.http.get<unknown>(
      `/courier-applications${suffix ? `?${suffix}` : ''}`,
    );
    if (
      !isRecord(payload) ||
      !Array.isArray(payload.items) ||
      typeof payload.total !== 'number'
    ) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return {
      items: payload.items.map(parseDetail),
      total: payload.total,
      limit: typeof payload.limit === 'number' ? payload.limit : 25,
      offset: typeof payload.offset === 'number' ? payload.offset : 0,
    };
  }

  async getApplicationFileDataUri(applicationId: string, kind: FileKind): Promise<string> {
    return this.http.getImageDataUri(
      `/courier-applications/${encodeURIComponent(applicationId)}/files/${kind}`,
    );
  }

  async approve(applicationId: string, capacity: number): Promise<ApplicationDetail> {
    const payload = await this.http.post<unknown>(
      `/courier-applications/${encodeURIComponent(applicationId)}/approve`,
      {capacity},
    );
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseDetail(payload.application);
  }

  async reject(applicationId: string, reason: string): Promise<ApplicationDetail> {
    const payload = await this.http.post<unknown>(
      `/courier-applications/${encodeURIComponent(applicationId)}/reject`,
      {reason},
    );
    if (!isRecord(payload)) {
      throw new Error('La respuesta del servidor no cumple el contrato de la API.');
    }
    return parseDetail(payload.application);
  }
}

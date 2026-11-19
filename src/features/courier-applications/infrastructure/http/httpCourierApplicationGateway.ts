import type { HttpClient } from '../../../../shared/infrastructure/http/index.js';
import { HttpError } from '../../../../shared/infrastructure/http/index.js';
import type {
  ApplicationDetail,
  ApplicationDraftInput,
  ApplicationFilters,
  ApplicationPage,
  CourierApplication,
  FileKind,
  ImageType,
} from '../../domain/courierApplication.js';
import type { CourierApplicationGateway } from '../../domain/courierApplicationGateway.js';
import {
  readApplication,
  readApplicationDetail,
  readApplicationPage,
  readOptionalApplication,
} from './response.js';

export class HttpCourierApplicationGateway implements CourierApplicationGateway {
  constructor(private readonly httpClient: HttpClient) {}

  public async getMine(): Promise<CourierApplication | null> {
    try {
      return readOptionalApplication(
        await this.httpClient.get<unknown>('/courier-applications/me'),
      );
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  public async saveDraft(input: ApplicationDraftInput): Promise<CourierApplication> {
    return readApplication(
      await this.httpClient.put<unknown>('/courier-applications/me', {
        fullName: input.fullName,
        nationalId: input.nationalId,
        phone: input.phone,
        birthDate: input.birthDate,
        vehicleType: input.vehicleType,
        licenseNumber: input.licenseNumber,
        licenseCategory: input.licenseCategory,
        licenseExpiresOn: input.licenseExpiresOn,
      }),
    );
  }

  public async uploadFile(
    kind: FileKind,
    file: Blob,
    contentType: ImageType,
  ): Promise<CourierApplication> {
    return readApplication(
      await this.httpClient.putBinary<unknown>(
        '/courier-applications/me/files/' + encodeURIComponent(kind),
        file,
        contentType,
      ),
    );
  }

  public getMyFile(kind: FileKind): Promise<Blob> {
    return this.httpClient.getBlob('/courier-applications/me/files/' + encodeURIComponent(kind));
  }

  public async submit(): Promise<CourierApplication> {
    return readApplication(
      await this.httpClient.post<unknown>('/courier-applications/me/submit'),
    );
  }

  public async cancel(): Promise<CourierApplication> {
    return readApplication(
      await this.httpClient.post<unknown>('/courier-applications/me/cancel'),
    );
  }

  public async list(filters: ApplicationFilters = {}): Promise<ApplicationPage> {
    const params = new URLSearchParams();
    if (filters.status !== undefined && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    const query = filters.q?.trim() ?? '';
    if (query.length > 0) {
      params.set('q', query);
    }
    if (filters.limit !== undefined) {
      params.set('limit', String(filters.limit));
    }
    if (filters.offset !== undefined) {
      params.set('offset', String(filters.offset));
    }

    const suffix = params.toString();
    return readApplicationPage(
      await this.httpClient.get<unknown>(
        '/courier-applications' + (suffix.length > 0 ? '?' + suffix : ''),
      ),
    );
  }

  public async get(id: string): Promise<ApplicationDetail> {
    return readApplicationDetail(
      await this.httpClient.get<unknown>('/courier-applications/' + encodeURIComponent(id)),
    );
  }

  public getFile(id: string, kind: FileKind): Promise<Blob> {
    return this.httpClient.getBlob(
      '/courier-applications/' + encodeURIComponent(id) + '/files/' + encodeURIComponent(kind),
    );
  }

  public async approve(id: string, capacity = 10): Promise<ApplicationDetail> {
    return readApplicationDetail(
      await this.httpClient.post<unknown>(
        '/courier-applications/' + encodeURIComponent(id) + '/approve',
        { capacity },
      ),
    );
  }

  public async reject(id: string, reason: string): Promise<ApplicationDetail> {
    return readApplicationDetail(
      await this.httpClient.post<unknown>(
        '/courier-applications/' + encodeURIComponent(id) + '/reject',
        { reason },
      ),
    );
  }
}

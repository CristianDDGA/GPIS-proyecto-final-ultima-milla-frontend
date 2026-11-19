import type {
  ApplicationDetail,
  ApplicationDraftInput,
  ApplicationFileInfo,
  ApplicationFilters,
  ApplicationPage,
  CourierApplication,
  FileKind,
  ImageType,
} from './courierApplication.js';

export interface CourierApplicationGateway {
  /** GET /courier-applications/me — null cuando el cliente aún no tiene solicitud (404). */
  getMine(): Promise<CourierApplication | null>;
  saveDraft(input: ApplicationDraftInput): Promise<CourierApplication>;
  uploadFile(kind: FileKind, file: Blob, contentType: ImageType): Promise<CourierApplication>;
  getMyFile(kind: FileKind): Promise<Blob>;
  submit(): Promise<CourierApplication>;
  cancel(): Promise<CourierApplication>;

  list(filters?: ApplicationFilters): Promise<ApplicationPage>;
  get(id: string): Promise<ApplicationDetail>;
  getFile(id: string, kind: FileKind): Promise<Blob>;
  approve(id: string, capacity?: number): Promise<ApplicationDetail>;
  reject(id: string, reason: string): Promise<ApplicationDetail>;
}

export interface ApplicationFileView extends ApplicationFileInfo {
  readonly url: string | null;
}

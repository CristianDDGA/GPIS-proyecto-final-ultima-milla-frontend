export type ApplicationStatus =
  | 'borrador'
  | 'pendiente'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada';

export type VehicleType = 'moto' | 'auto' | 'camioneta';
export type LicenseCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type FileKind = 'license' | 'photo';
export type ImageMimeType = 'image/jpeg' | 'image/png';

export interface ApplicationFileInfo {
  readonly kind: FileKind;
  readonly contentType: ImageMimeType;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
}

export interface CourierApplication {
  readonly id: string;
  readonly userId: string;
  readonly status: ApplicationStatus;
  readonly fullName: string;
  readonly nationalId: string;
  readonly phone: string;
  readonly birthDate: string;
  readonly vehicleType: VehicleType;
  readonly licenseNumber: string;
  readonly licenseCategory: string;
  readonly licenseExpiresOn: string;
  readonly files: readonly ApplicationFileInfo[];
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly rejectionReason: string | null;
  readonly approvedCapacity: number | null;
  readonly createdAt: string;
}

export interface ApplicationDetail extends CourierApplication {
  readonly applicantEmail: string;
  readonly applicantName: string | null;
}

export interface ApplicationDraftInput {
  readonly fullName: string;
  readonly nationalId: string;
  readonly phone: string;
  readonly birthDate: string;
  readonly vehicleType: VehicleType;
  readonly licenseNumber: string;
  readonly licenseCategory: LicenseCategory;
  readonly licenseExpiresOn: string;
}

export const APPLICATION_STATUS_LABELS: Readonly<Record<ApplicationStatus, string>> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

export const VEHICLE_LABELS: Readonly<Record<VehicleType, string>> = {
  moto: 'Moto',
  auto: 'Auto',
  camioneta: 'Camioneta',
};

export const LICENSE_CATEGORIES: readonly LicenseCategory[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

import type {
  ApplicationDetail,
  ApplicationFileInfo,
  ApplicationPage,
  ApplicationStatus,
  CourierApplication,
  FileKind,
  ImageType,
  VehicleType,
} from '../../domain/index.js';

export const CONTRACT_ERROR_MESSAGE =
  'La respuesta del servidor no cumple el contrato de la API.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

const STATUSES: readonly ApplicationStatus[] = ['borrador', 'pendiente', 'aprobada', 'rechazada', 'cancelada'];
const FILE_KINDS: readonly FileKind[] = ['license', 'photo'];
const IMAGE_TYPES: readonly ImageType[] = ['image/jpeg', 'image/png'];
const VEHICLE_TYPES: readonly VehicleType[] = ['moto', 'auto', 'camioneta'];

function readFile(value: unknown): ApplicationFileInfo | null {
  if (
    !isRecord(value) ||
    !(FILE_KINDS as readonly string[]).includes(value['kind'] as string) ||
    !(IMAGE_TYPES as readonly string[]).includes(value['contentType'] as string) ||
    typeof value['sizeBytes'] !== 'number' ||
    !isIsoDate(value['uploadedAt'])
  ) {
    return null;
  }

  return {
    kind: value['kind'] as FileKind,
    contentType: value['contentType'] as ImageType,
    sizeBytes: value['sizeBytes'],
    uploadedAt: value['uploadedAt'],
  };
}

function readApplicationShape(value: unknown): CourierApplication | null {
  if (!isRecord(value)) {
    return null;
  }

  const files = Array.isArray(value['files']) ? value['files'].map(readFile) : null;
  if (
    !isText(value['id']) ||
    !isText(value['userId']) ||
    !isText(value['fullName']) ||
    !isText(value['nationalId']) ||
    !isText(value['phone']) ||
    !isText(value['birthDate']) ||
    !(VEHICLE_TYPES as readonly string[]).includes(value['vehicleType'] as string) ||
    !isText(value['licenseNumber']) ||
    !isText(value['licenseCategory']) ||
    !isText(value['licenseExpiresOn']) ||
    !(STATUSES as readonly string[]).includes(value['status'] as string) ||
    files === null ||
    files.some((file) => file === null) ||
    !isNullableText(value['submittedAt']) ||
    !isNullableText(value['reviewedAt']) ||
    !isNullableText(value['rejectionReason']) ||
    (value['approvedCapacity'] !== null && typeof value['approvedCapacity'] !== 'number') ||
    !isIsoDate(value['createdAt'])
  ) {
    return null;
  }

  return {
    id: value['id'],
    userId: value['userId'],
    fullName: value['fullName'],
    nationalId: value['nationalId'],
    phone: value['phone'],
    birthDate: value['birthDate'],
    vehicleType: value['vehicleType'] as VehicleType,
    licenseNumber: value['licenseNumber'],
    licenseCategory: value['licenseCategory'],
    licenseExpiresOn: value['licenseExpiresOn'],
    status: value['status'] as ApplicationStatus,
    files: files as ApplicationFileInfo[],
    submittedAt: value['submittedAt'],
    reviewedAt: value['reviewedAt'],
    rejectionReason: value['rejectionReason'],
    approvedCapacity: value['approvedCapacity'],
    createdAt: value['createdAt'],
  };
}

export function readApplication(value: unknown): CourierApplication {
  if (!isRecord(value)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  const application = readApplicationShape(value['application']);
  if (application === null) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  return application;
}

export function readApplicationDetail(value: unknown): ApplicationDetail {
  if (!isRecord(value)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  const record = value['application'];
  if (!isRecord(record)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  const base = readApplicationShape(record);
  if (
    base === null ||
    !isText(record['applicantEmail']) ||
    !isNullableText(record['applicantName'])
  ) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  return {
    ...base,
    applicantEmail: record['applicantEmail'] as string,
    applicantName: record['applicantName'] as string | null,
  };
}

export function readApplicationPage(value: unknown): ApplicationPage {
  if (
    !isRecord(value) ||
    !Array.isArray(value['items']) ||
    typeof value['total'] !== 'number' ||
    typeof value['limit'] !== 'number' ||
    typeof value['offset'] !== 'number'
  ) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  const items = value['items'].map((item) => {
    if (!isRecord(item)) {
      return null;
    }
    const base = readApplicationShape(item);
    if (base === null || !isText(item['applicantEmail']) || !isNullableText(item['applicantName'])) {
      return null;
    }
    return {
      ...base,
      applicantEmail: item['applicantEmail'] as string,
      applicantName: item['applicantName'] as string | null,
    } satisfies ApplicationDetail;
  });

  if (items.some((item) => item === null)) {
    throw new Error(CONTRACT_ERROR_MESSAGE);
  }

  return {
    items: items as ApplicationDetail[],
    total: value['total'],
    limit: value['limit'],
    offset: value['offset'],
  };
}

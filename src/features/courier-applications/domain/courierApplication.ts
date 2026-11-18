export type ApplicationStatus = 'borrador' | 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada';
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = ['borrador', 'pendiente', 'aprobada', 'rechazada', 'cancelada'];

export type FileKind = 'license' | 'photo';
export const FILE_KINDS: readonly FileKind[] = ['license', 'photo'];

export type ImageType = 'image/jpeg' | 'image/png';
export type VehicleType = 'moto' | 'auto' | 'camioneta';
export const VEHICLE_TYPES: readonly VehicleType[] = ['moto', 'auto', 'camioneta'];
export const LICENSE_CATEGORIES = ['A', 'A1', 'B', 'C', 'C1', 'D', 'D1', 'E', 'E1', 'F', 'G'] as const;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MIN_AGE_YEARS = 18;
export const MAX_AGE_YEARS = 100;

export interface CourierApplication {
  readonly id: string;
  readonly userId: string;
  readonly fullName: string;
  readonly nationalId: string;
  readonly phone: string;
  readonly birthDate: string;
  readonly vehicleType: VehicleType;
  readonly licenseNumber: string;
  readonly licenseCategory: string;
  readonly licenseExpiresOn: string;
  readonly status: ApplicationStatus;
  readonly files: readonly ApplicationFileInfo[];
  readonly submittedAt: string | null;
  readonly reviewedAt: string | null;
  readonly rejectionReason: string | null;
  readonly approvedCapacity: number | null;
  readonly createdAt: string;
}

export interface ApplicationFileInfo {
  readonly kind: FileKind;
  readonly contentType: ImageType;
  readonly sizeBytes: number;
  readonly uploadedAt: string;
}

/** Vista del administrador: incluye la cuenta del solicitante. */
export interface ApplicationDetail extends CourierApplication {
  readonly applicantEmail: string;
  readonly applicantName: string | null;
}

export interface ApplicationPage {
  readonly items: readonly ApplicationDetail[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ApplicationFilters {
  readonly status?: ApplicationStatus | 'all' | undefined;
  readonly q?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface ApplicationDraftInput {
  readonly fullName: string;
  readonly nationalId: string;
  readonly phone: string;
  readonly birthDate: string;
  readonly vehicleType: VehicleType;
  readonly licenseNumber: string;
  readonly licenseCategory: string;
  readonly licenseExpiresOn: string;
}

export interface ImageValidation {
  readonly ok: boolean;
  readonly contentType?: ImageType | undefined;
  readonly error?: string | undefined;
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  borrador: 'Borrador',
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
};

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  moto: 'Moto',
  auto: 'Auto',
  camioneta: 'Camioneta',
};

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  license: 'Licencia de conducir',
  photo: 'Foto del vehículo',
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const PERSON_NAME = /^\p{L}[\p{L}\p{M}]*(?:(?:\.? |['’-])\p{L}[\p{L}\p{M}]*)*\.?$/u;
const NATIONAL_ID_RE = /^\d{10}$/;

export function todayInEcuador(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function isValidIsoDate(value: string): boolean {
  const match = DATE_RE.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function subtractYears(isoDate: string, years: number): string {
  const [year, month, day] = isoDate.split('-').map(Number) as [number, number, number];
  const target = new Date(Date.UTC(year - years, month - 1, day));
  if (target.getUTCMonth() !== month - 1) {
    target.setUTCDate(0);
  }
  return target.toISOString().slice(0, 10);
}

/** Módulo 10 de cédula ecuatoriana (mismas reglas que el backend). */
export function isValidEcuadorianNationalId(value: string): boolean {
  if (!NATIONAL_ID_RE.test(value)) {
    return false;
  }
  const digits = [...value].map(Number) as number[];
  const province = digits[0]! * 10 + digits[1]!;
  if (!((province >= 1 && province <= 24) || province === 30)) {
    return false;
  }
  if (digits[2]! >= 6) {
    return false;
  }
  let sum = 0;
  for (let index = 0; index < 9; index += 1) {
    let product = digits[index]! * (index % 2 === 0 ? 2 : 1);
    if (product > 9) {
      product -= 9;
    }
    sum += product;
  }
  return (10 - (sum % 10)) % 10 === digits[9];
}

function normalizeText(value: string): string {
  return value.normalize('NFC').replace(/\s+/gu, ' ').trim();
}

const NATIONAL_ID_MESSAGE =
  'La cédula no es una cédula ecuatoriana válida (revisa la provincia, el tercer dígito y el dígito verificador).';

export function validateApplicationDraft(
  input: ApplicationDraftInput,
  today: string = todayInEcuador(),
): { isValid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const fullName = normalizeText(input.fullName);

  if (fullName.length < 2 || fullName.length > 120 || !PERSON_NAME.test(fullName)) {
    errors.fullName = 'Indica nombres y apellidos válidos (solo letras y espacios).';
  } else if (fullName.split(' ').length < 2) {
    errors.fullName = 'Indica tus nombres y apellidos.';
  }

  const nationalId = input.nationalId.trim();
  if (!NATIONAL_ID_RE.test(nationalId)) {
    errors.nationalId = 'La cédula debe tener 10 dígitos.';
  } else if (!isValidEcuadorianNationalId(nationalId)) {
    errors.nationalId = NATIONAL_ID_MESSAGE;
  }

  const phone = input.phone.trim();
  if (!/^\+?\d(?:[ -]?\d){6,14}$/.test(phone)) {
    errors.phone = 'El teléfono debe tener entre 7 y 15 dígitos (puede iniciar con +).';
  }

  const birthDate = input.birthDate.trim();
  if (!isValidIsoDate(birthDate)) {
    errors.birthDate = 'La fecha de nacimiento debe tener el formato AAAA-MM-DD.';
  } else if (birthDate > subtractYears(today, MIN_AGE_YEARS)) {
    errors.birthDate = 'Debes ser mayor de 18 años.';
  } else if (birthDate < subtractYears(today, MAX_AGE_YEARS)) {
    errors.birthDate = 'La fecha de nacimiento no es válida.';
  }

  if (!(VEHICLE_TYPES as readonly string[]).includes(input.vehicleType)) {
    errors.vehicleType = 'Selecciona un tipo de vehículo válido.';
  }

  const licenseNumber = normalizeText(input.licenseNumber).toUpperCase();
  if (licenseNumber.length < 4 || licenseNumber.length > 20 || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(licenseNumber)) {
    errors.licenseNumber = 'El número de licencia solo admite letras, números y guion (4 a 20 caracteres).';
  }

  if (!(LICENSE_CATEGORIES as readonly string[]).includes(input.licenseCategory)) {
    errors.licenseCategory = 'Selecciona una categoría de licencia válida.';
  }

  const licenseExpiresOn = input.licenseExpiresOn.trim();
  if (!isValidIsoDate(licenseExpiresOn)) {
    errors.licenseExpiresOn = 'La caducidad debe tener el formato AAAA-MM-DD.';
  } else if (licenseExpiresOn <= today) {
    errors.licenseExpiresOn = 'La licencia está caducada.';
  }

  return { isValid: Object.keys(errors).length === 0, errors };
}

/** Reconoce JPEG/PNG por firma (no confía en la extensión). */
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= png.length && png.every((value, index) => bytes[index] === value)) {
    return 'image/png';
  }
  return null;
}

export async function validateImageFile(file: File): Promise<ImageValidation> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'La imagen no puede superar 5 MB.' };
  }
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') {
    return { ok: false, error: 'Solo se aceptan imágenes JPEG o PNG.' };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);
  if (detected === null) {
    return { ok: false, error: 'El archivo no es una imagen JPEG o PNG válida.' };
  }
  return { ok: true, contentType: detected };
}

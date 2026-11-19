import { useCallback, useEffect, useRef, useState } from 'react';
import type { CourierApplicationUseCases } from '../../application/index.js';
import {
  validateApplicationDraft,
  validateImageFile,
  type ApplicationDraftInput,
  type CourierApplication,
  type FileKind,
} from '../../domain/index.js';

export interface UseMyCourierApplicationResult {
  readonly application: CourierApplication | null;
  readonly draft: ApplicationDraftInput;
  readonly fieldErrors: Record<string, string>;
  readonly fileUrls: Partial<Record<FileKind, string>>;
  readonly isLoading: boolean;
  readonly isSavingDraft: boolean;
  readonly uploadingKind: FileKind | null;
  readonly isSubmitting: boolean;
  readonly isCancelling: boolean;
  readonly error: string | null;
  readonly successMessage: string | null;
  readonly updateField: <K extends keyof ApplicationDraftInput>(
    field: K,
    value: ApplicationDraftInput[K],
  ) => void;
  readonly reload: () => Promise<void>;
  readonly saveDraft: () => Promise<boolean>;
  readonly uploadFile: (kind: FileKind, file: File) => Promise<void>;
  readonly submitApplication: () => Promise<boolean>;
  readonly cancelApplication: () => Promise<boolean>;
  readonly clearFeedback: () => void;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function emptyDraft(defaultFullName: string): ApplicationDraftInput {
  return {
    fullName: defaultFullName,
    nationalId: '',
    phone: '',
    birthDate: '',
    vehicleType: 'moto',
    licenseNumber: '',
    licenseCategory: 'A',
    licenseExpiresOn: '',
  };
}

function draftFromApplication(application: CourierApplication): ApplicationDraftInput {
  return {
    fullName: application.fullName,
    nationalId: application.nationalId,
    phone: application.phone,
    birthDate: application.birthDate,
    vehicleType: application.vehicleType,
    licenseNumber: application.licenseNumber,
    licenseCategory: application.licenseCategory,
    licenseExpiresOn: application.licenseExpiresOn,
  };
}

/**
 * Orquesta el flujo completo de autopostulación a repartidor para el rol cliente
 * (borrador, subida binaria JPEG/PNG, previsualización con ObjectURL, envío y cancelación).
 */
export function useMyCourierApplication(
  useCases: CourierApplicationUseCases,
  defaultFullName = '',
): UseMyCourierApplicationResult {
  const [application, setApplication] = useState<CourierApplication | null>(null);
  const [draft, setDraft] = useState<ApplicationDraftInput>(() => emptyDraft(defaultFullName));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fileUrls, setFileUrls] = useState<Partial<Record<FileKind, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<FileKind | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const fileUrlsRef = useRef<Partial<Record<FileKind, string>>>({});

  const revokeAllUrls = useCallback((): void => {
    for (const url of Object.values(fileUrlsRef.current)) {
      if (url !== undefined) {
        URL.revokeObjectURL(url);
      }
    }
    fileUrlsRef.current = {};
    setFileUrls({});
  }, []);

  const loadFiles = useCallback(
    async (app: CourierApplication | null): Promise<void> => {
      revokeAllUrls();
      if (app === null || app.files.length === 0) {
        return;
      }

      const nextUrls: Partial<Record<FileKind, string>> = {};
      await Promise.all(
        (['license', 'photo'] as const).map(async (kind) => {
          if (!app.files.some((file) => file.kind === kind)) {
            return;
          }
          try {
            const blob = await useCases.getMyFile.execute(kind);
            if (!mountedRef.current) {
              return;
            }
            nextUrls[kind] = URL.createObjectURL(blob);
          } catch {
            // Si no se puede previsualizar, el archivo sigue figurando como subido.
          }
        }),
      );

      if (!mountedRef.current) {
        for (const url of Object.values(nextUrls)) {
          if (url !== undefined) {
            URL.revokeObjectURL(url);
          }
        }
        return;
      }

      fileUrlsRef.current = nextUrls;
      setFileUrls(nextUrls);
    },
    [revokeAllUrls, useCases],
  );

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const current = await useCases.getMine.execute();
      if (!mountedRef.current) {
        return;
      }
      setApplication(current);
      if (current !== null) {
        setDraft(draftFromApplication(current));
      } else {
        setDraft(emptyDraft(defaultFullName));
      }
      await loadFiles(current);
    } catch (error_) {
      if (mountedRef.current) {
        setError(toErrorMessage(error_, 'No se pudo consultar tu solicitud actual.'));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [defaultFullName, loadFiles, useCases]);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => {
      mountedRef.current = false;
      revokeAllUrls();
    };
  }, [reload, revokeAllUrls]);

  const updateField = useCallback(
    <K extends keyof ApplicationDraftInput>(field: K, value: ApplicationDraftInput[K]): void => {
      setDraft((previous) => ({ ...previous, [field]: value }));
      setFieldErrors((previous) => {
        if (previous[field] === undefined) {
          return previous;
        }
        const next = { ...previous };
        delete next[field];
        return next;
      });
    },
    [],
  );

  const saveDraft = useCallback(async (): Promise<boolean> => {
    setError(null);
    setSuccessMessage(null);
    const validation = validateApplicationDraft(draft);
    setFieldErrors(validation.errors);
    if (!validation.isValid) {
      return false;
    }

    setIsSavingDraft(true);
    try {
      const saved = await useCases.saveDraft.execute(draft);
      if (!mountedRef.current) {
        return false;
      }
      setApplication(saved);
      setDraft(draftFromApplication(saved));
      setFieldErrors({});
      setSuccessMessage(
        'Borrador guardado. Ahora adjunta la licencia y la foto del vehículo para enviar tu solicitud.',
      );
      await loadFiles(saved);
      return true;
    } catch (error_) {
      if (mountedRef.current) {
        setError(toErrorMessage(error_, 'No se pudo guardar el borrador de la solicitud.'));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsSavingDraft(false);
      }
    }
  }, [draft, loadFiles, useCases]);

  const uploadFile = useCallback(
    async (kind: FileKind, file: File): Promise<void> => {
      setError(null);
      setSuccessMessage(null);

      const validation = await validateImageFile(file);
      if (!validation.ok || validation.contentType === undefined) {
        setError(validation.error ?? 'Archivo no válido. Usa una imagen JPEG o PNG de hasta 5 MB.');
        return;
      }

      setUploadingKind(kind);
      try {
        const updated = await useCases.uploadFile.execute(kind, file, validation.contentType);
        if (!mountedRef.current) {
          return;
        }
        setApplication(updated);

        const previousUrl = fileUrlsRef.current[kind];
        if (previousUrl !== undefined) {
          URL.revokeObjectURL(previousUrl);
        }
        const nextUrl = URL.createObjectURL(file);
        fileUrlsRef.current = { ...fileUrlsRef.current, [kind]: nextUrl };
        setFileUrls({ ...fileUrlsRef.current });
        setSuccessMessage('Documento adjuntado correctamente.');
      } catch (error_) {
        if (mountedRef.current) {
          setError(toErrorMessage(error_, 'No se pudo subir el archivo seleccionado.'));
        }
      } finally {
        if (mountedRef.current) {
          setUploadingKind(null);
        }
      }
    },
    [useCases],
  );

  const submitApplication = useCallback(async (): Promise<boolean> => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);
    try {
      const submitted = await useCases.submit.execute();
      if (!mountedRef.current) {
        return false;
      }
      setApplication(submitted);
      setSuccessMessage('Tu solicitud fue enviada a revisión.');
      return true;
    } catch (error_) {
      if (mountedRef.current) {
        setError(toErrorMessage(error_, 'No se pudo enviar tu solicitud a revisión.'));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsSubmitting(false);
      }
    }
  }, [useCases]);

  const cancelApplication = useCallback(async (): Promise<boolean> => {
    setError(null);
    setSuccessMessage(null);
    setIsCancelling(true);
    try {
      const cancelled = await useCases.cancel.execute();
      if (!mountedRef.current) {
        return false;
      }
      setApplication(cancelled);
      setSuccessMessage('Solicitud cancelada. Puedes editar los datos si deseas volver a postular.');
      return true;
    } catch (error_) {
      if (mountedRef.current) {
        setError(toErrorMessage(error_, 'No se pudo cancelar la solicitud.'));
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setIsCancelling(false);
      }
    }
  }, [useCases]);

  const clearFeedback = useCallback((): void => {
    setError(null);
    setSuccessMessage(null);
  }, []);

  return {
    application,
    draft,
    fieldErrors,
    fileUrls,
    isLoading,
    isSavingDraft,
    uploadingKind,
    isSubmitting,
    isCancelling,
    error,
    successMessage,
    updateField,
    reload,
    saveDraft,
    uploadFile,
    submitApplication,
    cancelApplication,
    clearFeedback,
  };
}

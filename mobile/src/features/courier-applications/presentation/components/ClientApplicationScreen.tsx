import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Image, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  Button,
  Card,
  KineticHeader,
  PickerField,
  StatusBadge,
  TextInputField,
  colors,
  spacing,
  tabularNumbersStyle,
  typography,
} from '../../../../shared/ui';
import {formatUtcDateOnly, runAsync} from '../../../../shared/utils/format';
import {
  ISO_DATE_RE,
  isValidEcuadorianNationalId,
  validatePersonName,
} from '../../../../shared/utils/validation';
import {
  APPLICATION_STATUS_LABELS,
  LICENSE_CATEGORIES,
  VEHICLE_LABELS,
  type ApplicationDraftInput,
  type CourierApplication,
  type FileKind,
  type LicenseCategory,
  type VehicleType,
} from '../../domain/courierApplication';
import type {HttpCourierApplicationGateway} from '../../infrastructure/httpCourierApplicationGateway';
import {
  hasNativeImagePicker,
  pickDocumentImage,
} from '../../infrastructure/nativeImagePicker';

interface ClientApplicationScreenProps {
  readonly gateway: HttpCourierApplicationGateway;
  readonly defaultFullName: string;
}

export function ClientApplicationScreen({
  gateway,
  defaultFullName,
}: ClientApplicationScreenProps) {
  const [application, setApplication] = useState<CourierApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingKind, setUploadingKind] = useState<FileKind | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [fileUris, setFileUris] = useState<Partial<Record<FileKind, string>>>({});
  const [feedback, setFeedback] = useState<{type: 'error' | 'success'; text: string} | null>(null);

  const [draft, setDraft] = useState<ApplicationDraftInput>({
    fullName: defaultFullName,
    nationalId: '',
    phone: '',
    birthDate: '',
    vehicleType: 'moto',
    licenseNumber: '',
    licenseCategory: 'A',
    licenseExpiresOn: '',
  });

  const loadMine = useCallback(async () => {
    setIsLoading(true);
    try {
      const app = await gateway.getMine();
      setApplication(app);
      if (app) {
        setDraft({
          fullName: app.fullName,
          nationalId: app.nationalId,
          phone: app.phone,
          birthDate: app.birthDate,
          vehicleType: app.vehicleType,
          licenseNumber: app.licenseNumber,
          licenseCategory: (LICENSE_CATEGORIES.includes(app.licenseCategory as LicenseCategory)
            ? app.licenseCategory
            : 'A') as LicenseCategory,
          licenseExpiresOn: app.licenseExpiresOn,
        });

        const nextUris: Partial<Record<FileKind, string>> = {};
        for (const file of app.files) {
          try {
            nextUris[file.kind] = await gateway.getMyFileDataUri(file.kind);
          } catch {
            // Ignoramos falla puntual de previsualización si la imagen ya fue registrada.
          }
        }
        setFileUris(nextUris);
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo cargar tu postulación.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [gateway]);

  useEffect(() => {
    runAsync(loadMine());
  }, [loadMine]);

  const validateDraft = (): string | null => {
    const words = draft.fullName.trim().split(/\s+/).filter(Boolean);
    const nameErr = validatePersonName(draft.fullName, 'El nombre completo');
    if (nameErr) return nameErr;
    if (words.length < 2) return 'Ingresa nombres y apellidos completos.';
    if (!isValidEcuadorianNationalId(draft.nationalId)) {
      return 'Ingresa una cédula ecuatoriana válida de 10 dígitos.';
    }
    if (!/^\d{7,15}$/.test(draft.phone.trim())) {
      return 'Ingresa un teléfono válido entre 7 y 15 dígitos.';
    }
    if (!ISO_DATE_RE.test(draft.birthDate.trim())) {
      return 'La fecha de nacimiento debe tener formato AAAA-MM-DD.';
    }
    if (draft.licenseNumber.trim().length < 3) {
      return 'Ingresa tu número de licencia.';
    }
    if (!ISO_DATE_RE.test(draft.licenseExpiresOn.trim())) {
      return 'La fecha de caducidad debe tener formato AAAA-MM-DD.';
    }
    return null;
  };

  const handleSaveDraft = async () => {
    const err = validateDraft();
    if (err) {
      setFeedback({type: 'error', text: err});
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const saved = await gateway.saveDraft({
        ...draft,
        fullName: draft.fullName.trim(),
        nationalId: draft.nationalId.trim(),
        phone: draft.phone.trim(),
        birthDate: draft.birthDate.trim(),
        licenseNumber: draft.licenseNumber.trim(),
        licenseExpiresOn: draft.licenseExpiresOn.trim(),
      });
      setApplication(saved);
      setFeedback({type: 'success', text: 'Borrador guardado correctamente.'});
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo guardar el borrador.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpload = async (kind: FileKind) => {
    setUploadingKind(kind);
    setFeedback(null);
    try {
      const picked = await pickDocumentImage();
      if (!picked) return;
      const updated = await gateway.uploadFile(kind, picked.base64, picked.contentType);
      setApplication(updated);
      setFileUris(prev => ({
        ...prev,
        [kind]: `data:${picked.contentType};base64,${picked.base64}`,
      }));
      setFeedback({
        type: 'success',
        text:
          kind === 'license'
            ? 'Licencia de conducir cargada correctamente.'
            : 'Foto del vehículo cargada correctamente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo subir la imagen.',
      });
    } finally {
      setUploadingKind(null);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const submitted = await gateway.submitMine();
      setApplication(submitted);
      setFeedback({type: 'success', text: 'Tu solicitud fue enviada a revisión.'});
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo enviar la postulación.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    setFeedback(null);
    try {
      const cancelled = await gateway.cancelMine();
      setApplication(cancelled);
      setConfirmCancel(false);
      setFileUris({});
      setFeedback({type: 'success', text: 'Solicitud cancelada correctamente.'});
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo cancelar la solicitud.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const isPendingReview = application?.status === 'pendiente';
  const canEdit =
    application === null ||
    application.status === 'borrador' ||
    application.status === 'rechazada' ||
    application.status === 'cancelada';
  const isDraft = application?.status === 'borrador';
  const files = application?.files ?? [];
  const hasLicense = files.some(f => f.kind === 'license');
  const hasPhoto = files.some(f => f.kind === 'photo');

  return (
    <View style={styles.container}>
      <KineticHeader
        rightAction={
          <Button
            isLoading={isLoading}
            label="↻ Actualizar"
            onPress={() => runAsync(loadMine())}
            size="sm"
            variant="secondary"
          />
        }
        title="Postulación a repartidor"
      />

      {feedback ? (
        <AlertBanner
          onClose={() => setFeedback(null)}
          title={feedback.type === 'success' ? 'Actualización' : 'Atención'}
          type={feedback.type}>
          {feedback.text}
        </AlertBanner>
      ) : null}

      {isLoading && application === null ? (
        <ActivityIndicator color={colors.webflowBlue} size="large" />
      ) : isPendingReview && application ? (
        <View style={styles.section}>
          <Card>
            <View style={styles.headRow}>
              <Text style={typography.cardTitle}>Solicitud en revisión</Text>
              <StatusBadge label="Pendiente" tone="blue" />
            </View>
            <AlertBanner title="Pendiente de revisión" type="info">
              {`Tu solicitud fue enviada el ${formatUtcDateOnly(application.submittedAt)} y está siendo revisada por el equipo administrador.`}
            </AlertBanner>
            <Card variant="muted">
              <Text style={typography.body}>{`Nombre: ${application.fullName}`}</Text>
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Cédula: ${application.nationalId}`}
              </Text>
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Teléfono: ${application.phone}`}
              </Text>
              <Text style={typography.body}>
                {`Vehículo: ${VEHICLE_LABELS[application.vehicleType]}`}
              </Text>
              <Text style={typography.body}>
                {`Licencia: ${application.licenseCategory} · ${application.licenseNumber}`}
              </Text>
            </Card>
            {confirmCancel ? (
              <Card variant="muted">
                <Text style={typography.body}>¿Seguro deseas cancelar tu postulación?</Text>
                <View style={styles.rowActions}>
                  <Button
                    isLoading={isCancelling}
                    label="Sí, cancelar"
                    onPress={() => runAsync(handleCancel())}
                    size="sm"
                    variant="danger"
                  />
                  <Button
                    label="Volver"
                    onPress={() => setConfirmCancel(false)}
                    size="sm"
                    variant="secondary"
                  />
                </View>
              </Card>
            ) : (
              <Button
                label="Cancelar solicitud"
                onPress={() => setConfirmCancel(true)}
                size="sm"
                variant="secondary"
              />
            )}
          </Card>

          <Card>
            <Text style={typography.cardTitle}>Documentos enviados</Text>
            {(['license', 'photo'] as const).map(kind => (
              <View key={kind} style={styles.docBox}>
                <Text style={typography.label}>
                  {kind === 'license' ? 'Licencia de conducir' : 'Foto del vehículo'}
                </Text>
                {fileUris[kind] ? (
                  <Image
                    resizeMode="cover"
                    source={{uri: fileUris[kind]}}
                    style={styles.previewImg}
                  />
                ) : (
                  <Text style={typography.caption}>Archivo registrado en servidor</Text>
                )}
              </View>
            ))}
          </Card>
        </View>
      ) : (
        <View style={styles.section}>
          {application?.status === 'rechazada' ? (
            <AlertBanner title="Postulación anterior rechazada" type="warning">
              {application.rejectionReason ??
                'Tu solicitud anterior fue rechazada. Actualiza tus datos para reenviar.'}
            </AlertBanner>
          ) : null}

          {canEdit ? (
            <>
              <Card>
                <View style={styles.headRow}>
                  <Text style={typography.cardTitle}>Datos personales y licencia</Text>
                  {application ? (
                    <StatusBadge label={APPLICATION_STATUS_LABELS[application.status]} tone="neutral" />
                  ) : null}
                </View>

                <TextInputField
                  editable={!isSaving}
                  isRequired
                  label="Nombre completo"
                  maxLength={120}
                  onChangeText={val => setDraft(prev => ({...prev, fullName: val}))}
                  placeholder="Nombres y apellidos"
                  value={draft.fullName}
                />
                <TextInputField
                  editable={!isSaving}
                  isRequired
                  keyboardType="number-pad"
                  label="Cédula ecuatoriana"
                  maxLength={10}
                  onChangeText={val => setDraft(prev => ({...prev, nationalId: val}))}
                  placeholder="10 dígitos"
                  value={draft.nationalId}
                />
                <TextInputField
                  editable={!isSaving}
                  isRequired
                  keyboardType="phone-pad"
                  label="Teléfono"
                  maxLength={15}
                  onChangeText={val => setDraft(prev => ({...prev, phone: val}))}
                  placeholder="0991234567"
                  value={draft.phone}
                />
                <TextInputField
                  editable={!isSaving}
                  isRequired
                  label="Fecha de nacimiento"
                  maxLength={10}
                  onChangeText={val => setDraft(prev => ({...prev, birthDate: val}))}
                  placeholder="AAAA-MM-DD"
                  value={draft.birthDate}
                />
                <PickerField
                  isRequired
                  label="Tipo de vehículo"
                  onValueChange={val => setDraft(prev => ({...prev, vehicleType: val as VehicleType}))}
                  options={[
                    {value: 'moto', label: 'Moto'},
                    {value: 'auto', label: 'Auto'},
                    {value: 'camioneta', label: 'Camioneta'},
                  ]}
                  value={draft.vehicleType}
                />
                <TextInputField
                  editable={!isSaving}
                  isRequired
                  label="Número de licencia"
                  maxLength={20}
                  onChangeText={val => setDraft(prev => ({...prev, licenseNumber: val}))}
                  placeholder="Ej. EC-17234567"
                  value={draft.licenseNumber}
                />
                <PickerField
                  isRequired
                  label="Categoría"
                  onValueChange={val =>
                    setDraft(prev => ({...prev, licenseCategory: val as LicenseCategory}))
                  }
                  options={LICENSE_CATEGORIES.map(c => ({value: c, label: `Categoría ${c}`}))}
                  value={draft.licenseCategory}
                />
                <TextInputField
                  editable={!isSaving}
                  isRequired
                  label="Fecha de caducidad de la licencia"
                  maxLength={10}
                  onChangeText={val => setDraft(prev => ({...prev, licenseExpiresOn: val}))}
                  placeholder="AAAA-MM-DD"
                  value={draft.licenseExpiresOn}
                />
                <Button
                  fullWidth
                  isLoading={isSaving}
                  label={isDraft ? 'Actualizar borrador' : 'Guardar borrador'}
                  onPress={() => runAsync(handleSaveDraft())}
                />
              </Card>

              <Card>
                <View style={styles.headRow}>
                  <Text style={typography.cardTitle}>Documentos requeridos</Text>
                  <Text style={typography.caption}>JPEG o PNG · máx. 5 MB</Text>
                </View>

                {!isDraft ? (
                  <AlertBanner title="Borrador requerido" type="info">
                    Guarda primero tus datos personales para habilitar la carga de documentos.
                  </AlertBanner>
                ) : null}

                {(['license', 'photo'] as const).map(kind => {
                  const uploaded = files.some(f => f.kind === kind);
                  const uri = fileUris[kind];
                  return (
                    <Card key={kind} variant="muted">
                      <View style={styles.headRow}>
                        <Text style={typography.label}>
                          {kind === 'license' ? 'Licencia de conducir' : 'Foto del vehículo'}
                        </Text>
                        <StatusBadge
                          label={uploaded ? 'Cargado' : 'Requerido'}
                          tone={uploaded ? 'green' : 'neutral'}
                        />
                      </View>
                      {uri ? (
                        <Image resizeMode="cover" source={{uri}} style={styles.previewImg} />
                      ) : null}
                      <Button
                        disabled={!isDraft || !hasNativeImagePicker()}
                        isLoading={uploadingKind === kind}
                        label={uploaded ? 'Cambiar imagen' : 'Seleccionar imagen'}
                        onPress={() => runAsync(handleUpload(kind))}
                        size="sm"
                        variant="secondary"
                      />
                    </Card>
                  );
                })}

                {isDraft ? (
                  <Button
                    disabled={!hasLicense || !hasPhoto}
                    fullWidth
                    isLoading={isSubmitting}
                    label="Enviar postulación"
                    onPress={() => runAsync(handleSubmit())}
                  />
                ) : null}
              </Card>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  section: {gap: spacing.lg},
  headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  rowActions: {flexDirection: 'row', gap: spacing.sm},
  docBox: {gap: spacing.sm},
  previewImg: {
    width: '100%',
    height: 150,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
  },
});

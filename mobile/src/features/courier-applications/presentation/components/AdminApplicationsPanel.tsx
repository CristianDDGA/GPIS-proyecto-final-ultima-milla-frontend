import {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  EmptyState,
  PickerField,
  ShortIdChip,
  StatusBadge,
  TextInputField,
  colors,
  fontFamilySans,
  spacing,
  tabularNumbersStyle,
  typography,
  type BadgeTone,
} from '../../../../shared/ui';
import {formatUtcDateOnly, runAsync} from '../../../../shared/utils/format';
import {
  APPLICATION_STATUS_LABELS,
  VEHICLE_LABELS,
  type ApplicationDetail,
  type ApplicationStatus,
  type FileKind,
} from '../../domain/courierApplication';
import type {HttpCourierApplicationGateway} from '../../infrastructure/httpCourierApplicationGateway';

const PAGE_LIMIT = 15;

const STATUS_TONE: Record<ApplicationStatus, BadgeTone> = {
  borrador: 'neutral',
  pendiente: 'blue',
  aprobada: 'green',
  rechazada: 'red',
  cancelada: 'neutral',
};

interface AdminApplicationsPanelProps {
  readonly gateway: HttpCourierApplicationGateway;
}

export function AdminApplicationsPanel({gateway}: AdminApplicationsPanelProps) {
  const [items, setItems] = useState<readonly ApplicationDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('pendiente');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [selected, setSelected] = useState<ApplicationDetail | null>(null);
  const [capacity, setCapacity] = useState('10');
  const [reason, setReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [images, setImages] = useState<Partial<Record<FileKind, string>>>({});
  const [feedback, setFeedback] = useState<{type: 'error' | 'success'; text: string} | null>(null);

  const load = useCallback(
    async (targetOffset = offset) => {
      setIsLoading(true);
      try {
        const page = await gateway.listApplications({
          ...(statusFilter !== 'all' ? {status: statusFilter} : {}),
          ...(search.trim() ? {q: search.trim()} : {}),
          limit: PAGE_LIMIT,
          offset: targetOffset,
        });
        setItems(page.items);
        setTotal(page.total);
        setOffset(page.offset);
      } catch (error) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [gateway, offset, search, statusFilter],
  );

  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      runAsync(load(0));
    }
  }, [load]);

  const inspect = async (app: ApplicationDetail) => {
    setSelected(app);
    setImages({});
    setCapacity('10');
    setReason('');
    for (const file of app.files) {
      try {
        const uri = await gateway.getApplicationFileDataUri(app.id, file.kind);
        setImages(prev => ({...prev, [file.kind]: uri}));
      } catch {
        // Mantiene inspección textual si no se puede cargar la vista previa binaria.
      }
    }
  };

  const handleApprove = async () => {
    if (!selected) return;
    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1 || cap > 200) {
      setFeedback({type: 'error', text: 'La capacidad debe ser un entero entre 1 y 200.'});
      return;
    }
    setIsReviewing(true);
    setFeedback(null);
    try {
      await gateway.approve(selected.id, cap);
      setSelected(null);
      setFeedback({
        type: 'success',
        text: 'Solicitud aprobada: la cuenta fue promovida a repartidor.',
      });
      await load(0);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo aprobar la solicitud.',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    if (reason.trim().length < 5) {
      setFeedback({type: 'error', text: 'Indica un motivo de rechazo (mínimo 5 caracteres).'});
      return;
    }
    setIsReviewing(true);
    setFeedback(null);
    try {
      await gateway.reject(selected.id, reason.trim());
      setSelected(null);
      setFeedback({type: 'success', text: 'Solicitud rechazada correctamente.'});
      await load(0);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo rechazar la solicitud.',
      });
    } finally {
      setIsReviewing(false);
    }
  };

  return (
    <View style={styles.container}>
      {feedback ? (
        <AlertBanner
          onClose={() => setFeedback(null)}
          title={feedback.type === 'success' ? 'Revisión completada' : 'Atención'}
          type={feedback.type}>
          {feedback.text}
        </AlertBanner>
      ) : null}

      <Card variant="muted">
        <Text style={typography.cardTitle}>Solicitudes de repartidor</Text>
        <TextInputField
          label="Buscar"
          onChangeText={setSearch}
          placeholder="Nombre, correo o cédula"
          value={search}
        />
        <PickerField
          label="Estado"
          onValueChange={val => setStatusFilter(val as typeof statusFilter)}
          options={[
            {value: 'pendiente', label: 'Pendiente'},
            {value: 'all', label: 'Todos los estados'},
            {value: 'aprobada', label: 'Aprobada'},
            {value: 'rechazada', label: 'Rechazada'},
            {value: 'cancelada', label: 'Cancelada'},
          ]}
          value={statusFilter}
        />
        <View style={styles.rowActions}>
          <Button isLoading={isLoading} label="Filtrar" onPress={() => runAsync(load(0))} size="sm" />
          <Button
            label="Limpiar"
            onPress={() => {
              setSearch('');
              setStatusFilter('pendiente');
              runAsync(load(0));
            }}
            size="sm"
            variant="secondary"
          />
        </View>
      </Card>

      {isLoading && items.length === 0 ? (
        <ActivityIndicator color={colors.webflowBlue} size="large" />
      ) : items.length === 0 ? (
        <EmptyState
          description="No hay postulaciones que coincidan con el estado o búsqueda actual."
          title="Sin solicitudes"
        />
      ) : (
        <View style={styles.list}>
          {items.map(item => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => runAsync(inspect(item))}
              style={({pressed}) => [styles.appCard, pressed && styles.appCardPressed]}>
              <View style={styles.headRow}>
                <View style={styles.appMeta}>
                  <Text style={styles.appName}>{item.fullName}</Text>
                  <Text style={typography.caption}>{item.applicantEmail}</Text>
                </View>
                <StatusBadge
                  label={APPLICATION_STATUS_LABELS[item.status]}
                  tone={STATUS_TONE[item.status]}
                />
              </View>
              <View style={styles.badges}>
                <ShortIdChip id={item.id} prefix="SOL" />
                <Text style={typography.caption}>
                  {`${VEHICLE_LABELS[item.vehicleType]} · Lic. ${item.licenseCategory}`}
                </Text>
                <Text style={[typography.caption, tabularNumbersStyle]}>
                  {formatUtcDateOnly(item.submittedAt)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {total > PAGE_LIMIT ? (
        <View style={styles.pagination}>
          <Text style={[typography.caption, tabularNumbersStyle]}>
            {`${offset + 1}–${Math.min(offset + items.length, total)} de ${total}`}
          </Text>
          <View style={styles.rowActions}>
            <Button
              disabled={offset === 0 || isLoading}
              label="Anterior"
              onPress={() => runAsync(load(Math.max(0, offset - PAGE_LIMIT)))}
              size="sm"
              variant="secondary"
            />
            <Button
              disabled={offset + PAGE_LIMIT >= total || isLoading}
              label="Siguiente"
              onPress={() => runAsync(load(offset + PAGE_LIMIT))}
              size="sm"
              variant="secondary"
            />
          </View>
        </View>
      ) : null}

      <BottomSheetModal
        onClose={() => setSelected(null)}
        subtitle={selected?.applicantEmail}
        title={selected?.fullName ?? 'Revisión de postulación'}
        visible={selected !== null}>
        {selected ? (
          <View style={styles.detailWrap}>
            <Card variant="muted">
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Cédula: ${selected.nationalId}`}
              </Text>
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Teléfono: ${selected.phone}`}
              </Text>
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Nacimiento: ${selected.birthDate}`}
              </Text>
              <Text style={typography.body}>
                {`Vehículo: ${VEHICLE_LABELS[selected.vehicleType]}`}
              </Text>
              <Text style={typography.body}>
                {`Licencia: ${selected.licenseCategory} · ${selected.licenseNumber} (cad. ${selected.licenseExpiresOn})`}
              </Text>
              <StatusBadge
                label={APPLICATION_STATUS_LABELS[selected.status]}
                tone={STATUS_TONE[selected.status]}
              />
            </Card>

            {(['license', 'photo'] as const).map(kind => (
              <Card key={kind}>
                <Text style={typography.label}>
                  {kind === 'license' ? 'Licencia de conducir' : 'Foto del vehículo'}
                </Text>
                {images[kind] ? (
                  <Image
                    resizeMode="cover"
                    source={{uri: images[kind]}}
                    style={styles.previewImg}
                  />
                ) : (
                  <ActivityIndicator color={colors.webflowBlue} size="small" />
                )}
              </Card>
            ))}

            {selected.status === 'pendiente' ? (
              <Card>
                <Text style={typography.cardTitle}>Decisión administrativa</Text>
                <TextInputField
                  keyboardType="number-pad"
                  label="Capacidad de ruta asignada (1..200)"
                  onChangeText={setCapacity}
                  value={capacity}
                />
                <Button
                  fullWidth
                  isLoading={isReviewing}
                  label="Aprobar solicitud"
                  onPress={() => runAsync(handleApprove())}
                />
                <TextInputField
                  label="Motivo si rechazas"
                  multiline
                  onChangeText={setReason}
                  placeholder="Describe la razón del rechazo"
                  value={reason}
                />
                <Button
                  fullWidth
                  isLoading={isReviewing}
                  label="Rechazar solicitud"
                  onPress={() => runAsync(handleReject())}
                  variant="danger"
                />
              </Card>
            ) : null}
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.md},
  rowActions: {flexDirection: 'row', gap: spacing.sm},
  list: {gap: spacing.sm},
  appCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    padding: spacing.md,
    gap: spacing.sm,
  },
  appCardPressed: {backgroundColor: colors.mist},
  headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm},
  appMeta: {flex: 1, minWidth: 0, gap: 2},
  appName: {fontFamily: fontFamilySans, fontSize: 15, fontWeight: '600', color: colors.obsidian},
  badges: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  pagination: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  detailWrap: {gap: spacing.md},
  previewImg: {
    width: '100%',
    height: 160,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ashBorder,
  },
});

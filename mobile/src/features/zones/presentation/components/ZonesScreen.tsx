import {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  EmptyState,
  KineticHeader,
  ShortIdChip,
  TextInputField,
  colors,
  fontFamilySans,
  spacing,
  tabularNumbersStyle,
  typography,
} from '../../../../shared/ui';
import {formatUtcTimestamp, runAsync} from '../../../../shared/utils/format';
import {validatePlaceName} from '../../../../shared/utils/validation';
import type {Zone} from '../../domain/zone';
import type {HttpZoneGateway} from '../../infrastructure/httpZoneGateway';

interface ZonesScreenProps {
  readonly gateway: HttpZoneGateway;
  readonly zones: readonly Zone[];
  readonly orders: readonly {readonly zoneId: string}[];
  readonly canCreateZone: boolean;
  readonly isLoadingCatalog: boolean;
  readonly onRefresh: () => Promise<void>;
  readonly onNavigateToOrders: (zoneId: string) => void;
}

export function ZonesScreen({
  gateway,
  zones,
  orders,
  canCreateZone,
  isLoadingCatalog,
  onRefresh,
  onNavigateToOrders,
}: ZonesScreenProps) {
  const [zoneName, setZoneName] = useState('');
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [isCreating, setIsCreating] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success'; text: string} | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const countByZone = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of orders) {
      map.set(order.zoneId, (map.get(order.zoneId) ?? 0) + 1);
    }
    return map;
  }, [orders]);

  const handleCreate = async () => {
    const err = validatePlaceName(zoneName);
    if (err) {
      setNameError(err);
      return;
    }
    setNameError(undefined);
    setIsCreating(true);
    setFeedback(null);
    try {
      const created = await gateway.create(zoneName.trim());
      setZoneName('');
      setFeedback({type: 'success', text: `Zona "${created.name}" registrada correctamente.`});
      await onRefresh();
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo registrar la zona.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const inspectZone = async (zone: Zone) => {
    setSelectedZone(zone);
    setIsLoadingDetail(true);
    try {
      const fresh = await gateway.getById(zone.id);
      setSelectedZone(fresh);
    } catch {
      // Mantiene el resumen ya cargado si el detalle remoto falla temporalmente.
    } finally {
      setIsLoadingDetail(false);
    }
  };

  return (
    <View style={styles.container}>
      <KineticHeader
        rightAction={
          <Button
            isLoading={isLoadingCatalog}
            label="↻ Actualizar"
            onPress={() => runAsync(onRefresh())}
            size="sm"
            variant="secondary"
          />
        }
        title="Zonas de cobertura"
      />

      {feedback ? (
        <AlertBanner
          onClose={() => setFeedback(null)}
          title={feedback.type === 'success' ? 'Operación exitosa' : 'Atención'}
          type={feedback.type}>
          {feedback.text}
        </AlertBanner>
      ) : null}

      {canCreateZone ? (
        <Card>
          <Text style={typography.cardTitle}>Registrar nueva zona</Text>
          <TextInputField
            editable={!isCreating}
            error={nameError}
            isRequired
            label="Nombre de la zona"
            maxLength={80}
            onChangeText={val => {
              setZoneName(val);
              if (nameError) setNameError(undefined);
            }}
            placeholder="Ej. Centro Histórico"
            value={zoneName}
          />
          <Button
            fullWidth
            isLoading={isCreating}
            label="Crear zona"
            onPress={() => runAsync(handleCreate())}
          />
        </Card>
      ) : null}

      <Card style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={typography.cardTitle}>Zonas operativas</Text>
          <View style={styles.countPill}>
            <Text style={[styles.countText, tabularNumbersStyle]}>
              {`${zones.length} ${zones.length === 1 ? 'zona' : 'zonas'}`}
            </Text>
          </View>
        </View>

        {isLoadingCatalog && zones.length === 0 ? (
          <ActivityIndicator color={colors.webflowBlue} size="large" />
        ) : zones.length === 0 ? (
          <EmptyState
            description="No hay zonas de cobertura registradas en este momento."
            title="Sin zonas registradas"
          />
        ) : (
          <View style={styles.cards}>
            {zones.map(zone => {
              const count = countByZone.get(zone.id) ?? 0;
              return (
                <Pressable
                  key={zone.id}
                  accessibilityRole="button"
                  onPress={() => runAsync(inspectZone(zone))}
                  style={({pressed}) => [styles.zoneRow, pressed && styles.zoneRowPressed]}>
                  <View style={styles.zoneMain}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <View style={styles.zoneMeta}>
                      <ShortIdChip id={zone.id} prefix="ZON" />
                      <Text style={[styles.zoneStats, tabularNumbersStyle]}>
                        {count === 0 ? 'Sin pedidos' : `${count} ${count === 1 ? 'pedido' : 'pedidos'}`}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.rowCta}>Ver detalle</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <BottomSheetModal
        onClose={() => setSelectedZone(null)}
        subtitle="Área de cobertura"
        title={selectedZone?.name ?? 'Detalle de zona'}
        visible={selectedZone !== null}>
        {selectedZone ? (
          <View style={styles.detailContent}>
            {isLoadingDetail ? (
              <ActivityIndicator color={colors.webflowBlue} size="small" />
            ) : null}
            <Card variant="muted">
              <View style={styles.detailRow}>
                <Text style={typography.caption}>Código</Text>
                <ShortIdChip id={selectedZone.id} prefix="ZON" />
              </View>
              <View style={styles.detailRow}>
                <Text style={typography.caption}>Demanda visible</Text>
                <Text style={[typography.body, tabularNumbersStyle]}>
                  {`${countByZone.get(selectedZone.id) ?? 0} pedido(s)`}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={typography.caption}>Fecha de creación</Text>
                <Text style={typography.body}>{formatUtcTimestamp(selectedZone.createdAt)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={typography.caption}>Última actualización</Text>
                <Text style={typography.body}>{formatUtcTimestamp(selectedZone.updatedAt)}</Text>
              </View>
            </Card>
            <Button
              fullWidth
              label="Ver pedidos de esta zona →"
              onPress={() => {
                const targetId = selectedZone.id;
                setSelectedZone(null);
                onNavigateToOrders(targetId);
              }}
            />
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  listSection: {gap: spacing.md},
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
  },
  countText: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
    color: colors.slate,
  },
  cards: {gap: spacing.sm},
  zoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    padding: spacing.md,
    minHeight: 60,
  },
  zoneRowPressed: {backgroundColor: colors.mist},
  zoneMain: {flex: 1, minWidth: 0, gap: 6},
  zoneName: {
    fontFamily: fontFamilySans,
    fontSize: 15,
    fontWeight: '600',
    color: colors.obsidian,
  },
  zoneMeta: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  zoneStats: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    color: colors.slate,
  },
  rowCta: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    fontWeight: '500',
    color: colors.webflowBlue,
  },
  detailContent: {gap: spacing.md},
  detailRow: {gap: 3},
});

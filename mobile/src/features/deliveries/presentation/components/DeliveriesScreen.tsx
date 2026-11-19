import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  EmptyState,
  KineticHeader,
  PickerField,
  ShortIdChip,
  StatusBadge,
  colors,
  fontFamilySans,
  radii,
  spacing,
  tabularNumbersStyle,
  typography,
  type BadgeTone,
} from '../../../../shared/ui';
import {formatShortCode, formatUtcTimestamp, runAsync} from '../../../../shared/utils/format';
import type {ActiveCourierRoute, Courier} from '../../../couriers/domain/courier';
import type {HttpCourierGateway} from '../../../couriers/infrastructure/httpCourierGateway';
import {ORDER_STATUS_LABELS, type OrderStatus} from '../../../orders/domain/order';
import type {Zone} from '../../../zones/domain/zone';
import {
  deliveryActionLabel,
  getNextDeliveryStatus,
  type DeliveryOrder,
} from '../../domain/delivery';
import type {HttpDeliveryGateway} from '../../infrastructure/httpDeliveryGateway';

const STOP_STAGES: readonly {readonly status: OrderStatus; readonly label: string}[] = [
  {status: 'asignado_a_ruta', label: 'Asignado'},
  {status: 'recogido', label: 'Recogido'},
  {status: 'en_camino', label: 'En camino'},
  {status: 'entregado', label: 'Entregado'},
];

const BADGE_TONE: Record<OrderStatus, BadgeTone> = {
  pendiente: 'amber',
  asignado_a_ruta: 'blue',
  recogido: 'neutral',
  en_camino: 'blue',
  entregado: 'green',
};

interface DeliveriesScreenProps {
  readonly deliveryGateway: HttpDeliveryGateway;
  readonly courierGateway: HttpCourierGateway;
  readonly role: 'personal' | 'repartidor' | 'cliente';
  readonly actorCourierId: string | null;
  readonly actorDisplayName: string | null;
  readonly zones: readonly Zone[];
  readonly onCatalogChanged: () => Promise<void>;
}

export function DeliveriesScreen({
  deliveryGateway,
  courierGateway,
  role,
  actorCourierId,
  actorDisplayName,
  zones,
  onCatalogChanged,
}: DeliveriesScreenProps) {
  const [couriers, setCouriers] = useState<readonly Courier[]>([]);
  const [selectedCourierId, setSelectedCourierId] = useState(
    role === 'repartidor' ? (actorCourierId ?? '') : '',
  );
  const [availability, setAvailability] = useState<boolean | null>(null);
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);

  const [activeRoute, setActiveRoute] = useState<ActiveCourierRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [deliveryRecords, setDeliveryRecords] = useState<Record<string, DeliveryOrder>>({});
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const [inspectedOrder, setInspectedOrder] = useState<DeliveryOrder | null>(null);
  const [isLoadingInspector, setIsLoadingInspector] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success'; text: string} | null>(null);

  const routeVersionRef = useRef(0);
  const effectiveCourierId = role === 'repartidor' ? (actorCourierId ?? '') : selectedCourierId;

  useEffect(() => {
    if (role !== 'personal') return;
    let active = true;
    courierGateway
      .getCouriers({limit: 100})
      .then(page => {
        if (active) setCouriers(page.items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [courierGateway, role]);

  useEffect(() => {
    if (role !== 'personal') return;
    const match = couriers.find(c => c.id === effectiveCourierId);
    setAvailability(match ? match.isAvailable : null);
  }, [couriers, effectiveCourierId, role]);

  const loadRoute = useCallback(async () => {
    if (!effectiveCourierId) {
      setActiveRoute(null);
      return;
    }
    const req = ++routeVersionRef.current;
    setIsLoadingRoute(true);
    setFeedback(null);
    try {
      const route = await courierGateway.getActiveRoute(effectiveCourierId);
      if (routeVersionRef.current !== req) return;
      setActiveRoute(route);
      if (route && route.stops.length > 0) {
        const settled = await Promise.allSettled(
          route.stops.map(s => deliveryGateway.getDeliveryOrder(s.orderId)),
        );
        if (routeVersionRef.current !== req) return;
        const map: Record<string, DeliveryOrder> = {};
        for (const res of settled) {
          if (res.status === 'fulfilled') {
            map[res.value.orderId] = res.value;
          }
        }
        setDeliveryRecords(prev => ({...prev, ...map}));
      }
    } catch (error) {
      if (routeVersionRef.current === req) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'No se pudo cargar la hoja de ruta activa.',
        });
      }
    } finally {
      if (routeVersionRef.current === req) {
        setIsLoadingRoute(false);
      }
    }
  }, [courierGateway, deliveryGateway, effectiveCourierId]);

  useEffect(() => {
    runAsync(loadRoute());
  }, [loadRoute]);

  const handleSetAvailability = async (target: boolean) => {
    if (!effectiveCourierId) return;
    setIsUpdatingAvailability(true);
    setFeedback(null);
    try {
      const updated = await courierGateway.updateAvailability(effectiveCourierId, target);
      setAvailability(updated.isAvailable);
      setCouriers(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      setFeedback({
        type: 'success',
        text: `Disponibilidad actualizada: ${updated.isAvailable ? 'Disponible' : 'No disponible'}.`,
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo actualizar la disponibilidad.',
      });
    } finally {
      setIsUpdatingAvailability(false);
    }
  };

  const handleAdvanceStop = async (orderId: string) => {
    setAdvancingId(orderId);
    setFeedback(null);
    try {
      const record =
        deliveryRecords[orderId] ?? (await deliveryGateway.getDeliveryOrder(orderId));
      const next = getNextDeliveryStatus(record.status);
      if (!next) {
        setFeedback({type: 'error', text: 'Este pedido no tiene más transiciones disponibles.'});
        return;
      }
      const res = await deliveryGateway.changeStatus({
        orderId,
        newStatus: next,
        expectedVersion: record.version,
      });
      setDeliveryRecords(prev => ({
        ...prev,
        [orderId]: {
          ...record,
          status: res.status,
          version: res.version,
          deliveredAt: res.status === 'entregado' ? new Date().toISOString() : record.deliveredAt,
          updatedAt: new Date().toISOString(),
        },
      }));
      setFeedback({
        type: 'success',
        text: `#PED-${formatShortCode(orderId)}: actualizado a "${ORDER_STATUS_LABELS[res.status]}".`,
      });
      await Promise.all([loadRoute(), onCatalogChanged()]);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo actualizar el estado.',
      });
    } finally {
      setAdvancingId(null);
    }
  };

  const handleInspectStop = async (orderId: string) => {
    setIsLoadingInspector(true);
    try {
      const fresh = await deliveryGateway.getDeliveryOrder(orderId);
      setDeliveryRecords(prev => ({...prev, [fresh.orderId]: fresh}));
      setInspectedOrder(fresh);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo inspeccionar la parada.',
      });
    } finally {
      setIsLoadingInspector(false);
    }
  };

  const handleCompleteRoute = async () => {
    if (!activeRoute) return;
    setIsCompleting(true);
    setFeedback(null);
    try {
      await deliveryGateway.completeRoute(activeRoute.routeId);
      setDeliveryRecords({});
      setInspectedOrder(null);
      setFeedback({
        type: 'success',
        text: `Ruta #RUT-${formatShortCode(activeRoute.routeId)} completada correctamente.`,
      });
      await Promise.all([loadRoute(), onCatalogChanged()]);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo completar la ruta.',
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const stops = useMemo(() => activeRoute?.stops ?? [], [activeRoute?.stops]);
  const deliveredCount = stops.filter(
    stop => (deliveryRecords[stop.orderId]?.status ?? stop.status) === 'entregado',
  ).length;
  const progressPct = stops.length === 0 ? 0 : Math.round((deliveredCount / stops.length) * 100);
  const canComplete =
    activeRoute !== null &&
    activeRoute.status === 'en_curso' &&
    stops.length > 0 &&
    deliveredCount === stops.length;

  const zoneName = (zoneId: string) =>
    zones.find(zone => zone.id === zoneId)?.name ?? 'Zona sin catalogar';

  if (role === 'repartidor' && actorCourierId === null) {
    return (
      <View style={styles.container}>
        <KineticHeader title="Ejecución de entregas" />
        <AlertBanner title="Sin repartidor vinculado" type="warning">
          Tu cuenta aún no tiene una ficha operativa en flota. Un administrador debe vincular o
          aprobar tu perfil de repartidor.
        </AlertBanner>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KineticHeader
        rightAction={
          effectiveCourierId ? (
            <Button
              isLoading={isLoadingRoute}
              label="↻ Recargar"
              onPress={() => runAsync(loadRoute())}
              size="sm"
              variant="secondary"
            />
          ) : undefined
        }
        title="Ejecución de entregas"
      />

      {feedback ? (
        <AlertBanner
          onClose={() => setFeedback(null)}
          title={feedback.type === 'success' ? 'Operación exitosa' : 'Atención'}
          type={feedback.type}>
          {feedback.text}
        </AlertBanner>
      ) : null}

      <Card>
        <Text style={typography.cardTitle}>
          {role === 'repartidor' ? 'Mi perfil de reparto' : 'Repartidor en operación'}
        </Text>

        {role === 'personal' ? (
          <PickerField
            label="Repartidor"
            onValueChange={setSelectedCourierId}
            options={couriers.map(c => ({
              value: c.id,
              label: `${c.displayName} · ${c.isAvailable ? 'Disponible' : 'No disponible'}`,
            }))}
            placeholder="Selecciona un repartidor"
            value={selectedCourierId}
          />
        ) : (
          <View style={styles.profileSummary}>
            <Text style={styles.profileName}>{actorDisplayName ?? 'Repartidor en sesión'}</Text>
            <Text style={typography.caption}>Perfil vinculado a tu sesión activa.</Text>
          </View>
        )}

        <View style={styles.availBox}>
          <View style={styles.availHead}>
            <Text style={typography.caption}>Disponibilidad operativa</Text>
            <StatusBadge
              label={
                availability === null
                  ? role === 'repartidor'
                    ? 'Por confirmar'
                    : 'Sin seleccionar'
                  : availability
                    ? 'Disponible'
                    : 'No disponible'
              }
              tone={
                availability === null ? 'neutral' : availability ? 'green' : 'red'
              }
            />
          </View>

          {role === 'repartidor' && effectiveCourierId ? (
            availability === null ? (
              <View style={styles.availControls}>
                <Text style={typography.caption}>
                  Define explícitamente si estás disponible para recibir nuevas rutas.
                </Text>
                <View style={styles.rowButtons}>
                  <Button
                    isLoading={isUpdatingAvailability}
                    label="Marcar disponible"
                    onPress={() => runAsync(handleSetAvailability(true))}
                    size="sm"
                    testID="mark-available-btn"
                  />
                  <Button
                    isLoading={isUpdatingAvailability}
                    label="No disponible"
                    onPress={() => runAsync(handleSetAvailability(false))}
                    size="sm"
                    variant="secondary"
                  />
                </View>
              </View>
            ) : (
              <Button
                isLoading={isUpdatingAvailability}
                label={availability ? 'Marcar no disponible' : 'Marcar disponible'}
                onPress={() => runAsync(handleSetAvailability(!availability))}
                size="sm"
                variant={availability ? 'outline' : 'primary'}
              />
            )
          ) : null}
        </View>
      </Card>

      <Card>
        <Text style={typography.cardTitle}>Hoja de ruta activa</Text>

        {!effectiveCourierId ? (
          <Text style={typography.bodyMuted}>
            Selecciona un repartidor para cargar su hoja de ruta activa.
          </Text>
        ) : isLoadingRoute && !activeRoute ? (
          <ActivityIndicator color={colors.webflowBlue} size="large" />
        ) : !activeRoute ? (
          <EmptyState
            action={
              <Button
                label="↻ Volver a consultar"
                onPress={() => runAsync(loadRoute())}
                size="sm"
                variant="secondary"
              />
            }
            description="No hay una ruta asignada o en curso en este momento."
            title="Sin hoja de ruta activa"
          />
        ) : (
          <View style={styles.routeBody} testID="assigned-route-result">
            <View style={styles.metaGrid}>
              <Card style={styles.metaTile} variant="muted">
                <Text style={typography.caption}>Zona</Text>
                <Text style={styles.metaVal}>{zoneName(activeRoute.zoneId)}</Text>
              </Card>
              <Card style={styles.metaTile} variant="muted">
                <Text style={typography.caption}>Fecha</Text>
                <Text style={[styles.metaVal, tabularNumbersStyle]}>{activeRoute.serviceDate}</Text>
              </Card>
              <Card style={styles.metaTile} variant="muted">
                <Text style={typography.caption}>Estado</Text>
                <StatusBadge
                  label={activeRoute.status === 'en_curso' ? 'En curso' : 'Asignada'}
                  tone={activeRoute.status === 'en_curso' ? 'green' : 'blue'}
                />
              </Card>
              <Card style={styles.metaTile} variant="muted">
                <Text style={typography.caption}>Código</Text>
                <ShortIdChip id={activeRoute.routeId} prefix="RUT" />
              </Card>
            </View>

            <Card variant="muted">
              <View style={styles.progressHead}>
                <Text style={[typography.label, tabularNumbersStyle]}>
                  {`Entregados: ${deliveredCount} de ${stops.length}`}
                </Text>
                <Text style={[styles.progressPct, tabularNumbersStyle]}>{`${progressPct}%`}</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {width: `${progressPct}%`},
                    deliveredCount === stops.length && stops.length > 0 && styles.progressComplete,
                  ]}
                />
              </View>
            </Card>

            <View style={styles.stopsList} testID="route-stops-heading">
              {stops.map(stop => {
                const status = deliveryRecords[stop.orderId]?.status ?? stop.status;
                const next = getNextDeliveryStatus(status);
                const stageIdx = Math.max(
                  0,
                  STOP_STAGES.findIndex(s => s.status === status),
                );
                return (
                  <View key={stop.orderId} style={styles.stopCard}>
                    <View style={styles.stopTop}>
                      <View style={styles.posBox}>
                        <Text style={[styles.posVal, tabularNumbersStyle]}>{stop.position}</Text>
                        <Text style={styles.posLbl}>Parada</Text>
                      </View>
                      <View style={styles.stopMain}>
                        <Pressable onPress={() => runAsync(handleInspectStop(stop.orderId))}>
                          <Text style={styles.stopAddr}>{stop.deliveryAddress}</Text>
                        </Pressable>
                        <View style={styles.stopMeta}>
                          <ShortIdChip id={stop.orderId} prefix="PED" />
                          <StatusBadge label={ORDER_STATUS_LABELS[status]} tone={BADGE_TONE[status]} />
                          <Text style={[typography.caption, tabularNumbersStyle]}>
                            {stop.deliveryTime || 'Sin hora'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.stepper}>
                      {STOP_STAGES.map((stage, idx) => (
                        <View
                          key={stage.status}
                          style={[
                            styles.stageChip,
                            idx < stageIdx && styles.stageDone,
                            idx === stageIdx && styles.stageCurrent,
                          ]}>
                          <Text
                            style={[
                              styles.stageText,
                              idx < stageIdx && styles.stageTextDone,
                              idx === stageIdx && styles.stageTextCurrent,
                            ]}>
                            {stage.label}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.rowButtons}>
                      <Button
                        isLoading={isLoadingInspector}
                        label="Inspeccionar"
                        onPress={() => runAsync(handleInspectStop(stop.orderId))}
                        size="sm"
                        variant="secondary"
                      />
                      {next ? (
                        <Button
                          isLoading={advancingId === stop.orderId}
                          label={deliveryActionLabel(next)}
                          onPress={() => runAsync(handleAdvanceStop(stop.orderId))}
                          size="sm"
                        />
                      ) : status === 'entregado' ? (
                        <StatusBadge label="Pedido entregado" tone="green" />
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>

            <Card variant="muted">
              <Text style={[typography.label, tabularNumbersStyle]}>
                {`Pedidos entregados: ${deliveredCount} de ${stops.length}`}
              </Text>
              {!canComplete && activeRoute.status !== 'en_curso' ? (
                <Text style={styles.reasonText}>
                  Inicia la ruta marcando al menos un pedido en camino para poder completarla.
                </Text>
              ) : !canComplete ? (
                <Text style={styles.reasonText}>
                  Entrega todas las paradas antes de completar la ruta.
                </Text>
              ) : null}
              <Button
                disabled={!canComplete}
                fullWidth
                isLoading={isCompleting}
                label="Completar ruta"
                onPress={() => runAsync(handleCompleteRoute())}
              />
            </Card>
          </View>
        )}
      </Card>

      <BottomSheetModal
        onClose={() => setInspectedOrder(null)}
        title="Detalle de parada"
        visible={inspectedOrder !== null}>
        {inspectedOrder ? (
          <View style={styles.inspectWrap}>
            <Card variant="muted">
              <ShortIdChip id={inspectedOrder.orderId} prefix="PED" />
              {inspectedOrder.routeId ? (
                <ShortIdChip id={inspectedOrder.routeId} prefix="RUT" />
              ) : null}
              <StatusBadge
                label={ORDER_STATUS_LABELS[inspectedOrder.status]}
                tone={BADGE_TONE[inspectedOrder.status]}
              />
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Versión: v${inspectedOrder.version}`}
              </Text>
              <Text style={typography.body}>
                {`Entregado: ${formatUtcTimestamp(inspectedOrder.deliveredAt)}`}
              </Text>
              <Text style={typography.body}>
                {`Actualizado: ${formatUtcTimestamp(inspectedOrder.updatedAt)}`}
              </Text>
            </Card>
            <Button
              fullWidth
              isLoading={isLoadingInspector}
              label="↻ Sincronizar registro"
              onPress={() => runAsync(handleInspectStop(inspectedOrder.orderId))}
              variant="secondary"
            />
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  profileSummary: {gap: 2},
  profileName: {fontFamily: fontFamilySans, fontSize: 16, fontWeight: '600', color: colors.obsidian},
  availBox: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
    padding: spacing.md,
    gap: spacing.sm,
  },
  availHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  availControls: {gap: spacing.sm},
  rowButtons: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  routeBody: {gap: spacing.md},
  metaGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  metaTile: {width: '48%', padding: spacing.md, gap: 4},
  metaVal: {fontFamily: fontFamilySans, fontSize: 14, fontWeight: '600', color: colors.obsidian},
  progressHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  progressPct: {fontFamily: fontFamilySans, fontSize: 14, fontWeight: '600', color: colors.webflowBlue},
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.pureWhite,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    overflow: 'hidden',
  },
  progressFill: {height: '100%', backgroundColor: colors.webflowBlue},
  progressComplete: {backgroundColor: colors.greenText},
  stopsList: {gap: spacing.md},
  stopCard: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    borderLeftWidth: 3,
    borderLeftColor: colors.webflowBlue,
    backgroundColor: colors.pureWhite,
    padding: spacing.md,
    gap: spacing.sm,
  },
  stopTop: {flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start'},
  posBox: {minWidth: 42, alignItems: 'center'},
  posVal: {fontFamily: fontFamilySans, fontSize: 17, fontWeight: '600', color: colors.webflowBlue},
  posLbl: {fontFamily: fontFamilySans, fontSize: 11, fontWeight: '500', color: colors.slate},
  stopMain: {flex: 1, minWidth: 0, gap: 6},
  stopAddr: {fontFamily: fontFamilySans, fontSize: 15, fontWeight: '600', color: colors.obsidian},
  stopMeta: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  stepper: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  stageChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.tag,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.mist,
  },
  stageDone: {backgroundColor: colors.greenBg, borderColor: colors.greenBorder},
  stageCurrent: {backgroundColor: colors.blueTintBg, borderColor: colors.blueTintBorder},
  stageText: {fontFamily: fontFamilySans, fontSize: 11, fontWeight: '500', color: colors.slate},
  stageTextDone: {color: colors.greenText},
  stageTextCurrent: {color: colors.webflowBlue, fontWeight: '600'},
  reasonText: {fontFamily: fontFamilySans, fontSize: 12, color: colors.pendingText},
  inspectWrap: {gap: spacing.md},
});

import {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  Button,
  Card,
  EmptyState,
  IsometricCapacityCube,
  KineticHeader,
  PickerField,
  ShortIdChip,
  StatusBadge,
  TextInputField,
  colors,
  fontFamilySans,
  radii,
  spacing,
  tabularNumbersStyle,
  typography,
  type BadgeTone,
} from '../../../../shared/ui';
import {addDaysIsoLocal, runAsync, todayIsoLocal} from '../../../../shared/utils/format';
import {ISO_DATE_RE} from '../../../../shared/utils/validation';
import type {Courier} from '../../../couriers/domain/courier';
import type {Order} from '../../../orders/domain/order';
import type {Zone} from '../../../zones/domain/zone';
import {
  ROUTE_STATUS_LABELS,
  type RouteDetail,
  type RouteStatus,
  type RouteSummary,
} from '../../domain/route';
import type {HttpRouteGateway} from '../../infrastructure/httpRouteGateway';
import {RouteDetailModal} from './RouteDetailModal';

const ROUTE_TONE: Record<RouteStatus, BadgeTone> = {
  planificada: 'neutral',
  asignada: 'blue',
  en_curso: 'green',
  completada: 'green',
  cancelada: 'neutral',
};

interface RoutesScreenProps {
  readonly gateway: HttpRouteGateway;
  readonly zones: readonly Zone[];
  readonly pendingOrders: readonly Order[];
  readonly couriers: readonly Courier[];
  readonly initialServiceDate: string;
  readonly isAdmin: boolean;
  readonly onCatalogChanged: () => Promise<void>;
  readonly onNavigateToFleet?: () => void;
}

export function RoutesScreen({
  gateway,
  zones,
  pendingOrders,
  couriers,
  initialServiceDate,
  isAdmin,
  onCatalogChanged,
  onNavigateToFleet,
}: RoutesScreenProps) {
  const [routes, setRoutes] = useState<readonly RouteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(initialServiceDate);
  const [filterZoneId, setFilterZoneId] = useState('');

  const [planOpen, setPlanOpen] = useState(false);
  const [planDate, setPlanDate] = useState(todayIsoLocal);
  const [planCapacity, setPlanCapacity] = useState('4');
  const [isPlanning, setIsPlanning] = useState(false);

  const [lateOpen, setLateOpen] = useState(false);
  const [lateOrderId, setLateOrderId] = useState('');
  const [lateCapacity, setLateCapacity] = useState('4');
  const [isPlacingLate, setIsPlacingLate] = useState(false);

  const [selectedRoute, setSelectedRoute] = useState<RouteDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success' | 'warning'; text: string} | null>(null);

  useEffect(() => {
    if (initialServiceDate) {
      setFilterDate(initialServiceDate);
      setPlanDate(initialServiceDate);
    }
  }, [initialServiceDate]);

  const loadRoutes = useCallback(
    async (dateVal = filterDate, zoneVal = filterZoneId) => {
      setIsLoading(true);
      try {
        const list = await gateway.getRoutes({
          ...(dateVal.trim() ? {serviceDate: dateVal.trim()} : {}),
          ...(zoneVal ? {zoneId: zoneVal} : {}),
          limit: 50,
        });
        setRoutes(list);
      } catch (error) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'No se pudo cargar el listado de rutas.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [filterDate, filterZoneId, gateway],
  );

  useEffect(() => {
    runAsync(loadRoutes(filterDate, filterZoneId));
  }, [filterDate, filterZoneId, loadRoutes]);

  const pendingOptions = useMemo(
    () =>
      pendingOrders
        .filter(order => order.status === 'pendiente')
        .map(order => ({
          value: order.id,
          label: `${order.deliveryAddress} · ${order.deliveryDate} ${order.deliveryTime}`,
        })),
    [pendingOrders],
  );

  const zoneNameOf = (zoneId: string) =>
    zones.find(zone => zone.id === zoneId)?.name ?? 'Zona sin catalogar';

  const courierNameOf = (courierId: string | null) => {
    if (!courierId) return null;
    return couriers.find(courier => courier.id === courierId)?.displayName ?? 'Repartidor asignado';
  };

  const inspectRoute = async (routeId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await gateway.getRouteById(routeId);
      setSelectedRoute(detail);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo consultar el detalle de la ruta.',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handlePlan = async () => {
    if (!ISO_DATE_RE.test(planDate.trim())) {
      setFeedback({type: 'error', text: 'La fecha de servicio debe usar formato AAAA-MM-DD.'});
      return;
    }
    const cap = Number(planCapacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setFeedback({type: 'error', text: 'La capacidad debe ser un entero positivo.'});
      return;
    }

    setIsPlanning(true);
    setFeedback(null);
    try {
      const res = await gateway.planRoutes(planDate.trim(), cap);
      setPlanOpen(false);
      setFeedback({
        type: 'success',
        text:
          res.routeIds.length > 0
            ? `Se planificaron ${res.routeIds.length} ruta(s) para ${res.serviceDate}.`
            : `No había pedidos pendientes para planificar en ${res.serviceDate}.`,
      });
      await Promise.all([loadRoutes(), onCatalogChanged()]);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo generar el plan de rutas.',
      });
    } finally {
      setIsPlanning(false);
    }
  };

  const handlePlaceLate = async () => {
    if (!lateOrderId) {
      setFeedback({type: 'error', text: 'Selecciona un pedido pendiente.'});
      return;
    }
    const cap = Number(lateCapacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setFeedback({type: 'error', text: 'La capacidad límite debe ser un entero positivo.'});
      return;
    }

    setIsPlacingLate(true);
    setFeedback(null);
    try {
      const res = await gateway.placeLateOrder(lateOrderId, cap);
      if (res.status === 'asignado_a_ruta') {
        setLateOpen(false);
        setLateOrderId('');
        setFeedback({type: 'success', text: 'Pedido tardío asignado a una ruta activa.'});
        await Promise.all([loadRoutes(), onCatalogChanged(), inspectRoute(res.routeId)]);
      } else {
        setFeedback({
          type: 'warning',
          text: 'Sin repartidor disponible con cupo; el pedido sigue pendiente.',
        });
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo insertar el pedido tardío.',
      });
    } finally {
      setIsPlacingLate(false);
    }
  };

  return (
    <View style={styles.container}>
      <KineticHeader
        rightAction={
          <Button
            isLoading={isLoading}
            label="↻ Actualizar"
            onPress={() => runAsync(loadRoutes())}
            size="sm"
            variant="secondary"
          />
        }
        title="Planificación y operaciones de ruta"
      />

      {feedback ? (
        <AlertBanner
          onClose={() => setFeedback(null)}
          title={feedback.type === 'success' ? 'Operación exitosa' : 'Atención'}
          type={feedback.type}>
          {feedback.text}
        </AlertBanner>
      ) : null}

      {isAdmin ? (
        <View style={styles.adminCards}>
          <Card>
            <View style={styles.headRow}>
              <Text style={typography.cardTitle}>Generar plan de rutas</Text>
              <Button
                label={planOpen ? 'Ocultar' : 'Planificar'}
                onPress={() => setPlanOpen(prev => !prev)}
                size="sm"
                variant={planOpen ? 'secondary' : 'primary'}
              />
            </View>
            {planOpen ? (
              <View style={styles.form}>
                <TextInputField
                  editable={!isPlanning}
                  isRequired
                  label="Fecha de servicio"
                  maxLength={10}
                  onChangeText={setPlanDate}
                  placeholder="AAAA-MM-DD"
                  value={planDate}
                />
                <View style={styles.quickDateRow}>
                  {[
                    {label: 'Hoy', iso: todayIsoLocal()},
                    {label: 'Mañana', iso: addDaysIsoLocal(1)},
                  ].map(item => (
                    <Pressable
                      key={item.label}
                      accessibilityRole="button"
                      hitSlop={4}
                      onPress={() => setPlanDate(item.iso)}
                      style={[
                        styles.dateChip,
                        planDate === item.iso && styles.dateChipActive,
                      ]}>
                      <Text
                        style={[
                          styles.dateChipText,
                          planDate === item.iso && styles.dateChipTextActive,
                        ]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInputField
                  editable={!isPlanning}
                  isRequired
                  keyboardType="number-pad"
                  label="Límite de capacidad por ruta"
                  onChangeText={setPlanCapacity}
                  value={planCapacity}
                />
                <Button
                  fullWidth
                  isLoading={isPlanning}
                  label="Generar planificación"
                  onPress={() => runAsync(handlePlan())}
                />
              </View>
            ) : null}
          </Card>

          <Card>
            <View style={styles.headRow}>
              <Text style={typography.cardTitle}>Insertar pedido tardío</Text>
              <Button
                label={lateOpen ? 'Ocultar' : 'Insertar'}
                onPress={() => setLateOpen(prev => !prev)}
                size="sm"
                variant="secondary"
              />
            </View>
            {lateOpen ? (
              <View style={styles.form}>
                <PickerField
                  isRequired
                  label="Pedido pendiente"
                  maxRenderedOptions={50}
                  onValueChange={setLateOrderId}
                  options={pendingOptions}
                  placeholder="Buscar o seleccionar pedido..."
                  searchableThreshold={5}
                  value={lateOrderId}
                />
                <TextInputField
                  editable={!isPlacingLate}
                  isRequired
                  keyboardType="number-pad"
                  label="Límite de capacidad de la ruta"
                  onChangeText={setLateCapacity}
                  value={lateCapacity}
                />
                <Button
                  disabled={pendingOptions.length === 0}
                  fullWidth
                  isLoading={isPlacingLate}
                  label="Insertar pedido tardío"
                  onPress={() => runAsync(handlePlaceLate())}
                />
              </View>
            ) : null}
          </Card>
        </View>
      ) : null}

      <Card variant="muted">
        <View style={styles.headRow}>
          <Text style={typography.cardTitle}>Rutas planificadas</Text>
          <View style={styles.countPill}>
            <Text style={[styles.countText, tabularNumbersStyle]}>
              {`${routes.length} ${routes.length === 1 ? 'ruta' : 'rutas'}`}
            </Text>
          </View>
        </View>
        <TextInputField
          label="Fecha de servicio"
          maxLength={10}
          onChangeText={setFilterDate}
          placeholder="AAAA-MM-DD (opcional)"
          value={filterDate}
        />
        <View style={styles.quickDateRow}>
          {[
            {label: 'Todas', iso: ''},
            {label: 'Hoy', iso: todayIsoLocal()},
            {label: 'Mañana', iso: addDaysIsoLocal(1)},
          ].map(item => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              hitSlop={4}
              onPress={() => setFilterDate(item.iso)}
              style={[
                styles.dateChip,
                filterDate === item.iso && styles.dateChipActive,
              ]}>
              <Text
                style={[
                  styles.dateChipText,
                  filterDate === item.iso && styles.dateChipTextActive,
                ]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <PickerField
          label="Zona"
          onValueChange={setFilterZoneId}
          options={[
            {value: '', label: 'Todas las zonas'},
            ...zones.map(z => ({value: z.id, label: z.name})),
          ]}
          value={filterZoneId}
        />
        <View style={styles.rowActions}>
          <Button
            isLoading={isLoading}
            label="Filtrar"
            onPress={() => runAsync(loadRoutes())}
            size="sm"
          />
          <Button
            label="Limpiar filtros"
            onPress={() => {
              setFilterDate('');
              setFilterZoneId('');
            }}
            size="sm"
            variant="secondary"
          />
        </View>
      </Card>

      {isLoading && routes.length === 0 ? (
        <ActivityIndicator color={colors.webflowBlue} size="large" />
      ) : routes.length === 0 ? (
        <EmptyState
          description="No se encontraron rutas para los filtros seleccionados."
          title="No hay rutas registradas"
        />
      ) : (
        <View style={styles.list}>
          {routes.map(route => {
            const courierName = courierNameOf(route.courierId);
            return (
              <Pressable
                key={route.id}
                accessibilityRole="button"
                onPress={() => runAsync(inspectRoute(route.id))}
                style={({pressed}) => [styles.routeCard, pressed && styles.routeCardPressed]}>
                <View style={styles.routeTop}>
                  <IsometricCapacityCube
                    capacity={route.capacityLimit}
                    occupied={route.occupiedSlots}
                    status={route.status}
                  />
                  <View style={styles.routeInfo}>
                    <View style={styles.routeHeader}>
                      <Text style={styles.routeZone}>{zoneNameOf(route.zoneId)}</Text>
                      <StatusBadge
                        label={ROUTE_STATUS_LABELS[route.status]}
                        tone={ROUTE_TONE[route.status]}
                      />
                    </View>
                    <View style={styles.routeMeta}>
                      <ShortIdChip id={route.id} prefix="RUT" />
                      <Text style={[styles.metaText, tabularNumbersStyle]}>
                        {route.serviceDate}
                      </Text>
                      <Text style={[styles.metaText, tabularNumbersStyle]}>
                        {`${route.occupiedSlots}/${route.capacityLimit} cupos`}
                      </Text>
                    </View>
                    <Text style={styles.courierText}>
                      {courierName ? `Repartidor: ${courierName}` : 'Sin asignar'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <RouteDetailModal
        couriers={couriers}
        isAdmin={isAdmin}
        isLoadingDetail={isLoadingDetail}
        isMutating={isMutating}
        onCancelRoute={async () => {
          if (!selectedRoute) return;
          setIsMutating(true);
          try {
            await gateway.cancelRoute(selectedRoute.id);
            setSelectedRoute(null);
            setFeedback({type: 'success', text: 'Ruta cancelada correctamente.'});
            await Promise.all([loadRoutes(), onCatalogChanged()]);
          } catch (error) {
            setFeedback({
              type: 'error',
              text: error instanceof Error ? error.message : 'No se pudo cancelar la ruta.',
            });
          } finally {
            setIsMutating(false);
          }
        }}
        onClose={() => setSelectedRoute(null)}
        onMoveOrder={async (orderId, destinationRouteId) => {
          if (!selectedRoute) return;
          setIsMutating(true);
          try {
            await gateway.moveOrder(orderId, destinationRouteId);
            setFeedback({type: 'success', text: 'Pedido reubicado a la ruta destino.'});
            await Promise.all([loadRoutes(), inspectRoute(selectedRoute.id)]);
          } catch (error) {
            setFeedback({
              type: 'error',
              text: error instanceof Error ? error.message : 'No se pudo mover el pedido.',
            });
          } finally {
            setIsMutating(false);
          }
        }}
        onNavigateToFleet={onNavigateToFleet}
        onReload={async () => {
          if (selectedRoute) await inspectRoute(selectedRoute.id);
        }}
        onReorderStops={async orderIds => {
          if (!selectedRoute) return;
          setIsMutating(true);
          try {
            await gateway.reorderStops(selectedRoute.id, orderIds);
            setFeedback({type: 'success', text: 'Orden de paradas guardado.'});
            await inspectRoute(selectedRoute.id);
          } catch (error) {
            setFeedback({
              type: 'error',
              text: error instanceof Error ? error.message : 'No se pudo guardar el orden.',
            });
          } finally {
            setIsMutating(false);
          }
        }}
        route={selectedRoute}
        routes={routes}
        zones={zones}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  adminCards: {gap: spacing.md},
  headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  form: {gap: spacing.md},
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
  },
  countText: {fontFamily: fontFamilySans, fontSize: 12, fontWeight: '500', color: colors.slate},
  rowActions: {flexDirection: 'row', gap: spacing.sm},
  quickDateRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  dateChip: {
    minHeight: 40,
    minWidth: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateChipActive: {borderColor: colors.webflowBlue, backgroundColor: colors.blueTintBg},
  dateChipText: {fontFamily: fontFamilySans, fontSize: 12, fontWeight: '500', color: colors.slate},
  dateChipTextActive: {color: colors.webflowBlue, fontWeight: '600'},
  list: {gap: spacing.sm},
  routeCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    padding: spacing.md,
  },
  routeCardPressed: {backgroundColor: colors.mist},
  routeTop: {flexDirection: 'row', gap: spacing.md, alignItems: 'center'},
  routeInfo: {flex: 1, minWidth: 0, gap: 6},
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  routeZone: {fontFamily: fontFamilySans, fontSize: 15, fontWeight: '600', color: colors.obsidian},
  routeMeta: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  metaText: {fontFamily: fontFamilySans, fontSize: 12, color: colors.slate},
  courierText: {fontFamily: fontFamilySans, fontSize: 12, color: colors.slate},
});

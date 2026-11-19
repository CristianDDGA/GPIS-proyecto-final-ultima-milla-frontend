import {useCallback, useEffect, useMemo, useState} from 'react';
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
  TextInputField,
  colors,
  fontFamilySans,
  radii,
  spacing,
  tabularNumbersStyle,
  typography,
  type BadgeTone,
} from '../../../../shared/ui';
import {
  addDaysIsoLocal,
  formatUtcTimestamp,
  runAsync,
  todayIsoLocal,
} from '../../../../shared/utils/format';
import {
  ISO_DATE_RE,
  TIME_HH_MM_RE,
  validateAddress,
} from '../../../../shared/utils/validation';
import type {Zone} from '../../../zones/domain/zone';
import {
  ORDER_STATUS_LABELS,
  ORDER_TIMELINE,
  type Order,
  type OrderStatus,
} from '../../domain/order';
import type {HttpOrderGateway} from '../../infrastructure/httpOrderGateway';

const PAGE_SIZE = 15;

const STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  pendiente: 'amber',
  asignado_a_ruta: 'blue',
  recogido: 'neutral',
  en_camino: 'blue',
  entregado: 'green',
};

interface OrdersScreenProps {
  readonly gateway: HttpOrderGateway;
  readonly zones: readonly Zone[];
  readonly initialZoneFilter: string;
  readonly canCreateOrder: boolean;
  readonly onCatalogChanged: () => Promise<void>;
  readonly onNavigateToRoutes?: (deliveryDate: string) => void;
}

export function OrdersScreen({
  gateway,
  zones,
  initialZoneFilter,
  canCreateOrder,
  onCatalogChanged,
  onNavigateToRoutes,
}: OrdersScreenProps) {
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [filterZoneId, setFilterZoneId] = useState(initialZoneFilter);
  const [offset, setOffset] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [zoneId, setZoneId] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(todayIsoLocal);
  const [deliveryTime, setDeliveryTime] = useState('10:30');
  const [isCreating, setIsCreating] = useState(false);

  const [feedback, setFeedback] = useState<{type: 'error' | 'success'; text: string} | null>(null);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  useEffect(() => {
    if (initialZoneFilter) {
      setFilterZoneId(initialZoneFilter);
    }
  }, [initialZoneFilter]);

  const zoneNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const zone of zones) {
      map.set(zone.id, zone.name);
    }
    return map;
  }, [zones]);

  const fetchOrders = useCallback(
    async (dateVal = filterDate, zoneVal = filterZoneId) => {
      setIsLoading(true);
      try {
        const list = await gateway.getAll({
          ...(dateVal.trim() ? {deliveryDate: dateVal.trim()} : {}),
          ...(zoneVal ? {zoneId: zoneVal} : {}),
        });
        setOrders(list);
        setOffset(0);
      } catch (error) {
        setFeedback({
          type: 'error',
          text: error instanceof Error ? error.message : 'No se pudieron consultar los pedidos.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [filterDate, filterZoneId, gateway],
  );

  useEffect(() => {
    runAsync(fetchOrders(filterDate, filterZoneId));
  }, [fetchOrders, filterDate, filterZoneId]);

  const handleCreate = async () => {
    if (!zoneId) {
      setFeedback({type: 'error', text: 'Selecciona una zona de cobertura.'});
      return;
    }
    const addrErr = validateAddress(address);
    if (addrErr) {
      setFeedback({type: 'error', text: addrErr});
      return;
    }
    if (!ISO_DATE_RE.test(deliveryDate.trim())) {
      setFeedback({type: 'error', text: 'La fecha debe usar formato AAAA-MM-DD.'});
      return;
    }
    if (!TIME_HH_MM_RE.test(deliveryTime.trim())) {
      setFeedback({type: 'error', text: 'La hora debe usar formato HH:MM (24h).'});
      return;
    }

    setIsCreating(true);
    setFeedback(null);
    try {
      const created = await gateway.create({
        zoneId,
        deliveryAddress: address.trim(),
        deliveryDate: deliveryDate.trim(),
        deliveryTime: deliveryTime.trim(),
      });
      setAddress('');
      setFormOpen(false);
      setFeedback({
        type: 'success',
        text: `Pedido programado para "${created.deliveryAddress}".`,
      });
      await Promise.all([fetchOrders(), onCatalogChanged()]);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo registrar el pedido.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const inspectOrder = async (order: Order) => {
    setDetailOrder(order);
    setIsLoadingDetail(true);
    try {
      const fresh = await gateway.getById(order.id);
      setDetailOrder(fresh);
    } catch {
      // Mantiene datos actuales si el backend ya devolvió el resumen.
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const visibleOrders = orders.slice(offset, offset + PAGE_SIZE);
  const total = orders.length;

  return (
    <View style={styles.container}>
      <KineticHeader
        rightAction={
          <Button
            isLoading={isLoading}
            label="↻ Actualizar"
            onPress={() => runAsync(fetchOrders())}
            size="sm"
            variant="secondary"
          />
        }
        title="Gestión de pedidos"
      />

      {feedback ? (
        <AlertBanner
          onClose={() => setFeedback(null)}
          title={feedback.type === 'success' ? 'Operación exitosa' : 'Atención'}
          type={feedback.type}>
          {feedback.text}
        </AlertBanner>
      ) : null}

      {canCreateOrder ? (
        <Card>
          <View style={styles.sectionHead}>
            <Text style={typography.cardTitle}>Programar nuevo pedido</Text>
            <Button
              label={formOpen ? 'Ocultar' : 'Nuevo pedido'}
              onPress={() => setFormOpen(prev => !prev)}
              size="sm"
              variant={formOpen ? 'secondary' : 'primary'}
            />
          </View>
          {formOpen ? (
            <View style={styles.form}>
              <PickerField
                isRequired
                label="Zona de Cobertura"
                onValueChange={setZoneId}
                options={zones.map(zone => ({value: zone.id, label: zone.name}))}
                placeholder="Selecciona una zona..."
                value={zoneId}
              />
              <TextInputField
                editable={!isCreating}
                isRequired
                label="Dirección de Entrega"
                maxLength={200}
                onChangeText={setAddress}
                placeholder="Ej. Av. 10 de Agosto y Colón"
                value={address}
              />
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <TextInputField
                    editable={!isCreating}
                    isRequired
                    label="Fecha de Entrega"
                    maxLength={10}
                    onChangeText={setDeliveryDate}
                    placeholder="AAAA-MM-DD"
                    value={deliveryDate}
                  />
                </View>
                <View style={styles.col}>
                  <TextInputField
                    editable={!isCreating}
                    isRequired
                    label="Hora de Entrega"
                    maxLength={5}
                    onChangeText={setDeliveryTime}
                    placeholder="HH:MM"
                    value={deliveryTime}
                  />
                </View>
              </View>
              <View style={styles.quickDateRow}>
                {[
                  {label: 'Hoy', iso: todayIsoLocal()},
                  {label: 'Mañana', iso: addDaysIsoLocal(1)},
                ].map(item => (
                  <Pressable
                    key={item.label}
                    accessibilityRole="button"
                    onPress={() => setDeliveryDate(item.iso)}
                    style={[
                      styles.dateChip,
                      deliveryDate === item.iso && styles.dateChipActive,
                    ]}>
                    <Text
                      style={[
                        styles.dateChipText,
                        deliveryDate === item.iso && styles.dateChipTextActive,
                      ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                fullWidth
                isLoading={isCreating}
                label="Crear Pedido"
                onPress={() => runAsync(handleCreate())}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card variant="muted">
        <View style={styles.sectionHead}>
          <Text style={typography.cardTitle}>Pedidos programados</Text>
          <View style={styles.countPill}>
            <Text style={[styles.countText, tabularNumbersStyle]}>
              {`${total} ${total === 1 ? 'pedido' : 'pedidos'}`}
            </Text>
          </View>
        </View>

        <TextInputField
          label="Fecha de entrega"
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
            ...zones.map(zone => ({value: zone.id, label: zone.name})),
          ]}
          value={filterZoneId}
        />
        <View style={styles.filterActions}>
          <Button
            isLoading={isLoading}
            label="Filtrar"
            onPress={() => runAsync(fetchOrders())}
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

      {isLoading && orders.length === 0 ? (
        <ActivityIndicator color={colors.webflowBlue} size="large" />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          description="No existen pedidos registrados para los filtros seleccionados."
          title="Sin pedidos"
        />
      ) : (
        <View style={styles.list}>
          {visibleOrders.map(order => {
            const zoneLabel = order.zoneName || zoneNameById.get(order.zoneId) || 'Zona';
            return (
              <Pressable
                key={order.id}
                accessibilityRole="button"
                onPress={() => runAsync(inspectOrder(order))}
                style={({pressed}) => [styles.orderCard, pressed && styles.orderCardPressed]}>
                <View style={styles.orderHead}>
                  <Text style={styles.orderAddr}>{order.deliveryAddress}</Text>
                  <StatusBadge
                    label={ORDER_STATUS_LABELS[order.status]}
                    tone={STATUS_TONE[order.status]}
                  />
                </View>
                <View style={styles.orderMeta}>
                  <ShortIdChip id={order.id} prefix="PED" />
                  <Text style={styles.orderMetaText}>{zoneLabel}</Text>
                  <Text style={[styles.orderMetaText, tabularNumbersStyle]}>
                    {`${order.deliveryDate} · ${order.deliveryTime}`}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {total > PAGE_SIZE ? (
            <View style={styles.pagination}>
              <Text style={[styles.countText, tabularNumbersStyle]}>
                {`${offset + 1}–${Math.min(offset + visibleOrders.length, total)} de ${total}`}
              </Text>
              <View style={styles.filterActions}>
                <Button
                  disabled={offset === 0 || isLoading}
                  label="Anterior"
                  onPress={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  size="sm"
                  variant="secondary"
                />
                <Button
                  disabled={offset + PAGE_SIZE >= total || isLoading}
                  label="Siguiente"
                  onPress={() => setOffset(offset + PAGE_SIZE)}
                  size="sm"
                  variant="secondary"
                />
              </View>
            </View>
          ) : null}
        </View>
      )}

      <BottomSheetModal
        onClose={() => setDetailOrder(null)}
        title="Detalle del pedido"
        visible={detailOrder !== null}>
        {detailOrder ? (
          <View style={styles.detailWrap}>
            {isLoadingDetail ? (
              <ActivityIndicator color={colors.webflowBlue} size="small" />
            ) : null}
            <Card variant="muted">
              <ShortIdChip id={detailOrder.id} prefix="PED" />
              <Text style={styles.detailAddr}>{detailOrder.deliveryAddress}</Text>
              <Text style={typography.body}>
                {`Zona: ${detailOrder.zoneName || zoneNameById.get(detailOrder.zoneId) || detailOrder.zoneId}`}
              </Text>
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Programación: ${detailOrder.deliveryDate} · ${detailOrder.deliveryTime}`}
              </Text>
              <StatusBadge
                label={ORDER_STATUS_LABELS[detailOrder.status]}
                tone={STATUS_TONE[detailOrder.status]}
              />
              <Text style={typography.caption}>
                {`Actualizado: ${formatUtcTimestamp(detailOrder.updatedAt)}`}
              </Text>
            </Card>

            <Card>
              <Text style={typography.cardTitle}>Progreso operativo</Text>
              <View style={styles.timeline}>
                {ORDER_TIMELINE.map(step => {
                  const activeIdx = ORDER_TIMELINE.findIndex(c => c.status === detailOrder.status);
                  const stepIdx = ORDER_TIMELINE.findIndex(c => c.status === step.status);
                  const done = stepIdx < activeIdx;
                  const current = stepIdx === activeIdx;
                  return (
                    <View key={step.status} style={styles.timelineRow}>
                      <View
                        style={[
                          styles.dot,
                          done && styles.dotDone,
                          current && styles.dotCurrent,
                        ]}
                      />
                      <Text style={[styles.timelineLabel, current && styles.timelineLabelActive]}>
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            {onNavigateToRoutes ? (
              <Button
                fullWidth
                label="Ir a planificar rutas de esta fecha →"
                onPress={() => {
                  const date = detailOrder.deliveryDate;
                  setDetailOrder(null);
                  onNavigateToRoutes(date);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  sectionHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  form: {gap: spacing.md},
  twoCol: {flexDirection: 'row', gap: spacing.sm},
  col: {flex: 1},
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
  },
  countText: {fontFamily: fontFamilySans, fontSize: 12, fontWeight: '500', color: colors.slate},
  filterActions: {flexDirection: 'row', gap: spacing.sm},
  quickDateRow: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs},
  dateChip: {
    minHeight: 34,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    justifyContent: 'center',
  },
  dateChipActive: {borderColor: colors.webflowBlue, backgroundColor: colors.blueTintBg},
  dateChipText: {fontFamily: fontFamilySans, fontSize: 12, fontWeight: '500', color: colors.slate},
  dateChipTextActive: {color: colors.webflowBlue, fontWeight: '600'},
  list: {gap: spacing.sm},
  orderCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    padding: spacing.md,
    gap: spacing.sm,
  },
  orderCardPressed: {backgroundColor: colors.mist},
  orderHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  orderAddr: {
    flex: 1,
    fontFamily: fontFamilySans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.obsidian,
  },
  orderMeta: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  orderMetaText: {fontFamily: fontFamilySans, fontSize: 12, color: colors.slate},
  pagination: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  detailWrap: {gap: spacing.md},
  detailAddr: {fontFamily: fontFamilySans, fontSize: 16, fontWeight: '600', color: colors.obsidian},
  timeline: {gap: spacing.sm},
  timelineRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
  },
  dotDone: {borderColor: colors.greenText, backgroundColor: colors.greenText},
  dotCurrent: {borderColor: colors.webflowBlue, backgroundColor: colors.webflowBlue},
  timelineLabel: {fontFamily: fontFamilySans, fontSize: 14, color: colors.slate},
  timelineLabelActive: {fontWeight: '600', color: colors.obsidian},
});

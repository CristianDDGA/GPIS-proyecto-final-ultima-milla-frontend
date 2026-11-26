import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  IsometricCapacityCube,
  PickerField,
  ShortIdChip,
  StatusBadge,
  colors,
  fontFamilySans,
  spacing,
  tabularNumbersStyle,
  typography,
  type BadgeTone,
} from '../../../../shared/ui';
import {runAsync} from '../../../../shared/utils/format';
import type {Courier} from '../../../couriers/domain/courier';
import {ORDER_STATUS_LABELS} from '../../../orders/domain/order';
import type {Zone} from '../../../zones/domain/zone';
import {
  ROUTE_STATUS_LABELS,
  type RouteDetail,
  type RouteStatus,
  type RouteStop,
  type RouteSummary,
} from '../../domain/route';

const ROUTE_TONE: Record<RouteStatus, BadgeTone> = {
  planificada: 'neutral',
  asignada: 'blue',
  en_curso: 'green',
  completada: 'green',
  cancelada: 'neutral',
};

interface RouteDetailModalProps {
  readonly route: RouteDetail | null;
  readonly routes: readonly RouteSummary[];
  readonly zones: readonly Zone[];
  readonly couriers: readonly Courier[];
  readonly isAdmin: boolean;
  readonly isLoadingDetail: boolean;
  readonly isMutating: boolean;
  readonly onClose: () => void;
  readonly onReload: () => Promise<void>;
  readonly onReorderStops: (orderIds: string[]) => Promise<void>;
  readonly onMoveOrder: (orderId: string, destinationRouteId: string) => Promise<void>;
  readonly onCancelRoute: () => Promise<void>;
  readonly onNavigateToFleet?: () => void;
}

export function RouteDetailModal({
  route,
  routes,
  zones,
  couriers,
  isAdmin,
  isLoadingDetail,
  isMutating,
  onClose,
  onReload,
  onReorderStops,
  onMoveOrder,
  onCancelRoute,
  onNavigateToFleet,
}: RouteDetailModalProps) {
  const [draftOrderIds, setDraftOrderIds] = useState<string[]>([]);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    setDraftOrderIds(route ? route.stops.map(stop => stop.orderId) : []);
    setMoveTargets({});
    setConfirmCancel(false);
  }, [route]);

  const stopsByOrder = useMemo(() => {
    const map = new Map<string, RouteStop>();
    for (const stop of route?.stops ?? []) {
      map.set(stop.orderId, stop);
    }
    return map;
  }, [route?.stops]);

  const orderedStops = useMemo(
    () =>
      draftOrderIds
        .map(id => stopsByOrder.get(id))
        .filter((item): item is RouteStop => item !== undefined),
    [draftOrderIds, stopsByOrder],
  );

  const compatibleRoutes = useMemo(() => {
    if (!route) return [];
    return routes.filter(
      candidate =>
        candidate.id !== route.id &&
        candidate.zoneId === route.zoneId &&
        candidate.serviceDate === route.serviceDate &&
        (candidate.status === 'planificada' || candidate.status === 'asignada') &&
        candidate.occupiedSlots < candidate.capacityLimit,
    );
  }, [route, routes]);

  if (!route) {
    return null;
  }

  const zoneName = zones.find(z => z.id === route.zoneId)?.name ?? 'Zona sin catalogar';
  const courierName =
    route.courierId === null
      ? null
      : (couriers.find(c => c.id === route.courierId)?.displayName ?? 'Repartidor asignado');
  const isEditable = route.status === 'planificada' || route.status === 'asignada';
  const canReorder = isAdmin && isEditable && orderedStops.length > 1;
  const hasStarted = route.stops.some(s => s.status !== 'asignado_a_ruta');
  const canCancel = isAdmin && isEditable && !hasStarted;
  const isDirty =
    draftOrderIds.length !== route.stops.length ||
    draftOrderIds.some((id, index) => id !== route.stops[index]?.orderId);

  const shiftStop = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= draftOrderIds.length) return;
    const copy = [...draftOrderIds];
    const current = copy[index];
    const next = copy[target];
    if (!current || !next) return;
    copy[index] = next;
    copy[target] = current;
    setDraftOrderIds(copy);
  };

  return (
    <BottomSheetModal
      onClose={onClose}
      subtitle={`${route.serviceDate} · ${zoneName}`}
      title="Detalle de la ruta"
      visible={route !== null}>
      {isLoadingDetail ? (
        <ActivityIndicator color={colors.webflowBlue} size="small" />
      ) : null}

      <Card variant="muted">
        <View style={styles.overviewRow}>
          <IsometricCapacityCube
            capacity={route.capacityLimit}
            occupied={route.occupiedSlots}
            status={route.status}
          />
          <View style={styles.overviewMeta}>
            <View style={styles.metaLine}>
              <ShortIdChip id={route.id} prefix="RUT" />
              <StatusBadge label={ROUTE_STATUS_LABELS[route.status]} tone={ROUTE_TONE[route.status]} />
            </View>
            <Text style={[typography.body, tabularNumbersStyle]}>
              {`Ocupación: ${route.occupiedSlots} / ${route.capacityLimit} cupos`}
            </Text>
            <Text style={typography.bodyMuted}>
              {courierName ? `Repartidor: ${courierName}` : 'Repartidor: Sin asignar'}
            </Text>
          </View>
        </View>
        <Button
          isLoading={isLoadingDetail}
          label="↻ Recargar detalle"
          onPress={() => runAsync(onReload())}
          size="sm"
          variant="secondary"
        />
      </Card>

      <Text style={typography.cardTitle}>Paradas de la ruta</Text>

      {orderedStops.length === 0 ? (
        <AlertBanner title="Sin paradas activas" type="info">
          {route.status === 'completada'
            ? 'Ruta completada: las paradas fueron archivadas al confirmar el cierre.'
            : 'Esta ruta todavía no tiene paradas asignadas.'}
        </AlertBanner>
      ) : (
        <View style={styles.stopsList}>
          {orderedStops.map((stop, index) => {
            const targetRoute = moveTargets[stop.orderId] ?? '';
            const canMove = isAdmin && stop.status === 'asignado_a_ruta' && compatibleRoutes.length > 0;
            return (
              <Card key={stop.orderId} style={styles.stopCard}>
                <View style={styles.stopHead}>
                  <Text style={[styles.stopPos, tabularNumbersStyle]}>{`#${index + 1}`}</Text>
                  <Text style={styles.stopAddr}>{stop.deliveryAddress}</Text>
                </View>
                <View style={styles.stopMeta}>
                  <ShortIdChip id={stop.orderId} prefix="PED" />
                  <StatusBadge
                    label={ORDER_STATUS_LABELS[stop.status]}
                    tone={
                      stop.status === 'entregado'
                        ? 'green'
                        : stop.status === 'entrega_fallida'
                          ? 'red'
                          : stop.status === 'cancelado'
                            ? 'neutral'
                            : 'blue'
                    }
                  />
                  <Text style={[typography.caption, tabularNumbersStyle]}>
                    {`${stop.deliveryDate} ${stop.deliveryTime}`}
                  </Text>
                </View>

                {canReorder ? (
                  <View style={styles.rowButtons}>
                    <Button
                      disabled={index === 0 || isMutating}
                      label="↑ Subir"
                      onPress={() => shiftStop(index, -1)}
                      size="sm"
                      variant="secondary"
                    />
                    <Button
                      disabled={index === orderedStops.length - 1 || isMutating}
                      label="↓ Bajar"
                      onPress={() => shiftStop(index, 1)}
                      size="sm"
                      variant="secondary"
                    />
                  </View>
                ) : null}

                {canMove ? (
                  <View style={styles.moveBox}>
                    <PickerField
                      label="Mover a otra ruta compatible"
                      onValueChange={val => setMoveTargets(prev => ({...prev, [stop.orderId]: val}))}
                      options={compatibleRoutes.map(c => ({
                        value: c.id,
                        label: `${c.serviceDate} · ${c.occupiedSlots}/${c.capacityLimit} cupos`,
                      }))}
                      placeholder="Selecciona ruta destino"
                      value={targetRoute}
                    />
                    {targetRoute ? (
                      <Button
                        isLoading={isMutating}
                        label="Mover pedido"
                        onPress={() => runAsync(onMoveOrder(stop.orderId, targetRoute))}
                        size="sm"
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}

      {canReorder && isDirty ? (
        <View style={styles.rowButtons}>
          <Button
            isLoading={isMutating}
            label="Guardar nuevo orden"
            onPress={() => runAsync(onReorderStops(draftOrderIds))}
            size="sm"
          />
          <Button
            disabled={isMutating}
            label="Descartar"
            onPress={() => setDraftOrderIds(route.stops.map(s => s.orderId))}
            size="sm"
            variant="secondary"
          />
        </View>
      ) : null}

      {onNavigateToFleet ? (
        <Button
          fullWidth
          label="Asignar repartidor en Despacho →"
          onPress={() => {
            onClose();
            onNavigateToFleet();
          }}
        />
      ) : null}

      {canCancel ? (
        <Card variant="muted">
          {confirmCancel ? (
            <View style={styles.cancelBox}>
              <Text style={typography.body}>
                Esta acción libera todas las paradas y no se puede deshacer.
              </Text>
              <View style={styles.rowButtons}>
                <Button
                  isLoading={isMutating}
                  label="Sí, cancelar ruta"
                  onPress={() => runAsync(onCancelRoute())}
                  size="sm"
                  variant="danger"
                />
                <Button
                  disabled={isMutating}
                  label="No, volver"
                  onPress={() => setConfirmCancel(false)}
                  size="sm"
                  variant="secondary"
                />
              </View>
            </View>
          ) : (
            <Button
              label="Cancelar ruta"
              onPress={() => setConfirmCancel(true)}
              size="sm"
              variant="danger"
            />
          )}
        </Card>
      ) : null}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  overviewRow: {flexDirection: 'row', gap: spacing.md, alignItems: 'center'},
  overviewMeta: {flex: 1, gap: 6},
  metaLine: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  stopsList: {gap: spacing.sm},
  stopCard: {gap: spacing.sm},
  stopHead: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm},
  stopPos: {
    fontFamily: fontFamilySans,
    fontSize: 13,
    fontWeight: '600',
    color: colors.webflowBlue,
    minWidth: 26,
  },
  stopAddr: {flex: 1, fontFamily: fontFamilySans, fontSize: 14, fontWeight: '600', color: colors.obsidian},
  stopMeta: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm},
  rowButtons: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  moveBox: {gap: spacing.sm},
  cancelBox: {gap: spacing.sm},
});

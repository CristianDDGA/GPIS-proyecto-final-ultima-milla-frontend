import {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {
  AlertBanner,
  BottomSheetModal,
  Button,
  Card,
  EmptyState,
  KineticHeader,
  PickerField,
  SegmentedControl,
  ShortIdChip,
  StatusBadge,
  TextInputField,
  colors,
  fontFamilySans,
  spacing,
  tabularNumbersStyle,
  typography,
} from '../../../../shared/ui';
import {runAsync} from '../../../../shared/utils/format';
import {validatePersonName} from '../../../../shared/utils/validation';
import {ORDER_STATUS_LABELS} from '../../../orders/domain/order';
import type {RouteSummary} from '../../../routes/domain/route';
import type {HttpRouteGateway} from '../../../routes/infrastructure/httpRouteGateway';
import type {Zone} from '../../../zones/domain/zone';
import type {ActiveCourierRoute, Courier} from '../../domain/courier';
import type {HttpCourierGateway} from '../../infrastructure/httpCourierGateway';

interface DispatchScreenProps {
  readonly gateway: HttpCourierGateway;
  readonly routeGateway: HttpRouteGateway;
  readonly zones: readonly Zone[];
  readonly onCatalogChanged: () => Promise<void>;
  readonly onNavigateToDeliveries: () => void;
}

export function DispatchScreen({
  gateway,
  routeGateway,
  zones,
  onCatalogChanged,
  onNavigateToDeliveries,
}: DispatchScreenProps) {
  const [couriers, setCouriers] = useState<readonly Courier[]>([]);
  const [routes, setRoutes] = useState<readonly RouteSummary[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
  const [isLoading, setIsLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('5');
  const [isCreating, setIsCreating] = useState(false);

  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inspectedCourier, setInspectedCourier] = useState<Courier | null>(null);
  const [activeRoute, setActiveRoute] = useState<ActiveCourierRoute | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [feedback, setFeedback] = useState<{type: 'error' | 'success'; text: string} | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [courierPage, routeList] = await Promise.all([
        gateway.getCouriers({limit: 100}),
        routeGateway.getRoutes({limit: 100}),
      ]);
      setCouriers(courierPage.items);
      setRoutes(routeList);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo cargar la flota.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [gateway, routeGateway]);

  useEffect(() => {
    runAsync(loadData());
  }, [loadData]);

  const zoneNameOf = (zoneId: string) =>
    zones.find(zone => zone.id === zoneId)?.name ?? 'Zona sin catalogar';

  const visibleCouriers = useMemo(() => {
    if (availabilityFilter === 'available') return couriers.filter(c => c.isAvailable);
    if (availabilityFilter === 'unavailable') return couriers.filter(c => !c.isAvailable);
    return couriers;
  }, [availabilityFilter, couriers]);

  const assignableRoutes = useMemo(
    () =>
      routes.filter(
        route => (route.status === 'planificada' || route.status === 'asignada') && route.occupiedSlots > 0,
      ),
    [routes],
  );

  const availableCouriers = useMemo(
    () => couriers.filter(c => c.isEnabled && c.isAvailable),
    [couriers],
  );

  const handleCreateCourier = async () => {
    const err = validatePersonName(displayName, 'El nombre del repartidor');
    if (err) {
      setFeedback({type: 'error', text: err});
      return;
    }
    const cap = Number(maxCapacity);
    if (!Number.isInteger(cap) || cap < 1) {
      setFeedback({type: 'error', text: 'La capacidad máxima debe ser un entero positivo.'});
      return;
    }

    setIsCreating(true);
    setFeedback(null);
    try {
      const created = await gateway.createCourier(displayName.trim(), cap);
      setDisplayName('');
      setCreateOpen(false);
      setFeedback({type: 'success', text: `Repartidor "${created.displayName}" registrado.`});
      await Promise.all([loadData(), onCatalogChanged()]);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo registrar el repartidor.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedRouteId || !selectedCourierId) {
      setFeedback({type: 'error', text: 'Selecciona una ruta planificada y un repartidor disponible.'});
      return;
    }

    setIsAssigning(true);
    setFeedback(null);
    try {
      await gateway.assignRoute(selectedRouteId, selectedCourierId);
      setSelectedRouteId('');
      setSelectedCourierId('');
      setFeedback({type: 'success', text: 'Ruta asignada al repartidor correctamente.'});
      await Promise.all([loadData(), onCatalogChanged()]);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo asignar la ruta.',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleToggleAvailability = async (courier: Courier) => {
    setTogglingId(courier.id);
    setFeedback(null);
    try {
      const updated = await gateway.updateAvailability(courier.id, !courier.isAvailable);
      setCouriers(prev => prev.map(item => (item.id === updated.id ? updated : item)));
      setFeedback({
        type: 'success',
        text: `${updated.displayName}: ahora ${updated.isAvailable ? 'Disponible' : 'No disponible'}.`,
      });
      await onCatalogChanged();
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo actualizar la disponibilidad.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const inspectActiveRoute = async (courier: Courier) => {
    setInspectedCourier(courier);
    setActiveRoute(null);
    setIsLoadingRoute(true);
    try {
      const route = await gateway.getActiveRoute(courier.id);
      setActiveRoute(route);
    } catch (error) {
      setFeedback({
        type: 'error',
        text: error instanceof Error ? error.message : 'No se pudo consultar la hoja de ruta.',
      });
      setInspectedCourier(null);
    } finally {
      setIsLoadingRoute(false);
    }
  };

  return (
    <View style={styles.container}>
      <KineticHeader
        rightAction={
          <Button
            isLoading={isLoading}
            label="↻ Actualizar"
            onPress={() => runAsync(loadData())}
            size="sm"
            variant="secondary"
          />
        }
        title="Flota y despacho"
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
        <View style={styles.headRow}>
          <Text style={typography.cardTitle}>Alta de repartidor</Text>
          <Button
            label={createOpen ? 'Ocultar' : 'Registrar'}
            onPress={() => setCreateOpen(prev => !prev)}
            size="sm"
            variant="secondary"
          />
        </View>
        {createOpen ? (
          <View style={styles.form}>
            <TextInputField
              editable={!isCreating}
              isRequired
              label="Nombre del repartidor"
              maxLength={80}
              onChangeText={setDisplayName}
              placeholder="Ej. Carlos Andrade"
              value={displayName}
            />
            <TextInputField
              editable={!isCreating}
              isRequired
              keyboardType="number-pad"
              label="Máximo de pedidos por viaje"
              onChangeText={setMaxCapacity}
              value={maxCapacity}
            />
            <Button
              fullWidth
              isLoading={isCreating}
              label="Registrar repartidor"
              onPress={() => runAsync(handleCreateCourier())}
            />
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={typography.cardTitle}>Asignación de ruta a repartidor</Text>
        <PickerField
          isRequired
          label="Ruta planificada"
          onValueChange={setSelectedRouteId}
          options={assignableRoutes.map(r => ({
            value: r.id,
            label: `${r.serviceDate} · ${zoneNameOf(r.zoneId)} · ${r.occupiedSlots}/${r.capacityLimit} cupos`,
          }))}
          placeholder="Selecciona una ruta planificada"
          value={selectedRouteId}
        />
        <PickerField
          isRequired
          label="Repartidor disponible"
          onValueChange={setSelectedCourierId}
          options={availableCouriers.map(c => ({
            value: c.id,
            label: `${c.displayName} (${c.maxOrdersPerTrip} por viaje)`,
          }))}
          placeholder="Selecciona un repartidor"
          value={selectedCourierId}
        />
        <Button
          disabled={!selectedRouteId || !selectedCourierId}
          fullWidth
          isLoading={isAssigning}
          label="Asignar ruta"
          onPress={() => runAsync(handleAssign())}
        />
      </Card>

      <Card style={styles.fleetSection}>
        <View style={styles.headRow}>
          <Text style={typography.cardTitle}>Catálogo de flota</Text>
          <Text style={[typography.caption, tabularNumbersStyle]}>
            {`${couriers.length} repartidores`}
          </Text>
        </View>
        <SegmentedControl<'all' | 'available' | 'unavailable'>
          onChange={setAvailabilityFilter}
          options={[
            {value: 'all', label: 'Todos'},
            {value: 'available', label: 'Disponibles'},
            {value: 'unavailable', label: 'No disponibles'},
          ]}
          value={availabilityFilter}
        />

        {isLoading && couriers.length === 0 ? (
          <ActivityIndicator color={colors.webflowBlue} size="large" />
        ) : visibleCouriers.length === 0 ? (
          <EmptyState
            description="No hay repartidores que coincidan con este filtro."
            title="Sin repartidores"
          />
        ) : (
          <View style={styles.list}>
            {visibleCouriers.map(courier => (
              <Card key={courier.id} variant="outlined">
                <View style={styles.courierHead}>
                  <View style={styles.courierMeta}>
                    <Text style={styles.courierName}>{courier.displayName}</Text>
                    <Text style={[typography.caption, tabularNumbersStyle]}>
                      {`Capacidad: ${courier.maxOrdersPerTrip} pedidos por viaje`}
                    </Text>
                  </View>
                  <ShortIdChip id={courier.id} prefix="REP" />
                </View>

                <View style={styles.badges}>
                  <StatusBadge
                    label={courier.isEnabled ? 'Habilitado' : 'Deshabilitado'}
                    tone={courier.isEnabled ? 'green' : 'neutral'}
                  />
                  <StatusBadge
                    label={courier.isAvailable ? 'Disponible' : 'No disponible'}
                    tone={courier.isAvailable ? 'blue' : 'amber'}
                  />
                </View>

                <View style={styles.actions}>
                  <Button
                    isLoading={togglingId === courier.id}
                    label={courier.isAvailable ? 'Marcar no disponible' : 'Marcar disponible'}
                    onPress={() => runAsync(handleToggleAvailability(courier))}
                    size="sm"
                    variant="secondary"
                  />
                  <Button
                    label="Ver hoja de ruta"
                    onPress={() => runAsync(inspectActiveRoute(courier))}
                    size="sm"
                    variant="ghost"
                  />
                </View>
              </Card>
            ))}
          </View>
        )}
      </Card>

      <BottomSheetModal
        onClose={() => {
          setInspectedCourier(null);
          setActiveRoute(null);
        }}
        subtitle={inspectedCourier?.displayName}
        title="Hoja de ruta activa"
        visible={inspectedCourier !== null}>
        {isLoadingRoute ? (
          <ActivityIndicator color={colors.webflowBlue} size="large" />
        ) : activeRoute === null ? (
          <EmptyState
            description="El repartidor no tiene una ruta asignada o en curso actualmente."
            title="Sin ruta activa"
          />
        ) : (
          <View style={styles.routeWrap}>
            <Card variant="muted">
              <ShortIdChip id={activeRoute.routeId} prefix="RUT" />
              <Text style={typography.body}>{`Zona: ${zoneNameOf(activeRoute.zoneId)}`}</Text>
              <Text style={[typography.body, tabularNumbersStyle]}>
                {`Fecha: ${activeRoute.serviceDate}`}
              </Text>
              <StatusBadge
                label={activeRoute.status === 'en_curso' ? 'En curso' : 'Asignada'}
                tone={activeRoute.status === 'en_curso' ? 'green' : 'blue'}
              />
            </Card>
            {activeRoute.stops.map(stop => (
              <Card key={stop.orderId}>
                <Text style={styles.courierName}>
                  {`${stop.position}. ${stop.deliveryAddress}`}
                </Text>
                <View style={styles.badges}>
                  <ShortIdChip id={stop.orderId} prefix="PED" />
                  <StatusBadge label={ORDER_STATUS_LABELS[stop.status]} tone="blue" />
                </View>
              </Card>
            ))}
            <Button
              fullWidth
              label="Ir a Entregas →"
              onPress={() => {
                setInspectedCourier(null);
                onNavigateToDeliveries();
              }}
            />
          </View>
        )}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.lg},
  headRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm},
  form: {gap: spacing.md},
  fleetSection: {gap: spacing.md},
  list: {gap: spacing.sm},
  courierHead: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm},
  courierMeta: {flex: 1, minWidth: 0, gap: 3},
  courierName: {fontFamily: fontFamilySans, fontSize: 15, fontWeight: '600', color: colors.obsidian},
  badges: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  actions: {flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm},
  routeWrap: {gap: spacing.md},
});

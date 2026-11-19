import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaProvider, useSafeAreaInsets} from 'react-native-safe-area-context';
import {ROLE_LABELS, type AuthRole} from '../features/auth/domain/authUser';
import {AdminAccessScreen} from '../features/auth/presentation/components/AdminAccessScreen';
import {AuthScreen} from '../features/auth/presentation/components/AuthScreen';
import {ChangePasswordModal} from '../features/auth/presentation/components/ChangePasswordModal';
import {useAuth} from '../features/auth/presentation/hooks/useAuth';
import {ClientApplicationScreen} from '../features/courier-applications/presentation/components/ClientApplicationScreen';
import type {Courier} from '../features/couriers/domain/courier';
import {DispatchScreen} from '../features/couriers/presentation/components/DispatchScreen';
import {DeliveriesScreen} from '../features/deliveries/presentation/components/DeliveriesScreen';
import type {Order} from '../features/orders/domain/order';
import {OrdersScreen} from '../features/orders/presentation/components/OrdersScreen';
import {RoutesScreen} from '../features/routes/presentation/components/RoutesScreen';
import type {Zone} from '../features/zones/domain/zone';
import {ZonesScreen} from '../features/zones/presentation/components/ZonesScreen';
import {MobileHttpClient} from '../shared/infrastructure/http/httpClient';
import {
  DEFAULT_API_BASE_URL,
  loadStoredApiUrl,
  saveStoredApiUrl,
} from '../shared/infrastructure/storage/sessionStorage';
import {
  AlertBanner,
  BottomSheetModal,
  MillastMark,
  NavIcon,
  StatusBadge,
  colors,
  fontFamilySans,
  radii,
  spacing,
  typography,
  type NavTabId,
} from '../shared/ui';
import {initialsOf, runAsync} from '../shared/utils/format';
import {composeGateways} from './composeGateways';

type AppTab = 'zones' | 'orders' | 'routes' | 'dispatch' | 'deliveries' | 'users' | 'application';

const DEFAULT_TAB_BY_ROLE: Readonly<Record<AuthRole, AppTab>> = {
  personal: 'zones',
  repartidor: 'deliveries',
  cliente: 'orders',
};

const BOTTOM_TABS_BY_ROLE: Readonly<Record<AuthRole, readonly {tab: NavTabId; label: string}[]>> = {
  cliente: [
    {tab: 'zones', label: 'Zonas'},
    {tab: 'orders', label: 'Pedidos'},
    {tab: 'application', label: 'Ser repartidor'},
  ],
  repartidor: [
    {tab: 'deliveries', label: 'Entregas'},
    {tab: 'routes', label: 'Rutas'},
    {tab: 'orders', label: 'Pedidos'},
    {tab: 'zones', label: 'Zonas'},
  ],
  personal: [
    {tab: 'zones', label: 'Zonas'},
    {tab: 'orders', label: 'Pedidos'},
    {tab: 'routes', label: 'Rutas'},
    {tab: 'dispatch', label: 'Despacho'},
    {tab: 'more', label: 'Más'},
  ],
};

function MillastMobileShell() {
  const insets = useSafeAreaInsets();
  const apiUrlRef = useRef(DEFAULT_API_BASE_URL);
  const accessTokenRef = useRef<string | null>(null);
  const unauthorizedRef = useRef<() => void>(() => undefined);

  const [apiUrl, setApiUrl] = useState(DEFAULT_API_BASE_URL);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [httpClient] = useState(
    () =>
      new MobileHttpClient({
        getBaseUrl: () => apiUrlRef.current,
        getAccessToken: () => accessTokenRef.current,
        onUnauthorized: () => unauthorizedRef.current(),
      }),
  );

  const gateways = useMemo(() => composeGateways(httpClient), [httpClient]);
  const setTokenRef = useCallback((token: string | null) => {
    accessTokenRef.current = token;
  }, []);
  const auth = useAuth(gateways.auth, setTokenRef);

  const [activeTab, setActiveTab] = useState<AppTab>('orders');
  const [ordersZoneFilter, setOrdersZoneFilter] = useState('');
  const [routesDateFilter, setRoutesDateFilter] = useState('');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  const [zones, setZones] = useState<readonly Zone[]>([]);
  const [orders, setOrders] = useState<readonly Order[]>([]);
  const [couriers, setCouriers] = useState<readonly Courier[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    loadStoredApiUrl()
      .then(url => {
        apiUrlRef.current = url;
        setApiUrl(url);
      })
      .finally(() => setConfigLoaded(true));
  }, []);

  const resetSessionView = useCallback(() => {
    setZones([]);
    setOrders([]);
    setCouriers([]);
    setCatalogError(null);
    setOrdersZoneFilter('');
    setRoutesDateFilter('');
    setPasswordModalOpen(false);
    setMoreSheetOpen(false);
  }, []);

  useEffect(() => {
    unauthorizedRef.current = () => {
      resetSessionView();
      auth.forceSignOut('Tu sesión ha expirado. Vuelve a iniciar sesión.');
    };
  }, [auth, resetSessionView]);

  const currentUser = auth.user;
  const currentRole = currentUser?.role ?? null;

  useEffect(() => {
    if (currentRole) {
      setActiveTab(DEFAULT_TAB_BY_ROLE[currentRole]);
    }
  }, [currentRole]);

  const loadSharedCatalog = useCallback(async () => {
    if (!currentRole) return;
    setIsLoadingCatalog(true);
    setCatalogError(null);

    const [zonesRes, ordersRes, couriersRes] = await Promise.allSettled([
      gateways.zones.getAll(),
      gateways.orders.getAll(),
      currentRole === 'personal' ? gateways.couriers.getCouriers({limit: 100}) : Promise.resolve(null),
    ]);

    if (zonesRes.status === 'fulfilled') setZones(zonesRes.value);
    if (ordersRes.status === 'fulfilled') setOrders(ordersRes.value);
    if (couriersRes.status === 'fulfilled' && couriersRes.value !== null) {
      setCouriers(couriersRes.value.items);
    }

    const firstFailed =
      zonesRes.status === 'rejected'
        ? zonesRes.reason
        : ordersRes.status === 'rejected'
          ? ordersRes.reason
          : null;

    if (firstFailed) {
      setCatalogError(
        firstFailed instanceof Error
          ? firstFailed.message
          : 'No se pudo cargar el catálogo compartido.',
      );
    }

    setIsLoadingCatalog(false);
  }, [currentRole, gateways]);

  useEffect(() => {
    if (auth.status === 'authenticated') {
      runAsync(loadSharedCatalog());
    }
  }, [auth.status, loadSharedCatalog]);

  const handleSaveApiUrl = useCallback(async (nextUrl: string) => {
    const saved = await saveStoredApiUrl(nextUrl);
    apiUrlRef.current = saved;
    setApiUrl(saved);
  }, []);

  const handleLogout = useCallback(() => {
    runAsync(
      auth.logout().finally(() => {
        resetSessionView();
      }),
    );
  }, [auth, resetSessionView]);

  const routeCouriers = useMemo<readonly Courier[]>(() => {
    if (couriers.length > 0) return couriers;
    if (currentUser?.role === 'repartidor' && currentUser.courierId !== null) {
      return [
        {
          id: currentUser.courierId,
          displayName: currentUser.displayName ?? currentUser.email,
          maxOrdersPerTrip: 0,
          isEnabled: currentUser.isActive,
          isAvailable: false,
          createdAt: '',
          updatedAt: '',
        },
      ];
    }
    return [];
  }, [couriers, currentUser]);

  if (!configLoaded || auth.status === 'loading') {
    return (
      <View style={[styles.loadingScreen, {paddingTop: insets.top}]}>
        <MillastMark size={38} />
        <ActivityIndicator color={colors.webflowBlue} size="large" />
        <Text style={typography.bodyMuted}>Restaurando sesión activa...</Text>
      </View>
    );
  }

  if (auth.status !== 'authenticated' || currentUser === null) {
    return (
      <AuthScreen
        apiUrl={apiUrl}
        externalError={auth.error}
        gateway={gateways.auth}
        onAuthenticated={auth.applySession}
        onClearExternalError={auth.clearError}
        onSaveApiUrl={handleSaveApiUrl}
      />
    );
  }

  const displayName =
    currentUser.displayName && currentUser.displayName.trim().length > 0
      ? currentUser.displayName.trim()
      : currentUser.email;
  const navTabs = BOTTOM_TABS_BY_ROLE[currentUser.role];
  const isMoreActive = activeTab === 'deliveries' || activeTab === 'users';

  return (
    <View style={[styles.shell, {paddingTop: insets.top}]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <MillastMark size={26} />
          <View style={styles.identity}>
            <Text numberOfLines={1} style={styles.userName}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={styles.userRole}>
              {ROLE_LABELS[currentUser.role]}
            </Text>
          </View>
        </View>

        <View style={styles.sessionActions}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initialsOf(displayName)}</Text>
          </View>
          <Pressable
            accessibilityLabel="Cambiar contraseña"
            accessibilityRole="button"
            onPress={() => setPasswordModalOpen(true)}
            style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Clave</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Cerrar sesión"
            accessibilityRole="button"
            onPress={handleLogout}
            style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Salir</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.webflowBlue]}
            onRefresh={() => runAsync(loadSharedCatalog())}
            refreshing={isLoadingCatalog}
            tintColor={colors.webflowBlue}
          />
        }
        showsVerticalScrollIndicator={false}>
        {catalogError ? (
          <AlertBanner
            onClose={() => setCatalogError(null)}
            title="Catálogo compartido"
            type="error">
            {catalogError}
          </AlertBanner>
        ) : null}

        {activeTab === 'zones' ? (
          <ZonesScreen
            canCreateZone={currentUser.role === 'personal'}
            gateway={gateways.zones}
            isLoadingCatalog={isLoadingCatalog}
            onNavigateToOrders={zoneId => {
              setOrdersZoneFilter(zoneId);
              setActiveTab('orders');
            }}
            onRefresh={loadSharedCatalog}
            orders={orders}
            zones={zones}
          />
        ) : null}

        {activeTab === 'orders' ? (
          <OrdersScreen
            canCreateOrder={currentUser.role !== 'repartidor'}
            gateway={gateways.orders}
            initialZoneFilter={ordersZoneFilter}
            onCatalogChanged={loadSharedCatalog}
            onNavigateToRoutes={
              currentUser.role === 'personal'
                ? date => {
                    setRoutesDateFilter(date);
                    setActiveTab('routes');
                  }
                : undefined
            }
            zones={zones}
          />
        ) : null}

        {activeTab === 'routes' ? (
          <RoutesScreen
            couriers={routeCouriers}
            gateway={gateways.routes}
            initialServiceDate={routesDateFilter}
            isAdmin={currentUser.role === 'personal'}
            onCatalogChanged={loadSharedCatalog}
            onNavigateToFleet={
              currentUser.role === 'personal' ? () => setActiveTab('dispatch') : undefined
            }
            pendingOrders={orders}
            zones={zones}
          />
        ) : null}

        {activeTab === 'dispatch' ? (
          <DispatchScreen
            gateway={gateways.couriers}
            onCatalogChanged={loadSharedCatalog}
            onNavigateToDeliveries={() => setActiveTab('deliveries')}
            routeGateway={gateways.routes}
            zones={zones}
          />
        ) : null}

        {activeTab === 'deliveries' ? (
          <DeliveriesScreen
            actorCourierId={currentUser.courierId}
            actorDisplayName={currentUser.displayName}
            courierGateway={gateways.couriers}
            deliveryGateway={gateways.deliveries}
            onCatalogChanged={loadSharedCatalog}
            role={currentUser.role}
            zones={zones}
          />
        ) : null}

        {activeTab === 'users' ? (
          <AdminAccessScreen
            applicationGateway={gateways.courierApplications}
            authGateway={gateways.auth}
          />
        ) : null}

        {activeTab === 'application' ? (
          <ClientApplicationScreen
            defaultFullName={currentUser.displayName ?? ''}
            gateway={gateways.courierApplications}
          />
        ) : null}
      </ScrollView>

      <View style={[styles.tabBar, {paddingBottom: Math.max(insets.bottom, 8)}]}>
        {navTabs.map(item => {
          const isSelected =
            item.tab === 'more' ? isMoreActive : activeTab === item.tab;
          return (
            <Pressable
              key={item.tab}
              accessibilityRole="tab"
              accessibilityState={{selected: isSelected}}
              onPress={() => {
                if (item.tab === 'more') {
                  setMoreSheetOpen(true);
                } else {
                  setActiveTab(item.tab);
                }
              }}
              style={styles.tabItem}
              testID={`mobile-tab-${item.tab}`}>
              <NavIcon active={isSelected} tab={item.tab} />
              <Text
                numberOfLines={1}
                style={[styles.tabLabel, isSelected && styles.tabLabelActive]}>
                {item.label}
              </Text>
              {isSelected ? <View style={styles.tabIndicator} /> : null}
            </Pressable>
          );
        })}
      </View>

      <BottomSheetModal
        onClose={() => setMoreSheetOpen(false)}
        subtitle="Secciones operativas adicionales del administrador"
        title="Más secciones"
        visible={moreSheetOpen}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMoreSheetOpen(false);
            setActiveTab('deliveries');
          }}
          style={styles.moreItem}>
          <View style={styles.moreTextWrap}>
            <Text style={styles.moreTitle}>Entregas</Text>
            <Text style={typography.caption}>
              Supervisión de rutas en curso y seguimiento de paradas
            </Text>
          </View>
          {activeTab === 'deliveries' ? <StatusBadge label="Activa" tone="blue" /> : null}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMoreSheetOpen(false);
            setActiveTab('users');
          }}
          style={styles.moreItem}>
          <View style={styles.moreTextWrap}>
            <Text style={styles.moreTitle}>Accesos</Text>
            <Text style={typography.caption}>
              Directorio de usuarios y revisión de solicitudes de repartidor
            </Text>
          </View>
          {activeTab === 'users' ? <StatusBadge label="Activa" tone="blue" /> : null}
        </Pressable>
      </BottomSheetModal>

      <ChangePasswordModal
        gateway={gateways.auth}
        onChanged={auth.applySession}
        onClose={() => setPasswordModalOpen(false)}
        user={currentUser}
        visible={passwordModalOpen}
      />
    </View>
  );
}

export function MillastMobileApp() {
  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor={colors.pureWhite} barStyle="dark-content" />
      <MillastMobileShell />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.pureWhite,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.pureWhite,
  },
  topbar: {
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontFamily: fontFamilySans,
    fontSize: 14,
    fontWeight: '600',
    color: colors.obsidian,
  },
  userRole: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    color: colors.slate,
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radii.control,
    backgroundColor: colors.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fontFamilySans,
    fontSize: 11,
    fontWeight: '600',
    color: colors.pureWhite,
  },
  headerBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
  },
  headerBtnText: {
    fontFamily: fontFamilySans,
    fontSize: 12,
    fontWeight: '500',
    color: colors.obsidian,
  },
  scrollBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    paddingTop: 6,
    paddingHorizontal: spacing.xs,
  },
  tabItem: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  tabLabel: {
    fontFamily: fontFamilySans,
    fontSize: 11,
    fontWeight: '500',
    color: colors.slate,
  },
  tabLabelActive: {
    color: colors.webflowBlue,
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    top: -6,
    width: 28,
    height: 2,
    backgroundColor: colors.webflowBlue,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.ashBorder,
    backgroundColor: colors.pureWhite,
    padding: spacing.lg,
  },
  moreTextWrap: {flex: 1, gap: 3},
  moreTitle: {
    fontFamily: fontFamilySans,
    fontSize: 15,
    fontWeight: '600',
    color: colors.obsidian,
  },
});

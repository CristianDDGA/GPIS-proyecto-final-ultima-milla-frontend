import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FetchHttpClient } from '../shared/infrastructure/http/index.js';
import {
  Alert,
  Button,
  ClipboardCheckIcon,
  LiquidLavaBackground,
  MapPinIcon,
  MillastEmblemGlyph,
  Modal,
  PackageIcon,
  RouteIcon,
  ShoppingBagIcon,
  Spinner,
  TruckIcon,
  UnifiedWaterlineNavbar,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
  type WaterlineIconAnim,
  type WaterlineNavItem,
} from '../shared/ui/index.js';

import {
  AdminAccessView,
  AuthView,
  ChangePasswordModal,
  HttpAuthGateway,
  SessionBar,
  clearToken,
  getToken,
  useAuth,
  type AuthRole,
} from '../features/auth/index.js';
import { ZoneManagementView, type Zone } from '../features/zones/index.js';
import { OrderManagementView, type Order } from '../features/orders/index.js';
import { RouteManagementView } from '../features/routes/index.js';
import { CourierFleetDispatchView, type Courier } from '../features/couriers/index.js';
import { DeliveryExecutionView, type DeliveryActor } from '../features/deliveries/index.js';
import { ClientCourierApplicationView } from '../features/courier-applications/index.js';
import {
  AdminStoreView,
  CourierStoreView,
  CustomerStoreView,
} from '../features/store/index.js';
import { composeUseCases } from './compose-use-cases.js';

type AppTab =
  | 'store'
  | 'courier-cash'
  | 'zones'
  | 'orders'
  | 'routes'
  | 'dispatch'
  | 'deliveries'
  | 'users'
  | 'application';

const TAB_CONFIG: Readonly<Record<AppTab, { readonly label: string; readonly anim: WaterlineIconAnim }>> = {
  store: { label: 'Tienda', anim: 'pop' },
  'courier-cash': { label: 'Cobros', anim: 'glow' },
  zones: { label: 'Zonas', anim: 'drop' },
  orders: { label: 'Pedidos', anim: 'pop' },
  routes: { label: 'Rutas', anim: 'plane' },
  dispatch: { label: 'Despacho', anim: 'wave' },
  deliveries: { label: 'Entregas', anim: 'glow' },
  users: { label: 'Accesos', anim: 'spin' },
  application: { label: 'Ser repartidor', anim: 'glow' },
};

function renderTabIcon(tab: AppTab) {
  switch (tab) {
    case 'store':
      return <ShoppingBagIcon size={15} />;
    case 'courier-cash':
      return <WalletIcon size={15} />;
    case 'zones':
      return <MapPinIcon size={15} />;
    case 'orders':
      return <PackageIcon size={15} />;
    case 'routes':
      return <RouteIcon size={15} />;
    case 'dispatch':
      return <TruckIcon size={15} />;
    case 'deliveries':
      return <ClipboardCheckIcon size={15} />;
    case 'users':
      return <UsersIcon size={15} />;
    case 'application':
      return <UserCheckIcon size={15} />;
  }
}

const TABS_BY_ROLE: Readonly<Record<AuthRole, readonly AppTab[]>> = {
  personal: ['zones', 'orders', 'routes', 'dispatch', 'deliveries', 'store', 'users'],
  repartidor: ['deliveries', 'courier-cash', 'routes', 'orders', 'zones'],
  cliente: ['store', 'orders', 'zones', 'application'],
};

const DEFAULT_TAB_BY_ROLE: Readonly<Record<AuthRole, AppTab>> = {
  personal: 'zones',
  repartidor: 'deliveries',
  cliente: 'store',
};

const APP_TABS: readonly AppTab[] = [
  'store',
  'courier-cash',
  'zones',
  'orders',
  'routes',
  'dispatch',
  'deliveries',
  'users',
  'application',
];
const ORDER_QUERY_PARAMS = ['orderId', 'deliveryDate', 'zoneId'] as const;

function isAppTab(value: string): value is AppTab {
  return (APP_TABS as readonly string[]).includes(value);
}

function readRequestedTab(): string | null {
  return new URLSearchParams(window.location.search).get('tab');
}

function resolveTab(requested: string | null, role: AuthRole | null): AppTab {
  const fallback: AppTab = role === null ? 'zones' : DEFAULT_TAB_BY_ROLE[role];
  const normalized = requested === 'fleet' ? 'dispatch' : requested;

  if (normalized === null || role === null || !isAppTab(normalized)) {
    return fallback;
  }

  return TABS_BY_ROLE[role].includes(normalized) ? normalized : fallback;
}

export function App() {
  const unauthorizedHandlerRef = useRef<() => void>(() => undefined);

  const [httpClient] = useState(
    () =>
      new FetchHttpClient(undefined, {
        getAccessToken: () => getToken(),
        onUnauthorized: () => unauthorizedHandlerRef.current(),
      }),
  );
  const [authGateway] = useState(() => new HttpAuthGateway(httpClient));
  const useCases = useMemo(() => composeUseCases(httpClient), [httpClient]);
  const auth = useAuth(authGateway);

  const resetSessionViewState = useCallback(() => {
    setZones([]);
    setOrders([]);
    setCouriers([]);
    setCatalogError(null);
    setRequestedTab(null);
    setPasswordModalOpen(false);
    setLogoutModalOpen(false);

    const url = new URL(window.location.href);
    url.searchParams.delete('tab');
    for (const key of ORDER_QUERY_PARAMS) {
      url.searchParams.delete(key);
    }
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      window.history.replaceState({}, '', url);
    }
  }, []);

  useEffect(() => {
    unauthorizedHandlerRef.current = () => {
      clearToken();
      resetSessionViewState();
      auth.forceSignOut();
    };
  }, [auth.forceSignOut, resetSessionViewState]);

  const currentRole = auth.user?.role ?? null;
  const currentUser = auth.user;
  const [requestedTab, setRequestedTab] = useState<string | null>(readRequestedTab);
  const activeTab = resolveTab(requestedTab, currentRole);
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isLogoutModalOpen, setLogoutModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const restoreTab = () => setRequestedTab(readRequestedTab());
    window.addEventListener('popstate', restoreTab);
    return () => window.removeEventListener('popstate', restoreTab);
  }, []);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 6);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = useMemo<readonly WaterlineNavItem<AppTab>[]>(() => {
    const roleTabs = currentRole === null ? APP_TABS : TABS_BY_ROLE[currentRole];
    return roleTabs.map((tab) => ({
      id: tab,
      label: TAB_CONFIG[tab].label,
      anim: TAB_CONFIG[tab].anim,
      icon: renderTabIcon(tab),
    }));
  }, [currentRole]);

  const selectTab = useCallback((tab: AppTab, params?: Readonly<Record<string, string>>) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);

    if (tab !== 'orders' && tab !== 'routes') {
      for (const key of ORDER_QUERY_PARAMS) {
        url.searchParams.delete(key);
      }
    }

    if (params !== undefined) {
      for (const [key, value] of Object.entries(params)) {
        if (value.length > 0) {
          url.searchParams.set(key, value);
        } else {
          url.searchParams.delete(key);
        }
      }
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      window.history.pushState({}, '', url);
    }

    setRequestedTab(tab);
  }, []);

  const [zones, setZones] = useState<Zone[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadSharedCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    const includeCouriers = currentRole === 'personal';

    const [zonesResult, ordersResult, couriersResult] = await Promise.allSettled([
      useCases.orders.getZones.execute(),
      useCases.orders.getOrders.execute(),
      includeCouriers ? useCases.couriers.getCouriers.execute({}) : Promise.resolve(null),
    ]);

    if (zonesResult.status === 'fulfilled') {
      setZones(zonesResult.value);
    }
    if (ordersResult.status === 'fulfilled') {
      setOrders(ordersResult.value);
    }
    if (couriersResult.status === 'fulfilled' && couriersResult.value !== null) {
      setCouriers([...couriersResult.value.items]);
    }

    const failed =
      zonesResult.status === 'rejected'
        ? zonesResult.reason
        : ordersResult.status === 'rejected'
          ? ordersResult.reason
          : null;

    if (failed !== null && failed !== undefined) {
      setCatalogError(
        failed instanceof Error
          ? failed.message
          : 'No se pudo cargar el catálogo compartido de zonas y pedidos.',
      );
    }

    setIsLoadingCatalog(false);
  }, [currentRole, useCases]);

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      return;
    }

    void loadSharedCatalog();
  }, [auth.status, loadSharedCatalog]);

  const listPlanifiedRoutes = useCallback(async () => {
    const items = await useCases.routes.getRoutes.execute({ limit: 100 });

    return items.map((route) => ({
      id: route.id,
      zoneId: route.zoneId,
      serviceDate: route.serviceDate,
      status: route.status,
      capacityLimit: route.capacityLimit,
      occupiedSlots: route.occupiedSlots,
    }));
  }, [useCases.routes]);

  const routeCouriers = useMemo<readonly Courier[]>(() => {
    if (couriers.length > 0) {
      return couriers;
    }
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
  }, [
    couriers,
    currentUser?.role,
    currentUser?.courierId,
    currentUser?.displayName,
    currentUser?.email,
    currentUser?.isActive,
  ]);

  const deliveryActor = useMemo<DeliveryActor>(
    () => ({
      id: currentUser?.id ?? '',
      role: currentUser?.role ?? 'cliente',
      courierId: currentUser?.courierId ?? null,
      displayName: currentUser?.displayName ?? null,
    }),
    [currentUser?.id, currentUser?.role, currentUser?.courierId, currentUser?.displayName],
  );

  const confirmLogout = useCallback(() => {
    setLogoutModalOpen(false);
    void auth.logout().finally(() => {
      resetSessionViewState();
    });
  }, [auth.logout, resetSessionViewState]);

  const handleAuthenticated = useCallback(() => {
    void auth.refreshMe();
  }, [auth.refreshMe]);

  if (auth.status === 'loading') {
    return (
      <div className="app-frame wl-dashboard">
        <LiquidLavaBackground />
        <div className="wl-dashboard-content">
          <main className="app-shell app-shell--centered">
            <div className="wf-loading-card">
              <Spinner size="lg" label="Restaurando la sesión activa" />
              <p role="status">Restaurando la sesión activa...</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (auth.status !== 'authenticated' || currentUser === null) {
    return (
      <div className="app-frame">
        <main className="app-shell app-shell--auth">
          {auth.error !== null && (
            <Alert type="error" title="Atención" onClose={auth.clearError}>
              {auth.error}
            </Alert>
          )}
          <AuthView useCases={useCases.auth} onAuthenticated={handleAuthenticated} />
        </main>
      </div>
    );
  }

  const defaultRoleTab = DEFAULT_TAB_BY_ROLE[currentUser.role];

  return (
    <div className="app-frame wl-dashboard">
      <LiquidLavaBackground />

      <div className="wl-dashboard-content">
        <header className={`wl-sticky-header ${isScrolled ? 'wl-sticky-header--scrolled' : ''}`}>
          <UnifiedWaterlineNavbar
            items={navItems}
            activeId={activeTab}
            onSelect={(tab) => selectTab(tab)}
            ariaLabel="Navegación principal del sistema"
            leadingSlot={
              <>
                <button
                  type="button"
                  className="wl-brand-btn"
                  onClick={() => selectTab(defaultRoleTab)}
                  aria-label="Ir al inicio de Millast"
                >
                  <span className="wl-brand-badge" aria-hidden="true">
                    <MillastEmblemGlyph size={17} />
                  </span>
                  <span className="wl-brand-wordmark">Millast</span>
                </button>
                <span className="wl-header-divider" aria-hidden="true" />
              </>
            }
            trailingSlot={
              <SessionBar
                user={currentUser}
                isLoading={auth.isSubmitting}
                onOpenPassword={() => setPasswordModalOpen(true)}
                onLogout={() => setLogoutModalOpen(true)}
              />
            }
          />
        </header>

        <main className="wf-app-main">
          {auth.error !== null && (
            <Alert type="error" title="Atención" onClose={auth.clearError}>
              {auth.error}
            </Alert>
          )}

          {catalogError !== null && (
            <Alert type="error" title="Catálogo compartido" onClose={() => setCatalogError(null)}>
              {catalogError}
            </Alert>
          )}

          {isLoadingCatalog && zones.length === 0 && (
            <div className="wf-loading-card wf-loading-card--inline">
              <Spinner size="md" label="Cargando zonas y pedidos" />
              <p role="status">Sincronizando catálogo operativo...</p>
            </div>
          )}

          <div
            key={activeTab}
            className="wf-app-panel app-panel"
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
            tabIndex={-1}
          >
            {activeTab === 'store' && currentUser.role === 'cliente' && (
              <CustomerStoreView
                storeGateway={useCases.store}
                zones={zones}
                onOrderPlaced={() => {
                  void loadSharedCatalog();
                }}
              />
            )}

            {activeTab === 'store' && currentUser.role === 'personal' && (
              <AdminStoreView storeGateway={useCases.store} zones={zones} />
            )}

            {activeTab === 'courier-cash' && currentUser.role === 'repartidor' && (
              <CourierStoreView
                storeGateway={useCases.store}
                onOrdersChanged={() => {
                  void loadSharedCatalog();
                }}
              />
            )}

            {activeTab === 'zones' && (
              <ZoneManagementView
                httpClient={httpClient}
                canCreateZone={currentUser.role === 'personal'}
                orders={orders}
                onNavigateToOrders={(zoneId) => selectTab('orders', { zoneId })}
              />
            )}

            {activeTab === 'orders' && (
              <OrderManagementView
                useCases={useCases.orders}
                canCreateOrder={currentUser.role !== 'repartidor'}
                onNavigateToRoutes={
                  currentUser.role === 'personal'
                    ? (deliveryDate) => selectTab('routes', { deliveryDate })
                    : undefined
                }
              />
            )}

            {activeTab === 'routes' && (
              <RouteManagementView
                useCases={useCases.routes}
                zones={zones}
                pendingOrders={orders}
                couriers={routeCouriers}
                isAdmin={currentUser.role === 'personal'}
                onCatalogChanged={() => {
                  void loadSharedCatalog();
                }}
                onNavigateToFleet={
                  currentUser.role === 'personal' ? () => selectTab('dispatch') : undefined
                }
              />
            )}

            {activeTab === 'dispatch' && (
              <CourierFleetDispatchView
                useCases={useCases.couriers}
                listPlanifiedRoutes={listPlanifiedRoutes}
                zones={zones}
                onNavigateToDeliveries={() => selectTab('deliveries')}
              />
            )}

            {activeTab === 'deliveries' && (
              <DeliveryExecutionView
                useCases={useCases.deliveries}
                courierUseCases={useCases.couriers}
                actor={deliveryActor}
                zones={zones}
                onDeliveryChanged={() => {
                  void loadSharedCatalog();
                }}
              />
            )}

            {activeTab === 'users' && (
              <AdminAccessView
                authUseCases={useCases.auth}
                applicationUseCases={useCases.courierApplications}
              />
            )}

            {activeTab === 'application' && (
              <ClientCourierApplicationView
                useCases={useCases.courierApplications}
                defaultFullName={currentUser.displayName ?? ''}
              />
            )}
          </div>
        </main>
      </div>

      {isPasswordModalOpen && (
        <ChangePasswordModal
          useCases={useCases.auth}
          onClose={() => setPasswordModalOpen(false)}
          onChanged={() => {
            setPasswordModalOpen(false);
            void auth.refreshMe();
          }}
        />
      )}

      {isLogoutModalOpen && (
        <Modal
          title="Cerrar sesión"
          description={`¿Deseas cerrar la sesión activa de ${currentUser.displayName || currentUser.email}?`}
          size="sm"
          onClose={() => setLogoutModalOpen(false)}
          footer={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setLogoutModalOpen(false)}
                disabled={auth.isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={confirmLogout}
                isLoading={auth.isSubmitting}
              >
                Cerrar sesión
              </Button>
            </>
          }
        >
          <p className="wf-modal__paragraph">
            Tu token de acceso será revocado y volverás a la pantalla de inicio de sesión.
          </p>
        </Modal>
      )}
    </div>
  );
}

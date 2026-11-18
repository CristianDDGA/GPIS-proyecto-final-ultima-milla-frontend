import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FetchHttpClient } from '../shared/infrastructure/http/index.js';
import { Alert, Spinner } from '../shared/ui/index.js';

import {
  AdminAccessView,
  AuthView,
  ChangePasswordModal,
  HttpAuthGateway,
  MillastMark,
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
import { composeUseCases } from './compose-use-cases.js';

type AppTab = 'zones' | 'orders' | 'routes' | 'dispatch' | 'deliveries' | 'users' | 'application';

const TAB_LABELS: Readonly<Record<AppTab, string>> = {
  zones: 'Zonas',
  orders: 'Pedidos',
  routes: 'Rutas',
  dispatch: 'Despacho',
  deliveries: 'Entregas',
  users: 'Accesos',
  application: 'Ser repartidor',
};

const TABS_BY_ROLE: Readonly<Record<AuthRole, readonly AppTab[]>> = {
  personal: ['zones', 'orders', 'routes', 'dispatch', 'deliveries', 'users'],
  repartidor: ['deliveries', 'routes', 'orders', 'zones'],
  cliente: ['orders', 'zones', 'application'],
};

const DEFAULT_TAB_BY_ROLE: Readonly<Record<AuthRole, AppTab>> = {
  personal: 'zones',
  repartidor: 'deliveries',
  cliente: 'orders',
};

const APP_TABS: readonly AppTab[] = [
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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const restoreTab = () => setRequestedTab(readRequestedTab());
    window.addEventListener('popstate', restoreTab);
    return () => window.removeEventListener('popstate', restoreTab);
  }, []);

  useEffect(() => {
    const handleScroll = (): void => {
      setIsScrolled(window.scrollY > 4);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const allowedTabs: readonly AppTab[] =
    currentRole === null ? APP_TABS : TABS_BY_ROLE[currentRole];
  const navTabs = useMemo(
    () => APP_TABS.filter((tab) => allowedTabs.includes(tab)),
    [allowedTabs],
  );

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
  }, [couriers, currentUser?.role, currentUser?.courierId, currentUser?.displayName, currentUser?.email, currentUser?.isActive]);

  const deliveryActor = useMemo<DeliveryActor>(
    () => ({
      id: currentUser?.id ?? '',
      role: currentUser?.role ?? 'cliente',
      courierId: currentUser?.courierId ?? null,
      displayName: currentUser?.displayName ?? null,
    }),
    [currentUser?.id, currentUser?.role, currentUser?.courierId, currentUser?.displayName],
  );

  const handleLogout = useCallback(() => {
    void auth.logout().finally(() => {
      resetSessionViewState();
    });
  }, [auth.logout, resetSessionViewState]);

  const handleAuthenticated = useCallback(() => {
    void auth.refreshMe();
  }, [auth.refreshMe]);

  if (auth.status === 'loading') {
    return (
      <div className="app-frame">
        <main className="app-shell app-shell--centered">
          <div className="wf-loading-card">
            <Spinner size="lg" label="Restaurando la sesión activa" />
            <p role="status">Restaurando la sesión activa...</p>
          </div>
        </main>
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

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = navTabs.indexOf(activeTab);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex: number;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % navTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + navTabs.length) % navTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = navTabs.length - 1;
    } else {
      return;
    }

    const nextTab = navTabs[nextIndex];
    if (nextTab === undefined) {
      return;
    }

    event.preventDefault();
    selectTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById('app-tab-' + nextTab)?.focus());
  };

  return (
    <div className="app-frame wf-app">
      <header className={'wf-app-topbar ' + (isScrolled ? 'wf-app-topbar--scrolled' : '')}>
        <div className="wf-app-topbar__inner">
          <div className="wf-app-brand">
            <MillastMark className="wf-app-brand__mark" />
            <span className="wf-app-brand__name">Millast</span>
          </div>

          <nav
            className="wf-app-nav"
            role="tablist"
            aria-label="Navegación principal del sistema"
            onKeyDown={handleTabKeyDown}
          >
            {navTabs.map((tab) => {
              const isSelected = activeTab === tab;
              return (
                <button
                  key={tab}
                  id={'app-tab-' + tab}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={'app-panel-' + tab}
                  tabIndex={isSelected ? 0 : -1}
                  className={'wf-app-nav__tab ' + (isSelected ? 'wf-app-nav__tab--active' : '')}
                  onClick={() => selectTab(tab)}
                >
                  <span>{TAB_LABELS[tab]}</span>
                </button>
              );
            })}
          </nav>

          <SessionBar
            user={currentUser}
            isLoading={auth.isSubmitting}
            onOpenPassword={() => setPasswordModalOpen(true)}
            onLogout={handleLogout}
          />
        </div>
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
          id={'app-panel-' + activeTab}
          aria-labelledby={'app-tab-' + activeTab}
          tabIndex={-1}
        >
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
    </div>
  );
}

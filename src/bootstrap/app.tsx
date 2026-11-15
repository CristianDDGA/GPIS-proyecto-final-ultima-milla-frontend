import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { FetchHttpClient } from '../shared/infrastructure/http/index.js';
import { Alert, Card, Spinner } from '../shared/ui/index.js';

import {
  AuthView,
  HttpAuthGateway,
  SessionBar,
  AdminUserManagementView,
  clearToken,
  getToken,
  useAuth,
  type AuthRole,
} from '../features/auth/index.js';
import { ZoneManagementView, type Zone } from '../features/zones/index.js';
import { OrderManagementView, type Order } from '../features/orders/index.js';
import { RouteManagementView } from '../features/routes/index.js';
import { CourierFleetDispatchView } from '../features/couriers/index.js';
import { DeliveryExecutionView, type DeliveryActor } from '../features/deliveries/index.js';
import { composeUseCases } from './compose-use-cases.js';

type AppTab = 'zones' | 'orders' | 'routes' | 'fleet' | 'deliveries' | 'users';

const TAB_LABELS: Readonly<Record<AppTab, string>> = {
  zones: 'Zonas',
  orders: 'Pedidos',
  routes: 'Rutas y Operaciones',
  fleet: 'Flota y Despacho',
  deliveries: 'Ejecución de Entregas',
  users: 'Usuarios y Sistema',
};

const TABS_BY_ROLE: Readonly<Record<AuthRole, readonly AppTab[]>> = {
  personal: ['zones', 'orders', 'routes', 'fleet', 'deliveries', 'users'],
  repartidor: ['deliveries', 'routes', 'orders', 'zones'],
  cliente: ['orders', 'zones'],
};

const DEFAULT_TAB_BY_ROLE: Readonly<Record<AuthRole, AppTab>> = {
  personal: 'zones',
  repartidor: 'deliveries',
  cliente: 'orders',
};

const APP_TABS: readonly AppTab[] = ['zones', 'orders', 'routes', 'fleet', 'deliveries', 'users'];

const ORDER_QUERY_PARAMS = ['orderId', 'deliveryDate', 'zoneId'] as const;

function isAppTab(value: string): value is AppTab {
  return (APP_TABS as readonly string[]).includes(value);
}

function readRequestedTab(): string | null {
  return new URLSearchParams(window.location.search).get('tab');
}

function resolveTab(requested: string | null, role: AuthRole | null): AppTab {
  const fallback: AppTab = role === null ? 'zones' : DEFAULT_TAB_BY_ROLE[role];

  if (requested === null || role === null || !isAppTab(requested)) {
    return fallback;
  }

  return TABS_BY_ROLE[role].includes(requested) ? requested : fallback;
}

export function App() {
  const unauthorizedHandlerRef = useRef<() => void>(() => undefined);

  // A single HTTP client shares the JWT provider and the global 401 handler with every feature.
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
    setVerificationMessage(null);
    setZones([]);
    setOrders([]);
    setCatalogError(null);
    setRequestedTab(null);

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

  useEffect(() => {
    const restoreTab = () => setRequestedTab(readRequestedTab());
    window.addEventListener('popstate', restoreTab);
    return () => window.removeEventListener('popstate', restoreTab);
  }, []);

  const selectTab = useCallback((tab: AppTab) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);

    if (tab !== 'orders') {
      for (const key of ORDER_QUERY_PARAMS) {
        url.searchParams.delete(key);
      }
    }

    if (url.protocol === 'http:' || url.protocol === 'https:') {
      window.history.pushState({}, '', url);
    }

    setRequestedTab(tab);
  }, []);

  const [zones, setZones] = useState<Zone[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const loadSharedCatalog = useCallback(async () => {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const [zoneItems, orderItems] = await Promise.all([
        useCases.orders.getZones.execute(),
        useCases.orders.getOrders.execute(),
      ]);

      setZones(zoneItems);
      setOrders(orderItems);
    } catch (error) {
      setCatalogError(
        error instanceof Error
          ? error.message
          : 'No se pudo cargar el catálogo de zonas y pedidos pendientes.',
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  }, [useCases]);

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      return;
    }

    if (activeTab !== 'routes') {
      return;
    }

    void loadSharedCatalog();
  }, [auth.status, activeTab, loadSharedCatalog]);

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

  const deliveryActor = useMemo<DeliveryActor>(
    () => ({
      id: currentUser?.id ?? '',
      role: currentUser?.role ?? 'cliente',
      courierId: currentUser?.courierId ?? null,
      displayName: currentUser?.displayName ?? null,
    }),
    [currentUser?.id, currentUser?.role, currentUser?.courierId, currentUser?.displayName],
  );

  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

  const handleVerifyProfile = useCallback(async () => {
    setVerificationMessage(null);
    const verifiedUser = await auth.refreshMe();
    if (verifiedUser !== null) {
      setVerificationMessage(
        `Perfil verificado: ${verifiedUser.displayName ?? verifiedUser.email} · rol ${verifiedUser.publicRole} · repartidor vinculado: ${verifiedUser.courierId ?? 'no asignado'}.`,
      );
    }
  }, [auth.refreshMe]);

  const handleLogout = useCallback(() => {
    resetSessionViewState();
    void auth.logout();
  }, [auth.logout, resetSessionViewState]);

  const handleAuthenticated = useCallback(() => {
    void auth.refreshMe();
  }, [auth.refreshMe]);

  if (auth.status === 'loading') {
    return (
      <main className="app-shell app-shell--centered">
        <Card variant="outlined" className="app-loading-card">
          <Spinner size="lg" label="Restaurando la sesión activa" />
          <p role="status">Restaurando la sesión activa (GET /auth/me)...</p>
        </Card>
      </main>
    );
  }

  if (auth.status !== 'authenticated' || currentUser === null) {
    return (
      <main className="app-shell">
        {auth.error !== null && (
          <Alert type="error" title="Atención" onClose={auth.clearError}>
            {auth.error}
          </Alert>
        )}
        <AuthView useCases={useCases.auth} onAuthenticated={handleAuthenticated} />
      </main>
    );
  }

  const allowedTabs = TABS_BY_ROLE[currentUser.role];

  // ARIA tabs pattern: roving tabIndex plus Left/Right/Home/End navigation, as in AuthView.
  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const currentIndex = allowedTabs.indexOf(activeTab);
    if (currentIndex < 0) {
      return;
    }

    let nextIndex: number;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % allowedTabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + allowedTabs.length) % allowedTabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = allowedTabs.length - 1;
    } else {
      return;
    }

    const nextTab = allowedTabs[nextIndex];
    if (nextTab === undefined) {
      return;
    }

    event.preventDefault();
    selectTab(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`app-tab-${nextTab}`)?.focus());
  };

  return (
    <main className="app-shell">
      <header className="app-hero">
        <p className="app-eyebrow">Gestión de Logística</p>
        <h1>Última Milla</h1>
        <p className="app-description">
          Panel unificado de operación: zonas de cobertura, pedidos, planificación de rutas, flota
          de reparto y ejecución de entregas contra la API real del backend.
        </p>
      </header>

      <SessionBar
        user={currentUser}
        healthStatus={auth.healthStatus}
        isLoading={auth.isSubmitting}
        verificationMessage={verificationMessage}
        onLogout={handleLogout}
        onVerifyProfile={() => {
          void handleVerifyProfile();
        }}
      />

      {auth.error !== null && (
        <Alert type="error" title="Atención" onClose={auth.clearError}>
          {auth.error}
        </Alert>
      )}

      <nav
        className="app-nav"
        role="tablist"
        aria-label="Navegación principal del sistema"
        onKeyDown={handleTabKeyDown}
      >
        {allowedTabs.map((tab) => (
          <button
            key={tab}
            id={`app-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`app-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`app-nav__tab ${activeTab === tab ? 'app-nav__tab--active' : ''}`}
            onClick={() => selectTab(tab)}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>

      <div
        className="app-panel"
        role="tabpanel"
        id={`app-panel-${activeTab}`}
        aria-labelledby={`app-tab-${activeTab}`}
        tabIndex={-1}
      >
        {activeTab === 'zones' && (
          <ZoneManagementView
            httpClient={httpClient}
            canCreateZone={currentUser.role === 'personal'}
          />
        )}

        {activeTab === 'orders' && (
          <OrderManagementView
            useCases={useCases.orders}
            canCreateOrder={currentUser.role !== 'repartidor'}
          />
        )}

        {activeTab === 'routes' && (
          <>
            {catalogError !== null && (
              <Alert type="error" title="Catálogo compartido" onClose={() => setCatalogError(null)}>
                {catalogError}
              </Alert>
            )}

            {isLoadingCatalog && (
              <Card variant="outlined" className="app-loading-card">
                <Spinner size="md" label="Cargando zonas y pedidos pendientes" />
                <p role="status">Cargando zonas y pedidos pendientes...</p>
              </Card>
            )}

            <RouteManagementView
              useCases={useCases.routes}
              zones={zones}
              pendingOrders={orders}
              isAdmin={currentUser.role === 'personal'}
              onCatalogChanged={() => {
                void loadSharedCatalog();
              }}
            />
          </>
        )}

        {activeTab === 'fleet' && (
          <CourierFleetDispatchView
            useCases={useCases.couriers}
            listPlanifiedRoutes={listPlanifiedRoutes}
          />
        )}

        {activeTab === 'deliveries' && (
          <DeliveryExecutionView
            useCases={useCases.deliveries}
            courierUseCases={useCases.couriers}
            actor={deliveryActor}
          />
        )}

        {activeTab === 'users' && <AdminUserManagementView useCases={useCases.auth} />}
      </div>
    </main>
  );
}

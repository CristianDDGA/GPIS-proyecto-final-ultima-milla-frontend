import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { FetchHttpClient } from '../shared/infrastructure/http/index.js';
import {
  Alert,
  Card,
  KineticCounter,
  KineticHeader,
  Spinner,
} from '../shared/ui/index.js';

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
import { HttpZoneRepository, ZoneManagementView, type Zone } from '../features/zones/index.js';
import { OrderManagementView, type Order } from '../features/orders/index.js';
import { RouteManagementView } from '../features/routes/index.js';
import { CourierFleetDispatchView, type Courier } from '../features/couriers/index.js';
import { DeliveryExecutionView, type DeliveryActor } from '../features/deliveries/index.js';
import { DispatchManagementView } from '../features/dispatch/index.js';
import { composeUseCases } from './compose-use-cases.js';

type AppTab = 'zones' | 'orders' | 'routes' | 'dispatch' | 'deliveries' | 'users';

const TAB_LABELS: Readonly<Record<AppTab, string>> = {
  zones: 'Zonas',
  orders: 'Pedidos',
  routes: 'Rutas',
  dispatch: 'Despacho',
  deliveries: 'Entregas',
  users: 'Accesos',
};

const TABS_BY_ROLE: Readonly<Record<AuthRole, readonly AppTab[]>> = {
  personal: ['zones', 'orders', 'routes', 'dispatch', 'deliveries', 'users'],
  repartidor: ['deliveries', 'routes', 'orders', 'zones'],
  cliente: ['orders', 'zones'],
};

const DEFAULT_TAB_BY_ROLE: Readonly<Record<AuthRole, AppTab>> = {
  personal: 'zones',
  repartidor: 'deliveries',
  cliente: 'orders',
};

const APP_TABS: readonly AppTab[] = ['zones', 'orders', 'routes', 'dispatch', 'deliveries', 'users'];

const STEP_BY_TAB: Readonly<Record<AppTab, number>> = {
  zones: 1,
  orders: 2,
  routes: 3,
  dispatch: 4,
  deliveries: 5,
  users: 6,
};

/** Las cinco etapas del pipeline operativo, en orden de negocio. */
const PIPELINE_STAGES: readonly { readonly tab: AppTab; readonly label: string }[] = [
  { tab: 'zones', label: 'Cobertura' },
  { tab: 'orders', label: 'Demanda' },
  { tab: 'routes', label: 'Planificación' },
  { tab: 'dispatch', label: 'Despacho' },
  { tab: 'deliveries', label: 'Última milla' },
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

  // Compatibilidad: el antiguo identificador de la pestaña de despacho era "fleet".
  const normalized = requested === 'fleet' ? 'dispatch' : requested;

  if (normalized === null || role === null || !isAppTab(normalized)) {
    return fallback;
  }

  return TABS_BY_ROLE[role].includes(normalized) ? normalized : fallback;
}

function pipelineStatusLabel(activeTab: AppTab): string {
  if (activeTab === 'users') {
    return 'Administración';
  }

  const index = PIPELINE_STAGES.findIndex((stage) => stage.tab === activeTab);
  return index < 0 ? '' : `Paso ${index + 1} de ${PIPELINE_STAGES.length}`;
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
  const zoneRepository = useMemo(() => new HttpZoneRepository(httpClient), [httpClient]);
  const auth = useAuth(authGateway);

  const resetSessionViewState = useCallback(() => {
    setVerificationMessage(null);
    setZones([]);
    setOrders([]);
    setCouriers([]);
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

  const allowedTabs: readonly AppTab[] =
    currentRole === null ? APP_TABS : TABS_BY_ROLE[currentRole];

  // El dock respeta el orden real del pipeline operativo, independientemente
  // del orden en que cada rol tenga habilitadas sus pestañas.
  const navTabs = useMemo(
    () => [...allowedTabs].sort((left, right) => STEP_BY_TAB[left] - STEP_BY_TAB[right]),
    [allowedTabs],
  );

  const selectTab = useCallback((tab: AppTab, params?: Readonly<Record<string, string>>) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);

    if (tab !== 'orders') {
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

    const includeCouriers = currentRole === 'personal' || currentRole === 'repartidor';

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
        `Perfil verificado: ${verifiedUser.displayName ?? verifiedUser.email} · rol ${verifiedUser.publicRole}.`,
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
      <div className="app-frame">
        <div className="app-mesh" aria-hidden="true" />
        <main className="app-shell app-shell--centered">
          <Card variant="outlined" className="app-loading-card">
            <Spinner size="lg" label="Restaurando la sesión activa" />
            <p role="status">Restaurando la sesión activa...</p>
          </Card>
        </main>
      </div>
    );
  }

  if (auth.status !== 'authenticated' || currentUser === null) {
    return (
      <div className="app-frame">
        <div className="app-mesh" aria-hidden="true" />
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

  const activeTabIndex = navTabs.indexOf(activeTab);
  const navStyle = {
    '--tab-index': activeTabIndex < 0 ? 0 : activeTabIndex,
    '--tab-count': navTabs.length,
  } as CSSProperties;

  const pendingOrderCount = orders.filter((order) => order.status === 'pendiente').length;
  const availableCourierCount = couriers.filter(
    (courier) => courier.isEnabled && courier.isAvailable,
  ).length;
  const activePipelineIndex = PIPELINE_STAGES.findIndex((stage) => stage.tab === activeTab);

  // ARIA tabs pattern: roving tabIndex plus Left/Right/Home/End navigation, as in AuthView.
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
    window.requestAnimationFrame(() => document.getElementById(`app-tab-${nextTab}`)?.focus());
  };

  return (
    <div className="app-frame">
      <div className="app-mesh" aria-hidden="true" />

      <header className="app-topbar">
        <div className="app-topbar__inner">
          <div className="app-brand">
            <span className="app-brand__mark" aria-hidden="true">
              ⬢
            </span>
            <span className="app-brand__name">Última Milla</span>
            <span className="app-brand__tag">Torre de control</span>
          </div>

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
        </div>

        <nav
          className="app-nav"
          role="tablist"
          aria-label="Navegación principal del sistema"
          onKeyDown={handleTabKeyDown}
          style={navStyle}
        >
          {navTabs.map((tab) => (
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
              <span className="app-nav__step" aria-hidden="true">
                {STEP_BY_TAB[tab]}
              </span>
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </header>

      <main className="app-main">
        <div className="app-hero">
          <KineticHeader
            level="h1"
            eyebrow="Gestión de logística"
            stepLabel={pipelineStatusLabel(activeTab)}
            title="Torre de control de última milla"
            description="Cobertura, demanda, planificación, despacho y entregas confirmadas en una secuencia guiada sobre la API real del backend."
            className="app-hero__header"
          />

          <div className="app-hero__kpis" aria-label="Indicadores operativos">
            <KineticCounter label="Zonas" value={zones.length} tone="accent" />
            <KineticCounter label="Pedidos pendientes" value={pendingOrderCount} tone="transit" />
            {currentUser.role === 'personal' && (
              <KineticCounter
                label="Repartidores disponibles"
                value={availableCourierCount}
                tone="delivered"
              />
            )}
          </div>
        </div>

        <div className="app-pipeline" aria-label="Flujo operativo de última milla">
          {PIPELINE_STAGES.map((stage, index) => {
            const isActive = stage.tab === activeTab;
            const isDone = activePipelineIndex >= 0 && index < activePipelineIndex;
            const isAllowed = allowedTabs.includes(stage.tab);
            return (
              <span key={stage.tab} className="app-pipeline__item">
                {index > 0 && (
                  <span className="app-pipeline__arrow" aria-hidden="true">
                    →
                  </span>
                )}
                <button
                  type="button"
                  className={`app-pipeline__stage ${
                    isActive ? 'app-pipeline__stage--active' : ''
                  } ${isDone ? 'app-pipeline__stage--done' : ''}`.trim()}
                  disabled={!isAllowed}
                  onClick={() => selectTab(stage.tab)}
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="app-pipeline__stage-number" aria-hidden="true">
                    {index + 1}
                  </span>
                  {stage.label}
                </button>
              </span>
            );
          })}
        </div>

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
          <Card variant="outlined" className="app-loading-card">
            <Spinner size="md" label="Cargando zonas y pedidos" />
            <p role="status">Sincronizando catálogo operativo...</p>
          </Card>
        )}

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
              orders={orders}
              onNavigateToOrders={(zoneId) => selectTab('orders', { zoneId })}
            />
          )}

          {activeTab === 'orders' && (
            <OrderManagementView
              useCases={useCases.orders}
              canCreateOrder={currentUser.role !== 'repartidor'}
              onNavigateToRoutes={(deliveryDate) => selectTab('routes', { deliveryDate })}
            />
          )}

          {activeTab === 'routes' && (
            <RouteManagementView
              useCases={useCases.routes}
              zones={zones}
              pendingOrders={orders}
              couriers={couriers}
              isAdmin={currentUser.role === 'personal'}
              onCatalogChanged={() => {
                void loadSharedCatalog();
              }}
              onNavigateToFleet={() => selectTab('dispatch')}
            />
          )}

          {activeTab === 'dispatch' && (
            <>
              <CourierFleetDispatchView
                useCases={useCases.couriers}
                listPlanifiedRoutes={listPlanifiedRoutes}
                zones={zones}
                onNavigateToDeliveries={() => selectTab('deliveries')}
              />

              <div className="app-dispatch-module">
                <DispatchManagementView
                  useCases={useCases.dispatch}
                  zoneCatalog={zoneRepository}
                />
              </div>
            </>
          )}

          {activeTab === 'deliveries' && (
            <DeliveryExecutionView
              useCases={useCases.deliveries}
              courierUseCases={useCases.couriers}
              actor={deliveryActor}
              zones={zones}
            />
          )}

          {activeTab === 'users' && <AdminUserManagementView useCases={useCases.auth} />}
        </div>
      </main>
    </div>
  );
}

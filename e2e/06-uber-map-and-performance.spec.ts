import { expect, test } from '@playwright/test';
import {
  loginAs,
  logoutViaAccountMenu,
  navigateTab,
  openAccountMenu,
  resetMockApi,
  stubExternalNetwork,
} from './support/helpers';

test.describe('06 · Unified Design, 0fps Idle Perf, Skeletons & Uber-Style Maps', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await stubExternalNetwork(page);
  });

  test('renders unified Waterline Login shell and sleeps GPU shaders at 0fps when idle', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');

    // El login ya no muestra barra superior ni estado del sistema: solo el showcase y la tarjeta de acceso
    await expect(page.locator('#auth-login-email')).toBeVisible();
    await expect(page.locator('.mlg-header-pill')).toHaveCount(0);
    await expect(page.getByText(/Sistema operativo|Verificando API|Sin conexión API/i)).toHaveCount(0);

    // Sign in as Admin and verify normalized PageHeader + KpiStrip
    await loginAs(page, 'admin@millast.ec');
    await expect(page.locator('.wl-page-header')).toBeVisible();
    await expect(page.locator('.wl-kpi-strip')).toBeVisible();

    // Wait for initial entrance settle, then confirm both WebGL shaders sleep at 0fps
    await page.waitForTimeout(1400);
    const lavaState = await page.locator('canvas.wl-lava-canvas').getAttribute('data-raf-active');
    const navCanvas = page.locator('canvas.nimbus-canvas');
    const navState =
      (await navCanvas.count()) > 0 ? await navCanvas.getAttribute('data-raf-active') : 'false';
    expect(lavaState).toBe('false');
    expect(navState).toBe('false');

    expect(pageErrors).toEqual([]);
  });

  test('displays GPU shimmer skeletons while data is loading under slow network', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await loginAs(page, 'admin@millast.ec');
    await navigateTab(page, 'Tienda');
    await expect(page.getByRole('heading', { name: 'Administración de tienda', exact: true })).toBeVisible();

    // Delay admin store orders response so StopCardsSkeleton is deterministically observable
    await page.route('**/store/admin/orders**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.continue();
    });

    const storeTabs = page.getByRole('tablist', { name: 'Módulos de tienda' });
    await storeTabs.getByRole('tab', { name: 'Pedidos' }).click();
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    await expect(page.getByText('Av. Amazonas N34-120 y República').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('operates Uber-style RouteStopsMap (layers, dock stepper, expand toggle, Waze/GMaps) and Customer tracking', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Courier Uber-style RouteStopsMap
    await loginAs(page, 'repartidor@millast.ec');
    await navigateTab(page, 'Cobros');

    const mapShell = page.locator('.route-map-shell').first();
    await expect(mapShell).toBeVisible();
    await expect(mapShell).toHaveAttribute('data-map-layer', 'uber');

    // HUD + Bottom Interactive Stop Dock visible by default on full map
    await expect(mapShell.locator('.route-map-hud')).toBeVisible();
    await expect(mapShell.locator('.route-map-dock')).toBeVisible();
    await expect(mapShell.getByRole('link', { name: /Waze/i })).toBeVisible();
    await expect(mapShell.getByRole('link', { name: /Google Maps/i }).first()).toBeVisible();

    // Switch layers Uber -> Satélite -> Calles -> Uber
    await mapShell.getByRole('button', { name: 'Satélite' }).click();
    await expect(mapShell).toHaveAttribute('data-map-layer', 'satellite');
    await mapShell.getByRole('button', { name: 'Calles' }).click();
    await expect(mapShell).toHaveAttribute('data-map-layer', 'osm');
    await mapShell.getByRole('button', { name: 'Uber' }).click();
    await expect(mapShell).toHaveAttribute('data-map-layer', 'uber');

    // Expand & collapse viewport height
    const expandBtn = mapShell.getByRole('button', { name: 'Expandir mapa' });
    await expandBtn.click();
    await expect(mapShell.getByRole('button', { name: 'Contraer mapa' })).toBeVisible();
    await mapShell.getByRole('button', { name: 'Contraer mapa' }).click();
    await expect(mapShell.getByRole('button', { name: 'Expandir mapa' })).toBeVisible();

    // Step through stops if multiple stops exist
    const nextStopBtn = mapShell.getByRole('button', { name: 'Parada siguiente' });
    if ((await nextStopBtn.count()) > 0) {
      await nextStopBtn.click();
      await mapShell.getByRole('button', { name: 'Parada anterior' }).click();
    }

    // 2. Customer order tracking via AccountMenu -> Mis pedidos + Uber RouteStopsMap
    await logoutViaAccountMenu(page);
    await loginAs(page, 'cliente@millast.ec');
    await expect(page.locator('.client-topbar')).toBeVisible();

    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Mis pedidos' }).click();
    const trackBtn = page
      .locator('main')
      .getByRole('button', { name: /Ver estado|Ver seguimiento|Seguir|Ver detalle|Ver/i })
      .first();
    await expect(trackBtn).toBeVisible();
    await trackBtn.click();

    await expect(page.locator('.route-map-shell')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

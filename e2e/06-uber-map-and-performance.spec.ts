import { expect, test } from '@playwright/test';
import { loginAs, navigateTab, resetMockApi, stubExternalNetwork } from './support/helpers';

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

    // Normalized Waterline Login header pill + live health indicator
    await expect(page.locator('.mlg-header-pill')).toBeVisible();
    await expect(page.getByText(/Sistema operativo|Verificando API/i).first()).toBeVisible();

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

    // Delay store catalog response so ProductGridSkeleton is observable on initial Customer load
    await page.route('**/store/products**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 750));
      await route.continue();
    });

    await loginAs(page, 'cliente@millast.ec');
    await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    await expect(page.getByText('Audífonos Inalámbricos Studio ANC').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('operates Uber-style RouteStopsMap (layers, dock stepper, expand toggle, Waze/GMaps) and Customer 4-stage tracking', async ({
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

    // 2. Customer Uber Eats-style 4-stage order tracking
    await page.getByRole('button', { name: /Salir|Cerrar sesión/i }).click();
    const logoutDialog = page.locator('.wf-modal[role="dialog"]');
    await expect(logoutDialog).toBeVisible();
    await logoutDialog.getByRole('button', { name: /Cerrar sesión|Salir/i }).click();
    await expect(page.locator('#auth-login-email')).toBeVisible();

    await loginAs(page, 'cliente@millast.ec');
    await expect(page.locator('.wl-page-header')).toBeVisible();
    await expect(page.locator('.wl-kpi-strip')).toBeVisible();

    const storeTabs = page.getByRole('tablist', { name: /Secciones de la tienda|Tienda/i });
    await storeTabs.getByRole('tab', { name: /Mis compras/i }).click();
    const viewOrderBtn = page.getByRole('button', { name: 'Ver', exact: true }).first();
    await expect(viewOrderBtn).toBeVisible();
    await viewOrderBtn.click();

    const modal = page.locator('.wf-modal[role="dialog"]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.store-track-steps')).toBeVisible();
    await expect(modal.locator('.route-map-shell')).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

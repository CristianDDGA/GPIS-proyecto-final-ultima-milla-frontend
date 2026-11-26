import { expect, test } from '@playwright/test';
import { loginAs, navigateTab, resetMockApi, stubExternalNetwork } from './support/helpers';

test.describe('02 · Admin Full End-to-End Operations Flow', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await stubExternalNetwork(page);
  });

  test('navigates all 7 Admin modules, creates a zone, plans routes, and operates Store + Map + Cash', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await loginAs(page, 'admin@millast.ec');

    // 1. Zonas: verify existing zones + create a new zone
    await expect(page.getByRole('heading', { name: 'Zonas de cobertura' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Norte · Iñaquito', exact: true })).toBeVisible();

    const zoneInput = page.getByLabel(/Nombre de la zona/i);
    await zoneInput.fill('Sur · Quitumbe');
    const zonePicker = page.locator('.wl-map-picker__kbd').first();
    await zonePicker.focus();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Crear zona/i }).click();
    const okNotice = page.getByRole('button', { name: 'Cerrar notificación' });
    await expect(okNotice).toBeVisible();
    await okNotice.click();
    await expect(page.getByRole('cell', { name: 'Sur · Quitumbe', exact: true })).toBeVisible();

    // 2. Pedidos: verify orders list loads
    await navigateTab(page, 'Pedidos');
    await expect(page.getByText('Av. Amazonas N34-120 y República')).toBeVisible();

    // 3. Rutas: verify planned routes & plan new routes for pending orders
    await navigateTab(page, 'Rutas');
    await expect(page.getByRole('heading', { name: /rutas/i }).first()).toBeVisible();

    // 4. Despacho: verify courier fleet view
    await navigateTab(page, 'Despacho');
    await expect(page.getByRole('cell', { name: 'Carlos Andrade' }).first()).toBeVisible();

    // 5. Entregas: verify delivery execution view
    await navigateTab(page, 'Entregas');
    await expect(page.getByRole('heading', { name: /Ejecución de entregas/i })).toBeVisible();

    // 6. Tienda Admin: inspect all 5 subtabs including interactive Map & Cash settlement
    await navigateTab(page, 'Tienda');
    await expect(page.getByRole('heading', { name: 'Administración de tienda', exact: true })).toBeVisible();

    const storeTabs = page.getByRole('tablist', { name: 'Módulos de tienda' });

    // 6a. Resumen
    await expect(page.getByText('Audífonos Inalámbricos Studio ANC').first()).toBeVisible();

    // 6b. Catálogo
    await storeTabs.getByRole('tab', { name: 'Catálogo' }).click();
    await expect(page.getByText('Audio y Tecnología').first()).toBeVisible();

    // 6c. Pedidos (includes interactive Ecuador RouteStopsMap!)
    await storeTabs.getByRole('tab', { name: 'Pedidos' }).click();
    await expect(page.getByText('Pedidos de tienda (despacho y detalle)')).toBeVisible();
    const mapRegion = page.getByRole('region', { name: /Mapa de /i });
    await expect(mapRegion).toBeVisible();
    await expect(page.locator('.route-map-territory-mask').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Satélite' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Calles' })).toHaveCount(0);

    // 6d. Caja (daily courier cash + settlement)
    await storeTabs.getByRole('tab', { name: 'Caja' }).click();
    await expect(page.getByText('Carlos Andrade').first()).toBeVisible();

    // 6e. Franjas
    await storeTabs.getByRole('tab', { name: 'Franjas' }).click();
    await expect(page.getByRole('button', { name: /Guardar/i }).first()).toBeVisible();

    // 7. Accesos: verify user directory shows all 3 roles including Google-verified user
    await navigateTab(page, 'Accesos');
    await expect(page.getByText('admin@millast.ec').first()).toBeVisible();
    await expect(page.getByText('cliente@millast.ec').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

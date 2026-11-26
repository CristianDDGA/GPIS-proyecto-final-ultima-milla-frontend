import { expect, test } from '@playwright/test';
import { loginAs, navigateTab, resetMockApi, stubExternalNetwork } from './support/helpers';

test.describe('04 · Courier Delivery Execution, Interactive Route Map & COD Cash', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await stubExternalNetwork(page);
  });

  test('views active route, interacts with Quito route map, collects COD payment, and checks daily cash', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await loginAs(page, 'repartidor@millast.ec');

    // Lands on Entregas tab
    await expect(page.getByRole('heading', { name: /Ejecución de entregas/i })).toBeVisible();
    await expect(page.getByText('Av. Amazonas N34-120 y República').first()).toBeVisible();

    // Switch to Cobros tab (CourierStoreView with RouteStopsMap + COD actions)
    await navigateTab(page, 'Cobros');
    await expect(page.getByText('Av. Amazonas N34-120 y República').first()).toBeVisible();

    // Verify interactive RouteStopsMap is rendered in unified style and responds to keyboard zoom/pan
    const mapRegion = page.getByRole('region', { name: /Mapa de paradas de tu ruta/i });
    await expect(mapRegion).toBeVisible();
    await expect(page.locator('.route-map-territory-mask').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Satélite' })).toHaveCount(0);
    await mapRegion.getByRole('button', { name: /Mover el mapa con el teclado/i }).focus();
    await page.keyboard.press('+');
    await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Ajustar ruta' }).click();

    // Click stop marker #1 on map to open popup, then deliver & collect COD
    const firstPin = page.locator('.route-map-marker').first();
    await expect(firstPin).toBeVisible();
    await firstPin.click();
    await expect(page.locator('.route-map-popup')).toBeVisible();

    // Trigger COD delivery modal on the active en_camino stop
    const deliverBtn = page.getByRole('button', { name: /Cobrar y entregar|Entregar y cobrar/i }).first();
    await expect(deliverBtn).toBeVisible();
    await deliverBtn.click();

    const modal = page.locator('.wf-modal[role="dialog"]');
    await expect(modal).toBeVisible();
    await modal.getByRole('button', { name: /Confirmar entrega|Cobrar y entregar/i }).click();

    await expect(page.getByText(/Entrega confirmada/i)).toBeVisible();
    const okBtn = page.getByRole('button', { name: 'Cerrar notificación' });
    if (await okBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await okBtn.click();
    }

    // Check Mi caja subtab
    await page.getByRole('tab', { name: 'Mi caja', exact: true }).click();
    await expect(page.getByText(/209\.97|efectivo|cobrado/i).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

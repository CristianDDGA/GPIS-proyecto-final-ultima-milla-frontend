import { expect, test } from '@playwright/test';
import { loginAs, navigateTab, resetMockApi, stubExternalNetwork } from './support/helpers';

test.describe('03 · Customer Store, Cart, COD Checkout, Orders & Addresses', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await stubExternalNetwork(page);
  });

  test('browses catalog, adds product to cart, checks out COD with Ecuador map, and manages orders/addresses', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await loginAs(page, 'cliente@millast.ec');

    // Lands directly on Tienda
    await expect(page.getByText('Audífonos Inalámbricos Studio ANC')).toBeVisible();
    await expect(page.getByText('Lámpara Ambiental LED WiFi')).toBeVisible();

    // Add first in-stock product to cart
    const firstCard = page.locator('.store-product-card', {
      hasText: 'Audífonos Inalámbricos Studio ANC',
    });
    await firstCard.getByRole('button', { name: /Agregar/i }).click();

    // Navigate to Carrito subtab inside CustomerStoreView
    const storeTabs = page.getByRole('tablist', { name: /Secciones de la tienda|Tienda/i });
    await storeTabs.getByRole('tab', { name: /Carrito/i }).click();
    await expect(page.getByText('Audífonos Inalámbricos Studio ANC').first()).toBeVisible();

    // Use saved address or fill delivery address + ensure map picker renders
    const addressInput = page.getByLabel(/Dirección de entrega/i);
    if ((await addressInput.inputValue()).trim().length === 0) {
      await addressInput.fill('Av. Eloy Alfaro N32-450 y Mariana de Jesús');
    }

    // Select an available delivery time slot button (e.g., 12:00 or 14:00)
    const slotButton = page.locator('.store-slot-btn:not(:disabled)').first();
    await expect(slotButton).toBeVisible();
    await slotButton.click();

    // Verify interactive EcuadorMapPicker is present and keyboard accessible
    const pickerViewport = page.locator('.wl-map-picker__viewport');
    await expect(pickerViewport).toBeVisible();
    await pickerViewport.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    // Confirm COD order
    await page.getByRole('button', { name: /Confirmar pedido/i }).click();
    await expect(page.getByText(/Pedido confirmado|Pedido creado|contra entrega/i).first()).toBeVisible();

    // Check Mis compras subtab
    await storeTabs.getByRole('tab', { name: /Mis compras/i }).click();
    await expect(page.getByText('Av. Amazonas N34-120 y República').first()).toBeVisible();

    // Check Direcciones subtab
    await storeTabs.getByRole('tab', { name: /Direcciones/i }).click();
    await expect(page.getByText('Casa · Iñaquito')).toBeVisible();

    // Navigate to Ser repartidor tab
    await navigateTab(page, 'Ser repartidor');
    await expect(page.getByRole('heading', { name: /repartidor/i }).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

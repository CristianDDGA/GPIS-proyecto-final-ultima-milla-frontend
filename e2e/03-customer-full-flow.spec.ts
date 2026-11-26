import { expect, test } from '@playwright/test';
import { loginAs, openAccountMenu, resetMockApi, stubExternalNetwork } from './support/helpers';

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

    // Lands directly on redesigned Client Store catalog
    await expect(page.locator('.client-topbar')).toBeVisible();
    await expect(page.getByText('Audífonos Inalámbricos Studio ANC')).toBeVisible();
    await expect(page.getByText('Lámpara Ambiental LED WiFi')).toBeVisible();

    // Add first in-stock product to cart
    const firstCard = page.locator('.client-product', {
      hasText: 'Audífonos Inalámbricos Studio ANC',
    });
    await firstCard.getByRole('button', { name: /Agregar al carrito/i }).click();

    // Open cart from ClientTopBar and proceed to 3-step checkout
    await page.locator('.client-topbar__cart').click();
    await expect(page.getByRole('heading', { name: 'Tu carrito' })).toBeVisible();
    await page.getByRole('button', { name: /Continuar con la compra/i }).click();

    // Step 1: Choose Otra dirección -> verify Uber EcuadorMapPicker keyboard accessibility
    await page.getByRole('radio', { name: /Otra dirección/i }).click();
    const pickerViewport = page.locator('.wl-map-picker__viewport');
    await expect(pickerViewport).toBeVisible();
    await pickerViewport.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');

    await page.locator('#checkout-address').fill('Av. Eloy Alfaro N32-450 y Mariana de Jesús');
    await page.getByRole('button', { name: /Entregar aquí y continuar/i }).click();

    // Step 2: Select an available delivery slot
    const slotButton = page.locator('.client-slot').first();
    await expect(slotButton).toBeVisible();
    await slotButton.click();
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();

    // Step 3: Confirm COD order
    await page.getByRole('button', { name: /Confirmar pedido/i }).click();
    await expect(page.getByRole('heading', { name: /Recibimos tu pedido/i })).toBeVisible();

    // View order tracking with timeline + Uber map
    await page.getByRole('button', { name: /Ver estado del pedido/i }).click();
    await expect(page.locator('.route-map-shell')).toBeVisible();

    // Check Mi perfil (saved addresses) via AccountMenu
    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Mi perfil' }).click();
    await expect(page.getByText('Casa · Iñaquito').first()).toBeVisible();

    // Check Quiero ser repartidor via AccountMenu
    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Quiero ser repartidor' }).click();
    await expect(page.getByRole('heading', { name: /repartidor/i }).first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });
});

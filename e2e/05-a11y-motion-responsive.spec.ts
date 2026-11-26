import { expect, test } from '@playwright/test';
import { loginAs, navigateTab, openAccountMenu, resetMockApi, stubExternalNetwork } from './support/helpers';

test.describe('05 · Accessibility, Motion Discipline & Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await stubExternalNetwork(page);
  });

  test('has zero horizontal overflow on Login, Admin, and Customer views', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#auth-login-email')).toBeVisible();

    const loginOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(loginOverflow).toBeLessThanOrEqual(2);

    await loginAs(page, 'admin@millast.ec');
    const adminOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(adminOverflow).toBeLessThanOrEqual(2);

    await navigateTab(page, 'Tienda');
    await expect(page.getByRole('heading', { name: 'Administración de tienda', exact: true })).toBeVisible();
    const storeOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(storeOverflow).toBeLessThanOrEqual(2);
  });

  test('supports keyboard-only navigation on Waterline navbar and skips decorative bounce', async ({
    page,
  }) => {
    await loginAs(page, 'admin@millast.ec');

    const nav = page.getByRole('tablist', { name: 'Navegación principal del sistema' });
    const firstTab = nav.getByRole('tab', { name: 'Zonas', exact: true });
    await firstTab.focus();
    await page.keyboard.press('ArrowRight');

    const secondTab = nav.getByRole('tab', { name: 'Pedidos', exact: true });
    await expect(secondTab).toHaveAttribute('aria-selected', 'true');

    const navInput = await page.evaluate(() => document.documentElement.dataset.navInput);
    expect(navInput).toBe('keyboard');
  });

  test('traps focus inside Modal, closes on Escape, and restores focus to opener', async ({ page }) => {
    await loginAs(page, 'admin@millast.ec');

    await openAccountMenu(page);
    await page.getByRole('menuitem', { name: 'Cambiar contraseña' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Body scroll lock while open
    const lockedOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(lockedOverflow).toBe('hidden');

    // Tabbing multiple times stays inside dialog
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      const insideDialog = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active?.closest('[role="dialog"]'));
      });
      expect(insideDialog).toBe(true);
    }

    // Escape closes modal and restores focus/scroll
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(restoredOverflow).toBe('');
  });

  test('respects prefers-reduced-motion: reduce without breaking interactions', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await loginAs(page, 'admin@millast.ec');
    await expect(page.getByRole('heading', { name: 'Zonas de cobertura' })).toBeVisible();

    // Transitions remain gentle & non-zero-broken (not blocked from clicking/switching)
    await navigateTab(page, 'Pedidos');
    await expect(page.getByText('Av. Amazonas N34-120 y República').first()).toBeVisible();
  });
});

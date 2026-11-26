import { expect, test } from '@playwright/test';
import {
  IS_LIVE_BACKEND,
  loginAs,
  logoutViaAccountMenu,
  resetMockApi,
  stubExternalNetwork,
} from './support/helpers';

test.describe('01 · Auth, Registration, Password Recovery & Google Sign-In', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockApi(page);
    await stubExternalNetwork(page);
  });

  test('renders clean unauthenticated Liquid Glass login without spurious error banners', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await expect(page.locator('#auth-login-email')).toBeVisible();
    await expect(page.locator('#auth-login-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entrar al sistema' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toHaveAttribute('aria-selected', 'false');

    // No spurious session-expired alert on fresh unauthenticated visit
    await expect(page.getByText(/sesión ha expirado/i)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test('shows error on invalid credentials, then authenticates Admin and logs out via modal', async ({ page }) => {
    await page.goto('/');
    await page.locator('#auth-login-email').fill('admin@millast.ec');
    await page.locator('#auth-login-password').fill('wrong-password');
    await page.getByRole('button', { name: 'Entrar al sistema' }).click();

    await expect(page.getByRole('alert')).toBeVisible();

    // Now login with valid credentials
    await page.locator('#auth-login-password').fill('Password123!');
    await page.getByRole('button', { name: 'Entrar al sistema' }).click();

    await expect(page.getByRole('tablist', { name: 'Navegación principal del sistema' })).toBeVisible();
    await expect(page.locator('.wl-account__trigger')).toContainText('Matius');

    // Open AccountMenu -> logout modal and confirm
    await logoutViaAccountMenu(page);
  });

  test('supports customer self-registration and 6-digit email verification', async ({ page }) => {
    test.skip(IS_LIVE_BACKEND, 'Uses deterministic verification code 123456 in autonomous mode.');

    await page.goto('/');
    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toHaveAttribute('aria-selected', 'true');

    await page.locator('#auth-register-display-name').fill('Valeria Quiroz');
    await page.locator('#auth-register-email').fill('valeria.e2e@millast.ec');
    await page.locator('#auth-register-password').fill('Segura#2026A');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();

    // Transitions to 6-digit verification code screen
    await expect(page.getByRole('heading', { name: /Verificar correo/i })).toBeVisible();
    await page.locator('#auth-verify-code').fill('123456');
    await page.getByRole('button', { name: 'Confirmar código', exact: true }).click();

    // Authenticated directly as Cliente into ClientTopBar + Tienda
    await expect(page.locator('.client-topbar')).toBeVisible();
    await expect(page.locator('.wl-account__trigger')).toContainText('Valeria');
  });

  test('supports forgot-password and reset-password flow', async ({ page }) => {
    test.skip(IS_LIVE_BACKEND, 'Uses deterministic reset code 654321 in autonomous mode.');

    await page.goto('/');
    await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page.getByRole('heading', { name: /Recuperar contraseña/i })).toBeVisible();

    await page.locator('#auth-forgot-email').fill('cliente@millast.ec');
    await page.getByRole('button', { name: 'Enviar código', exact: true }).click();

    await expect(page.getByRole('heading', { name: /Nueva contraseña/i })).toBeVisible();
    await page.locator('#auth-reset-code').fill('654321');
    await page.locator('#auth-reset-password').fill('NuevaClave#2026A');
    await page.getByRole('button', { name: 'Restablecer contraseña', exact: true }).click();

    await expect(page.locator('#auth-login-email')).toBeVisible();
  });

  test('authenticates Cliente seamlessly via Google Sign-In button', async ({ page }) => {
    test.skip(IS_LIVE_BACKEND, 'Uses mocked Google Identity Services credential in autonomous mode.');

    await page.goto('/');
    const googleBtn = page.getByTestId('google-gsi-mock-btn');
    await expect(googleBtn).toBeVisible();
    await googleBtn.click();

    await expect(page.locator('.client-topbar')).toBeVisible();
    await expect(page.locator('.wl-account__trigger')).toContainText('Sofía');
  });

  test('persists session across page reload when authenticated', async ({ page }) => {
    await loginAs(page, 'admin@millast.ec');
    await page.reload();
    await expect(page.getByRole('tablist', { name: 'Navegación principal del sistema' })).toBeVisible();
    await expect(page.locator('.wl-account__trigger')).toContainText('Matius');
  });
});

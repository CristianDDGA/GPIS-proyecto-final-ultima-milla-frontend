import { expect, type Page } from '@playwright/test';

export const IS_LIVE_BACKEND = process.env.PLAYWRIGHT_LIVE_BACKEND === '1';
export const MOCK_API_BASE_URL = `http://127.0.0.1:${process.env.MOCK_API_PORT ?? '3100'}`;

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TINY_PNG_BUFFER = Buffer.from(TINY_PNG_BASE64, 'base64');

export async function resetMockApi(page: Page): Promise<void> {
  if (IS_LIVE_BACKEND) return;
  const response = await page.request.post(`${MOCK_API_BASE_URL}/__test/reset`);
  expect(response.ok()).toBeTruthy();
}

/**
 * Intercepts external map tiles, OSRM routing, Nominatim geocoding, and Google GIS
 * so E2E tests remain 100% deterministic offline and never flake on external rate limits.
 */
export async function stubExternalNetwork(page: Page, options?: { googleToken?: string }): Promise<void> {
  await page.route(/^https:\/\/(tile\.openstreetmap\.org|server\.arcgisonline\.com)\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TINY_PNG_BUFFER,
    }),
  );

  await page.route(/^https:\/\/router\.project-osrm\.org\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'Ok',
        routes: [
          {
            distance: 6420,
            duration: 960,
            geometry: {
              type: 'LineString',
              coordinates: [
                [-78.4852, -0.1765],
                [-78.496, -0.195],
                [-78.5123, -0.2201],
              ],
            },
          },
        ],
      }),
    }),
  );

  await page.route(/^https:\/\/nominatim\.openstreetmap\.org\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          display_name: 'Parque La Carolina, Iñaquito, Quito, Ecuador',
          lat: '-0.18065',
          lon: '-78.48464',
        },
      ]),
    }),
  );

  const googleToken = options?.googleToken ?? 'google-valid-playwright-token';
  await page.route(/^https:\/\/accounts\.google\.com\/gsi\/client.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript; charset=utf-8',
      body: `
        window.google = {
          accounts: {
            id: {
              _cb: null,
              initialize: function(cfg) { this._cb = cfg.callback; },
              renderButton: function(container) {
                if (!container) return;
                container.innerHTML = '';
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = 'Continuar con Google (Test)';
                btn.setAttribute('data-testid', 'google-gsi-mock-btn');
                btn.style.cssText = 'width:100%;height:42px;border-radius:999px;border:1px solid #cbd5e1;background:#fff;color:#0b132b;font-weight:600;cursor:pointer;';
                btn.addEventListener('click', function() {
                  if (window.google.accounts.id._cb) {
                    window.google.accounts.id._cb({ credential: '${googleToken}' });
                  }
                });
                container.appendChild(btn);
              }
            }
          }
        };
      `,
    }),
  );
}

export async function loginAs(
  page: Page,
  email: string,
  password = 'Password123!',
): Promise<void> {
  await page.goto('/');
  await page.locator('#auth-login-email').fill(email);
  await page.locator('#auth-login-password').fill(password);
  await page.getByRole('button', { name: 'Entrar al sistema' }).click();
  await expect(page.locator('.wl-account__trigger')).toBeVisible();
}

export async function openAccountMenu(page: Page): Promise<void> {
  const trigger = page.locator('.wl-account__trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('menu', { name: 'Opciones de la cuenta' })).toBeVisible();
}

export async function logoutViaAccountMenu(page: Page): Promise<void> {
  await openAccountMenu(page);
  await page.getByRole('menuitem', { name: /Cerrar sesión/i }).click();
  const dialog = page.locator('.wf-modal[role="dialog"]');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Sí, salir|Cerrar sesión/i }).click();
  await expect(page.locator('#auth-login-email')).toBeVisible();
}

export async function navigateTab(page: Page, label: string): Promise<void> {
  const tab = page
    .getByRole('tablist', { name: 'Navegación principal del sistema' })
    .getByRole('tab', { name: label, exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

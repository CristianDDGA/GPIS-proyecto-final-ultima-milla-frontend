# Pruebas y calidad del frontend

Estado al 2026-11-23. Se aplica la matriz del informe APE «Selección de tecnologías para pruebas» al repositorio web. El backend tiene su propia guía en `docs/PRUEBAS_Y_CALIDAD.md` de su repositorio.

## Matriz del informe APE aplicada al sistema

| Herramienta (APE) | Backend | Web (este repo) | Móvil (`mobile/`) |
|---|---|---|---|
| Jest + Supertest | Sí: unitarias, integración en memoria y PostgreSQL real | — | Jest para unitarias |
| Vitest + React Testing Library | — | **Sí** (desde esta rama) | — |
| Cypress | — | Sí: `cypress/e2e` contra API y PostgreSQL reales | — |
| Detox | — | — | Sí: `mobile/e2e/assigned-route.e2e.js` |
| k6 | Sí: `smoke` y `san-valentin-stress` | — | — |
| OWASP ZAP | Sí: baseline, 0 FAIL / 0 WARN | — | — |
| ESLint | Sí | **Sí** (desde esta rama) | Sí |
| SonarQube Cloud | Sí (`gpis-ultima-milla-api`) | **Sí** (`CristianDDGA_GPIS-proyecto-final-ultima-milla-frontend`) | — |
| GitHub Actions (recomendación APE) | Sí: `ci.yml` y `sonar.yml` | **Sí** (desde esta rama) | — |

## Pruebas unitarias y de componentes (Vitest + React Testing Library)

```powershell
npm test               # una corrida
npm run test:watch     # modo observación
npm run test:coverage  # genera coverage/lcov.info para SonarQube Cloud
```

Configuración: `vitest.config.ts` (entorno `jsdom`, `src/test/setup.ts` con `@testing-library/jest-dom`). Las pruebas viven junto al código (`*.test.ts` / `*.test.tsx`). `src/test/fakeHttpClient.ts` ofrece un cliente HTTP falso y datos de ejemplo.

Qué se prueba (127 pruebas):

| Área | Archivo | Qué valida |
|---|---|---|
| Cuentas | `features/auth/domain/authUser.test.ts` | Correo estricto, política de contraseñas igual al backend, nombre sin números ni emojis, código de 6 dígitos, fuerza de la clave |
| Cuentas | `features/auth/application/authUseCases.test.ts` | Normalización del correo, no llama a la API con datos inválidos, Google |
| Cuentas | `features/auth/infrastructure/http/httpAuthGateway.test.ts` | Token en `localStorage`, logout que siempre limpia, `/health`, filtros de usuarios, contrato de respuestas |
| Cliente HTTP | `shared/infrastructure/http/httpClient.test.ts` | JWT, 401 que cierra sesión salvo en endpoints públicos, errores de red, 204, binarios |
| Zonas | `features/zones/zones.test.tsx` | Repositorio HTTP, **formulario con React Testing Library** y hook `useZones` |
| Pedidos, rutas, conductores, entregas | `features/logistics-domain.test.ts`, `features/routes/routes.test.ts`, `features/dispatch.test.ts` | Validaciones, máquina de estados de entrega, `occupiedSlots <= capacityLimit`, `Idempotency-Key`, versión esperada (concurrencia optimista) |
| Solicitudes de conductor | `features/courier-applications/*.test.ts` | Cédula ecuatoriana (módulo 10), mayoría de edad, licencia vigente, imágenes JPEG/PNG por firma, aprobar y rechazar |
| Tienda y mapa | `features/store/**/*.test.ts` | Centavos, idempotencia del pedido, conflictos de stock (409), coordenadas dentro de Ecuador, enlaces de navegación |

Cobertura sobre la lógica (dominio, aplicación e infraestructura): 75 % de sentencias. Las vistas visuales (WebGL, Liquid Glass, mapas) quedan fuera del cálculo y se validan con Cypress y revisión manual.

Las pruebas encontraron y corrigieron un error: si la API (o un proxy como Render) respondía un error que no era JSON, el cliente HTTP leía el cuerpo dos veces y lanzaba `Body has already been read` en vez de un `HttpError` con su estado.

## Pruebas E2E web (Cypress)

Necesitan la API en `http://127.0.0.1:3000` y la web en `http://127.0.0.1:5173`. El binario de Cypress no se descarga en CI; en local, la primera vez:

```powershell
npx cypress install
npm run dev          # en otra terminal
npm run e2e
```

Los casos `sprint02-order-detail` y `sprint03-dispatch` usan la API real; la URL se cambia en `cypress.config.js` (`expose.apiUrl`).

## Integración continua y SonarQube Cloud

- `.github/workflows/ci.yml`: en cada PR y push a `develop`/`main` corre `typecheck`, `lint`, pruebas con cobertura y `build`.
- `.github/workflows/sonar.yml`: analiza con SonarQube Cloud. Se omite (no falla) mientras el repositorio no tenga los secretos.

Configuración actual (2026-11-23, repositorio ya en la cuenta `CristianDDGA`):

- Proyecto en SonarQube Cloud: `CristianDDGA_GPIS-proyecto-final-ultima-milla-frontend` (organización `cristianddga`), importado desde GitHub, con el **análisis automático desactivado** para que el análisis venga del workflow e incluya la cobertura.
- Secretos del repositorio: `SONAR_HOST_URL` (`https://sonarcloud.io`) y `SONAR_TOKEN_FRONT` (token de SonarQube Cloud; se genera en *My Account → Security*). El workflow lo entrega al scanner como `SONAR_TOKEN`.
- Ruleset `Proteger develop` (activo): exige PR antes de fusionar (0 aprobaciones, para que el autor pueda fusionar) y que pasen los checks `checks` (CI) y `sonar`; bloquea el force push y el borrado de `develop`.

Si el job `sonar` no tiene los secretos se marca como omitido y GitHub lo cuenta como aprobado; el bloqueo real depende de que `SONAR_TOKEN_FRONT` exista.

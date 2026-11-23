# Web de logística de última milla

Aplicación React independiente del repositorio API. `src/bootstrap` monta la interfaz y será el composition root para inyectar gateways. `shared/infrastructure/http` será el único cliente HTTP; `shared/ui` alojará los componentes y tokens compartidos.

## Versiones fijadas

- Node.js 24.11.0 (`.nvmrc`) y npm 11.
- React y React DOM 19.3.0.
- Vite 8.3.4 (parche de seguridad sobre 8.3.2) con `@vitejs/plugin-react` 6.1.1.
- TypeScript 6.0.3.

El `package-lock.json` de este repositorio fija sus dependencias, separado del lockfile del backend.

## Estructura

```text
src/
  bootstrap/                     entrada React y composition root
  shared/ui/                     componentes y tokens únicos
  shared/infrastructure/http/    cliente HTTP único
  features/zones/{domain,application,infrastructure/http,presentation}/
  features/orders/               las mismas capas para pedidos
```

`index.html` y Vite apuntan a `src/bootstrap/main.tsx`. No hay componentes de demostración de Vite ni llamadas HTTP desde la UI.

## Comandos

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:coverage
npm run build
npm run preview
```

La aplicación de desarrollo usa `127.0.0.1:5173` y la vista previa `127.0.0.1:4173`; ambas requieren el puerto libre. Vite carga `VITE_API_BASE_URL` desde `.env`, con valor de ejemplo `http://localhost:3000`. Nunca pongas credenciales en variables `VITE_*`.

`VITE_GOOGLE_CLIENT_ID` (opcional) es el Client ID público de Google, el mismo que `GOOGLE_CLIENT_ID` del backend; sin él no aparece el botón de Google.

## Pruebas y calidad

Herramientas elegidas en el informe APE «Selección de tecnologías para pruebas»:

| Herramienta | Tipo | Dónde | Comando |
|---|---|---|---|
| Vitest + React Testing Library | Unitarias y de componentes | `src/**/*.test.ts(x)` | `npm test` / `npm run test:coverage` |
| Cypress | E2E web contra la API real | `cypress/e2e` | `npm run e2e` |
| Detox | E2E móvil | `mobile/e2e` | `npm run test:e2e` (en `mobile/`) |
| ESLint | Análisis estático | `eslint.config.js` | `npm run lint` |
| SonarQube Cloud | Análisis estático y cobertura | `sonar-project.properties` | workflow `sonar.yml` |
| GitHub Actions | Integración continua | `.github/workflows/ci.yml` | cada PR y push a `develop`/`main` |

Detalle de qué cubre cada prueba, cómo correr Cypress y cómo activar SonarQube Cloud: [docs/PRUEBAS_Y_CALIDAD.md](docs/PRUEBAS_Y_CALIDAD.md).

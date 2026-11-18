# Checklist de Ejecución — Refactor Login + Rol Administrador Webflow Studio (`DESIGN (1).md`)

## Etapa A — Login Webflow Studio Minimal (Completada y Verificada)
- [x] **Task L1:** Copiar `c:\Users\Matius\Downloads\DESIGN (1).md` a `DESIGN.md` en la raíz del frontend y verificar identidad byte a byte (`Get-FileHash`).
- [x] **Task L2:** Modularizar Login en `src/features/auth/presentation/` (`useAuthFlows`, `AuthTopNav`, `AuthStudioShowcase`, `KineticText`, `IsometricRouteSculpture`, `AuthPasswordField`, `PasswordStrengthMeter`, `AuthLoginForm`, `AuthRegisterForm`, `AuthVerifyEmailForm`, `AuthForgotPasswordForm`, `AuthResetPasswordForm`, `AuthView`).
- [x] **Task L3:** Depurar ruido visual en Login (sin botones duplicados en topbar, sin captura de navegador ni lista de etapas a la izquierda —solo el slogan—, sin pie `MILLAST · WEB`).
- [x] **Task L4:** Verificar Login en navegador (`1440×900`, `1366×668`, `390×844`) con 0 errores de consola y 0 scrollbars.

## Etapa B — Rol Administrador (`personal`) Webflow Studio (Completada)
- [x] **Task 1:** Purgar `src/bootstrap/authkit-theme.css` y unificar tokens (`tokens.css`) + primitivas UI (`Button`, `TextInput`, `Select`, `Card`, `Alert`, `Modal`, `SectionHeader`, `ShortIdBadge`, `EmptyState`, `KineticHeader`, `KineticCounter`, `IsometricCapacityCube`, `MillastMark`) en Webflow Studio (`#ffffff`, `#080808`, `#146ef5`, `#d8d8d8`, `#f0f0f0`, radios `4px`/`8px`, `Inter` + `JetBrains Mono`).
- [x] **Task 2:** Refactorizar el Shell Autenticado (`src/bootstrap/app.tsx`, `src/bootstrap/styles.css`), `SessionBar.tsx` y `ChangePasswordModal.tsx` manteniendo las 6 secciones bien ordenadas (`01 Zonas`, `02 Pedidos`, `03 Rutas`, `04 Despacho`, `05 Entregas`, `06 Accesos`).
- [x] **Task 3:** Refactorizar `AdminAccessView.tsx` y descomponer `AdminUserManagementView.tsx` en `admin/UserDirectoryTable.tsx` y `admin/UserModals.tsx` (SRP) con `admin-access.css`.
- [x] **Task 4:** Refactorizar y modularizar `AdminCourierApplicationsPanel.tsx` y `ApplicationReviewInspector.tsx`.
- [x] **Task 5:** Limpiar y alinear `01 Zonas` (`ZoneManagementView.tsx`, `zones.css`, `zone.ts`) y `02 Pedidos` (`OrderManagementView.tsx`, `orders.css`, `order.ts`) al estudio Webflow conservando selectores E2E.
- [x] **Task 6:** Refactorizar `03 Rutas` (`RouteManagementView.tsx`, `RoutePlannerCard.tsx`, `LateOrderPlacementCard.tsx`, `useRoutes.ts`, `routes.css`) con recepción de `?deliveryDate=` e Isometría 2.5D funcional (`IsometricCapacityCube`).
- [x] **Task 7:** Unificar `04 Despacho` (`CourierFleetDispatchView.tsx`, `couriers.css`, `courier.ts`), eliminar por completo `src/features/dispatch/` (endpoints `404` inexistentes) y simplificar `05 Entregas` (`DeliveryExecutionView.tsx`, `deliveries.css`).
- [x] **Task 8:** Verificar `npm run typecheck` y `npm run build` con 0 errores y actualizar la memoria en el vault **JAGUAR**.

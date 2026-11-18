# Checklist de Ejecución — Webflow Studio (`DESIGN (1).md`)

## Etapa A — Login Webflow Studio Minimal
- [x] Copiar `c:\Users\Matius\Downloads\DESIGN (1).md` a `DESIGN.md` en la raíz del frontend.
- [x] Modularizar Login en `src/features/auth/presentation/` (`useAuthFlows`, `AuthTopNav`, `AuthStudioShowcase`, `KineticText`, `IsometricRouteSculpture`, `AuthPasswordField`, `PasswordStrengthMeter`, 5 formularios).
- [x] Depurar ruido visual en Login (sin botones duplicados en topbar, sin imagen/lista de texto innecesaria, sin `MILLAST · WEB`).

## Etapa B — Rol Administrador (`personal`)
- [x] Purgar `authkit-theme.css` y unificar tokens (`Inter` como única fuente de interfaz, radios `4px`/`8px`, cero sombra en reposo).
- [x] Eliminar por completo `src/features/dispatch/` (endpoints `404` inexistentes).
- [x] Mantener las 6 secciones ordenadas (`Zonas`, `Pedidos`, `Rutas`, `Despacho`, `Entregas`, `Accesos`) eliminando numeración `01..06` y etiquetas `Etapa`.
- [x] Hidratar nombres legibles de zona y añadir paginación en `Pedidos`; mantener `IsometricCapacityCube` solo en `Rutas`; ocultar paneles vacíos en `Despacho` sin repartidor seleccionado.

## Etapa C — Rol Cliente (`cliente`)
- [x] Limpiar `Zonas` (sin banner de "Modo consulta") y `Pedidos` (sin acción administrativa `Planificar en Rutas` ni estado crudo visible).
- [x] Implementar pestaña **Ser repartidor** (`ClientCourierApplicationView`, `ClientApplicationFormCard`, `ClientApplicationDocumentsCard`, `useMyCourierApplication`).
- [x] Adaptar `readOptionalApplication` para `GET /courier-applications/me` cuando responde `200 { application: null }`.

## Etapa D — Verificación, Pulido y Documentación
- [x] Corregir flecha doble en `<Select>` (`Select.tsx` / `Select.css`) y ajuste de ancho para `"Todos los estados"`.
- [x] Evitar peticiones `401` al pulsar `Salir` desde pestañas secundarias (`app.tsx`).
- [x] Documentar brechas/observaciones de backend sin editar `GPIS-proyecto-final-ultima-milla-backend` (`tasks/backend-observations.md`).
- [x] Verificar `npm run typecheck`, `npm run build` y navegación en Chromium (`1440×900` Admin y Cliente) con 0 errores de consola y 0 errores de red.

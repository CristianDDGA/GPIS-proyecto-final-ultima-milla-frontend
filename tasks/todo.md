# Checklist de Ejecución — Webflow Studio (`DESIGN (1).md`)

## Etapas A–C — Login, Administrador y Cliente
- [x] Login minimalista Webflow Studio + Kinetic Type + Isometría 2.5D sin redundancias ni scroll.
- [x] Consola Admin (6 secciones ordenadas sin `01..06`/`Etapa`, `Inter` puro, `IsometricCapacityCube` solo en `Rutas`, sin `dispatch` `404`).
- [x] Portal Cliente (`Zonas`, `Pedidos`, `Ser repartidor`) y corrección de `<Select>` (flecha única) y logout (`Salir` sin `401`).

## Etapa D — Portal Repartidor (`repartidor`)
- [x] Evitar petición `GET /couriers` (`403`) al iniciar sesión como `repartidor` (`app.tsx`).
- [x] Resolver nombre real del repartidor en `Rutas` y retirar enlace administrativo `Asignar repartidor en Despacho →` para `repartidor`.
- [x] Limpiar filtros de `Rutas` (`RouteFiltersForm`) y controlar lista de 3,800+ pedidos tardíos en `LateOrderPlacementCard`.
- [x] Modularizar `DeliveryExecutionView` en `CourierOperationCard`, `DeliveryStopList` y `DeliveryOrderInspectorCard`.
- [x] Precargar registros `/delivery-orders/:id` al cargar `Hoja de ruta activa`, ocultar tarjeta vacía de inspector sin ruta, agregar stepper visual de parada y control explícito `Por confirmar` / `Disponible` / `No disponible`.

## Etapa E — Documentación Backend & Prueba Cruzada de 3 Roles
- [x] Documentar todos los errores y brechas del backend en `docs/BACKEND_HALLAZGOS_Y_ERRORES.md` (sin editar el backend).
- [x] Probar flujo cruzado completo `Cliente → Admin → Repartidor → Cliente` (pedido y entrega completa de ruta) + autopostulación `Admin → Cliente → Admin → Repartidor` en Chromium con 0 errores de consola/red.
- [x] Verificar `npm run typecheck` y `npm run build` finales con 0 errores.

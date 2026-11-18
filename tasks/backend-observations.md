# Observaciones del Backend (Resumen Rápido)

> [!NOTE]
> El informe completo y clasificado por severidad (**BE-01** a **BE-07**) se encuentra en [docs/BACKEND_HALLAZGOS_Y_ERRORES.md](../docs/BACKEND_HALLAZGOS_Y_ERRORES.md). **No se modificó ningún archivo de `GPIS-proyecto-final-ultima-milla-backend`.**

1. **BE-01 (`couriers`/`auth`):** Falta endpoint para que `repartidor` consulte su disponibilidad (`GET /couriers` responde `403`, sin `GET /couriers/me`, y `GET /couriers/:id/route` / `GET /auth/me` omiten `isAvailable`). Mitigado en frontend con selección explícita `"Por confirmar"` → `Marcar disponible` / `No disponible`.
2. **BE-02 (`auth`/`couriers`):** `POST /auth/users` con rol `repartidor` no crea ni enlaza fila en `logistica.couriers` (`courierId = null`), y `POST /couriers` pasa `NULL::uuid` como `user_id`.
3. **BE-03 (`deliveries`/`routes`/`orders`):** `complete_route` marca `released_at` en `route_stops`, dejando en `0` los cupos en `GET /routes`, vacío `stops[]` en `GET /routes/:id` y vacío `GET /orders` para el repartidor tras completar la ruta.
4. **BE-04 (`deliveries`):** `GET /delivery-orders/:id` no valida propiedad de parada cuando el actor es `repartidor` (a diferencia de `POST /delivery-status-changes`).
5. **BE-05 (`orders`):** `GET /orders` no pagina ni filtra por `status` (`3,850` pedidos locales en una respuesta) y no incluye `zoneName`. Mitigado en frontend en `OrderList.tsx` (`15`/página + hidratación desde `zones`) y `LateOrderPlacementCard.tsx` (filtro + tope de `50` opciones).
6. **BE-06 (`courier-applications`):** `GET /courier-applications/me` retorna `200 { application: null }` cuando no existe borrador (adaptado con `readOptionalApplication`); `review_courier_application` no sincroniza `app_users.display_name`.
7. **BE-07 (`routes`/`couriers`/`zones`):** `GET /routes` y `GET /couriers` omiten `total`; `GET /zones` omite `isActive`; `change_order_status` fuerza `logistica.source = 'mobile'` para todo `repartidor`; retirados los `404` heredados (`POST /routes/:id/dispatch`, `GET /couriers/:id`).

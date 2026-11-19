# Hallazgos, Errores y Brechas en el Backend (`gpis-ultima-milla-api`)

> [!NOTE]
> Documento generado tras completar y probar extremo a extremo en navegador los 3 roles del frontend (**Cliente**, **Administrador** y **Repartidor**) contra el backend real en `http://localhost:3000`. **No se modificó ningún archivo del repositorio backend**; este informe registra todo lo encontrado para su corrección posterior en `GPIS-proyecto-final-ultima-milla-backend`.

---

## Resumen por Severidad

| ID | Severidad | Módulo / Ruta | Problema detectado |
| :--- | :--- | :--- | :--- |
| **BE-01** | Alta | `couriers` / `auth` | El rol `repartidor` no tiene ningún endpoint para consultar su propia disponibilidad (`isAvailable`) ni perfil operativo; `GET /couriers` responde `403`. |
| **BE-02** | Alta | `auth` / `couriers` | Crear un usuario `repartidor` vía `POST /auth/users` deja `courierId = null` y `POST /couriers` tampoco permite vincular `userId`. |
| **BE-03** | Alta | `deliveries` / `routes` / `orders` (SQL) | `logistica.complete_route` marca `released_at` en `route_stops`, vaciando `occupiedSlots` (`0/4`), `GET /routes/:id` (`stops: []`) y el listado `GET /orders` del repartidor. |
| **BE-04** | Media-Alta | `deliveries` | `GET /delivery-orders/:id` no valida propiedad ni rol del repartidor (brecha BOLA/IDOR respecto a `POST /delivery-status-changes`). |
| **BE-05** | Media | `orders` | `GET /orders` devuelve todos los pedidos sin paginación (`3,850` en local), sin filtro `?status=` y sin `zoneName` poblado. |
| **BE-06** | Media | `courier-applications` / `auth` | `GET /courier-applications/me` retorna `200 { application: null }`; `review_courier_application` no sincroniza `app_users.display_name`; fricción de cuentas demo ante `EMAIL_VERIFICATION_REQUIRED=true`. |
| **BE-07** | Baja-Media | `zones` / `routes` / `couriers` | Falta `total` en `{ items, limit, offset }`, `GET /zones` omite `isActive`, endpoints heredados `404` y `logistica.source` asume `'mobile'` siempre para repartidor. |

---

## Detalle Técnico de Cada Hallazgo

### [BE-01] El rol `repartidor` no puede leer su disponibilidad ni ficha operativa

- **Dónde está:**
  - `src/bootstrap/auth.middleware.ts` (`resolvePolicy`)
  - `src/modules/couriers/presentation/http/courier.router.ts`
  - `src/modules/couriers/infrastructure/postgres/prisma-assignment.repository.ts` (`getActiveRoute`)
  - `src/modules/auth/infrastructure/postgres/prisma-auth.repository.ts`
- **Qué ocurre:**
  - `GET /couriers` solo admite `['personal']` (devuelve `403 FORBIDDEN` para `repartidor`).
  - No existe `GET /couriers/me` ni `GET /couriers/:id`.
  - `GET /couriers/:id/route` retorna `{ item: { routeId, zoneId, serviceDate, status, stops } | null }`, pero **no** devuelve `isAvailable`, `isEnabled` ni `maxOrdersPerTrip`.
  - `GET /auth/me` y `POST /auth/login` incluyen `courierId`, sin el estado actual de disponibilidad.
- **Impacto:** Al iniciar sesión como `repartidor`, el sistema desconoce si está `Disponible` o `No disponible` hasta que ejecuta `PATCH /couriers/:id/availability`.
- **Corrección sugerida en backend:** Exponer `GET /couriers/me` (o habilitar `GET /couriers/:id` con `courierSelfPath`) y/o incluir `isAvailable` en `GET /couriers/:id/route` o en `AuthUser`.

---

### [BE-02] Usuarios `repartidor` creados por `POST /auth/users` quedan desconectados de `logistica.couriers`

- **Dónde está:**
  - `src/modules/auth/application/auth.use-cases.ts` (`registerByAdmin`)
  - `src/modules/couriers/infrastructure/postgres/prisma-courier.repository.ts` (`create` invoca `logistica.create_courier(..., NULL::uuid)`)
- **Qué ocurre:**
  - Al crear un usuario con `role: 'repartidor'` en `POST /auth/users`, se crea únicamente la fila en `logistica.app_users` sin crear ni enlazar registro en `logistica.couriers` (observado en PostgreSQL local: `ui.nuevo.usuario@logistica.local` con `role = 'repartidor'` y `courier_id = NULL`).
  - `POST /couriers` tampoco recibe `userId`; hardcodea `NULL::uuid`.
  - Actualmente, **solo** aprobar una autopostulación de cliente (`logistica.review_courier_application`) crea el registro en `couriers` con `user_id` enlazado.
- **Impacto:** Todo repartidor dado de alta manualmente desde **Accesos → Nuevo usuario** inicia sesión con `courierId: null` y queda imposibilitado para ver rutas u operar entregas.
- **Corrección sugerida en backend:** Permitir crear/vincular el registro de flota al dar de alta un `repartidor` desde `POST /auth/users` (o aceptar `userId` opcional validado en `POST /couriers` / `PATCH /couriers/:id/user`).

---

### [BE-03] `logistica.complete_route` vacía las paradas históricas en `GET /routes`, `GET /routes/:id` y `GET /orders` del repartidor

- **Dónde está:**
  - Función PostgreSQL `logistica.complete_route(uuid)`: ejecuta `UPDATE route_stops SET released_at = clock_timestamp(), release_reason = 'ruta_completada' WHERE route_id = p_route AND released_at IS NULL;`
  - `src/modules/routes/infrastructure/postgres/route-sql.ts` (`list` y `detail`, que leen `logistica.route_summary` y `logistica.current_route_stops`)
  - `src/modules/orders/infrastructure/postgres/logistica-order.sql.ts` (`find`, filtro de `repartidor` usando `current_route_stops`)
- **Qué ocurre:**
  - `current_route_stops` filtra por `released_at IS NULL`. Cuando una ruta pasa a estado `completada`:
    1. `GET /routes` muestra `occupiedSlots: 0` (por ejemplo `0/4` en vez de las paradas entregadas).
    2. `GET /routes/:id` devuelve `stops: []` (como si la ruta nunca hubiera tenido paradas).
    3. `GET /orders` para el rol `repartidor` deja de devolver todos los pedidos entregados en esa ruta (verificado en prueba en vivo: tras completar `#RUT-3BBD`, la pestaña **Pedidos** del repartidor mostró **`0 pedidos`**).
- **Corrección sugerida en backend:** Conservar trazabilidad de paradas completadas en las vistas/consultas de lectura (p. ej. incluir `release_reason = 'ruta_completada'` en el detalle histórico de rutas cerradas y en el historial de pedidos del repartidor, en lugar de ocultarlas igual que una parada cancelada o reubicada).

---

### [BE-04] Falta de verificación de propiedad en `GET /delivery-orders/:id` (BOLA / IDOR)

- **Dónde está:**
  - `src/bootstrap/auth.middleware.ts` (`resolvePolicy` permite `['personal', 'repartidor']` en `/delivery-orders/*`)
  - `src/modules/deliveries/infrastructure/postgres/prisma-delivery.repository.ts` (`findOrderById`)
  - `src/modules/deliveries/application/use-cases/get-delivery-order.use-case.ts`
- **Qué ocurre:** Mientras `POST /delivery-status-changes` comprueba que la parada pertenezca a una ruta del repartidor (`c.user_id = actorId`), `GET /delivery-orders/:id` consulta `logistica.orders` por `o.id` sin filtrar por el actor cuando el rol es `repartidor`.
- **Impacto:** Cualquier repartidor autenticado puede consultar estado, versión y fecha de entrega de pedidos ajenos conociendo su UUID.
- **Corrección sugerida en backend:** Aplicar el mismo filtro de pertenencia por `courier_id` / `user_id` cuando `actor.role === 'repartidor'`, devolviendo `403 FORBIDDEN` o `404 ORDER_NOT_FOUND` si no le corresponde.

---

### [BE-05] `GET /orders` sin paginación, sin filtro de estado ni `zoneName`

- **Dónde está:** `src/modules/orders/presentation/http/order.controller.ts` y `src/modules/orders/infrastructure/postgres/logistica-order.sql.ts`.
- **Qué ocurre:**
  1. `GET /orders` no soporta `limit`, `offset`, `total` ni `?status=`. En el entorno local devuelve **3,850 registros** completos en cada carga inicial.
  2. Durante la prueba en vivo con 3,832 pedidos pendientes, alimentar esa lista completa provocó latencia y bloqueo del DOM al abrir **Rutas** (mitigado en frontend paginando de 15 en 15 en `OrderList.tsx` y filtrando/limitando a 50 opciones visibles en `LateOrderPlacementCard.tsx`).
  3. `order.toJSON()` solo expone `zoneId` y omite `zoneName` (mitigado en frontend cruzando contra `GET /zones`).
- **Corrección sugerida en backend:** Agregar paginación (`limit`, `offset`, `total`), filtro opcional `status` y proyección de `zoneName` mediante `JOIN logistica.zones`.

---

### [BE-06] Inconsistencias en `courier-applications` y verificación de cuentas sembradas

- **Dónde están:**
  - `src/modules/courier-applications/presentation/http/application.router.ts`
  - Función SQL `logistica.review_courier_application(...)`
- **Qué ocurre:**
  1. `GET /courier-applications/me` devuelve HTTP `200 OK` con `{ "application": null }` cuando el cliente no ha iniciado postulación (adaptado en frontend con `readOptionalApplication`).
  2. Al aprobar una postulación, `review_courier_application` copia `a.full_name` a `couriers.display_name`, pero no actualiza `app_users.display_name` si el usuario se había registrado sin nombre o con otro texto.
  3. `PUT /courier-applications/me` devuelve `403 EMAIL_NOT_VERIFIED` si la cuenta cliente fue sembrada sin `email_verified_at`/`email_verified_via` y el servidor corre con `EMAIL_VERIFICATION_REQUIRED=true`.
- **Corrección sugerida en backend:** Documentar explícitamente el contrato nullable de `/me` en la especificación OpenAPI, sincronizar `app_users.display_name` si es `NULL` al aprobar y asegurar `email_verified_via` en los seeds de prueba.

---

### [BE-07] Asimetrías menores en contratos operativos y auditoría

- **Paginación sin `total`:** `GET /routes` y `GET /couriers` devuelven `{ items, limit, offset }` sin el total de registros; `GET /zones` no soporta paginación.
- **Zonas inactivas ocultas en contrato:** `prisma-zone.repository.ts` retorna `{ id, name, createdAt, updatedAt }` sin `isActive`, aunque el trigger `logistica.guard_order()` rechaza pedidos sobre zonas inactivas (`ZONE_NOT_FOUND_OR_INACTIVE` -> `409`).
- **Endpoints `404` heredados:** `POST /routes/:id/dispatch` y `GET /couriers/:id` no existen en el backend unificado (ya retirados del frontend al eliminar `src/features/dispatch/`).
- **Origen de auditoría en entregas:** `logistica.change_order_status` asigna siempre `logistica.source = 'mobile'` cuando `actor.role = 'repartidor'`, aunque el repartidor opere desde la aplicación web.

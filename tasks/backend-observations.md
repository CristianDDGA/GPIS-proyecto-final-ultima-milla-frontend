# Observaciones del Backend (Solo Documentación)

> [!NOTE]
> Por instrucción explícita, **no se modificó ningún archivo en `GPIS-proyecto-final-ultima-milla-backend`**. Este documento registra los comportamientos y brechas observadas en el backend durante la reconstrucción y verificación en navegador de los roles **Administrador (`personal`)** y **Cliente (`cliente`)**, junto con la mitigación aplicada temporalmente en el frontend cuando correspondía.

## 1. `GET /orders` sin paginación ni `zoneName` poblado

- **Ubicación en backend:** `src/modules/orders/presentation/http/order.controller.ts` (`GET /orders`).
- **Comportamiento observado:**
  1. Devuelve **todos** los registros en un único arreglo JSON sin parámetros `limit`/`offset` ni metadatos `total` (en la base local de pruebas responde con **3,850 pedidos** en una sola petición).
  2. `order.toJSON()` expone `zoneId`, pero **no** incluye `zoneName`.
- **Impacto:** Sobrecarga inicial de red/renderizado en la pestaña **Pedidos** del administrador y visualización previa de UUIDs crudos en la columna de zona.
- **Mitigación aplicada en frontend (sin tocar backend):**
  - Paginación del lado del cliente (`PAGE_SIZE = 15`) en `OrderList.tsx`.
  - Hidratación del nombre legible de la zona cruzando `zoneId` contra el catálogo `zones` ya cargado en memoria.
- **Corrección sugerida a futuro en backend:** Soportar `?limit=&offset=` con `{ items, total, limit, offset }` en `GET /orders` y proyectar `zoneName` mediante `JOIN` en la consulta SQL de lectura.

## 2. `GET /courier-applications/me` responde `200 { application: null }`

- **Ubicación en backend:** `src/modules/courier-applications/presentation/http/application.router.ts`.
- **Comportamiento observado:** Cuando un usuario con rol `cliente` no ha creado ningún borrador de postulación, `GET /courier-applications/me` retorna HTTP `200 OK` con `{ "application": null }`.
- **Impacto previo:** El parser estricto anterior en `courier-applications/infrastructure/http/response.ts` asumía que `data.application` siempre era un objeto no nulo y lanzaba un error de contrato (`"La respuesta del servidor no cumple el contrato de la API."`) al abrir **Ser repartidor** por primera vez.
- **Mitigación aplicada en frontend (sin tocar backend):** Incorporación de `readOptionalApplication` en `response.ts` y retorno explícito de `null` en `httpCourierApplicationGateway.ts#getMine`.

## 3. Endpoints inexistentes (`404`) consumidos por código heredado del frontend

- **Endpoints faltantes observados respecto al flujo previo:**
  - `POST /routes/:id/dispatch`
  - `GET /couriers/:id`
- **Comportamiento en backend:** El despacho real de una ruta hacia un repartidor se realiza mediante `POST /courier-assignments` y la ruta activa de un repartidor se consulta con `GET /couriers/:id/route`.
- **Decisión aplicada en frontend:** Se eliminó por completo el módulo legado `src/features/dispatch/` para no emitir peticiones `404` ni duplicar funcionalidades con `CourierFleetDispatchView`.

## 4. Asimetrías menores de contratos de lectura (`routes`, `couriers`, `zones`)

- **Paginación incompleta:** `GET /routes` y `GET /couriers` devuelven `{ items, limit, offset }` sin el campo `total`; `GET /zones` no soporta paginación.
- **Verificación de correo al postular (`PUT /courier-applications/me`):** El backend devuelve `403 EMAIL_NOT_VERIFIED` si un usuario cliente intenta crear o guardar un borrador de repartidor con una cuenta no verificada (coherente con el dominio, requiere que los usuarios cliente sembrados tengan `email_verified_at` cuando `EMAIL_VERIFICATION_REQUIRED=true`).

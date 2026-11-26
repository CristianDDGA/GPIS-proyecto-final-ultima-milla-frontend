# Millast — Product Truth (`PRODUCT.md`)

## 1. Propósito del producto
**Millast** es una plataforma integral de **logística de última milla y tienda con cobro contra entrega (COD)** operada en Ecuador (Quito, Ambato, Guayaquil, Cuenca, Riobamba y cobertura nacional dentro de `[-5.1..1.5, -92.5..-75.0]`, zona horaria `America/Guayaquil`).

Conecta en una sola consola web (y app Android nativa en `mobile/`) a los **3 roles operativos**:

| Rol | Identificador API | Flujo principal |
| :--- | :--- | :--- |
| **Administrador** | `personal` (`admin`) | Configura zonas, gestiona catálogo/stock/imágenes/franjas de la tienda (`/store/admin/*`), planifica y reordena rutas (`POST /route-plans`), despacha repartidores (`POST /courier-assignments`), monitorea entregas en mapa real, liquida caja COD (`POST /store/admin/cash/settlements`) y aprueba solicitudes de conductores (`/courier-applications`). |
| **Repartidor** | `repartidor` | Gestiona su disponibilidad, ejecuta entregas de su ruta activa con mapa vehicular real (OpenStreetMap + OSRM), registra cobros exactos contra entrega (`POST /store/courier/orders/:id/deliver`) o fallos con motivo cerrado (`.../fail`), consulta su caja diaria (`GET /store/courier/cash`) y cierra rutas (`POST /route-completions`). |
| **Cliente** | `cliente` | Compra en la tienda (`Tienda Millast`) con búsqueda, filtros, ofertas y carrito persistente, ubica su dirección con pin en mapa interactivo de Ecuador (o modo manual), selecciona franjas horarias en vivo, confirma pedidos atómicos idempotentes (`POST /store/orders`), sigue/reprograma/cancela sus compras y puede postularse como repartidor (`Ser repartidor`). |

## 2. Modos de superficie
- **Acceso (`AuthView` — Login / Registro / Verificación / Recuperación / Google Sign-In):** modo híbrido *Brand + Operate* sobre lienzo puro `#ffffff` con emblema WebGL2 Liquid Glass.
- **Consola Autenticada (3 roles — `Tienda`, `Zonas`, `Pedidos`, `Rutas`, `Despacho`, `Entregas`, `Cobros`, `Accesos`):** modo **Operate** puro — precisión, escaneabilidad, control por teclado, baja latencia visual y mapas reales interactivos por encima de la decoración.
- **App Móvil (`mobile/` — React Native 0.84.1 Android):** modo **Operate** nativo con objetivos táctiles `>= 48dp`, navegación por barra inferior por rol, hojas inferiores deslizables y paridad de contratos con el backend.

## 3. Restricciones técnicas y de contrato
- **Zero extra runtime npm dependencies en Web:** `dependencies` en `package.json` conserva únicamente `react` y `react-dom` (WebGL1/2, mapas OpenStreetMap/Esri + OSRM y componentes UI sin librerías de terceros).
- **Integridad monetaria e idempotencia:** todos los precios/cobros se manejan en centavos enteros USD (`*Cents`); operaciones críticas envían `Idempotency-Key` UUID y control de concurrencia optimista (`expectedVersion`).
- **Accesibilidad y rendimiento:** cumplimiento WCAG 2.2 AA (contraste `>= 4.5:1`, *focus trap* en modales, objetivos táctiles seguros, `prefers-reduced-motion` no destructivo y `prefers-contrast: more`).

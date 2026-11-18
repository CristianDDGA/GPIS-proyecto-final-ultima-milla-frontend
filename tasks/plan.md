# Plan de Implementación: Login, Administrador, Cliente y Repartidor — Webflow Studio (`DESIGN (1).md`)

> **Verificación del contrato visual:** Se comprobó por hash SHA-256 (`Get-FileHash`) que `DESIGN.md` en la raíz del repositorio frontend es idéntico byte a byte (`True`) a `c:\Users\Matius\Downloads\DESIGN (1).md`.

## 1. Resumen Ejecutivo

Reconstrucción integral de todos los roles del frontend web (**Acceso**, **Administrador (`personal`)**, **Cliente (`cliente`)** y **Repartidor (`repartidor`)**) en la rama `feature/admin-authkit-phase` siguiendo estrictamente **Webflow — Style Reference** (`DESIGN.md`):

- **Eliminación total de AuthKit y ruido visual:** fuera `authkit-theme.css`, lienzos `#05060f`, acentos violetas `#663af3`, `Space Grotesk`, píldoras `999px`, prefijos `01..06`, etiquetas `Etapa`, `"Modo consulta"` y tarjetas vacías sin datos seleccionados.
- **Tipografía `Inter` estricta (`400`, `500`, `600`):** retirada `JetBrains Mono` de `index.html`, `tokens.css` y vistas operativas; uso consistente de `tabular-nums` en `Inter`.
- **Cobertura completa de los 3 roles:**
  - **Administrador (`personal`):** `Zonas`, `Pedidos` (paginado + zona legible), `Rutas` (con filtro compacto + búsqueda de tardíos acotada + `IsometricCapacityCube`), `Despacho`, `Entregas`, `Accesos` (`Usuarios` + `Solicitudes`).
  - **Cliente (`cliente`):** `Zonas`, `Pedidos`, `Ser repartidor` (borrador, subida binaria JPEG/PNG, vista previa privada, envío y cancelación).
  - **Repartidor (`repartidor`):** `Zonas`, `Pedidos`, `Rutas` (sin botón admin a Despacho y con nombre propio resuelto) y `Entregas` modularizado (`CourierOperationCard`, `DeliveryStopList`, `DeliveryOrderInspectorCard`, precarga de registros de parada, stepper de progreso y manejo honesto de disponibilidad `Por confirmar` ante la brecha de backend).
- **Auditoría documentada sin editar backend:** hallazgos consolidados en [docs/BACKEND_HALLAZGOS_Y_ERRORES.md](../docs/BACKEND_HALLAZGOS_Y_ERRORES.md).

## 2. Fases Completadas

- [x] **Fase 1 (Login Webflow Minimal)**
- [x] **Fase 2 (Administrador Webflow Studio + Eliminación de AuthKit y `404`)**
- [x] **Fase 3 (Portal Cliente + `Ser repartidor`)**
- [x] **Fase 4 (Portal Repartidor `Entregas`/`Rutas` + Eliminación de `403` en `/couriers` + Tope/filtro de tardíos en `Rutas`)**
- [x] **Fase 5 (Prueba E2E en navegador entre los 3 roles y documentación de backend)**

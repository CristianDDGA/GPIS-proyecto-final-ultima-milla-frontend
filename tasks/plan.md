# Plan de Implementación: Consola de Administrador — Sistema Webflow Studio (`DESIGN (1).md`)

> **Verificación del contrato visual:** Se comprobó por hash SHA-256 (`Get-FileHash`) que `DESIGN.md` en la raíz del repositorio frontend es idéntico byte a byte (`True`) a `c:\Users\Matius\Downloads\DESIGN (1).md`.

## 1. Resumen Ejecutivo

Reconstruir la experiencia autenticada del rol **Administrador (`personal`)** en la rama `feature/admin-authkit-phase` siguiendo estrictamente el documento de referencia **Webflow — Style Reference** (`c:\Users\Matius\Downloads\DESIGN (1).md`), **eliminando el 100 % de AuthKit** (`authkit-theme.css`, lienzo oscuro `#05060f`, acento violeta `#663af3`, botones píldora `999px` y fuente `Space Grotesk`), **descartando por completo los endpoints inexistentes (`404`)**, manteniendo las **6 secciones bien ordenadas** (`01 Zonas`, `02 Pedidos`, `03 Rutas`, `04 Despacho`, `05 Entregas`, `06 Accesos`) e incorporando **Tipografía Cinética (`KineticText`)** en cabeceras/transiciones e **Isometría 2.5D (`IsometricCapacityCube`)** exclusivamente donde aporta lectura espacial real (`03 Rutas`).

---

## 2. Verificación contra `c:\Users\Matius\Downloads\DESIGN (1).md`

| Sección de `DESIGN (1).md` | Regla del documento | Implementación aplicada en el rol Administrador |
| :--- | :--- | :--- |
| **§1–2 Paleta y Contraste** | Lienzo primario `#ffffff`, secundario `#f0f0f0`, tinta `#080808` (20:1), secundario `#5a5a5a` (7:1), bordes `#d8d8d8`, un solo acento interactivo `#146ef5` (hover `#1366e2`), estados secundarios `#6ca7ff`, `#60ed76`, `#ffa666`. | Implementado en `src/shared/ui/tokens.css`, `src/bootstrap/styles.css` y hojas de estilo de las 6 secciones. Cero superficies oscuras o violetas de AuthKit. |
| **§3 Tipografía y Escala** | `Inter` (`400`, `500`, `600`, tracking negativo `-0.02em`..`-0.03em`) + `JetBrains Mono` (`"ss02", "ss10", "zero"`, `tabular-nums`, `uppercase`, `letter-spacing: 0.08em`) para índices `01..06`, badges, códigos cortos, fechas y métricas. | Fuente `Space Grotesk` retirada de `index.html`. Cabeceras con **Kinetic Type** (`KineticText` / `SectionHeader` / `KineticHeader`) e índices `01`..`06` en `JetBrains Mono`. |
| **§4 Layout y Espaciado** | Contenedor centrado `max-width: 1200px`, ritmo sobre rejilla de `8px`, mínimo `25%` de lienzo blanco respirable, navegación superior adhesiva de `56px` en `#ffffff` con borde inferior `1px solid #d8d8d8`. | Implementado en `.wf-app-topbar` (`56px`), `.wf-app-nav` y `.wf-app-main` en `src/bootstrap/app.tsx` y `src/bootstrap/styles.css`. |
| **§5–6 Componentes, Bordes y Sombras** | `4px` en botones, inputs, selects, tags y pestañas segmentadas; `8px` en tarjetas y modales. **Cero sombra en tarjetas en reposo** (`border: 1px solid #d8d8d8`); sombra multicapa `--shadow-lg` reservada para modales flotantes. | Aplicado en `Button.css`, `TextInput.css`, `Select.css`, `Card.css`, `Modal.css` y `ShortIdBadge.css`. |

---

## 3. Decisiones Confirmadas de Limpieza y Alcance

1. **Eliminación total de AuthKit:**
   - Eliminado `src/bootstrap/authkit-theme.css` y su importación en `src/bootstrap/main.tsx`.
   - Simplificado `MillastMark.tsx` al emblema geométrico plano en `#146ef5` + `#ffffff`.
2. **Eliminación de endpoints inexistentes (`404`):**
   - Eliminado por completo el módulo fantasma `src/features/dispatch/` (`DispatchManagementView`), que invocaba `POST /routes/:id/dispatch` (`404`) y `GET /couriers/:id` (`404`).
   - La sección **`04 Despacho`** utiliza exclusivamente `CourierFleetDispatchView.tsx` conectada a los 5 endpoints reales del backend (`POST /couriers`, `GET /couriers`, `PATCH /couriers/:id/availability`, `POST /courier-assignments`, `GET /couriers/:id/route`).
3. **Conservación de las 6 secciones bien ordenadas:**
   - La barra superior del Administrador presenta las **6 etapas numeradas en orden secuencial** (`01 Zonas`, `02 Pedidos`, `03 Rutas`, `04 Despacho`, `05 Entregas`, `06 Accesos`) con soporte completo de teclado (`ArrowLeft`, `ArrowRight`, `Home`, `End`) y sincronización URL (`?tab=`).
4. **Kinetic Type e Isometría 2.5D solo donde es necesario:**
   - **Kinetic Type** (`SectionHeader` / `KineticHeader` palabra por palabra + `KineticCounter` tabular) en los encabezados de las 6 secciones, modales e indicadores clave.
   - **Isometría 2.5D (`IsometricCapacityCube`)** mantenida exclusivamente en **`03 Rutas`** (`RouteTable` y `RouteDetailPanel`), donde representa visualmente los cupos ocupados frente a la capacidad límite (`occupiedSlots / capacityLimit`).

---

## 4. Desglose de Tareas Completadas

- [x] **Task 1:** Purgar `authkit-theme.css` y unificar tokens + primitivas UI en Webflow Studio (`DESIGN.md`).
- [x] **Task 2:** Refactorizar el Shell Autenticado (`app.tsx`), `SessionBar` y `ChangePasswordModal` con las 6 secciones ordenadas `01..06`.
- [x] **Task 3:** Refactorizar `AdminAccessView` y descomponer `AdminUserManagementView` (SRP).
- [x] **Task 4:** Refactorizar y modularizar `AdminCourierApplicationsPanel` (`ApplicationReviewInspector`).
- [x] **Task 5:** Limpiar y alinear `01 Zonas` y `02 Pedidos` al estudio Webflow + validaciones de dominio.
- [x] **Task 6:** Refactorizar `03 Rutas` con recepción de `?deliveryDate=` e Isometría 2.5D funcional (`IsometricCapacityCube`).
- [x] **Task 7:** Unificar `04 Despacho` (eliminar `src/features/dispatch/`) y simplificar `05 Entregas`.

# Plan de Implementación: Login, Consola de Administrador y Portal Cliente — Webflow Studio (`DESIGN (1).md`)

> **Verificación del contrato visual:** Se comprobó por hash SHA-256 (`Get-FileHash`) que `DESIGN.md` en la raíz del repositorio frontend es idéntico byte a byte (`True`) a `c:\Users\Matius\Downloads\DESIGN (1).md`.

## 1. Resumen Ejecutivo

Reconstruir las experiencias de **Acceso (Login/Registro/Recuperación)**, **Administrador (`personal`)** y **Cliente (`cliente`)** en la rama `feature/admin-authkit-phase` siguiendo estrictamente **Webflow — Style Reference** (`DESIGN.md`):

- **Eliminación total de AuthKit:** fuera `authkit-theme.css`, lienzo oscuro `#05060f`, acento violeta `#663af3`, botones píldora `999px` y fuente `Space Grotesk`.
- **Tipografía estricta según `DESIGN.md`:** **`Inter` (`400`, `500`, `600`)** como fuente única de toda la interfaz (sin `JetBrains Mono` ni fuentes monoespaciadas en cabeceras `<th>`, etiquetas `<dt>`, badges, fechas, paginación, códigos cortos o códigos OTP).
- **Limpieza visual de secciones:** eliminada por completo toda numeración innecesaria (`01..06` en barra superior y etiquetas `Etapa 01..06` / `Etapa 03a` / `Etapa 03b`) y mensajes redundantes (`Modo consulta` en rol cliente). Las 6 vistas de administrador se mantienen ordenadas (`Zonas`, `Pedidos`, `Rutas`, `Despacho`, `Entregas`, `Accesos`) y el cliente accede a 3 secciones (`Zonas`, `Pedidos`, `Ser repartidor`).
- **Kinetic Type + Isometría 2.5D con criterio:** **Tipografía Cinética (`KineticText`)** en cabeceras/modales e **Isometría 2.5D (`IsometricCapacityCube`)** solo en `Rutas` (`occupiedSlots / capacityLimit`).
- **Cero endpoints inexistentes (`404`) y documentación de hallazgos de backend:** eliminado `src/features/dispatch/`; observaciones del backend registradas sin modificar el repositorio backend en `tasks/backend-observations.md`.

---

## 2. Verificación contra `c:\Users\Matius\Downloads\DESIGN (1).md`

| Sección de `DESIGN (1).md` | Regla del documento | Implementación aplicada |
| :--- | :--- | :--- |
| **§1–2 Paleta y Contraste** | Lienzo primario `#ffffff`, secundario `#f0f0f0`, tinta `#080808` (20:1), secundario `#5a5a5a` (7:1), bordes `#d8d8d8`, un solo acento interactivo `#146ef5` (hover `#1366e2`). | Implementado en `src/shared/ui/tokens.css`, `src/bootstrap/styles.css` y hojas de estilo por feature. |
| **§3 Tipografía y Escala** | **`Inter`** (`400`, `500`, `600`; pesos medios/semibold sin `700`, tracking negativo en titulares) como sustituto de `WF Visual Sans Variable`. | Retiradas `Space Grotesk` y `JetBrains Mono` de `index.html`, `tokens.css` y componentes; `tabular-nums` en `Inter` para métricas/códigos. |
| **§4 Layout y Espaciado** | Contenedor centrado `max-width: 1200px`, rejilla de `8px`, mínimo `25%` de lienzo blanco respirable, barra superior adhesiva de `56px` en `#ffffff` con borde `1px solid #d8d8d8`. | `.wf-app-topbar` (`56px`), `.wf-app-nav` sin numeración ni pasos artificiales, `.wf-app-main`. |
| **§5–6 Componentes, Bordes y Sombras** | `4px` en botones, inputs, selects, tags y pestañas segmentadas; `8px` en tarjetas y modales. Cero sombra en tarjetas en reposo (`border: 1px solid #d8d8d8`). | `Button.css`, `TextInput.css`, `Select.css` (flecha nativa única), `Card.css`, `Modal.css`, `ShortIdBadge.css`. |

---

## 3. Desglose de Fases Completadas

- [x] **Fase 1 (Login Webflow Minimal):** Modularización SRP, slogan + escultura isométrica sin ruido visual, Kinetic Type, cero barras de desplazamiento.
- [x] **Fase 2 (Admin Webflow Studio):** Eliminación total de `authkit-theme.css`, eliminación de `src/features/dispatch/` (`404`), 6 secciones ordenadas sin numeración `01..06` ni etiquetas `Etapa`, `IsometricCapacityCube` solo en `Rutas`, tipografía `Inter` pura, paginación (`15`/página) y nombres legibles de zona en `Pedidos`.
- [x] **Fase 3 (Portal Cliente `cliente`):**
  - `Zonas`: vista de consulta limpia (sin banner de "Modo consulta").
  - `Pedidos`: listado de pedidos propios sin botones de administrador (`Planificar en Rutas`) ni estado crudo visible.
  - `Ser repartidor`: flujo completo (`useMyCourierApplication`, `ClientApplicationFormCard`, `ClientApplicationDocumentsCard`, `ClientCourierApplicationView`), tolerante a `GET /courier-applications/me` -> `200 { application: null }`.
- [x] **Fase 4 (Correcciones finales de pulido y documentación):**
  - Flecha única nativa en `<Select>` (`Select.tsx` / `Select.css`) y ajuste de ancho en filtros (`Todos los estados` en una sola línea).
  - Cierre de sesión `Salir` sin `401` espurios al limpiar estado después de completar `auth.logout()`.
  - Documentación de hallazgos backend en `tasks/backend-observations.md`.

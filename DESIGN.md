# Millast — Sistema Visual Oficial (`DESIGN.md`)
> **Millast Waterline Porcelain:** una sola arquitectura visual coherente desde el Login hasta los 3 roles (Administrador, Repartidor y Cliente), con azul operativo `#1668f3`, `0 fps` exactos en reposo y mapas interactivos estilo Uber.

**Tema:** light (alto contraste operativo)  
**Superficies:** Web (`src/`, modo *Operate*) + Android React Native (`mobile/`, paleta y geometría táctil alineadas)

---

## 1. Principios de Arquitectura Visual
1. **Identidad 100% unificada (Login + 3 Roles):**
   - **Acceso (`AuthView`):** mismo lienzo Waterline `#e8f0f9` sin barra superior ni indicadores de estado, emblema espectral WebGL2 (`GlassIconReveal` en reproducción 1-shot con clic para repetir), tarjeta Porcelain `26px`, pestañas y botones píldora `999px` e inputs `15px`.
   - **Consola Autenticada (`.wl-dashboard`):** barra superior flotante de cápsula única (`UnifiedWaterlineNavbar`), cabecera estándar `<PageHeader>` y banda de métricas `<KpiStrip>` en todas las vistas de **Administrador**, **Repartidor** y **Cliente**.
2. **Waterline Porcelain (alto rendimiento GPU):**
   - Las tarjetas en flujo (`.ui-card`, `.wf-toolbar`, `.route-map-shell`, `.route-map-dock`, `.wf-modal`) usan superficies sólidas limpias (`rgba(255, 255, 255, 0.92–0.97)` + borde especular + `contain: layout style`), eliminando el apilamiento de `backdrop-filter: blur(22–28px)`.
   - `backdrop-filter: blur(14px)` se reserva exclusivamente para la barra superior sticky (`.nimbus-glass`) y el fondo del modal (`.wf-modal-backdrop`).
3. **Presupuesto de GPU y velocidad (`0 fps` en reposo):**
   - `LiquidLavaBackground`: escala `0.45×` (máx. `960×540`), FBM de 2 octavas, tope `30fps` al mover el puntero y **Sleep-on-Idle** (`data-raf-active="false"` cuando no hay interacción, en touch, pestaña oculta o modal abierto).
   - `UnifiedWaterlineNavbar`: sin filtros SVG `<feTurbulence>`, buffers `Float32Array` preasignados y suspensión total de `rAF` en reposo (`data-raf-active="false"`).
   - **Code-Splitting:** las 11 vistas de dominio se cargan mediante `React.lazy()` + `<Suspense fallback={<ModuleFallbackSkeleton />}>`.
4. **Cero antipatrones de *slop* y cero degradados CSS en botones/superficies:** sin barras laterales de acento, sin texto degradado, sin rebotes elásticos y sin encabezados duplicados.

---

## 2. Tokens de Color (Semánticos y WCAG AA/AAA)

| Rol | Valor | Token CSS | Uso |
| :--- | :--- | :--- | :--- |
| **Brand Blue** | `#1668f3` | `--wl-brand` / `--color-primary` | CTAs primarios, foco, pestaña activa, trazado de ruta en mapa |
| **Brand Hover** | `#0e56d6` | `--wl-brand-hover` | Estado hover de botones primarios (solo puntero fino) |
| **Brand Active Text** | `#0b49c6` | `--wl-brand-active` | Texto azul de alto contraste sobre superficies claras (`>= 6.8:1`) |
| **Ink Primary** | `#0b132b` | `--wl-ink` / `--text-primary` | Títulos, datos principales, HUD oscuro de mapa y etiquetas (`>= 16:1`) |
| **Ink Soft** | `#334155` | `--wl-ink-soft` / `--text-secondary` | Subtítulos, encabezados de tabla, texto secundario (`>= 8.5:1`) |
| **Ink Muted** | `#475569` | `--wl-ink-muted` | Metadatos y placeholders (`>= 6.2:1`) |
| **Canvas Waterline** | `#e8f0f9` | `--wl-canvas` | Fondo unificado de Login y consola autenticada |
| **Porcelain Surface** | `rgba(255, 255, 255, 0.92)` | `--wl-glass-tint` | Tarjetas principales (`.ui-card`) con `contain: layout style` |
| **Porcelain Subcard** | `rgba(255, 255, 255, 0.96)` | `--wl-glass-subcard` | Subtarjetas, KPIs y dock de mapa |
| **Success** | `#15803d` / `#eefbf1` | `--color-success` | Entregado, disponible, cobro confirmado |
| **Warning / Pending** | `#b45309` / `#fff6ed` | `--color-warning` | Pendiente, stock bajo, cupos limitados |
| **Danger** | `#dc2626` / `#fef2f2` | `--color-error` | Cancelado, entrega fallida, agotado, errores |

---

## 3. Primitivos Canónicos de Dashboard y Carga
- **`<PageHeader />`:** título único (`28px` escritorio / `22px` móvil), subtítulo descriptivo, etiqueta eyebrow y slot de acciones a la derecha.
- **`<KpiStrip />`:** 3 a 4 tarjetas KPI uniformes con `font-variant-numeric: tabular-nums` y tonos semánticos (`neutral | blue | green | amber | red`).
- **Suite de Skeletons GPU (`CLS = 0`):** `AppBootSkeleton`, `ModuleFallbackSkeleton`, `KpiStripSkeleton`, `TableRowsSkeleton`, `ProductGridSkeleton`, `StopCardsSkeleton`, `MapCanvasSkeleton` y `TopRefetchBar`. Animan únicamente `transform: translate3d(...)` para nunca disparar repaints.

---

## 4. Mapas Interactivos Estilo Uber (`RouteStopsMap` & `EcuadorMapPicker`)
- **Cero dependencias npm y cero API keys de pago:** teselas OpenStreetMap + Esri World Imagery + OSRM público (con caché LRU acotada a 40 rutas) + Nominatim.
- **Estilo predeterminado `Uber` (`Uber | Calles | Satélite`):** grading GPU de alto contraste plateado sobre teselas OSM para que la ruta dual (`#0b132b` + `#ffffff` + `#1668f3`), las flechas direccionales, el puck vehicular y los pines resalten al instante.
- **Arrastre 60–120fps sin re-renders:** escenario único `.route-map-stage` trasladado por `translate3d` dentro de `rAF` y commit al soltar o superar el umbral de teselas.
- **Controles y seguimiento:** HUD flotante de ETA/km y avance, dock inferior navegable (`‹` / `›`) con accesos directos a **Google Maps**, **Waze** y **OSM**, botón `Mi ubicación` (validado en Ecuador), expansión de viewport (`380px ↔ 560px`), física de elevación del pin en `EcuadorMapPicker` y barra de progreso en 4 etapas estilo Uber Eats en el detalle de pedido del cliente.

---

## 5. Sistema de Movimiento (Filosofía Emil Kowalski)
| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--ease-out` | `cubic-bezier(0.23, 1, 0.32, 1)` | Entradas, popovers, cambio de panel, feedback `:active` |
| `--ease-in-out` | `cubic-bezier(0.77, 0, 0.175, 1)` | Desplazamiento en pantalla (`.segmented__thumb`, barras) |
| `--ease-drawer` | `cubic-bezier(0.32, 0.72, 0, 1)` | Modales y hojas inferiores |
| `--duration-press` | `140ms` | Confirmación táctil `:active { transform: scale(0.97) }` |
| `--duration-ui` | `180ms` | Pestañas, popovers, toggles y micro-transiciones (`< 300ms`) |
| `--duration-overlay` | `220ms` | Apertura/cierre de modales y alertas |

**Reglas innegociables:** cero animación al navegar con teclado, únicamente propiedades de compositor (`transform`, `opacity`, `clip-path`), `:hover` protegido por `@media (hover: hover) and (pointer: fine)` y `prefers-reduced-motion` no destructivo.

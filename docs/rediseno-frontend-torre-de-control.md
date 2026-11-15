# Rediseño de interfaz · Torre de Control de Última Milla

Rama: `feature/frontend-redesign-apple-hig`
Alcance: **solo frontend** (`GPIS-proyecto-final-ultima-milla-frontend`). No se modifica el
backend, los contratos de los 27 endpoints ni los casos de uso.

## Qué cambia

### 1. Seguridad de interfaz
- Se elimina `QUICK_ACCOUNTS` y `AUTH_ENDPOINTS` de `AuthView`: la pantalla pública ya no
  precarga contraseñas ni enumera rutas internas de la API.
- Se eliminan los títulos con jerga HTTP (`POST /route-plans`, `GET /routes/:id`,
  `/auth/me`, `NO_AVAILABLE_COURIER`) de la barra de sesión, administración de usuarios,
  planificador de rutas, pedidos tardíos y detalle de ruta.
- Los UUID de 36 caracteres dejan de exigirse al operador: el inspector de entregas se activa
  con un clic sobre la parada y las tablas muestran códigos cortos (`#PED-8A2F`, `#RUT-…`,
  `#ZON-…`) con el identificador completo en el tooltip y copia al portapapeles.

### 2. Sistema de diseño
- `src/shared/ui/tokens.css`: paleta semántica auditada (contrastes AAA/AA), materiales
  Liquid Glass, escala tipográfica tipo Apple Dynamic Type y curvas de resorte; conserva los
  tokens `--color-*` como alias para no romper los estilos previos.
- Tipografía: `Plus Jakarta Sans` para UI y `JetBrains Mono` con `tabular-nums` para
  telemetría, capacidades y códigos.
- Soporte explícito de `prefers-reduced-motion`, `prefers-reduced-transparency` y
  `prefers-contrast`.

### 3. Liquid Glass (dos capas)
- **Capa funcional flotante** translúcida con `backdrop-filter: blur(24px) saturate(145%)`:
  dock superior de navegación, cápsula de sesión, barra de filtros y panel de progreso.
- **Capa de contenido sólida** para tablas, formularios y tarjetas: el desenfoque nunca se
  apila sobre celdas ni campos de texto.
- Píldora activa con *Liquid Morph* (física de resorte) en el dock, el selector de acceso y
  el filtro de disponibilidad de flota.

### 4. Tipografía cinética
- `KineticHeader` revela los títulos palabra por palabra (220 ms, easing expo) al cambiar de
  etapa; `KineticCounter` interpola los KPI operativos con efecto odómetro.
- `KineticCounter` muestra en cabecera zonas, pedidos pendientes y repartidores disponibles.

### 5. Diseño isométrico 3D/SVG
- `IsometricLogisticsHub`: centro de distribución urbano en perspectiva 2.5D con rutas
  animadas y nodos que reaccionan al estado real del servidor (online / checking / offline).
  Se usa en la portada de acceso.
- `IsometricCapacityCube`: ranuras isométricas de ocupación de ruta coloreadas por estado
  (`planificada`, `asignada`, `en_curso`, `completada`) en planificación, tabla de rutas,
  despacho, entregas y detalle de zona.

### 6. Flujo operativo end-to-end
- Dock numerado con las 5 etapas del negocio (Cobertura → Demanda → Planificación → Despacho →
  Última milla) más Administración de accesos, ordenado por pipeline para todos los roles.
- Encabezado global con `Paso N de 5`, KPIs cinéticos y pista de flujo navegable.
- Zonas: vista **Master-Detail** con panel de cobertura, demanda asociada y CTA
  «Ver pedidos de esta zona».
- Pedidos: detalle con línea de tiempo de estado, barra de filtros Liquid Glass y CTA
  «Ir a planificar rutas de esta fecha».
- Rutas: repartidor resuelto a nombre real, cubo isométrico de cupos, filas interactivas y
  confirmación explícita de la acción destructiva «Cancelar ruta».
- Despacho: selectores con fecha + zona + cupos, capacidad visual y hoja de ruta activa con
  cubo isométrico.
- Entregas: barra de progreso isométrica y paradas inspeccionables con un clic.

## Compatibilidad preservada

- Parámetros de URL `?tab=…&deliveryDate=…&zoneId=…&orderId=…` y navegación atrás/adelante.
- Selectores y textos exigidos por Cypress: `#filter-date`, `#filter-zone`, `Filtrar`,
  `Limpiar filtros`, `Volver al listado`, `Detalle del pedido`, `Pedido no encontrado`,
  `Sin coincidencias para los filtros activos` y el `<dl>` del detalle con el UUID completo.
- Roles ARIA de las pestañas y navegación con teclado (←/→/Home/End).

## Verificación

```powershell
npm run typecheck
npm run build
```

Ambos comandos finalizan sin errores. La verificación visual se realizó con el servidor de
Vite y los tres roles (Administrador, Repartidor, Cliente), además de anchos de 1536 px y
390 px. Para el recorrido E2E con datos reales se requiere el backend y PostgreSQL locales
(`docker compose` en `db-proyecto`), que no estaban activos durante la revisión.

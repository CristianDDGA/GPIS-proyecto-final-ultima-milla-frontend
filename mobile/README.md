# Millast · Aplicación móvil Android

Aplicación React Native Android para operación logística de última milla de Millast, adaptada con el sistema visual Webflow Studio (`DESIGN.md`), navegación móvil por pestañas inferiores y selectores tipo *bottom sheet*.

## Roles soportados

- **Autenticación**: Inicio de sesión, registro de clientes, verificación por código, recuperación/cambio de contraseña y selector de servidor API (`http://10.0.2.2:3000` por defecto en emulador Android).
- **Cliente (`cliente`)**: Pestañas `Zonas`, `Pedidos` (consulta con detalle en línea de tiempo y registro) y `Ser repartidor` (borrador, subida binaria de foto/licencia desde galería Android nativa y envío a revisión).
- **Repartidor (`repartidor`)**: Pestañas `Entregas` (disponibilidad explícita, ruta activa precargada, transiciones de parada y cierre de ruta), `Rutas`, `Pedidos` y `Zonas`.
- **Administrador (`personal`)**: Pestañas `Zonas`, `Pedidos`, `Rutas` (capacidad isométrica, reordenamiento, movimiento y cancelación), `Despacho` y menú `Más` (`Entregas` y `Accesos`: usuarios + solicitudes).

## Verificación local

```powershell
npm ci
npm run typecheck
npm run lint
npx jest --watchAll=false
adb reverse tcp:3000 tcp:3000
npm run android
```

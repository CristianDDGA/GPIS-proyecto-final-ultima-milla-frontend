# Reinicio y siembra del entorno local (solo Windows / PowerShell)

Script de apoyo para dejar la base de datos local lista para probar el sistema completo
(PostgreSQL en Docker con migraciones 001..006, datos demo y las 4 cuentas de prueba con
contraseñas Scrypt).

> [!WARNING]
> `docker compose down -v` **elimina el volumen `logistica_postgres_data`** y con él todos los
> datos locales (zonas, pedidos, rutas, usuarios creados durante las pruebas). Úsalo solo
> cuando quieras volver al estado inicial de demostración.

## Uso

```powershell
Set-Location "C:\Users\Matius\Desktop\Universidad\GESTION\proyectofinal\GPIS-proyecto-final-ultima-milla\GPIS-proyecto-final-ultima-milla-frontend\docs\verificacion"
pwsh -NoProfile -File .\reiniciar-entorno.ps1
```

Para reiniciar sin borrar datos (solo volver a aplicar migraciones y semillas):

```powershell
pwsh -NoProfile -File .\reiniciar-entorno.ps1 -KeepData
```

El script termina mostrando las 4 cuentas sembradas y el conteo de pedidos por estado.

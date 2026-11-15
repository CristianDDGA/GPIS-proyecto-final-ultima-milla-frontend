# Reinicia (opcionalmente) y siembra el entorno local de demostración.
#
# Uso normal (borra el volumen de datos y vuelve al estado inicial):
#   pwsh -NoProfile -File .\reiniciar-entorno.ps1
# Conservando datos existentes (solo migra y re-siembra):
#   pwsh -NoProfile -File .\reiniciar-entorno.ps1 -KeepData
[CmdletBinding()]
param(
    [switch]$KeepData
)

$ErrorActionPreference = 'Stop'

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$projectRoot = (Resolve-Path (Join-Path $frontendRoot '..')).Path
$dbDirectory = Join-Path $projectRoot 'db-proyecto'
$seedSql = Join-Path $PSScriptRoot 'sembrar-usuarios-prueba.sql'

if (-not (Test-Path (Join-Path $dbDirectory 'compose.yaml'))) {
    throw "No se encontró db-proyecto/compose.yaml en: $dbDirectory"
}

if (-not (Test-Path $seedSql)) {
    throw "No se encontró el SQL de siembra: $seedSql"
}

Write-Host '== Docker ==' -ForegroundColor Cyan
docker info --format 'Docker daemon {{.ServerVersion}} disponible' | Out-Host

Push-Location $dbDirectory
try {
    if ($KeepData) {
        Write-Host '== Conservando el volumen de datos existente ==' -ForegroundColor Yellow
        docker compose up -d --wait postgres
    }
    else {
        Write-Host '== Recreando el contenedor y el volumen de datos ==' -ForegroundColor Yellow
        docker compose down -v --remove-orphans
        docker compose up -d --wait postgres
    }

    if ($LASTEXITCODE -ne 0) {
        throw 'No se pudo levantar el contenedor de PostgreSQL.'
    }

    Write-Host '== Migraciones SQL 001..006 ==' -ForegroundColor Cyan
    docker compose exec -T postgres sh /workspace/database/scripts/migrate.sh

    Write-Host '== Semilla demo (db-proyecto/database/seeds/demo.sql) ==' -ForegroundColor Cyan
    docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U logistica_admin -d logistica -f /workspace/database/seeds/demo.sql

    Write-Host '== Cuentas de prueba con contraseñas Scrypt ==' -ForegroundColor Cyan
    docker compose cp $seedSql 'postgres:/tmp/sembrar-usuarios-prueba.sql'
    docker compose exec -T postgres psql -X -v ON_ERROR_STOP=1 -U logistica_admin -d logistica -f /tmp/sembrar-usuarios-prueba.sql

    Write-Host ''
    Write-Host 'Entorno local listo. Cuentas de prueba:' -ForegroundColor Green
    Write-Host '  admin@logistica.local        Admin1234!        (rol personal / Administrador)'
    Write-Host '  repartidor1@logistica.local  Repartidor1234!  (rol repartidor, Repartidor Demo 1)'
    Write-Host '  repartidor2@logistica.local  Repartidor1234!  (rol repartidor, Repartidor Demo 2)'
    Write-Host '  cliente@logistica.local      Cliente1234!      (rol cliente)'
    Write-Host ''
    Write-Host 'Siguiente paso: levantar el backend en :3000 y el frontend en 127.0.0.1:5173.' -ForegroundColor Green
}
finally {
    Pop-Location
}

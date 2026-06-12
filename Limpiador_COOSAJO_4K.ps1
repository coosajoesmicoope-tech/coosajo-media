# Cierra la aplicación si está corriendo
Write-Host "Cerrando COOSAJO 4K..." -ForegroundColor Yellow
Stop-Process -Name "COOSAJO 4K" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "coosajo-signage-live" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Eliminar carpetas de instalación y caché viejo
Write-Host "Eliminando archivos viejos y cachés pesados..." -ForegroundColor Yellow

$localAppData = [Environment]::GetFolderPath('LocalApplicationData')
$appData = [Environment]::GetFolderPath('ApplicationData')

$pathsToDelete = @(
    "$localAppData\Programs\COOSAJO 4K",
    "$localAppData\coosajo-signage-live-updater",
    "$appData\coosajo-signage-live",
    "$appData\COOSAJO 4K"
)

foreach ($path in $pathsToDelete) {
    if (Test-Path $path) {
        Remove-Item -Path $path -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Eliminado: $path" -ForegroundColor Green
    }
}

# Limpiar registros de versiones anteriores (v9, v10, v11)
Write-Host "Limpiando huellas del registro de Windows..." -ForegroundColor Yellow
$registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"

if (Test-Path $registryPath) {
    Get-ChildItem -Path $registryPath | ForEach-Object {
        $item = Get-ItemProperty -Path $_.PSPath
        if ($item.DisplayName -match "COOSAJO 4K") {
            Remove-Item -Path $_.PSPath -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "Registro de Panel de Control eliminado." -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "LIMPIEZA COMPLETADA CON ÉXITO." -ForegroundColor Cyan
Write-Host "Ya puedes instalar el Setup 1.0.28 de forma limpia." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
pause

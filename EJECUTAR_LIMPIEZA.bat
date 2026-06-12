@echo off
title Limpiador de COOSAJO 4K
color 0A
echo Iniciando el Limpiador Profundo de versiones anteriores...
echo Por favor concede permisos de administrador si te lo pide.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Limpiador_COOSAJO_4K.ps1"

exit

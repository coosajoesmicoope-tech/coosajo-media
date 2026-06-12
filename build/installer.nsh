!macro customInit
  ; Matar forzosamente cualquier instancia de la app que esté corriendo para evitar el error de "archivo en uso"
  nsExec::ExecToStack 'taskkill /F /IM "COOSAJO 4K.exe"'
  nsExec::ExecToStack 'taskkill /F /IM "coosajo-signage-live.exe"'
  ; Darle 1 segundo al sistema para liberar los archivos
  Sleep 1000
!macroend

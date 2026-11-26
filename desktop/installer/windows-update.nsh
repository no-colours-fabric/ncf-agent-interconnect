; Check before the previous uninstaller is invoked. Client-owned MCP processes
; can survive the hub's Quit action and must not be force-killed by image name.
!macro customCheckAppRunning
  InitPluginsDir
  File /oname=$PLUGINSDIR\ncf-update-preflight.exe "${PROJECT_DIR}\build\assets\ncf-update-preflight.exe"
  ${Do}
    nsExec::ExecToStack /TIMEOUT=40000 '"$PLUGINSDIR\ncf-update-preflight.exe" "$INSTDIR"'
    Pop $R0
    Pop $R1
    ${If} $R0 == 0
      ${ExitDo}
    ${EndIf}
    ${If} $R1 == ""
      StrCpy $R1 "Close NCF Agent Interconnect from its tray menu and close connected applications before updating. Setup could not inspect background integrations. No installed files have been removed."
    ${EndIf}
    ${If} ${Silent}
      SetErrorLevel 20
      Quit
    ${EndIf}
    MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$R1" /SD IDCANCEL IDRETRY +2
    Quit
  ${Loop}
!macroend

; Resume only an already enabled service after the replacement is complete.
!macro customInstall
  nsExec::ExecToStack /TIMEOUT=30000 '"$INSTDIR\NCF Agent Interconnect.exe" --chatgpt-service'
  Pop $R0
  Pop $R1
!macroend

; A normal uninstall removes only the service's own selector. An update retains
; that explicit selection and resumes it from the newly installed source.
!macro customUnInstall
  ${IfNot} ${isUpdated}
    nsExec::ExecToStack /TIMEOUT=30000 '"$INSTDIR\NCF Agent Interconnect.exe" --chatgpt-service-disable'
    Pop $R0
    Pop $R1
    ${If} $R0 != 0
      ${IfNot} ${Silent}
        MessageBox MB_OK|MB_ICONEXCLAMATION "Close ChatGPT and retry uninstalling NCF Agent Interconnect. No installed files have been removed."
      ${EndIf}
      Abort
    ${EndIf}
  ${EndIf}
!macroend

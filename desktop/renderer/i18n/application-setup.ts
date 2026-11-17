import type { Locale } from './index.js';

const en = {
  openCodeV1Description:
    'Configure OpenCode v1 for “NCF Agent Interconnect”. OpenCode v2 has separate settings.',
  openCodeV2Description:
    'Configure OpenCode v2 for “NCF Agent Interconnect”. Only the selected configuration file will change; provider and account settings stay as they are.',
  openCodeV2Next:
    'Restart OpenCode v2, then connect from the intended chat using the request below.',
  openCodeProfile: 'OpenCode profile',
  selectedInstallation: 'Selected installation',
  showOpenCodeV1: 'Show OpenCode v1',
  applications: 'Applications',
  intro: 'Connect automatically or configure an app manually',
  startupTitle: 'Connect your apps',
  startupHelp: 'Choose the apps you use. NCF Agent Interconnect will add its integration.',
  savedHelp: 'Settings are saved. Follow the next step in each app, or continue configuring here.',
  readyHelp:
    'You can continue working in your connected chats. You can also configure more apps here.',
  continue: 'Continue to NCF Agent Interconnect',
  returnHelp: 'You can return to Applications from the sidebar at any time.',
  later: 'Not now',
  yourApps: 'Your apps',
  detectionHelp: 'Detection only enables automatic setup. Manual setup is always available.',
  detected: 'Detected on this computer',
  automaticUnavailable: 'Automatic setup unavailable',
  newApps: 'Newly detected apps will appear here',
  manual: 'Manual setup',
  back: 'Back to Applications',
  connecting: 'Connecting…',
  retry: 'Try again',
  confirmTitle: 'Confirm configuration changes',
  confirmHelp:
    'An existing NCF entry needs to be replaced. Review the selected file before applying.',
  reviewHelp:
    'Settings or the selected target have changed. Review this new preview before applying.',
  failed: 'Setup could not be completed. Try again or use manual setup.',
  uncertain:
    'The result is not confirmed. Retry checks the same setup attempt; it does not start a new one.',
  details: 'Setup details',
  copyFailed: 'Could not copy the text. Try again.',
  checkSetupResult: 'Check setup result',
  aionUiName: 'AionUi with Cursor Agent',
  nextStep: 'Next step',
  confirmQuestion: 'What may I need to confirm?',
  confirmAnswer:
    'Sign in, trust the workspace and approve client prompts when requested. Moving an occupied agent name needs your approval.',
  reloadQuestion: 'After Apply or an update?',
  claudeReload:
    'Reload the NCF plugins and reconnect MCP in this same chat. If verification is still lost, fully quit and reopen the client.',
  cursorReload: 'Restart Cursor, then send one message in the intended chat to restore delivery.',
  permissionsQuestion: 'Can I save permissions?',
  permissionsAnswer:
    'In /permissions, allow only the NCF tools you want: agent_read, agent_connect and agent_send. Existing deny/ask rules still apply.',
};
export type ApplicationSetupMessages = { [K in keyof typeof en]: string };

const translations: Record<Locale, ApplicationSetupMessages> = {
  en,
  ru: {
    openCodeV1Description:
      'Настройте OpenCode v1 для «NCF Agent Interconnect». У OpenCode v2 отдельные настройки.',
    openCodeV2Description:
      'Настройте OpenCode v2 для «NCF Agent Interconnect». Изменения затронут только выбранный файл конфигурации; настройки провайдеров и аккаунтов сохранятся.',
    openCodeV2Next:
      'Перезапустите OpenCode v2, затем используйте приведённую ниже просьбу в нужном чате, чтобы подключить помощника.',
    openCodeProfile: 'Профиль OpenCode',
    selectedInstallation: 'Выбранная копия программы',
    showOpenCodeV1: 'Показать OpenCode v1',
    applications: 'Приложения',
    intro: 'Подключите приложение автоматически или настройте вручную',
    startupTitle: 'Подключите свои приложения',
    startupHelp:
      'Выберите приложения, которыми пользуетесь. NCF Agent Interconnect добавит свою интеграцию.',
    savedHelp:
      'Настройки сохранены. Выполните следующий шаг в каждом приложении или продолжите настройку здесь.',
    readyHelp:
      'Можно продолжать работу в подключённых чатах. При желании настройте здесь другие приложения.',
    continue: 'Перейти в NCF Agent Interconnect',
    returnHelp: 'К настройке всегда можно вернуться через «Приложения» в боковой панели.',
    later: 'Не сейчас',
    yourApps: 'Ваши приложения',
    detectionHelp:
      'Обнаружение позволяет предложить автоматическую настройку. Ручная настройка доступна всегда.',
    detected: 'Обнаружено на этом компьютере',
    automaticUnavailable: 'Автоматическая настройка недоступна',
    newApps: 'Здесь будут появляться новые обнаруженные приложения',
    manual: 'Настроить вручную',
    back: 'К приложениям',
    connecting: 'Подключение…',
    retry: 'Повторить',
    confirmTitle: 'Подтвердите изменение настроек',
    confirmHelp:
      'Существующую запись NCF нужно заменить. Проверьте выбранный файл перед применением.',
    reviewHelp: 'Настройки или выбранный файл изменились. Проверьте новый план перед применением.',
    failed: 'Не удалось завершить настройку. Повторите попытку или настройте вручную.',
    uncertain:
      'Результат не подтверждён. Повторная попытка проверит тот же запрос настройки, не создавая новый.',
    details: 'Подробности настройки',
    copyFailed: 'Не удалось скопировать текст. Повторите попытку.',
    checkSetupResult: 'Проверить результат прежней попытки',
    aionUiName: 'AionUi с Cursor Agent',
    nextStep: 'Следующий шаг',
    confirmQuestion: 'Что может потребовать моего подтверждения?',
    confirmAnswer:
      'Вход в аккаунт, доверие к папке и разрешения клиента. Перенос занятого имени агента требует вашего подтверждения.',
    reloadQuestion: 'Что делать после применения настроек или обновления?',
    claudeReload:
      'Перезагрузите плагины NCF и переподключите MCP в этом же чате. Если проверка связи не восстановилась, полностью выйдите из клиента и откройте его снова.',
    cursorReload:
      'Перезапустите Cursor, затем отправьте одно сообщение в нужном чате для восстановления доставки.',
    permissionsQuestion: 'Можно ли сохранить разрешения?',
    permissionsAnswer:
      'В /permissions разрешите только нужные инструменты NCF: agent_read, agent_connect и agent_send. Правила запрета и обязательного подтверждения сохраняют приоритет.',
  },
  'zh-CN': {
    openCodeV1Description:
      '为“NCF Agent Interconnect”配置 OpenCode v1。OpenCode v2 使用独立的设置。',
    openCodeV2Description:
      '为“NCF Agent Interconnect”配置 OpenCode v2。只会修改选定的配置文件，提供商和账户设置保持不变。',
    openCodeV2Next: '重启 OpenCode v2，然后在要连接的聊天中使用下方的请求，让助手连接。',
    openCodeProfile: 'OpenCode 配置方案',
    selectedInstallation: '选定的安装实例',
    showOpenCodeV1: '显示 OpenCode v1',
    applications: '应用',
    intro: '自动连接应用，或手动配置',
    startupTitle: '连接你的应用',
    startupHelp: '选择你使用的应用。NCF Agent Interconnect 将添加集成配置。',
    savedHelp: '设置已保存。请在各应用中完成下一步，或继续在此配置。',
    readyHelp: '你可以在已连接的聊天中继续工作，也可以在此配置更多应用。',
    continue: '进入 NCF Agent Interconnect',
    returnHelp: '你随时可以通过侧边栏返回“应用”。',
    later: '暂不设置',
    yourApps: '你的应用',
    detectionHelp: '检测结果仅用于提供自动配置。你始终可以手动配置。',
    detected: '已在此计算机上检测到',
    automaticUnavailable: '无法自动配置',
    newApps: '新检测到的应用将显示在此处',
    manual: '手动配置',
    back: '返回应用',
    connecting: '正在连接…',
    retry: '重试',
    confirmTitle: '确认配置更改',
    confirmHelp: '需要替换现有 NCF 条目。应用前请检查所选文件。',
    reviewHelp: '设置或所选目标已更改。应用前请检查新的预览。',
    failed: '未能完成配置。请重试或手动配置。',
    uncertain: '结果尚未确认。重试会检查同一次配置请求，不会发起新的请求。',
    details: '配置详情',
    copyFailed: '无法复制文本，请重试。',
    checkSetupResult: '检查上次配置的结果',
    aionUiName: '使用 Cursor Agent 的 AionUi',
    nextStep: '下一步',
    confirmQuestion: '可能需要确认哪些操作？',
    confirmAnswer: '请按提示登录、信任工作区并批准客户端请求。转移已占用的智能体名称需要你的批准。',
    reloadQuestion: '应用设置或更新后该怎么做？',
    claudeReload:
      '重新加载 NCF 插件，并在同一聊天中重新连接 MCP。如果仍无法验证连接，请完全退出客户端后重新打开。',
    cursorReload: '重新启动 Cursor，然后在目标聊天中发送一条消息以恢复投递。',
    permissionsQuestion: '可以保存权限吗？',
    permissionsAnswer:
      '在 /permissions 中，仅允许所需的 NCF 工具：agent_read、agent_connect 和 agent_send。现有的拒绝及询问规则仍然有效。',
  },
  fr: {
    openCodeV1Description:
      'Configurez OpenCode v1 pour « NCF Agent Interconnect ». OpenCode v2 dispose de paramètres distincts.',
    openCodeV2Description:
      'Configurez OpenCode v2 pour « NCF Agent Interconnect ». Seul le fichier de configuration sélectionné sera modifié ; les paramètres des fournisseurs et des comptes seront conservés.',
    openCodeV2Next:
      'Redémarrez OpenCode v2, puis connectez l’assistant depuis la discussion souhaitée à l’aide de la demande ci-dessous.',
    openCodeProfile: 'Profil OpenCode',
    selectedInstallation: 'Installation sélectionnée',
    showOpenCodeV1: 'Afficher OpenCode v1',
    applications: 'Applications',
    intro: 'Connectez une application automatiquement ou configurez-la manuellement',
    startupTitle: 'Connectez vos applications',
    startupHelp:
      'Choisissez les applications que vous utilisez. NCF Agent Interconnect y ajoutera son intégration.',
    savedHelp:
      'Les paramètres sont enregistrés. Suivez la prochaine étape dans chaque application ou poursuivez la configuration ici.',
    readyHelp:
      'Vous pouvez poursuivre votre travail dans les conversations connectées ou configurer d’autres applications ici.',
    continue: 'Accéder à NCF Agent Interconnect',
    returnHelp: 'Vous pouvez revenir à Applications à tout moment depuis la barre latérale.',
    later: 'Pas maintenant',
    yourApps: 'Vos applications',
    detectionHelp:
      'La détection permet uniquement la configuration automatique. La configuration manuelle reste toujours disponible.',
    detected: 'Détectée sur cet ordinateur',
    automaticUnavailable: 'Configuration automatique indisponible',
    newApps: 'Les nouvelles applications détectées apparaîtront ici',
    manual: 'Configuration manuelle',
    back: 'Retour aux applications',
    connecting: 'Connexion en cours…',
    retry: 'Réessayer',
    confirmTitle: 'Confirmer les modifications de configuration',
    confirmHelp:
      'Une entrée NCF existante doit être remplacée. Vérifiez le fichier sélectionné avant d’appliquer les modifications.',
    reviewHelp:
      'Les paramètres ou la cible sélectionnée ont changé. Vérifiez ce nouvel aperçu avant d’appliquer les modifications.',
    failed:
      'La configuration n’a pas pu être terminée. Réessayez ou utilisez la configuration manuelle.',
    uncertain:
      'Le résultat n’est pas confirmé. Réessayer vérifie la même opération de configuration sans en lancer une nouvelle.',
    details: 'Détails de la configuration',
    copyFailed: 'Impossible de copier le texte. Réessayez.',
    checkSetupResult: 'Vérifier le résultat de la tentative précédente',
    aionUiName: 'AionUi avec Cursor Agent',
    nextStep: 'Prochaine étape',
    confirmQuestion: 'Que devrai-je éventuellement confirmer ?',
    confirmAnswer:
      'Connectez-vous, approuvez l’espace de travail et acceptez les demandes du client lorsque cela est demandé. Le transfert d’un nom d’agent déjà utilisé nécessite votre accord.',
    reloadQuestion: 'Que faire après l’application des paramètres ou une mise à jour ?',
    claudeReload:
      'Rechargez les plugins NCF et reconnectez MCP dans cette même conversation. Si la connexion ne peut toujours pas être vérifiée, quittez complètement le client et rouvrez-le.',
    cursorReload:
      'Redémarrez Cursor, puis envoyez un message dans la conversation souhaitée pour rétablir la livraison.',
    permissionsQuestion: 'Puis-je enregistrer les autorisations ?',
    permissionsAnswer:
      'Dans /permissions, autorisez uniquement les outils NCF souhaités : agent_read, agent_connect et agent_send. Les règles existantes de refus ou de confirmation restent applicables.',
  },
  de: {
    openCodeV1Description:
      'Richten Sie OpenCode v1 für „NCF Agent Interconnect“ ein. OpenCode v2 hat eigene Einstellungen.',
    openCodeV2Description:
      'Richten Sie OpenCode v2 für „NCF Agent Interconnect“ ein. Nur die ausgewählte Konfigurationsdatei wird geändert; Anbieter- und Kontoeinstellungen bleiben erhalten.',
    openCodeV2Next:
      'Starten Sie OpenCode v2 neu. Verbinden Sie den Assistenten anschließend im gewünschten Chat mit der unten stehenden Anfrage.',
    openCodeProfile: 'OpenCode-Profil',
    selectedInstallation: 'Ausgewählte Installation',
    showOpenCodeV1: 'OpenCode v1 anzeigen',
    applications: 'Anwendungen',
    intro: 'Verbinden Sie eine Anwendung automatisch oder richten Sie sie manuell ein',
    startupTitle: 'Verbinden Sie Ihre Anwendungen',
    startupHelp:
      'Wählen Sie die Anwendungen aus, die Sie verwenden. NCF Agent Interconnect fügt seine Integration hinzu.',
    savedHelp:
      'Die Einstellungen sind gespeichert. Führen Sie den nächsten Schritt in jeder Anwendung aus oder setzen Sie die Einrichtung hier fort.',
    readyHelp:
      'Sie können in Ihren verbundenen Chats weiterarbeiten oder hier weitere Anwendungen einrichten.',
    continue: 'Weiter zu NCF Agent Interconnect',
    returnHelp: 'Sie können jederzeit über die Seitenleiste zu Anwendungen zurückkehren.',
    later: 'Nicht jetzt',
    yourApps: 'Ihre Anwendungen',
    detectionHelp:
      'Die Erkennung ermöglicht nur die automatische Einrichtung. Die manuelle Einrichtung ist jederzeit verfügbar.',
    detected: 'Auf diesem Computer erkannt',
    automaticUnavailable: 'Automatische Einrichtung nicht verfügbar',
    newApps: 'Neu erkannte Anwendungen werden hier angezeigt',
    manual: 'Manuell einrichten',
    back: 'Zurück zu Anwendungen',
    connecting: 'Verbindung wird eingerichtet…',
    retry: 'Erneut versuchen',
    confirmTitle: 'Konfigurationsänderungen bestätigen',
    confirmHelp:
      'Ein vorhandener NCF-Eintrag muss ersetzt werden. Prüfen Sie die ausgewählte Datei, bevor Sie die Änderungen anwenden.',
    reviewHelp:
      'Die Einstellungen oder das ausgewählte Ziel haben sich geändert. Prüfen Sie die neue Vorschau vor dem Anwenden.',
    failed:
      'Die Einrichtung konnte nicht abgeschlossen werden. Versuchen Sie es erneut oder richten Sie die Anwendung manuell ein.',
    uncertain:
      'Das Ergebnis ist nicht bestätigt. Ein erneuter Versuch prüft denselben Einrichtungsvorgang, ohne einen neuen zu starten.',
    details: 'Einrichtungsdetails',
    copyFailed: 'Der Text konnte nicht kopiert werden. Versuchen Sie es erneut.',
    checkSetupResult: 'Ergebnis des ursprünglichen Versuchs prüfen',
    aionUiName: 'AionUi mit Cursor Agent',
    nextStep: 'Nächster Schritt',
    confirmQuestion: 'Was muss ich gegebenenfalls bestätigen?',
    confirmAnswer:
      'Melden Sie sich an, vertrauen Sie dem Arbeitsbereich und bestätigen Sie Client-Anfragen, wenn Sie dazu aufgefordert werden. Die Übertragung eines belegten Agentennamens erfordert Ihre Zustimmung.',
    reloadQuestion: 'Was ist nach dem Anwenden oder einem Update zu tun?',
    claudeReload:
      'Laden Sie die NCF-Plugins neu und verbinden Sie MCP in demselben Chat erneut. Lässt sich die Verbindung weiterhin nicht prüfen, beenden Sie den Client vollständig und öffnen Sie ihn erneut.',
    cursorReload:
      'Starten Sie Cursor neu und senden Sie anschließend eine Nachricht im gewünschten Chat, um die Zustellung wiederherzustellen.',
    permissionsQuestion: 'Kann ich Berechtigungen speichern?',
    permissionsAnswer:
      'Erlauben Sie unter /permissions nur die gewünschten NCF-Werkzeuge: agent_read, agent_connect und agent_send. Bestehende Ablehnungs- und Nachfrageregeln gelten weiterhin.',
  },
  it: {
    openCodeV1Description:
      'Configura OpenCode v1 per «NCF Agent Interconnect». OpenCode v2 ha impostazioni separate.',
    openCodeV2Description:
      'Configura OpenCode v2 per «NCF Agent Interconnect». Verrà modificato solo il file di configurazione selezionato; le impostazioni dei provider e degli account rimarranno invariate.',
    openCodeV2Next:
      'Riavvia OpenCode v2, poi usa la richiesta qui sotto nella chat desiderata per connettere l’assistente.',
    openCodeProfile: 'Profilo OpenCode',
    selectedInstallation: 'Installazione selezionata',
    showOpenCodeV1: 'Mostra OpenCode v1',
    applications: 'Applicazioni',
    intro: 'Collega un’app automaticamente oppure configurala manualmente',
    startupTitle: 'Collega le tue app',
    startupHelp:
      'Scegli le app che usi. NCF Agent Interconnect aggiungerà la propria integrazione.',
    savedHelp:
      'Le impostazioni sono salvate. Segui il passaggio successivo in ogni app oppure continua la configurazione qui.',
    readyHelp: 'Puoi continuare a lavorare nelle chat collegate oppure configurare altre app qui.',
    continue: 'Vai a NCF Agent Interconnect',
    returnHelp: 'Puoi tornare ad Applicazioni in qualsiasi momento dalla barra laterale.',
    later: 'Non ora',
    yourApps: 'Le tue app',
    detectionHelp:
      'Il rilevamento serve solo alla configurazione automatica. La configurazione manuale è sempre disponibile.',
    detected: 'Rilevata su questo computer',
    automaticUnavailable: 'Configurazione automatica non disponibile',
    newApps: 'Le nuove app rilevate appariranno qui',
    manual: 'Configurazione manuale',
    back: 'Torna alle applicazioni',
    connecting: 'Connessione in corso…',
    retry: 'Riprova',
    confirmTitle: 'Conferma le modifiche alla configurazione',
    confirmHelp:
      'Una voce NCF esistente deve essere sostituita. Controlla il file selezionato prima di applicare le modifiche.',
    reviewHelp:
      'Le impostazioni o la destinazione selezionata sono cambiate. Controlla la nuova anteprima prima di applicare le modifiche.',
    failed: 'Impossibile completare la configurazione. Riprova oppure configura manualmente.',
    uncertain:
      'Il risultato non è confermato. Un nuovo tentativo verifica la stessa operazione senza avviarne un’altra.',
    details: 'Dettagli della configurazione',
    copyFailed: 'Impossibile copiare il testo. Riprova.',
    checkSetupResult: 'Verifica l’esito del tentativo precedente',
    aionUiName: 'AionUi con Cursor Agent',
    nextStep: 'Passaggio successivo',
    confirmQuestion: 'Che cosa potrei dover confermare?',
    confirmAnswer:
      'Accedi, considera attendibile l’area di lavoro e approva le richieste del client quando richiesto. Il trasferimento di un nome agente già in uso richiede la tua approvazione.',
    reloadQuestion: 'Che cosa fare dopo aver applicato le impostazioni o un aggiornamento?',
    claudeReload:
      'Ricarica i plugin NCF e ricollega MCP nella stessa chat. Se la connessione non è ancora verificabile, chiudi completamente il client e riaprilo.',
    cursorReload:
      'Riavvia Cursor, quindi invia un messaggio nella chat desiderata per ripristinare la consegna.',
    permissionsQuestion: 'Posso salvare le autorizzazioni?',
    permissionsAnswer:
      'In /permissions, consenti solo gli strumenti NCF desiderati: agent_read, agent_connect e agent_send. Le regole esistenti di rifiuto o conferma continuano a valere.',
  },
  es: {
    openCodeV1Description:
      'Configura OpenCode v1 para «NCF Agent Interconnect». OpenCode v2 tiene ajustes independientes.',
    openCodeV2Description:
      'Configura OpenCode v2 para «NCF Agent Interconnect». Solo se modificará el archivo de configuración seleccionado; se conservarán los ajustes de proveedores y cuentas.',
    openCodeV2Next:
      'Reinicia OpenCode v2 y pide al asistente que se conecte desde el chat elegido usando la solicitud de abajo.',
    openCodeProfile: 'Perfil de OpenCode',
    selectedInstallation: 'Instalación seleccionada',
    showOpenCodeV1: 'Mostrar OpenCode v1',
    applications: 'Aplicaciones',
    intro: 'Conecta una aplicación automáticamente o configúrala manualmente',
    startupTitle: 'Conecta tus aplicaciones',
    startupHelp:
      'Elige las aplicaciones que utilizas. NCF Agent Interconnect añadirá su integración.',
    savedHelp:
      'La configuración se ha guardado. Sigue el próximo paso en cada aplicación o continúa configurando aquí.',
    readyHelp:
      'Puedes seguir trabajando en los chats conectados o configurar más aplicaciones aquí.',
    continue: 'Ir a NCF Agent Interconnect',
    returnHelp: 'Puedes volver a Aplicaciones en cualquier momento desde la barra lateral.',
    later: 'Ahora no',
    yourApps: 'Tus aplicaciones',
    detectionHelp:
      'La detección solo permite la configuración automática. La configuración manual siempre está disponible.',
    detected: 'Detectada en este equipo',
    automaticUnavailable: 'Configuración automática no disponible',
    newApps: 'Las nuevas aplicaciones detectadas aparecerán aquí',
    manual: 'Configuración manual',
    back: 'Volver a Aplicaciones',
    connecting: 'Conectando…',
    retry: 'Reintentar',
    confirmTitle: 'Confirmar cambios de configuración',
    confirmHelp:
      'Es necesario reemplazar una entrada NCF existente. Revisa el archivo seleccionado antes de aplicar los cambios.',
    reviewHelp:
      'La configuración o el destino seleccionado han cambiado. Revisa esta nueva vista previa antes de aplicar los cambios.',
    failed: 'No se pudo completar la configuración. Vuelve a intentarlo o configura manualmente.',
    uncertain:
      'El resultado no está confirmado. Reintentar comprueba la misma operación de configuración sin iniciar otra.',
    details: 'Detalles de configuración',
    copyFailed: 'No se pudo copiar el texto. Vuelve a intentarlo.',
    checkSetupResult: 'Comprobar el resultado del intento anterior',
    aionUiName: 'AionUi con Cursor Agent',
    nextStep: 'Próximo paso',
    confirmQuestion: '¿Qué podría tener que confirmar?',
    confirmAnswer:
      'Inicia sesión, confía en el espacio de trabajo y aprueba las solicitudes del cliente cuando se te pida. Transferir un nombre de agente ocupado requiere tu aprobación.',
    reloadQuestion: '¿Qué hago después de aplicar los ajustes o de una actualización?',
    claudeReload:
      'Recarga los plugins de NCF y vuelve a conectar MCP en este mismo chat. Si la conexión sigue sin poder verificarse, cierra completamente el cliente y ábrelo de nuevo.',
    cursorReload:
      'Reinicia Cursor y envía un mensaje en el chat deseado para restablecer la entrega.',
    permissionsQuestion: '¿Puedo guardar los permisos?',
    permissionsAnswer:
      'En /permissions, permite solo las herramientas NCF que necesites: agent_read, agent_connect y agent_send. Las reglas existentes de denegación o confirmación siguen vigentes.',
  },
  kk: {
    openCodeV1Description:
      'OpenCode v1 нұсқасын «NCF Agent Interconnect» үшін баптаңыз. OpenCode v2 нұсқасының баптаулары бөлек.',
    openCodeV2Description:
      'OpenCode v2 нұсқасын «NCF Agent Interconnect» үшін баптаңыз. Тек таңдалған конфигурация файлы өзгереді; провайдерлердің және есептік жазбалардың баптаулары сақталады.',
    openCodeV2Next:
      'OpenCode v2 нұсқасын қайта іске қосып, көмекшіні қажетті чаттан қосу үшін төмендегі сұрауды пайдаланыңыз.',
    openCodeProfile: 'OpenCode профилі',
    selectedInstallation: 'Таңдалған бағдарлама данасы',
    showOpenCodeV1: 'OpenCode v1 нұсқасын көрсету',
    applications: 'Қолданбалар',
    intro: 'Қолданбаны автоматты түрде қосыңыз немесе қолмен баптаңыз',
    startupTitle: 'Қолданбаларыңызды қосыңыз',
    startupHelp:
      'Пайдаланатын қолданбаларды таңдаңыз. NCF Agent Interconnect өз интеграциясын қосады.',
    savedHelp:
      'Баптаулар сақталды. Әр қолданбадағы келесі қадамды орындаңыз немесе баптауды осында жалғастырыңыз.',
    readyHelp:
      'Қосылған чаттарда жұмысты жалғастыруға немесе осында басқа қолданбаларды баптауға болады.',
    continue: 'NCF Agent Interconnect қолданбасына өту',
    returnHelp: 'Бүйірлік панельдегі «Қолданбалар» бөліміне кез келген уақытта оралуға болады.',
    later: 'Қазір емес',
    yourApps: 'Қолданбаларыңыз',
    detectionHelp:
      'Анықтау тек автоматты баптауға мүмкіндік береді. Қолмен баптау әрдайым қолжетімді.',
    detected: 'Осы компьютерде анықталды',
    automaticUnavailable: 'Автоматты баптау қолжетімсіз',
    newApps: 'Жаңадан анықталған қолданбалар осында көрсетіледі',
    manual: 'Қолмен баптау',
    back: 'Қолданбаларға оралу',
    connecting: 'Қосылуда…',
    retry: 'Қайталау',
    confirmTitle: 'Баптау өзгерістерін растаңыз',
    confirmHelp:
      'Бар NCF жазбасын ауыстыру керек. Өзгерістерді қолданбас бұрын таңдалған файлды тексеріңіз.',
    reviewHelp:
      'Баптаулар немесе таңдалған нысана өзгерді. Қолданбас бұрын жаңа өзгерістер жоспарын тексеріңіз.',
    failed: 'Баптауды аяқтау мүмкін болмады. Қайталап көріңіз немесе қолмен баптаңыз.',
    uncertain:
      'Нәтиже расталмады. Қайта әрекет жасау жаңа сұрау жібермей, сол баптау сұрауын тексереді.',
    details: 'Баптау туралы мәліметтер',
    copyFailed: 'Мәтінді көшіру мүмкін болмады. Қайталап көріңіз.',
    checkSetupResult: 'Алдыңғы әрекеттің нәтижесін тексеру',
    aionUiName: 'Cursor Agent қолданылатын AionUi',
    nextStep: 'Келесі қадам',
    confirmQuestion: 'Нені растауым қажет болуы мүмкін?',
    confirmAnswer:
      'Сұралған кезде аккаунтқа кіріңіз, жұмыс кеңістігіне сенім білдіріңіз және клиент сұрауларын мақұлдаңыз. Қолданыстағы агент атын ауыстыру үшін сіздің растауыңыз қажет.',
    reloadQuestion: 'Баптауларды қолданғаннан немесе жаңартудан кейін не істеу керек?',
    claudeReload:
      'NCF плагиндерін қайта жүктеп, MCP қызметін осы чатта қайта қосыңыз. Байланыс әлі тексерілмесе, клиенттен толық шығып, қайта ашыңыз.',
    cursorReload:
      'Cursor қолданбасын қайта іске қосып, жеткізуді қалпына келтіру үшін қажетті чатқа бір хабар жіберіңіз.',
    permissionsQuestion: 'Рұқсаттарды сақтауға бола ма?',
    permissionsAnswer:
      '/permissions ішінде тек қажетті NCF құралдарына рұқсат беріңіз: agent_read, agent_connect және agent_send. Бар тыйым салу және растау сұрау ережелері күшінде қалады.',
  },
  ja: {
    openCodeV1Description:
      'OpenCode v1 を「NCF Agent Interconnect」用に設定します。OpenCode v2 の設定は別になっています。',
    openCodeV2Description:
      'OpenCode v2 を「NCF Agent Interconnect」用に設定します。変更されるのは選択した設定ファイルのみで、プロバイダーやアカウントの設定は維持されます。',
    openCodeV2Next:
      'OpenCode v2 を再起動し、対象のチャットで以下の依頼文を使ってアシスタントを接続してください。',
    openCodeProfile: 'OpenCode のプロファイル',
    selectedInstallation: '選択したインストール済みアプリ',
    showOpenCodeV1: 'OpenCode v1 を表示',
    applications: 'アプリケーション',
    intro: 'アプリを自動で接続するか、手動で設定します',
    startupTitle: 'アプリを接続',
    startupHelp:
      '使用するアプリを選択してください。NCF Agent Interconnect が連携設定を追加します。',
    savedHelp: '設定を保存しました。各アプリで次の手順を実行するか、ここで設定を続けてください。',
    readyHelp: '接続済みのチャットで作業を続けられます。ここで他のアプリを設定することもできます。',
    continue: 'NCF Agent Interconnect に進む',
    returnHelp: 'サイドバーからいつでもアプリケーションに戻れます。',
    later: '後で',
    yourApps: 'お使いのアプリ',
    detectionHelp: '検出結果は自動設定の可否にのみ使用します。手動設定はいつでも利用できます。',
    detected: 'このコンピューターで検出済み',
    automaticUnavailable: '自動設定は利用できません',
    newApps: '新たに検出されたアプリはここに表示されます',
    manual: '手動設定',
    back: 'アプリ一覧に戻る',
    connecting: '接続中…',
    retry: '再試行',
    confirmTitle: '設定の変更を確認',
    confirmHelp:
      '既存の NCF エントリを置き換える必要があります。適用する前に選択したファイルを確認してください。',
    reviewHelp:
      '設定または選択した対象が変更されました。適用前に新しいプレビューを確認してください。',
    failed: '設定を完了できませんでした。再試行するか、手動で設定してください。',
    uncertain:
      '結果を確認できていません。再試行では同じ設定処理を確認し、新しい処理は開始しません。',
    details: '設定の詳細',
    copyFailed: 'テキストをコピーできませんでした。もう一度お試しください。',
    checkSetupResult: '前回の設定結果を確認',
    aionUiName: 'Cursor Agent を使用する AionUi',
    nextStep: '次の手順',
    confirmQuestion: 'どのような確認が必要ですか？',
    confirmAnswer:
      '必要に応じてサインインし、ワークスペースを信頼し、クライアントの要求を承認してください。使用中のエージェント名を移すには承認が必要です。',
    reloadQuestion: '設定の適用や更新の後は？',
    claudeReload:
      'NCF プラグインを再読み込みし、同じチャットで MCP を再接続してください。接続を確認できない場合は、クライアントを完全に終了して開き直してください。',
    cursorReload:
      'Cursor を再起動し、使用するチャットでメッセージを一度送信すると、配信を復旧できます。',
    permissionsQuestion: '権限を保存できますか？',
    permissionsAnswer:
      '/permissions で必要な NCF ツールのみを許可してください：agent_read、agent_connect、agent_send。既存の拒否・確認ルールは引き続き適用されます。',
  },
  'pt-BR': {
    openCodeV1Description:
      'Configure o OpenCode v1 para o “NCF Agent Interconnect”. O OpenCode v2 tem configurações separadas.',
    openCodeV2Description:
      'Configure o OpenCode v2 para o “NCF Agent Interconnect”. Apenas o arquivo de configuração selecionado será alterado; as configurações de provedores e contas serão preservadas.',
    openCodeV2Next:
      'Reinicie o OpenCode v2 e use a solicitação abaixo no chat desejado para conectar o assistente.',
    openCodeProfile: 'Perfil do OpenCode',
    selectedInstallation: 'Instalação selecionada',
    showOpenCodeV1: 'Mostrar OpenCode v1',
    applications: 'Aplicativos',
    intro: 'Conecte um aplicativo automaticamente ou configure-o manualmente',
    startupTitle: 'Conecte seus aplicativos',
    startupHelp:
      'Escolha os aplicativos que você usa. O NCF Agent Interconnect adicionará sua integração.',
    savedHelp:
      'As configurações foram salvas. Siga a próxima etapa em cada aplicativo ou continue a configuração aqui.',
    readyHelp:
      'Você pode continuar trabalhando nas conversas conectadas ou configurar mais aplicativos aqui.',
    continue: 'Ir para o NCF Agent Interconnect',
    returnHelp: 'Você pode voltar a Aplicativos pela barra lateral a qualquer momento.',
    later: 'Agora não',
    yourApps: 'Seus aplicativos',
    detectionHelp:
      'A detecção permite apenas a configuração automática. A configuração manual está sempre disponível.',
    detected: 'Detectado neste computador',
    automaticUnavailable: 'Configuração automática indisponível',
    newApps: 'Novos aplicativos detectados aparecerão aqui',
    manual: 'Configuração manual',
    back: 'Voltar aos aplicativos',
    connecting: 'Conectando…',
    retry: 'Tentar novamente',
    confirmTitle: 'Confirmar alterações de configuração',
    confirmHelp:
      'Uma entrada NCF existente precisa ser substituída. Confira o arquivo selecionado antes de aplicar as alterações.',
    reviewHelp:
      'As configurações ou o destino selecionado mudaram. Confira esta nova prévia antes de aplicar as alterações.',
    failed: 'Não foi possível concluir a configuração. Tente novamente ou configure manualmente.',
    uncertain:
      'O resultado não foi confirmado. Tentar novamente verifica a mesma operação de configuração, sem iniciar outra.',
    details: 'Detalhes da configuração',
    copyFailed: 'Não foi possível copiar o texto. Tente novamente.',
    checkSetupResult: 'Verificar o resultado da tentativa anterior',
    aionUiName: 'AionUi com Cursor Agent',
    nextStep: 'Próxima etapa',
    confirmQuestion: 'O que posso precisar confirmar?',
    confirmAnswer:
      'Entre na conta, confie no espaço de trabalho e aprove as solicitações do cliente quando necessário. Transferir um nome de agente já ocupado exige sua aprovação.',
    reloadQuestion: 'O que fazer após aplicar as configurações ou atualizar?',
    claudeReload:
      'Recarregue os plugins NCF e reconecte o MCP nesta mesma conversa. Se a conexão ainda não puder ser verificada, encerre completamente o cliente e abra-o novamente.',
    cursorReload:
      'Reinicie o Cursor e envie uma mensagem na conversa desejada para restaurar a entrega.',
    permissionsQuestion: 'Posso salvar as permissões?',
    permissionsAnswer:
      'Em /permissions, permita apenas as ferramentas NCF desejadas: agent_read, agent_connect e agent_send. As regras existentes de negação ou confirmação continuam válidas.',
  },
  ko: {
    openCodeV1Description:
      '“NCF Agent Interconnect”용으로 OpenCode v1을 설정합니다. OpenCode v2의 설정은 별도로 관리됩니다.',
    openCodeV2Description:
      '“NCF Agent Interconnect”용으로 OpenCode v2를 설정합니다. 선택한 구성 파일만 변경되며, 공급자와 계정 설정은 유지됩니다.',
    openCodeV2Next:
      'OpenCode v2를 다시 시작한 뒤, 원하는 채팅에서 아래 요청문을 사용해 어시스턴트를 연결하세요.',
    openCodeProfile: 'OpenCode 프로필',
    selectedInstallation: '선택한 설치본',
    showOpenCodeV1: 'OpenCode v1 표시',
    applications: '앱',
    intro: '앱을 자동으로 연결하거나 수동으로 설정하세요',
    startupTitle: '앱 연결',
    startupHelp: '사용하는 앱을 선택하세요. NCF Agent Interconnect가 연동 설정을 추가합니다.',
    savedHelp:
      '설정이 저장되었습니다. 각 앱에서 다음 단계를 진행하거나 여기에서 설정을 계속하세요.',
    readyHelp: '연결된 채팅에서 작업을 계속하거나 여기에서 다른 앱을 설정할 수 있습니다.',
    continue: 'NCF Agent Interconnect로 이동',
    returnHelp: '언제든지 사이드바에서 앱 화면으로 돌아갈 수 있습니다.',
    later: '나중에',
    yourApps: '내 앱',
    detectionHelp:
      '앱 감지는 자동 설정 가능 여부에만 사용됩니다. 수동 설정은 항상 사용할 수 있습니다.',
    detected: '이 컴퓨터에서 감지됨',
    automaticUnavailable: '자동 설정을 사용할 수 없음',
    newApps: '새로 감지된 앱이 여기에 표시됩니다',
    manual: '수동 설정',
    back: '앱 목록으로 돌아가기',
    connecting: '연결 중…',
    retry: '다시 시도',
    confirmTitle: '설정 변경 확인',
    confirmHelp: '기존 NCF 항목을 교체해야 합니다. 적용하기 전에 선택한 파일을 확인하세요.',
    reviewHelp: '설정 또는 선택한 대상이 변경되었습니다. 적용하기 전에 새 미리보기를 확인하세요.',
    failed: '설정을 완료하지 못했습니다. 다시 시도하거나 수동으로 설정하세요.',
    uncertain:
      '결과가 확인되지 않았습니다. 다시 시도하면 새 작업을 시작하지 않고 동일한 설정 작업을 확인합니다.',
    details: '설정 세부 정보',
    copyFailed: '텍스트를 복사하지 못했습니다. 다시 시도하세요.',
    checkSetupResult: '이전 설정 결과 확인',
    aionUiName: 'Cursor Agent를 사용하는 AionUi',
    nextStep: '다음 단계',
    confirmQuestion: '어떤 내용을 확인해야 하나요?',
    confirmAnswer:
      '요청이 표시되면 로그인하고 작업 공간을 신뢰하며 클라이언트 요청을 승인하세요. 사용 중인 에이전트 이름을 이전하려면 승인이 필요합니다.',
    reloadQuestion: '설정을 적용하거나 업데이트한 후에는?',
    claudeReload:
      'NCF 플러그인을 새로고침하고 같은 채팅에서 MCP를 다시 연결하세요. 연결을 계속 확인할 수 없다면 클라이언트를 완전히 종료한 뒤 다시 여세요.',
    cursorReload:
      'Cursor를 다시 시작한 다음 사용할 채팅에서 메시지를 한 번 보내 전달을 복구하세요.',
    permissionsQuestion: '권한을 저장할 수 있나요?',
    permissionsAnswer:
      '/permissions에서 필요한 NCF 도구만 허용하세요: agent_read, agent_connect, agent_send. 기존 거부 및 확인 요청 규칙은 계속 적용됩니다.',
  },
  tr: {
    openCodeV1Description:
      'OpenCode v1’i “NCF Agent Interconnect” için yapılandırın. OpenCode v2’nin ayarları ayrıdır.',
    openCodeV2Description:
      'OpenCode v2’yi “NCF Agent Interconnect” için yapılandırın. Yalnızca seçilen yapılandırma dosyası değişir; sağlayıcı ve hesap ayarları korunur.',
    openCodeV2Next:
      'OpenCode v2’yi yeniden başlatın, ardından istediğiniz sohbette aşağıdaki isteği kullanarak asistanı bağlayın.',
    openCodeProfile: 'OpenCode profili',
    selectedInstallation: 'Seçilen kurulum',
    showOpenCodeV1: 'OpenCode v1’i göster',
    applications: 'Uygulamalar',
    intro: 'Bir uygulamayı otomatik bağlayın veya elle yapılandırın',
    startupTitle: 'Uygulamalarınızı bağlayın',
    startupHelp:
      'Kullandığınız uygulamaları seçin. NCF Agent Interconnect kendi entegrasyonunu ekler.',
    savedHelp:
      'Ayarlar kaydedildi. Her uygulamada sonraki adımı izleyin veya yapılandırmaya burada devam edin.',
    readyHelp:
      'Bağlı sohbetlerinizde çalışmaya devam edebilir veya burada başka uygulamalar yapılandırabilirsiniz.',
    continue: 'NCF Agent Interconnect’e geç',
    returnHelp: 'Kenar çubuğundan istediğiniz zaman Uygulamalar’a dönebilirsiniz.',
    later: 'Şimdi değil',
    yourApps: 'Uygulamalarınız',
    detectionHelp:
      'Algılama yalnızca otomatik kurulumu mümkün kılar. Elle kurulum her zaman kullanılabilir.',
    detected: 'Bu bilgisayarda algılandı',
    automaticUnavailable: 'Otomatik kurulum kullanılamıyor',
    newApps: 'Yeni algılanan uygulamalar burada görünür',
    manual: 'Elle kurulum',
    back: 'Uygulamalara dön',
    connecting: 'Bağlanıyor…',
    retry: 'Yeniden dene',
    confirmTitle: 'Yapılandırma değişikliklerini onaylayın',
    confirmHelp:
      'Mevcut bir NCF kaydının değiştirilmesi gerekiyor. Uygulamadan önce seçilen dosyayı inceleyin.',
    reviewHelp: 'Ayarlar veya seçilen hedef değişti. Uygulamadan önce yeni önizlemeyi inceleyin.',
    failed: 'Kurulum tamamlanamadı. Yeniden deneyin veya elle yapılandırın.',
    uncertain:
      'Sonuç doğrulanmadı. Yeniden deneme, yeni bir işlem başlatmadan aynı kurulum işlemini kontrol eder.',
    details: 'Kurulum ayrıntıları',
    copyFailed: 'Metin kopyalanamadı. Yeniden deneyin.',
    checkSetupResult: 'Önceki girişimin sonucunu kontrol et',
    aionUiName: 'Cursor Agent kullanan AionUi',
    nextStep: 'Sonraki adım',
    confirmQuestion: 'Neleri onaylamam gerekebilir?',
    confirmAnswer:
      'İstendiğinde oturum açın, çalışma alanına güvenin ve istemci isteklerini onaylayın. Kullanılan bir ajan adının taşınması onayınızı gerektirir.',
    reloadQuestion: 'Ayarları uyguladıktan veya güncelledikten sonra ne yapmalıyım?',
    claudeReload:
      'NCF eklentilerini yeniden yükleyin ve MCP’yi aynı sohbette yeniden bağlayın. Bağlantı hâlâ doğrulanamıyorsa istemciden tamamen çıkıp yeniden açın.',
    cursorReload:
      'Cursor’ı yeniden başlatın, ardından teslimatı geri getirmek için kullanmak istediğiniz sohbette bir mesaj gönderin.',
    permissionsQuestion: 'İzinleri kaydedebilir miyim?',
    permissionsAnswer:
      '/permissions içinde yalnızca istediğiniz NCF araçlarına izin verin: agent_read, agent_connect ve agent_send. Mevcut reddetme ve onay isteme kuralları geçerli kalır.',
  },
  pl: {
    openCodeV1Description:
      'Skonfiguruj OpenCode v1 do pracy z „NCF Agent Interconnect”. OpenCode v2 ma osobne ustawienia.',
    openCodeV2Description:
      'Skonfiguruj OpenCode v2 do pracy z „NCF Agent Interconnect”. Zmieniony zostanie tylko wybrany plik konfiguracyjny; ustawienia dostawców i kont pozostaną bez zmian.',
    openCodeV2Next:
      'Uruchom ponownie OpenCode v2, a następnie w wybranym czacie poproś asystenta o połączenie, korzystając z poniższego tekstu.',
    openCodeProfile: 'Profil OpenCode',
    selectedInstallation: 'Wybrana instalacja',
    showOpenCodeV1: 'Pokaż OpenCode v1',
    applications: 'Aplikacje',
    intro: 'Połącz aplikację automatycznie lub skonfiguruj ją ręcznie',
    startupTitle: 'Połącz swoje aplikacje',
    startupHelp: 'Wybierz używane aplikacje. NCF Agent Interconnect doda swoją integrację.',
    savedHelp:
      'Ustawienia zostały zapisane. Wykonaj następny krok w każdej aplikacji lub kontynuuj konfigurację tutaj.',
    readyHelp:
      'Możesz kontynuować pracę w połączonych czatach lub skonfigurować tutaj kolejne aplikacje.',
    continue: 'Przejdź do NCF Agent Interconnect',
    returnHelp: 'W każdej chwili możesz wrócić do Aplikacji z paska bocznego.',
    later: 'Nie teraz',
    yourApps: 'Twoje aplikacje',
    detectionHelp:
      'Wykrywanie umożliwia tylko automatyczną konfigurację. Konfiguracja ręczna jest zawsze dostępna.',
    detected: 'Wykryto na tym komputerze',
    automaticUnavailable: 'Automatyczna konfiguracja jest niedostępna',
    newApps: 'Nowo wykryte aplikacje pojawią się tutaj',
    manual: 'Konfiguracja ręczna',
    back: 'Wróć do aplikacji',
    connecting: 'Łączenie…',
    retry: 'Spróbuj ponownie',
    confirmTitle: 'Potwierdź zmiany konfiguracji',
    confirmHelp:
      'Istniejący wpis NCF wymaga zastąpienia. Sprawdź wybrany plik przed zastosowaniem zmian.',
    reviewHelp:
      'Ustawienia lub wybrany cel uległy zmianie. Sprawdź nowy podgląd przed zastosowaniem zmian.',
    failed: 'Nie udało się ukończyć konfiguracji. Spróbuj ponownie lub skonfiguruj ręcznie.',
    uncertain:
      'Wynik nie został potwierdzony. Ponowna próba sprawdza tę samą operację konfiguracji, nie rozpoczynając nowej.',
    details: 'Szczegóły konfiguracji',
    copyFailed: 'Nie udało się skopiować tekstu. Spróbuj ponownie.',
    checkSetupResult: 'Sprawdź wynik poprzedniej próby',
    aionUiName: 'AionUi z Cursor Agent',
    nextStep: 'Następny krok',
    confirmQuestion: 'Co może wymagać mojego potwierdzenia?',
    confirmAnswer:
      'Gdy pojawi się prośba, zaloguj się, zaufaj obszarowi roboczemu i zatwierdź monity klienta. Przeniesienie zajętej nazwy agenta wymaga Twojej zgody.',
    reloadQuestion: 'Co zrobić po zastosowaniu ustawień lub aktualizacji?',
    claudeReload:
      'Przeładuj wtyczki NCF i ponownie połącz MCP w tym samym czacie. Jeśli nadal nie można zweryfikować połączenia, całkowicie zamknij klienta i otwórz go ponownie.',
    cursorReload:
      'Uruchom ponownie Cursor, a następnie wyślij jedną wiadomość w wybranym czacie, aby przywrócić dostarczanie.',
    permissionsQuestion: 'Czy mogę zapisać uprawnienia?',
    permissionsAnswer:
      'W /permissions zezwól tylko na potrzebne narzędzia NCF: agent_read, agent_connect i agent_send. Istniejące reguły odmowy i pytania o zgodę nadal obowiązują.',
  },
  nl: {
    openCodeV1Description:
      'Stel OpenCode v1 in voor ‘NCF Agent Interconnect’. OpenCode v2 heeft afzonderlijke instellingen.',
    openCodeV2Description:
      'Stel OpenCode v2 in voor ‘NCF Agent Interconnect’. Alleen het geselecteerde configuratiebestand wordt gewijzigd; de instellingen voor providers en accounts blijven behouden.',
    openCodeV2Next:
      'Start OpenCode v2 opnieuw en gebruik het onderstaande verzoek in de gewenste chat om de assistent te verbinden.',
    openCodeProfile: 'OpenCode-profiel',
    selectedInstallation: 'Geselecteerde installatie',
    showOpenCodeV1: 'OpenCode v1 tonen',
    applications: 'Apps',
    intro: 'Verbind een app automatisch of stel deze handmatig in',
    startupTitle: 'Verbind je apps',
    startupHelp: 'Kies de apps die je gebruikt. NCF Agent Interconnect voegt zijn integratie toe.',
    savedHelp:
      'De instellingen zijn opgeslagen. Volg de volgende stap in elke app of ga hier verder met instellen.',
    readyHelp: 'Je kunt verder werken in je verbonden chats of hier meer apps instellen.',
    continue: 'Ga naar NCF Agent Interconnect',
    returnHelp: 'Je kunt op elk moment via de zijbalk terugkeren naar Apps.',
    later: 'Niet nu',
    yourApps: 'Je apps',
    detectionHelp:
      'Detectie maakt alleen automatische configuratie mogelijk. Handmatig instellen blijft altijd beschikbaar.',
    detected: 'Gedetecteerd op deze computer',
    automaticUnavailable: 'Automatisch instellen niet beschikbaar',
    newApps: 'Nieuw gedetecteerde apps verschijnen hier',
    manual: 'Handmatig instellen',
    back: 'Terug naar Apps',
    connecting: 'Verbinden…',
    retry: 'Opnieuw proberen',
    confirmTitle: 'Configuratiewijzigingen bevestigen',
    confirmHelp:
      'Een bestaande NCF-vermelding moet worden vervangen. Controleer het geselecteerde bestand voordat je de wijzigingen toepast.',
    reviewHelp:
      'De instellingen of het geselecteerde doel zijn gewijzigd. Controleer het nieuwe voorbeeld voordat je de wijzigingen toepast.',
    failed: 'Het instellen is niet voltooid. Probeer het opnieuw of stel de app handmatig in.',
    uncertain:
      'Het resultaat is niet bevestigd. Opnieuw proberen controleert dezelfde configuratiepoging en start geen nieuwe.',
    details: 'Configuratiedetails',
    copyFailed: 'De tekst kon niet worden gekopieerd. Probeer het opnieuw.',
    checkSetupResult: 'Resultaat van vorige poging controleren',
    aionUiName: 'AionUi met Cursor Agent',
    nextStep: 'Volgende stap',
    confirmQuestion: 'Wat moet ik mogelijk bevestigen?',
    confirmAnswer:
      'Meld je aan, vertrouw de werkruimte en keur verzoeken van de client goed wanneer daarom wordt gevraagd. Het overdragen van een bezette agentnaam vereist je toestemming.',
    reloadQuestion: 'Wat doe ik na het toepassen van instellingen of een update?',
    claudeReload:
      'Herlaad de NCF-plug-ins en verbind MCP opnieuw in dezelfde chat. Als de verbinding nog steeds niet kan worden geverifieerd, sluit je de client volledig af en open je deze opnieuw.',
    cursorReload:
      'Start Cursor opnieuw en stuur vervolgens één bericht in de gewenste chat om de bezorging te herstellen.',
    permissionsQuestion: 'Kan ik machtigingen opslaan?',
    permissionsAnswer:
      'Sta in /permissions alleen de gewenste NCF-tools toe: agent_read, agent_connect en agent_send. Bestaande regels voor weigeren of toestemming vragen blijven gelden.',
  },
  uk: {
    openCodeV1Description:
      'Налаштуйте OpenCode v1 для «NCF Agent Interconnect». OpenCode v2 має окремі налаштування.',
    openCodeV2Description:
      'Налаштуйте OpenCode v2 для «NCF Agent Interconnect». Зміни торкнуться лише вибраного файлу конфігурації; налаштування провайдерів і облікових записів буде збережено.',
    openCodeV2Next:
      'Перезапустіть OpenCode v2, а потім скористайтеся наведеним нижче проханням у потрібному чаті, щоб підключити помічника.',
    openCodeProfile: 'Профіль OpenCode',
    selectedInstallation: 'Вибрана копія програми',
    showOpenCodeV1: 'Показати OpenCode v1',
    applications: 'Застосунки',
    intro: 'Підключіть застосунок автоматично або налаштуйте вручну',
    startupTitle: 'Підключіть свої застосунки',
    startupHelp:
      'Виберіть застосунки, якими користуєтеся. NCF Agent Interconnect додасть свою інтеграцію.',
    savedHelp:
      'Налаштування збережено. Виконайте наступний крок у кожному застосунку або продовжте налаштування тут.',
    readyHelp: 'Можна продовжувати роботу в підключених чатах або налаштувати тут інші застосунки.',
    continue: 'Перейти до NCF Agent Interconnect',
    returnHelp: 'До налаштування завжди можна повернутися через «Застосунки» на бічній панелі.',
    later: 'Не зараз',
    yourApps: 'Ваші застосунки',
    detectionHelp:
      'Виявлення дає змогу запропонувати автоматичне налаштування. Ручне налаштування доступне завжди.',
    detected: 'Виявлено на цьому комп’ютері',
    automaticUnavailable: 'Автоматичне налаштування недоступне',
    newApps: 'Тут з’являтимуться нові виявлені застосунки',
    manual: 'Налаштувати вручну',
    back: 'До застосунків',
    connecting: 'Підключення…',
    retry: 'Повторити',
    confirmTitle: 'Підтвердьте зміну налаштувань',
    confirmHelp:
      'Наявний запис NCF потрібно замінити. Перевірте вибраний файл перед застосуванням змін.',
    reviewHelp:
      'Налаштування або вибраний файл змінилися. Перевірте новий план перед застосуванням.',
    failed: 'Не вдалося завершити налаштування. Повторіть спробу або налаштуйте вручну.',
    uncertain:
      'Результат не підтверджено. Повторна спроба перевірить той самий запит налаштування, не створюючи нового.',
    details: 'Подробиці налаштування',
    copyFailed: 'Не вдалося скопіювати текст. Спробуйте ще раз.',
    checkSetupResult: 'Перевірити результат попередньої спроби',
    aionUiName: 'AionUi з Cursor Agent',
    nextStep: 'Наступний крок',
    confirmQuestion: 'Що може потребувати мого підтвердження?',
    confirmAnswer:
      'Вхід до облікового запису, довіра до робочої області та дозволи клієнта. Перенесення зайнятого імені агента потребує вашого підтвердження.',
    reloadQuestion: 'Що робити після застосування налаштувань або оновлення?',
    claudeReload:
      'Перезавантажте плагіни NCF і повторно підключіть MCP у цьому ж чаті. Якщо перевірку зв’язку не відновлено, повністю вийдіть із клієнта та відкрийте його знову.',
    cursorReload:
      'Перезапустіть Cursor, а потім надішліть одне повідомлення в потрібному чаті, щоб відновити доставлення.',
    permissionsQuestion: 'Чи можна зберегти дозволи?',
    permissionsAnswer:
      'У /permissions дозвольте лише потрібні інструменти NCF: agent_read, agent_connect і agent_send. Наявні правила заборони та обов’язкового підтвердження залишаються чинними.',
  },
};

export function applicationSetupMessages(locale: Locale): ApplicationSetupMessages {
  return translations[locale];
}

import type { Locale } from './index.js';

const en = {
  automaticAvailable: 'Automatic setup available',
  openCodeV1Description:
    'Configure OpenCode v1 for “NCF Agent Interconnect”. OpenCode v2 has separate settings.',
  openCodeV2Description:
    'Configure OpenCode v2 for “NCF Agent Interconnect”. Only the selected configuration file will change; provider and account settings stay as they are.',
  openCodeV2Next: 'Restart OpenCode v2, then ask the assistant to connect from the intended chat.',
  showOpenCodeV1: 'Show OpenCode v1',
  applications: 'Applications',
  readyTitle: 'You can start working',
  configuredStatus: 'Configured',
  applicationReadyHelp: 'Already set up. You can work in this app now.',
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
  readyChatHelp: 'In your app, open a new chat or return to an existing one, then type {command}.',
  confirmQuestion: 'What may I need to confirm?',
  confirmAnswer:
    'Sign in, trust the workspace and approve client prompts when requested. Moving an occupied agent name needs your approval.',
  reloadQuestion: 'After Apply or an update?',
  claudeConfirmAnswer:
    'If prompted, sign in and confirm that you trust the project. Claude Code may ask you to choose Allow before connecting or sending a message through NCF. Moving an occupied agent name requires your approval.',
  claudeReload:
    'Save any unfinished input, then reload the NCF plugins or restart Claude Code. Reconnect in the chat you want to use.',
  cursorReload: 'Restart Cursor and send a message in the intended chat.',
  permissionsQuestion: 'Can I save permissions?',
  permissionsAnswer:
    'If Claude Code keeps asking or blocks an action, check its permissions. Where /permissions is available, you can save permission for that specific action. Your organization’s rules still apply.',
};
export type ApplicationSetupMessages = { [K in keyof typeof en]: string };

const translations: Record<Locale, ApplicationSetupMessages> = {
  en,
  ru: {
    automaticAvailable: 'Доступна автоматическая настройка',
    openCodeV1Description:
      'Настройте OpenCode v1 для «NCF Agent Interconnect». У OpenCode v2 отдельные настройки.',
    openCodeV2Description:
      'Настройте OpenCode v2 для «NCF Agent Interconnect». Изменения затронут только выбранный файл конфигурации; настройки провайдеров и аккаунтов сохранятся.',
    openCodeV2Next:
      'Перезапустите OpenCode v2, затем попросите помощника подключиться в нужном чате.',
    showOpenCodeV1: 'Показать OpenCode v1',
    applications: 'Приложения',
    readyTitle: 'Можно начинать работу',
    configuredStatus: 'Настроено',
    applicationReadyHelp: 'В этом приложении уже можно работать.',
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
    readyChatHelp: 'В своём приложении откройте новый или существующий чат и введите {command}.',
    confirmQuestion: 'Что может потребовать моего подтверждения?',
    confirmAnswer:
      'Вход в аккаунт, доверие к папке и разрешения клиента. Перенос занятого имени агента требует вашего подтверждения.',
    reloadQuestion: 'Что делать после применения настроек или обновления?',
    claudeConfirmAnswer:
      'Если Claude Code попросит, войдите в аккаунт и подтвердите доверие проекту. При подключении или отправке сообщения через NCF может появиться запрос с кнопкой Allow. Перенос занятого имени агента требует вашего подтверждения.',
    claudeReload:
      'Сохраните незавершённый ввод, затем перезагрузите плагины NCF или перезапустите Claude Code. Подключитесь заново в нужном чате.',
    cursorReload: 'Перезапустите Cursor и отправьте сообщение в нужном чате.',
    permissionsQuestion: 'Можно ли сохранить разрешения?',
    permissionsAnswer:
      'Если Claude Code снова запрашивает подтверждение или блокирует действие, проверьте разрешения. Если доступна команда /permissions, можно сохранить разрешение для конкретного действия. Правила организации продолжают действовать.',
  },
  'zh-CN': {
    automaticAvailable: '可自动配置',
    openCodeV1Description:
      '为“NCF Agent Interconnect”配置 OpenCode v1。OpenCode v2 使用独立的设置。',
    openCodeV2Description:
      '为“NCF Agent Interconnect”配置 OpenCode v2。只会修改选定的配置文件，提供商和账户设置保持不变。',
    openCodeV2Next: '重启 OpenCode v2，然后在目标聊天中请助手连接。',
    showOpenCodeV1: '显示 OpenCode v1',
    applications: '应用',
    readyTitle: '可以开始工作了',
    configuredStatus: '已配置',
    applicationReadyHelp: '现在可以在此应用中工作。',
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
    readyChatHelp: '在你的应用中打开新聊天或已有聊天，然后输入 {command}。',
    confirmQuestion: '可能需要确认哪些操作？',
    confirmAnswer: '请按提示登录、信任工作区并批准客户端请求。转移已占用的智能体名称需要你的批准。',
    reloadQuestion: '应用设置或更新后该怎么做？',
    claudeConfirmAnswer:
      '如果收到提示，请登录并确认信任该项目。通过 NCF 连接或发送消息时，Claude Code 可能会要求你点击 Allow（允许）。转移已被占用的智能体名称需要你确认。',
    claudeReload:
      '保存尚未完成的输入，再重新加载 NCF 插件或重启 Claude Code。然后在要使用的聊天中重新连接。',
    cursorReload: '重启 Cursor，然后在目标聊天中发送一条消息。',
    permissionsQuestion: '可以保存权限吗？',
    permissionsAnswer:
      '如果 Claude Code 反复要求确认或阻止某项操作，请检查权限。如果可以使用 /permissions，你可以保存对该项操作的权限。组织的规则仍然适用。',
  },
  fr: {
    automaticAvailable: 'Configuration automatique disponible',
    openCodeV1Description:
      'Configurez OpenCode v1 pour « NCF Agent Interconnect ». OpenCode v2 dispose de paramètres distincts.',
    openCodeV2Description:
      'Configurez OpenCode v2 pour « NCF Agent Interconnect ». Seul le fichier de configuration sélectionné sera modifié ; les paramètres des fournisseurs et des comptes seront conservés.',
    openCodeV2Next:
      'Redémarrez OpenCode v2, puis demandez à l’assistant de se connecter depuis la discussion souhaitée.',
    showOpenCodeV1: 'Afficher OpenCode v1',
    applications: 'Applications',
    readyTitle: 'Vous pouvez commencer à travailler',
    configuredStatus: 'Configuré',
    applicationReadyHelp: 'Vous pouvez déjà travailler dans cette application.',
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
    readyChatHelp:
      'Dans votre application, ouvrez une nouvelle conversation ou reprenez-en une, puis tapez {command}.',
    confirmQuestion: 'Que devrai-je éventuellement confirmer ?',
    confirmAnswer:
      'Connectez-vous, approuvez l’espace de travail et acceptez les demandes du client lorsque cela est demandé. Le transfert d’un nom d’agent déjà utilisé nécessite votre accord.',
    reloadQuestion: 'Que faire après l’application des paramètres ou une mise à jour ?',
    claudeConfirmAnswer:
      'Si Claude Code vous le demande, connectez-vous et confirmez que vous faites confiance au projet. Claude Code peut vous demander de choisir Allow (Autoriser) pour établir une connexion ou envoyer un message via NCF. Le transfert d’un nom d’agent déjà utilisé nécessite votre accord.',
    claudeReload:
      'Enregistrez votre saisie en cours, puis rechargez les plugins NCF ou redémarrez Claude Code. Reconnectez-vous dans la discussion voulue.',
    cursorReload: 'Redémarrez Cursor et envoyez un message dans la conversation voulue.',
    permissionsQuestion: 'Puis-je enregistrer les autorisations ?',
    permissionsAnswer:
      'Si Claude Code vous demande à nouveau une confirmation ou bloque une action, vérifiez ses autorisations. Si la commande /permissions est disponible, vous pouvez mémoriser l’autorisation pour cette action précise. Les règles de votre organisation continuent de s’appliquer.',
  },
  de: {
    automaticAvailable: 'Automatische Einrichtung verfügbar',
    openCodeV1Description:
      'Richten Sie OpenCode v1 für „NCF Agent Interconnect“ ein. OpenCode v2 hat eigene Einstellungen.',
    openCodeV2Description:
      'Richten Sie OpenCode v2 für „NCF Agent Interconnect“ ein. Nur die ausgewählte Konfigurationsdatei wird geändert; Anbieter- und Kontoeinstellungen bleiben erhalten.',
    openCodeV2Next:
      'Starten Sie OpenCode v2 neu. Bitten Sie den Assistenten anschließend im gewünschten Chat, sich zu verbinden.',
    showOpenCodeV1: 'OpenCode v1 anzeigen',
    applications: 'Anwendungen',
    readyTitle: 'Sie können loslegen',
    configuredStatus: 'Eingerichtet',
    applicationReadyHelp: 'Sie können jetzt in dieser Anwendung arbeiten.',
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
    readyChatHelp:
      'Öffnen Sie in Ihrer App einen neuen oder bestehenden Chat und geben Sie {command} ein.',
    confirmQuestion: 'Was muss ich gegebenenfalls bestätigen?',
    confirmAnswer:
      'Melden Sie sich an, vertrauen Sie dem Arbeitsbereich und bestätigen Sie Client-Anfragen, wenn Sie dazu aufgefordert werden. Die Übertragung eines belegten Agentennamens erfordert Ihre Zustimmung.',
    reloadQuestion: 'Was ist nach dem Anwenden oder einem Update zu tun?',
    claudeConfirmAnswer:
      'Melden Sie sich bei Aufforderung an und bestätigen Sie, dass Sie dem Projekt vertrauen. Beim Verbinden oder Senden einer Nachricht über NCF kann Claude Code nach Ihrer Erlaubnis fragen (Allow). Die Übernahme eines bereits belegten Agentennamens erfordert Ihre Zustimmung.',
    claudeReload:
      'Speichern Sie Ihre noch nicht abgeschlossene Eingabe. Laden Sie dann die NCF-Plugins neu oder starten Sie Claude Code neu. Stellen Sie die Verbindung im gewünschten Chat erneut her.',
    cursorReload: 'Starten Sie Cursor neu und senden Sie eine Nachricht im gewünschten Chat.',
    permissionsQuestion: 'Kann ich Berechtigungen speichern?',
    permissionsAnswer:
      'Wenn Claude Code wiederholt nachfragt oder eine Aktion blockiert, prüfen Sie die Berechtigungen. Falls /permissions verfügbar ist, können Sie die Berechtigung für diese konkrete Aktion speichern. Die Regeln Ihrer Organisation gelten weiterhin.',
  },
  it: {
    automaticAvailable: 'Configurazione automatica disponibile',
    openCodeV1Description:
      'Configura OpenCode v1 per «NCF Agent Interconnect». OpenCode v2 ha impostazioni separate.',
    openCodeV2Description:
      'Configura OpenCode v2 per «NCF Agent Interconnect». Verrà modificato solo il file di configurazione selezionato; le impostazioni dei provider e degli account rimarranno invariate.',
    openCodeV2Next:
      'Riavvia OpenCode v2, poi chiedi all’assistente di connettersi dalla chat desiderata.',
    showOpenCodeV1: 'Mostra OpenCode v1',
    applications: 'Applicazioni',
    readyTitle: 'Puoi iniziare a lavorare',
    configuredStatus: 'Configurato',
    applicationReadyHelp: 'Ora puoi lavorare in questa applicazione.',
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
    readyChatHelp: 'Nella tua app, apri una chat nuova o esistente e digita {command}.',
    confirmQuestion: 'Che cosa potrei dover confermare?',
    confirmAnswer:
      'Accedi, considera attendibile l’area di lavoro e approva le richieste del client quando richiesto. Il trasferimento di un nome agente già in uso richiede la tua approvazione.',
    reloadQuestion: 'Che cosa fare dopo aver applicato le impostazioni o un aggiornamento?',
    claudeConfirmAnswer:
      'Se richiesto, accedi al tuo account e conferma che ritieni attendibile il progetto. Per connetterti o inviare un messaggio tramite NCF, Claude Code potrebbe chiederti di scegliere Allow (Consenti). Il trasferimento di un nome agente già in uso richiede la tua approvazione.',
    claudeReload:
      'Salva il testo che stai scrivendo, poi ricarica i plugin NCF o riavvia Claude Code. Riconnettiti nella chat che vuoi usare.',
    cursorReload: 'Riavvia Cursor e invia un messaggio nella chat desiderata.',
    permissionsQuestion: 'Posso salvare le autorizzazioni?',
    permissionsAnswer:
      'Se Claude Code continua a chiedere conferma o blocca un’azione, controlla le autorizzazioni. Se /permissions è disponibile, puoi salvare l’autorizzazione per quella singola azione. Le regole della tua organizzazione rimangono valide.',
  },
  es: {
    automaticAvailable: 'Configuración automática disponible',
    openCodeV1Description:
      'Configura OpenCode v1 para «NCF Agent Interconnect». OpenCode v2 tiene ajustes independientes.',
    openCodeV2Description:
      'Configura OpenCode v2 para «NCF Agent Interconnect». Solo se modificará el archivo de configuración seleccionado; se conservarán los ajustes de proveedores y cuentas.',
    openCodeV2Next:
      'Reinicia OpenCode v2 y pide al asistente que se conecte desde el chat elegido.',
    showOpenCodeV1: 'Mostrar OpenCode v1',
    applications: 'Aplicaciones',
    readyTitle: 'Ya puedes empezar a trabajar',
    configuredStatus: 'Configurado',
    applicationReadyHelp: 'Ya puedes trabajar en esta aplicación.',
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
    readyChatHelp: 'En tu aplicación, abre un chat nuevo o existente y escribe {command}.',
    confirmQuestion: '¿Qué podría tener que confirmar?',
    confirmAnswer:
      'Inicia sesión, confía en el espacio de trabajo y aprueba las solicitudes del cliente cuando se te pida. Transferir un nombre de agente ocupado requiere tu aprobación.',
    reloadQuestion: '¿Qué hago después de aplicar los ajustes o de una actualización?',
    claudeConfirmAnswer:
      'Si se te solicita, inicia sesión y confirma que confías en el proyecto. Al conectarte o enviar un mensaje mediante NCF, Claude Code puede pedirte que selecciones Allow (Permitir). Transferir un nombre de agente que ya está en uso requiere tu aprobación.',
    claudeReload:
      'Guarda el texto que hayas empezado a escribir y vuelve a cargar los complementos de NCF o reinicia Claude Code. Vuelve a conectarte en el chat que quieras usar.',
    cursorReload: 'Reinicia Cursor y envía un mensaje en el chat que quieras usar.',
    permissionsQuestion: '¿Puedo guardar los permisos?',
    permissionsAnswer:
      'Si Claude Code vuelve a pedir confirmación o bloquea una acción, revisa sus permisos. Si está disponible /permissions, puedes guardar el permiso para esa acción concreta. Las reglas de tu organización siguen vigentes.',
  },
  kk: {
    automaticAvailable: 'Автоматты баптау қолжетімді',
    openCodeV1Description:
      'OpenCode v1 нұсқасын «NCF Agent Interconnect» үшін баптаңыз. OpenCode v2 нұсқасының баптаулары бөлек.',
    openCodeV2Description:
      'OpenCode v2 нұсқасын «NCF Agent Interconnect» үшін баптаңыз. Тек таңдалған конфигурация файлы өзгереді; провайдерлердің және есептік жазбалардың баптаулары сақталады.',
    openCodeV2Next:
      'OpenCode v2 нұсқасын қайта іске қосып, қажетті чатта көмекшіден қосылуын сұраңыз.',
    showOpenCodeV1: 'OpenCode v1 нұсқасын көрсету',
    applications: 'Қолданбалар',
    readyTitle: 'Жұмысты бастауға болады',
    configuredStatus: 'Бапталған',
    applicationReadyHelp: 'Бұл қолданбада жұмысты бастай аласыз.',
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
    readyChatHelp: 'Қолданбаңызда жаңа не бұрыннан бар чатты ашып, {command} деп теріңіз.',
    confirmQuestion: 'Нені растауым қажет болуы мүмкін?',
    confirmAnswer:
      'Сұралған кезде аккаунтқа кіріңіз, жұмыс кеңістігіне сенім білдіріңіз және клиент сұрауларын мақұлдаңыз. Қолданыстағы агент атын ауыстыру үшін сіздің растауыңыз қажет.',
    reloadQuestion: 'Баптауларды қолданғаннан немесе жаңартудан кейін не істеу керек?',
    claudeConfirmAnswer:
      'Claude Code сұраса, есептік жазбаңызға кіріп, жобаға сенетініңізді растаңыз. NCF арқылы қосылғанда немесе хабарлама жібергенде Allow (Рұқсат ету) түймесін басу қажет болуы мүмкін. Қолданыстағы агент атын ауыстыру үшін сіздің растауыңыз қажет.',
    claudeReload:
      'Аяқталмаған мәтінді сақтап, NCF плагиндерін қайта жүктеңіз немесе Claude Code бағдарламасын қайта іске қосыңыз. Қажетті чатта қайта қосылыңыз.',
    cursorReload: 'Cursor қолданбасын қайта іске қосып, қажетті чатта хабарлама жіберіңіз.',
    permissionsQuestion: 'Рұқсаттарды сақтауға бола ма?',
    permissionsAnswer:
      'Claude Code қайта-қайта растауды сұраса немесе әрекетті бұғаттаса, рұқсаттарды тексеріңіз. /permissions пәрмені қолжетімді болса, нақты әрекетке берілген рұқсатты сақтай аласыз. Ұйымыңыздың ережелері күшінде қалады.',
  },
  ja: {
    automaticAvailable: '自動設定が利用可能',
    openCodeV1Description:
      'OpenCode v1 を「NCF Agent Interconnect」用に設定します。OpenCode v2 の設定は別になっています。',
    openCodeV2Description:
      'OpenCode v2 を「NCF Agent Interconnect」用に設定します。変更されるのは選択した設定ファイルのみで、プロバイダーやアカウントの設定は維持されます。',
    openCodeV2Next:
      'OpenCode v2 を再起動し、対象のチャットでアシスタントに接続を依頼してください。',
    showOpenCodeV1: 'OpenCode v1 を表示',
    applications: 'アプリケーション',
    readyTitle: '作業を始められます',
    configuredStatus: '設定済み',
    applicationReadyHelp: 'このアプリですぐに作業できます。',
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
    readyChatHelp:
      'お使いのアプリで新しいチャットまたは既存のチャットを開き、{command} と入力してください。',
    confirmQuestion: 'どのような確認が必要ですか？',
    confirmAnswer:
      '必要に応じてサインインし、ワークスペースを信頼し、クライアントの要求を承認してください。使用中のエージェント名を移すには承認が必要です。',
    reloadQuestion: '設定の適用や更新の後は？',
    claudeConfirmAnswer:
      '求められた場合は、サインインしてプロジェクトを信頼することを確認してください。NCF 経由で接続またはメッセージを送信する際に、Claude Code が Allow（許可）を求めることがあります。使用中のエージェント名を移すには、あなたの承認が必要です。',
    claudeReload:
      '入力途中の内容を保存し、NCF プラグインを再読み込みするか、Claude Code を再起動してください。その後、使用するチャットで再接続してください。',
    cursorReload: 'Cursor を再起動し、対象のチャットでメッセージを送信してください。',
    permissionsQuestion: '権限を保存できますか？',
    permissionsAnswer:
      'Claude Code が何度も確認を求めたり、操作をブロックしたりする場合は、権限を確認してください。/permissions を使用できる場合は、その操作に限って許可を保存できます。所属組織のルールは引き続き適用されます。',
  },
  'pt-BR': {
    automaticAvailable: 'Configuração automática disponível',
    openCodeV1Description:
      'Configure o OpenCode v1 para o “NCF Agent Interconnect”. O OpenCode v2 tem configurações separadas.',
    openCodeV2Description:
      'Configure o OpenCode v2 para o “NCF Agent Interconnect”. Apenas o arquivo de configuração selecionado será alterado; as configurações de provedores e contas serão preservadas.',
    openCodeV2Next:
      'Reinicie o OpenCode v2 e peça ao assistente para se conectar a partir do chat desejado.',
    showOpenCodeV1: 'Mostrar OpenCode v1',
    applications: 'Aplicativos',
    readyTitle: 'Você já pode começar a trabalhar',
    configuredStatus: 'Configurado',
    applicationReadyHelp: 'Você já pode trabalhar neste aplicativo.',
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
    readyChatHelp: 'No seu aplicativo, abra um chat novo ou existente e digite {command}.',
    confirmQuestion: 'O que posso precisar confirmar?',
    confirmAnswer:
      'Entre na conta, confie no espaço de trabalho e aprove as solicitações do cliente quando necessário. Transferir um nome de agente já ocupado exige sua aprovação.',
    reloadQuestion: 'O que fazer após aplicar as configurações ou atualizar?',
    claudeConfirmAnswer:
      'Se solicitado, entre na sua conta e confirme que você confia no projeto. Ao se conectar ou enviar uma mensagem pelo NCF, o Claude Code pode pedir que você selecione Allow (Permitir). A transferência de um nome de agente já em uso exige sua aprovação.',
    claudeReload:
      'Salve o texto que está digitando e recarregue os plugins do NCF ou reinicie o Claude Code. Conecte-se novamente no chat que deseja usar.',
    cursorReload: 'Reinicie o Cursor e envie uma mensagem no chat desejado.',
    permissionsQuestion: 'Posso salvar as permissões?',
    permissionsAnswer:
      'Se o Claude Code pedir confirmação repetidamente ou bloquear uma ação, verifique as permissões. Se /permissions estiver disponível, você pode salvar a permissão para essa ação específica. As regras da sua organização continuam valendo.',
  },
  ko: {
    automaticAvailable: '자동 설정 가능',
    openCodeV1Description:
      '“NCF Agent Interconnect”용으로 OpenCode v1을 설정합니다. OpenCode v2의 설정은 별도로 관리됩니다.',
    openCodeV2Description:
      '“NCF Agent Interconnect”용으로 OpenCode v2를 설정합니다. 선택한 구성 파일만 변경되며, 공급자와 계정 설정은 유지됩니다.',
    openCodeV2Next:
      'OpenCode v2를 다시 시작한 뒤, 원하는 채팅에서 어시스턴트에게 연결을 요청하세요.',
    showOpenCodeV1: 'OpenCode v1 표시',
    applications: '앱',
    readyTitle: '작업을 시작할 수 있습니다',
    configuredStatus: '설정 완료',
    applicationReadyHelp: '이 앱에서 바로 작업할 수 있습니다.',
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
    readyChatHelp: '사용하는 앱에서 새 채팅이나 기존 채팅을 열고 {command}를 입력하세요.',
    confirmQuestion: '어떤 내용을 확인해야 하나요?',
    confirmAnswer:
      '요청이 표시되면 로그인하고 작업 공간을 신뢰하며 클라이언트 요청을 승인하세요. 사용 중인 에이전트 이름을 이전하려면 승인이 필요합니다.',
    reloadQuestion: '설정을 적용하거나 업데이트한 후에는?',
    claudeConfirmAnswer:
      '요청이 표시되면 로그인하고 프로젝트를 신뢰한다고 확인하세요. NCF를 통해 연결하거나 메시지를 보낼 때 Claude Code가 Allow(허용)를 선택하라고 요청할 수 있습니다. 이미 사용 중인 에이전트 이름을 이전하려면 사용자의 승인이 필요합니다.',
    claudeReload:
      '작성 중인 내용을 저장한 뒤 NCF 플러그인을 다시 불러오거나 Claude Code를 다시 시작하세요. 사용할 채팅에서 다시 연결하세요.',
    cursorReload: 'Cursor를 다시 시작한 뒤 원하는 채팅에 메시지를 보내세요.',
    permissionsQuestion: '권한을 저장할 수 있나요?',
    permissionsAnswer:
      'Claude Code가 계속 확인을 요청하거나 작업을 차단하면 권한을 확인하세요. /permissions를 사용할 수 있다면 해당 작업에 대한 권한만 저장할 수 있습니다. 조직의 규칙은 계속 적용됩니다.',
  },
  tr: {
    automaticAvailable: 'Otomatik kurulum kullanılabilir',
    openCodeV1Description:
      'OpenCode v1’i “NCF Agent Interconnect” için yapılandırın. OpenCode v2’nin ayarları ayrıdır.',
    openCodeV2Description:
      'OpenCode v2’yi “NCF Agent Interconnect” için yapılandırın. Yalnızca seçilen yapılandırma dosyası değişir; sağlayıcı ve hesap ayarları korunur.',
    openCodeV2Next:
      'OpenCode v2’yi yeniden başlatın, ardından istediğiniz sohbette asistandan bağlanmasını isteyin.',
    showOpenCodeV1: 'OpenCode v1’i göster',
    applications: 'Uygulamalar',
    readyTitle: 'Çalışmaya başlayabilirsiniz',
    configuredStatus: 'Yapılandırıldı',
    applicationReadyHelp: 'Bu uygulamada hemen çalışmaya başlayabilirsiniz.',
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
    readyChatHelp: 'Uygulamanızda yeni veya mevcut bir sohbet açın ve {command} yazın.',
    confirmQuestion: 'Neleri onaylamam gerekebilir?',
    confirmAnswer:
      'İstendiğinde oturum açın, çalışma alanına güvenin ve istemci isteklerini onaylayın. Kullanılan bir ajan adının taşınması onayınızı gerektirir.',
    reloadQuestion: 'Ayarları uyguladıktan veya güncelledikten sonra ne yapmalıyım?',
    claudeConfirmAnswer:
      'İstenirse oturum açın ve projeye güvendiğinizi onaylayın. NCF üzerinden bağlanırken veya mesaj gönderirken Claude Code, Allow (İzin ver) seçeneğini kullanmanızı isteyebilir. Kullanılan bir ajan adının taşınması onayınızı gerektirir.',
    claudeReload:
      'Yazmakta olduğunuz metni kaydedin, ardından NCF eklentilerini yeniden yükleyin veya Claude Code’u yeniden başlatın. Kullanmak istediğiniz sohbette yeniden bağlanın.',
    cursorReload: 'Cursor’ı yeniden başlatın ve istediğiniz sohbette bir mesaj gönderin.',
    permissionsQuestion: 'İzinleri kaydedebilir miyim?',
    permissionsAnswer:
      'Claude Code sürekli onay istiyor veya bir işlemi engelliyorsa izinleri kontrol edin. /permissions kullanılabiliyorsa yalnızca söz konusu işlem için izni kaydedebilirsiniz. Kuruluşunuzun kuralları geçerliliğini korur.',
  },
  pl: {
    automaticAvailable: 'Dostępna automatyczna konfiguracja',
    openCodeV1Description:
      'Skonfiguruj OpenCode v1 do pracy z „NCF Agent Interconnect”. OpenCode v2 ma osobne ustawienia.',
    openCodeV2Description:
      'Skonfiguruj OpenCode v2 do pracy z „NCF Agent Interconnect”. Zmieniony zostanie tylko wybrany plik konfiguracyjny; ustawienia dostawców i kont pozostaną bez zmian.',
    openCodeV2Next:
      'Uruchom ponownie OpenCode v2, a następnie poproś asystenta o połączenie w wybranym czacie.',
    showOpenCodeV1: 'Pokaż OpenCode v1',
    applications: 'Aplikacje',
    readyTitle: 'Możesz rozpocząć pracę',
    configuredStatus: 'Skonfigurowano',
    applicationReadyHelp: 'Możesz już pracować w tej aplikacji.',
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
    readyChatHelp: 'W swojej aplikacji otwórz nowy lub istniejący czat i wpisz {command}.',
    confirmQuestion: 'Co może wymagać mojego potwierdzenia?',
    confirmAnswer:
      'Gdy pojawi się prośba, zaloguj się, zaufaj obszarowi roboczemu i zatwierdź monity klienta. Przeniesienie zajętej nazwy agenta wymaga Twojej zgody.',
    reloadQuestion: 'Co zrobić po zastosowaniu ustawień lub aktualizacji?',
    claudeConfirmAnswer:
      'Jeśli pojawi się monit, zaloguj się i potwierdź zaufanie do projektu. Przy łączeniu lub wysyłaniu wiadomości przez NCF Claude Code może poprosić o wybranie opcji Allow (Zezwól). Przeniesienie zajętej nazwy agenta wymaga Twojej zgody.',
    claudeReload:
      'Zapisz rozpoczęty tekst, a następnie przeładuj wtyczki NCF lub uruchom ponownie Claude Code. Połącz się ponownie w wybranym czacie.',
    cursorReload: 'Uruchom ponownie Cursor i wyślij wiadomość w wybranym czacie.',
    permissionsQuestion: 'Czy mogę zapisać uprawnienia?',
    permissionsAnswer:
      'Jeśli Claude Code wielokrotnie prosi o potwierdzenie lub blokuje działanie, sprawdź uprawnienia. Gdy polecenie /permissions jest dostępne, możesz zapisać zezwolenie na to konkretne działanie. Zasady Twojej organizacji nadal obowiązują.',
  },
  nl: {
    automaticAvailable: 'Automatische configuratie beschikbaar',
    openCodeV1Description:
      'Stel OpenCode v1 in voor ‘NCF Agent Interconnect’. OpenCode v2 heeft afzonderlijke instellingen.',
    openCodeV2Description:
      'Stel OpenCode v2 in voor ‘NCF Agent Interconnect’. Alleen het geselecteerde configuratiebestand wordt gewijzigd; de instellingen voor providers en accounts blijven behouden.',
    openCodeV2Next:
      'Start OpenCode v2 opnieuw en vraag de assistent in de gewenste chat om verbinding te maken.',
    showOpenCodeV1: 'OpenCode v1 tonen',
    applications: 'Apps',
    readyTitle: 'Je kunt aan de slag',
    configuredStatus: 'Ingesteld',
    applicationReadyHelp: 'Je kunt nu in deze app werken.',
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
    readyChatHelp: 'Open in je app een nieuwe of bestaande chat en typ {command}.',
    confirmQuestion: 'Wat moet ik mogelijk bevestigen?',
    confirmAnswer:
      'Meld je aan, vertrouw de werkruimte en keur verzoeken van de client goed wanneer daarom wordt gevraagd. Het overdragen van een bezette agentnaam vereist je toestemming.',
    reloadQuestion: 'Wat doe ik na het toepassen van instellingen of een update?',
    claudeConfirmAnswer:
      'Meld je aan en bevestig dat je het project vertrouwt als daarom wordt gevraagd. Bij het verbinden of verzenden van een bericht via NCF kan Claude Code je vragen om Allow (Toestaan) te kiezen. Voor het overzetten van een bezette agentnaam is je toestemming nodig.',
    claudeReload:
      'Sla tekst waaraan je nog werkt op en laad de NCF-plug-ins opnieuw of herstart Claude Code. Maak opnieuw verbinding in de chat die je wilt gebruiken.',
    cursorReload: 'Start Cursor opnieuw en stuur een bericht in de gewenste chat.',
    permissionsQuestion: 'Kan ik machtigingen opslaan?',
    permissionsAnswer:
      'Als Claude Code om bevestiging blijft vragen of een actie blokkeert, controleer dan de machtigingen. Als /permissions beschikbaar is, kun je toestemming voor die specifieke actie opslaan. De regels van je organisatie blijven gelden.',
  },
  uk: {
    automaticAvailable: 'Доступне автоматичне налаштування',
    openCodeV1Description:
      'Налаштуйте OpenCode v1 для «NCF Agent Interconnect». OpenCode v2 має окремі налаштування.',
    openCodeV2Description:
      'Налаштуйте OpenCode v2 для «NCF Agent Interconnect». Зміни торкнуться лише вибраного файлу конфігурації; налаштування провайдерів і облікових записів буде збережено.',
    openCodeV2Next:
      'Перезапустіть OpenCode v2, потім попросіть помічника підключитися в потрібному чаті.',
    showOpenCodeV1: 'Показати OpenCode v1',
    applications: 'Застосунки',
    readyTitle: 'Можна починати роботу',
    configuredStatus: 'Налаштовано',
    applicationReadyHelp: 'У цьому застосунку вже можна працювати.',
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
    readyChatHelp: 'У своєму застосунку відкрийте новий або наявний чат і введіть {command}.',
    confirmQuestion: 'Що може потребувати мого підтвердження?',
    confirmAnswer:
      'Вхід до облікового запису, довіра до робочої області та дозволи клієнта. Перенесення зайнятого імені агента потребує вашого підтвердження.',
    reloadQuestion: 'Що робити після застосування налаштувань або оновлення?',
    claudeConfirmAnswer:
      'Якщо з’явиться запит, увійдіть до облікового запису й підтвердьте довіру до проєкту. Під час підключення або надсилання повідомлення через NCF Claude Code може запропонувати натиснути Allow (Дозволити). Перенесення зайнятого імені агента потребує вашого підтвердження.',
    claudeReload:
      'Збережіть незавершений текст, а потім перезавантажте плагіни NCF або перезапустіть Claude Code. Підключіться знову в потрібному чаті.',
    cursorReload: 'Перезапустіть Cursor і надішліть повідомлення в потрібному чаті.',
    permissionsQuestion: 'Чи можна зберегти дозволи?',
    permissionsAnswer:
      'Якщо Claude Code повторно запитує підтвердження або блокує дію, перевірте дозволи. Якщо команда /permissions доступна, можна зберегти дозвіл на конкретну дію. Правила вашої організації залишаються чинними.',
  },
};

export function applicationSetupMessages(locale: Locale): ApplicationSetupMessages {
  return translations[locale];
}

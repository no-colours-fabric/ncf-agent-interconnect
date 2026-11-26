import type { Locale } from './index.js';

export const sessionDeliveryMessages = {
  en: {
    offWarning:
      'Background chat delivery is off. Turn it on to receive messages in the chat right away. While background delivery is off, messages may stay in the queue.',
    chooseProfile: 'Choose the ChatGPT profile to connect',
    connectRestartTitle: 'Restart ChatGPT',
    connectRestart: 'After connecting, quit ChatGPT completely and reopen it.',
    offer: 'Turn this on to receive messages in the background. Apply to save your choice.',
    quitBeforeChange: 'Quit ChatGPT completely before changing this setting. Reopen it afterwards.',
    checkStatus: 'Check status',
    label: 'Background chat delivery',
    login: 'All ChatGPT windows opened during this macOS login will use this profile:',
    user: 'All new ChatGPT windows for this user will use this profile:',
    profile: 'New chats in this profile will use background delivery:',
    restart: 'Quit ChatGPT completely and reopen it after changing this setting.',
    conflict: 'ChatGPT already has a different server setting. Background delivery is unavailable.',
    unavailable:
      'Could not verify the ChatGPT configuration. Check the profile selected in Applications.',
  },
  ru: {
    offWarning:
      'Фоновая доставка в чат отключена. Включите её, чтобы сообщения сразу поступали в чат. Пока фоновая доставка отключена, сообщения могут оставаться в очереди.',
    chooseProfile: 'Выберите профиль ChatGPT для подключения',
    connectRestartTitle: 'Перезапустите ChatGPT',
    connectRestart: 'После подключения полностью закройте ChatGPT и откройте его снова.',
    offer:
      'Включите, чтобы чаты получали сообщения в фоне. Нажмите «Применить», чтобы сохранить выбор.',
    quitBeforeChange:
      'Полностью закройте ChatGPT, затем измените настройку и снова откройте приложение.',
    checkStatus: 'Проверить состояние',
    label: 'Фоновая доставка в чаты',
    login: 'До выхода из macOS все вновь открытые окна ChatGPT будут использовать этот профиль:',
    user: 'Все новые окна ChatGPT этого пользователя будут использовать профиль:',
    profile: 'Фоновая доставка будет работать в чатах этого профиля:',
    restart: 'После изменения полностью закройте ChatGPT и откройте его снова.',
    conflict: 'Для ChatGPT уже задан другой сервер. Фоновая доставка недоступна.',
    unavailable:
      'Не удалось проверить настройки ChatGPT. Проверьте выбранный профиль в разделе «Приложения».',
  },
  'zh-CN': {
    offWarning:
      '聊天后台投递已关闭。开启后，消息会立即送达聊天。后台投递关闭时，消息可能会留在队列中。',
    chooseProfile: '选择要连接的 ChatGPT 配置文件',
    connectRestartTitle: '重新启动 ChatGPT',
    connectRestart: '连接后，请完全退出 ChatGPT，再重新打开。',
    offer: '开启后，聊天可在后台接收消息。点击“应用”保存选择。',
    quitBeforeChange: '更改此设置前，请完全退出 ChatGPT。更改后重新打开应用。',
    checkStatus: '检查状态',
    label: '聊天后台投递',
    login: '在本次 macOS 登录期间，新打开的所有 ChatGPT 窗口都将使用此配置文件：',
    user: '此用户新打开的所有 ChatGPT 窗口都将使用此配置文件：',
    profile: '此配置文件中的聊天将使用后台投递：',
    restart: '更改设置后，请完全退出 ChatGPT 再重新打开。',
    conflict: 'ChatGPT 已设置为使用其他服务器，无法启用后台投递。',
    unavailable: '无法验证 ChatGPT 配置。请在“应用程序”中检查所选配置文件。',
  },
  fr: {
    offWarning:
      'La livraison des messages en arrière-plan est désactivée. Activez-la pour recevoir les messages immédiatement dans la discussion. Tant qu’elle est désactivée, les messages peuvent rester en file d’attente.',
    chooseProfile: 'Choisissez le profil ChatGPT à connecter',
    connectRestartTitle: 'Redémarrez ChatGPT',
    connectRestart: 'Après la connexion, quittez complètement ChatGPT, puis rouvrez l’application.',
    offer:
      'Activez cette option pour recevoir les messages en arrière-plan. Cliquez sur Appliquer pour enregistrer votre choix.',
    quitBeforeChange:
      'Quittez complètement ChatGPT avant de modifier ce réglage. Rouvrez ensuite l’application.',
    checkStatus: 'Vérifier l’état',
    label: 'Réception des messages en arrière-plan',
    login:
      'Toutes les fenêtres ChatGPT ouvertes durant cette session macOS utiliseront ce profil :',
    user: 'Toutes les nouvelles fenêtres ChatGPT de cet utilisateur utiliseront ce profil :',
    profile: 'Les conversations de ce profil recevront les messages en arrière-plan :',
    restart: 'Après toute modification, quittez complètement ChatGPT puis rouvrez l’application.',
    conflict:
      'ChatGPT utilise déjà un autre serveur. La réception en arrière-plan est indisponible.',
    unavailable:
      'Impossible de vérifier la configuration de ChatGPT. Vérifiez le profil sélectionné dans Applications.',
  },
  de: {
    offWarning:
      'Die Hintergrundzustellung an den Chat ist deaktiviert. Aktivieren Sie sie, damit Nachrichten sofort im Chat ankommen. Solange die Hintergrundzustellung deaktiviert ist, können Nachrichten in der Warteschlange bleiben.',
    chooseProfile: 'ChatGPT-Profil für die Verbindung auswählen',
    connectRestartTitle: 'ChatGPT neu starten',
    connectRestart: 'Beenden Sie ChatGPT nach dem Verbinden vollständig und öffnen Sie es erneut.',
    offer:
      'Aktivieren Sie diese Option, um Nachrichten im Hintergrund zu empfangen. Klicken Sie zum Speichern auf „Übernehmen“.',
    quitBeforeChange:
      'Beenden Sie ChatGPT vollständig, bevor Sie diese Einstellung ändern. Öffnen Sie die App anschließend erneut.',
    checkStatus: 'Status prüfen',
    label: 'Nachrichten im Hintergrund zustellen',
    login: 'Alle in dieser macOS-Sitzung neu geöffneten ChatGPT-Fenster verwenden dieses Profil:',
    user: 'Alle neuen ChatGPT-Fenster dieses Benutzers verwenden dieses Profil:',
    profile: 'Chats in diesem Profil empfangen Nachrichten im Hintergrund:',
    restart: 'Beenden Sie ChatGPT nach einer Änderung vollständig und öffnen Sie es erneut.',
    conflict:
      'Für ChatGPT ist bereits ein anderer Server eingestellt. Die Hintergrundzustellung ist nicht verfügbar.',
    unavailable:
      'Die ChatGPT-Konfiguration konnte nicht geprüft werden. Prüfen Sie das unter Anwendungen ausgewählte Profil.',
  },
  it: {
    offWarning:
      'La consegna in background nella chat è disattivata. Attivala per ricevere subito i messaggi nella chat. Finché la consegna in background è disattivata, i messaggi potrebbero rimanere in coda.',
    chooseProfile: 'Scegli il profilo ChatGPT da collegare',
    connectRestartTitle: 'Riavvia ChatGPT',
    connectRestart: 'Dopo il collegamento, chiudi completamente ChatGPT e riaprilo.',
    offer:
      'Attiva questa opzione per ricevere i messaggi in background. Seleziona Applica per salvare la scelta.',
    quitBeforeChange:
      'Esci completamente da ChatGPT prima di modificare questa impostazione. Poi riapri l’app.',
    checkStatus: 'Verifica lo stato',
    label: 'Recapito dei messaggi in background',
    login:
      'Tutte le finestre di ChatGPT aperte durante questa sessione macOS useranno questo profilo:',
    user: 'Tutte le nuove finestre di ChatGPT di questo utente useranno questo profilo:',
    profile: 'Le chat di questo profilo riceveranno i messaggi in background:',
    restart: 'Dopo una modifica, esci completamente da ChatGPT e riaprilo.',
    conflict:
      'ChatGPT è già configurato per un altro server. Il recapito in background non è disponibile.',
    unavailable:
      'Impossibile verificare la configurazione di ChatGPT. Controlla il profilo selezionato in Applicazioni.',
  },
  es: {
    offWarning:
      'La entrega de mensajes en segundo plano al chat está desactivada. Actívala para recibir los mensajes de inmediato en el chat. Mientras esté desactivada, los mensajes pueden quedar en cola.',
    chooseProfile: 'Elige el perfil de ChatGPT que quieres conectar',
    connectRestartTitle: 'Reinicia ChatGPT',
    connectRestart:
      'Después de conectar el perfil, cierra ChatGPT por completo y vuelve a abrirlo.',
    offer:
      'Activa esta opción para recibir mensajes en segundo plano. Pulsa Aplicar para guardar tu elección.',
    quitBeforeChange:
      'Sal de ChatGPT por completo antes de cambiar este ajuste. Después, vuelve a abrir la aplicación.',
    checkStatus: 'Comprobar el estado',
    label: 'Entrega de mensajes en segundo plano',
    login:
      'Todas las ventanas de ChatGPT que abras durante esta sesión de macOS usarán este perfil:',
    user: 'Todas las ventanas nuevas de ChatGPT de este usuario usarán este perfil:',
    profile: 'Los chats de este perfil recibirán los mensajes en segundo plano:',
    restart: 'Después de cambiar este ajuste, sal de ChatGPT por completo y vuelve a abrirlo.',
    conflict:
      'ChatGPT ya tiene configurado otro servidor. La entrega en segundo plano no está disponible.',
    unavailable:
      'No se ha podido verificar la configuración de ChatGPT. Comprueba el perfil seleccionado en Aplicaciones.',
  },
  kk: {
    offWarning:
      'Чатқа фондық жеткізу өшірулі. Хабарлар чатқа бірден түсуі үшін оны қосыңыз. Фондық жеткізу өшірулі кезде хабарлар кезекте қалуы мүмкін.',
    chooseProfile: 'Қосылатын ChatGPT профилін таңдаңыз',
    connectRestartTitle: 'ChatGPT қолданбасын қайта іске қосыңыз',
    connectRestart: 'Қосылғаннан кейін ChatGPT қолданбасын толық жауып, қайта ашыңыз.',
    offer:
      'Хабарларды фондық режимде алу үшін осы параметрді қосыңыз. Таңдауды сақтау үшін «Қолдану» түймесін басыңыз.',
    quitBeforeChange:
      'Бұл параметрді өзгертпес бұрын ChatGPT қолданбасынан толық шығыңыз. Өзгерткеннен кейін қолданбаны қайта ашыңыз.',
    checkStatus: 'Күйін тексеру',
    label: 'Хабарларды чаттарға фондық режимде жеткізу',
    login:
      'Осы macOS сеансы аяқталғанша жаңадан ашылған барлық ChatGPT терезелері мына профильді пайдаланады:',
    user: 'Осы пайдаланушының барлық жаңа ChatGPT терезелері мына профильді пайдаланады:',
    profile: 'Мына профильдегі чаттарға хабарлар фондық режимде жеткізіледі:',
    restart: 'Параметрді өзгерткеннен кейін ChatGPT қолданбасынан толық шығып, оны қайта ашыңыз.',
    conflict: 'ChatGPT үшін басқа сервер таңдалған. Фондық жеткізу қолжетімсіз.',
    unavailable:
      'ChatGPT параметрлерін тексеру мүмкін болмады. «Қолданбалар» бөлімінде таңдалған профильді тексеріңіз.',
  },
  ja: {
    offWarning:
      'チャットへのバックグラウンド配信はオフです。オンにすると、メッセージがすぐにチャットに届きます。オフの間は、メッセージがキューに残る場合があります。',
    chooseProfile: '接続する ChatGPT プロファイルを選択',
    connectRestartTitle: 'ChatGPT を再起動してください',
    connectRestart: '接続後、ChatGPT を完全に終了してから、もう一度開いてください。',
    offer:
      'オンにすると、バックグラウンドでメッセージを受信できます。「適用」を押して選択を保存してください。',
    quitBeforeChange:
      'この設定を変更する前に ChatGPT を完全に終了してください。変更後、アプリを開き直してください。',
    checkStatus: '状態を確認',
    label: 'チャットへのバックグラウンド配信',
    login:
      '今回の macOS ログイン中に新しく開くすべての ChatGPT ウィンドウで、このプロファイルを使用します。',
    user: 'このユーザーが新しく開くすべての ChatGPT ウィンドウで、このプロファイルを使用します。',
    profile: 'このプロファイルのチャットではバックグラウンドでメッセージを受信します。',
    restart: '設定を変更したら、ChatGPT を完全に終了してから開き直してください。',
    conflict:
      'ChatGPT には別のサーバーが設定されているため、バックグラウンド配信は利用できません。',
    unavailable:
      'ChatGPT の設定を確認できませんでした。「アプリケーション」で選択したプロファイルを確認してください。',
  },
  'pt-BR': {
    offWarning:
      'A entrega de mensagens em segundo plano no chat está desativada. Ative-a para receber mensagens imediatamente no chat. Enquanto estiver desativada, as mensagens poderão ficar na fila.',
    chooseProfile: 'Escolha o perfil do ChatGPT que deseja conectar',
    connectRestartTitle: 'Reinicie o ChatGPT',
    connectRestart: 'Após a conexão, encerre o ChatGPT completamente e abra-o novamente.',
    offer:
      'Ative esta opção para receber mensagens em segundo plano. Clique em Aplicar para salvar a escolha.',
    quitBeforeChange:
      'Encerre o ChatGPT por completo antes de alterar esta configuração. Depois, abra o aplicativo novamente.',
    checkStatus: 'Verificar status',
    label: 'Entrega de mensagens em segundo plano',
    login: 'Todas as janelas do ChatGPT abertas durante esta sessão do macOS usarão este perfil:',
    user: 'Todas as novas janelas do ChatGPT deste usuário usarão este perfil:',
    profile: 'Os chats deste perfil receberão mensagens em segundo plano:',
    restart: 'Após alterar a configuração, encerre o ChatGPT por completo e abra-o novamente.',
    conflict:
      'O ChatGPT já está configurado para outro servidor. A entrega em segundo plano está indisponível.',
    unavailable:
      'Não foi possível verificar a configuração do ChatGPT. Confira o perfil selecionado em Aplicativos.',
  },
  ko: {
    offWarning:
      '채팅 백그라운드 전달이 꺼져 있습니다. 메시지를 채팅에서 바로 받으려면 이 기능을 켜세요. 백그라운드 전달이 꺼져 있으면 메시지가 대기열에 남을 수 있습니다.',
    chooseProfile: '연결할 ChatGPT 프로필을 선택하세요',
    connectRestartTitle: 'ChatGPT를 다시 시작하세요',
    connectRestart: '연결한 후 ChatGPT를 완전히 종료하고 다시 여세요.',
    offer: '백그라운드에서 메시지를 받으려면 이 옵션을 켜세요. 적용을 눌러 선택을 저장하세요.',
    quitBeforeChange:
      '이 설정을 변경하기 전에 ChatGPT를 완전히 종료하세요. 변경한 후 앱을 다시 여세요.',
    checkStatus: '상태 확인',
    label: '채팅에 백그라운드로 메시지 전달',
    login: '이번 macOS 로그인 세션에서 새로 여는 모든 ChatGPT 창은 다음 프로필을 사용합니다.',
    user: '이 사용자가 새로 여는 모든 ChatGPT 창은 다음 프로필을 사용합니다.',
    profile: '다음 프로필의 채팅에서 백그라운드로 메시지를 받습니다.',
    restart: '설정을 변경한 후 ChatGPT를 완전히 종료하고 다시 여세요.',
    conflict: 'ChatGPT에 다른 서버가 이미 설정되어 있어 백그라운드 전달을 사용할 수 없습니다.',
    unavailable: 'ChatGPT 설정을 확인할 수 없습니다. 애플리케이션에서 선택한 프로필을 확인하세요.',
  },
  tr: {
    offWarning:
      'Sohbete arka planda ileti teslimi kapalı. İletileri sohbetinizde hemen almak için bu özelliği açın. Arka planda teslim kapalıyken iletiler kuyrukta kalabilir.',
    chooseProfile: 'Bağlanacak ChatGPT profilini seçin',
    connectRestartTitle: 'ChatGPT’yi yeniden başlatın',
    connectRestart: 'Bağlandıktan sonra ChatGPT’yi tamamen kapatıp yeniden açın.',
    offer:
      'Arka planda mesaj almak için bu seçeneği açın. Seçiminizi kaydetmek için Uygula’ya tıklayın.',
    quitBeforeChange:
      'Bu ayarı değiştirmeden önce ChatGPT’den tamamen çıkın. Değişiklikten sonra uygulamayı yeniden açın.',
    checkStatus: 'Durumu kontrol et',
    label: 'Sohbetlere arka planda ileti teslimi',
    login: 'Bu macOS oturumu sırasında açılan tüm yeni ChatGPT pencereleri şu profili kullanır:',
    user: 'Bu kullanıcının tüm yeni ChatGPT pencereleri şu profili kullanır:',
    profile: 'Şu profildeki sohbetlere iletiler arka planda teslim edilir:',
    restart: 'Ayarı değiştirdikten sonra ChatGPT’den tamamen çıkıp uygulamayı yeniden açın.',
    conflict: 'ChatGPT için başka bir sunucu ayarlanmış. Arka planda teslim kullanılamıyor.',
    unavailable:
      'ChatGPT yapılandırması doğrulanamadı. Uygulamalar bölümünde seçili profili kontrol edin.',
  },
  pl: {
    offWarning:
      'Dostarczanie wiadomości do czatu w tle jest wyłączone. Włącz je, aby od razu otrzymywać wiadomości w czacie. Gdy dostarczanie w tle jest wyłączone, wiadomości mogą pozostawać w kolejce.',
    chooseProfile: 'Wybierz profil ChatGPT do połączenia',
    connectRestartTitle: 'Uruchom ponownie ChatGPT',
    connectRestart: 'Po połączeniu całkowicie zamknij ChatGPT i otwórz go ponownie.',
    offer: 'Włącz tę opcję, aby odbierać wiadomości w tle. Kliknij Zastosuj, aby zapisać wybór.',
    quitBeforeChange:
      'Przed zmianą tego ustawienia całkowicie zamknij ChatGPT. Po zmianie otwórz aplikację ponownie.',
    checkStatus: 'Sprawdź stan',
    label: 'Dostarczanie wiadomości do czatów w tle',
    login: 'Wszystkie okna ChatGPT otwarte podczas tej sesji macOS będą używać tego profilu:',
    user: 'Wszystkie nowe okna ChatGPT tego użytkownika będą używać tego profilu:',
    profile: 'Czaty w tym profilu będą odbierać wiadomości w tle:',
    restart: 'Po zmianie ustawienia całkowicie zamknij ChatGPT i otwórz aplikację ponownie.',
    conflict: 'W ChatGPT ustawiono już inny serwer. Dostarczanie w tle jest niedostępne.',
    unavailable:
      'Nie udało się sprawdzić konfiguracji ChatGPT. Sprawdź profil wybrany w sekcji Aplikacje.',
  },
  nl: {
    offWarning:
      'Berichtbezorging op de achtergrond is uitgeschakeld. Schakel dit in om berichten direct in de chat te ontvangen. Zolang bezorging op de achtergrond is uitgeschakeld, kunnen berichten in de wachtrij blijven.',
    chooseProfile: 'Kies het ChatGPT-profiel dat je wilt verbinden',
    connectRestartTitle: 'Start ChatGPT opnieuw',
    connectRestart: 'Sluit ChatGPT na het verbinden volledig af en open de app opnieuw.',
    offer:
      'Zet deze optie aan om berichten op de achtergrond te ontvangen. Klik op Toepassen om je keuze op te slaan.',
    quitBeforeChange:
      'Sluit ChatGPT volledig af voordat je deze instelling wijzigt. Open de app daarna opnieuw.',
    checkStatus: 'Status controleren',
    label: 'Berichten op de achtergrond bezorgen',
    login:
      'Alle ChatGPT-vensters die tijdens deze macOS-sessie worden geopend, gebruiken dit profiel:',
    user: 'Alle nieuwe ChatGPT-vensters van deze gebruiker gebruiken dit profiel:',
    profile: 'Chats in dit profiel ontvangen berichten op de achtergrond:',
    restart: 'Sluit ChatGPT na een wijziging volledig af en open de app opnieuw.',
    conflict:
      'Voor ChatGPT is al een andere server ingesteld. Bezorging op de achtergrond is niet beschikbaar.',
    unavailable:
      'De ChatGPT-configuratie kon niet worden gecontroleerd. Controleer het gekozen profiel onder Apps.',
  },
  uk: {
    offWarning:
      'Фонову доставку в чат вимкнено. Увімкніть її, щоб повідомлення одразу надходили в чат. Поки фонову доставку вимкнено, повідомлення можуть залишатися в черзі.',
    chooseProfile: 'Виберіть профіль ChatGPT для підключення',
    connectRestartTitle: 'Перезапустіть ChatGPT',
    connectRestart: 'Після підключення повністю закрийте ChatGPT і відкрийте його знову.',
    offer:
      'Увімкніть цей параметр, щоб чати отримували повідомлення у фоновому режимі. Натисніть «Застосувати», щоб зберегти вибір.',
    quitBeforeChange:
      'Повністю закрийте ChatGPT, перш ніж змінювати це налаштування. Потім відкрийте застосунок знову.',
    checkStatus: 'Перевірити стан',
    label: 'Фонова доставка повідомлень у чати',
    login: 'До виходу з macOS усі нові вікна ChatGPT використовуватимуть цей профіль:',
    user: 'Усі нові вікна ChatGPT цього користувача використовуватимуть профіль:',
    profile: 'Чати в цьому профілі отримуватимуть повідомлення у фоновому режимі:',
    restart: 'Після зміни налаштування повністю закрийте ChatGPT і відкрийте його знову.',
    conflict: 'Для ChatGPT уже налаштовано інший сервер. Фонова доставка недоступна.',
    unavailable:
      'Не вдалося перевірити налаштування ChatGPT. Перевірте профіль, вибраний у розділі «Програми».',
  },
} satisfies Record<
  Locale,
  Record<
    | 'chooseProfile'
    | 'connectRestart'
    | 'connectRestartTitle'
    | 'offWarning'
    | 'offer'
    | 'label'
    | 'login'
    | 'user'
    | 'profile'
    | 'restart'
    | 'quitBeforeChange'
    | 'checkStatus'
    | 'conflict'
    | 'unavailable',
    string
  >
>;

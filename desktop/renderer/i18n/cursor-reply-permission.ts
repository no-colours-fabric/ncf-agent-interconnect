import type { Locale } from './index.js';

export interface CursorReplyPermissionMessages {
  title: string;
  intro: string;
  instructions: string;
  scope: string;
  entryLabel: string;
  copy: string;
  copied: string;
  copyFailed: string;
}

const messages: Record<Locale, CursorReplyPermissionMessages> = {
  en: {
    title: 'Allow automatic replies in Cursor',
    intro:
      'Cursor Auto-review can block replies sent through NCF Agent Interconnect before they reach the app.',
    instructions:
      'Open Settings → Agents → Approvals & Execution in Cursor and add this entry to the active MCP allowlist. If Cursor says permissions are managed elsewhere, add it to that controlling list instead.',
    scope:
      'This permits every call to the agent_send tool in the current permission scope, not only replies. Other NCF Agent Interconnect tools, run modes, existing permissions and organization policy remain unchanged.',
    entryLabel: 'MCP allowlist entry',
    copy: 'Copy allowlist entry',
    copied: 'Allowlist entry copied.',
    copyFailed: 'Could not copy the allowlist entry. Select and copy it manually.',
  },
  ru: {
    title: 'Разрешите автоматические ответы в Cursor',
    intro:
      'Автопроверка Cursor может заблокировать ответы через NCF Agent Interconnect до их передачи приложению.',
    instructions:
      'Откройте в Cursor раздел Settings → Agents → Approvals & Execution и добавьте эту запись в действующий список разрешённых MCP-инструментов. Если Cursor сообщает, что разрешения управляются в другом месте, добавьте запись в указанный управляющий список.',
    scope:
      'Запись разрешает все вызовы инструмента agent_send в текущей области разрешений, а не только ответы. Другие инструменты NCF Agent Interconnect, режимы запуска, действующие разрешения и политика организации не меняются.',
    entryLabel: 'Запись списка разрешённых MCP-инструментов',
    copy: 'Копировать запись',
    copied: 'Запись скопирована.',
    copyFailed: 'Не удалось скопировать запись. Выделите и скопируйте её вручную.',
  },
  'zh-CN': {
    title: '允许 Cursor 自动回复',
    intro: 'Cursor 自动审查可能会在回复到达 NCF Agent Interconnect 之前将其拦截。',
    instructions:
      '在 Cursor 中打开 Settings → Agents → Approvals & Execution，将此条目添加到当前生效的 MCP 允许列表。如果 Cursor 提示权限由其他位置管理，请改为将其添加到相应的管理列表。',
    scope:
      '此条目会允许当前权限范围内对 agent_send 工具的所有调用，而不仅是回复。其他 NCF Agent Interconnect 工具、运行模式、现有权限和组织策略均不会更改。',
    entryLabel: 'MCP 允许列表条目',
    copy: '复制允许列表条目',
    copied: '已复制允许列表条目。',
    copyFailed: '无法复制允许列表条目。请选中并手动复制。',
  },
  fr: {
    title: 'Autoriser les réponses automatiques dans Cursor',
    intro:
      'La vérification automatique de Cursor peut bloquer les réponses envoyées via NCF Agent Interconnect avant leur arrivée dans l’application.',
    instructions:
      'Dans Cursor, ouvrez Settings → Agents → Approvals & Execution et ajoutez cette entrée à la liste d’autorisation MCP active. Si Cursor indique que les autorisations sont gérées ailleurs, ajoutez-la plutôt à la liste concernée.',
    scope:
      'Cette entrée autorise tous les appels à l’outil agent_send dans la portée d’autorisation actuelle, et pas seulement les réponses. Les autres outils NCF Agent Interconnect, les modes d’exécution, les autorisations existantes et la politique de l’organisation restent inchangés.',
    entryLabel: 'Entrée de la liste d’autorisation MCP',
    copy: 'Copier l’entrée d’autorisation',
    copied: 'Entrée d’autorisation copiée.',
    copyFailed:
      'Impossible de copier l’entrée d’autorisation. Sélectionnez-la et copiez-la manuellement.',
  },
  de: {
    title: 'Automatische Antworten in Cursor zulassen',
    intro:
      'Die automatische Prüfung von Cursor kann über NCF Agent Interconnect gesendete Antworten blockieren, bevor sie die Anwendung erreichen.',
    instructions:
      'Öffnen Sie in Cursor Settings → Agents → Approvals & Execution und fügen Sie diesen Eintrag der aktiven MCP-Zulassungsliste hinzu. Falls Cursor meldet, dass Berechtigungen an anderer Stelle verwaltet werden, fügen Sie ihn stattdessen dort hinzu.',
    scope:
      'Der Eintrag erlaubt in diesem Berechtigungsbereich alle Aufrufe des Werkzeugs agent_send, nicht nur Antworten. Andere Werkzeuge von NCF Agent Interconnect, Ausführungsmodi, bestehende Berechtigungen und Organisationsrichtlinien bleiben unverändert.',
    entryLabel: 'Eintrag der MCP-Zulassungsliste',
    copy: 'Zulassungseintrag kopieren',
    copied: 'Zulassungseintrag kopiert.',
    copyFailed:
      'Der Zulassungseintrag konnte nicht kopiert werden. Wählen Sie ihn aus und kopieren Sie ihn manuell.',
  },
  it: {
    title: 'Consenti le risposte automatiche in Cursor',
    intro:
      'La revisione automatica di Cursor può bloccare le risposte inviate tramite NCF Agent Interconnect prima che raggiungano l’applicazione.',
    instructions:
      'In Cursor, apri Settings → Agents → Approvals & Execution e aggiungi questa voce all’elenco MCP consentito attivo. Se Cursor indica che le autorizzazioni sono gestite altrove, aggiungila invece all’elenco che le gestisce.',
    scope:
      'La voce consente tutte le chiamate allo strumento agent_send nell’ambito di autorizzazione corrente, non soltanto le risposte. Gli altri strumenti NCF Agent Interconnect, le modalità di esecuzione, le autorizzazioni esistenti e i criteri dell’organizzazione restano invariati.',
    entryLabel: 'Voce dell’elenco MCP consentito',
    copy: 'Copia voce consentita',
    copied: 'Voce consentita copiata.',
    copyFailed: 'Impossibile copiare la voce consentita. Selezionala e copiala manualmente.',
  },
  es: {
    title: 'Permitir respuestas automáticas en Cursor',
    intro:
      'La revisión automática de Cursor puede bloquear las respuestas enviadas mediante NCF Agent Interconnect antes de que lleguen a la aplicación.',
    instructions:
      'En Cursor, abre Settings → Agents → Approvals & Execution y añade esta entrada a la lista de permitidos de MCP activa. Si Cursor indica que los permisos se administran en otro lugar, añádela a la lista que los controla.',
    scope:
      'La entrada permite todas las llamadas a la herramienta agent_send dentro del ámbito de permisos actual, no solo las respuestas. Las demás herramientas de NCF Agent Interconnect, los modos de ejecución, los permisos existentes y la política de la organización no cambian.',
    entryLabel: 'Entrada de la lista de permitidos de MCP',
    copy: 'Copiar entrada permitida',
    copied: 'Entrada permitida copiada.',
    copyFailed: 'No se pudo copiar la entrada permitida. Selecciónala y cópiala manualmente.',
  },
  kk: {
    title: 'Cursor ішінде автоматты жауаптарға рұқсат беру',
    intro:
      'Cursor автоматты тексеруі NCF Agent Interconnect арқылы жіберілген жауаптарды қолданбаға жетпей тұрып бұғаттауы мүмкін.',
    instructions:
      'Cursor ішінде Settings → Agents → Approvals & Execution бөлімін ашып, осы жазбаны белсенді MCP рұқсаттар тізіміне қосыңыз. Егер Cursor рұқсаттар басқа жерде басқарылатынын көрсетсе, жазбаны сол басқарушы тізімге қосыңыз.',
    scope:
      'Бұл жазба ағымдағы рұқсаттар аясында agent_send құралының тек жауаптарын емес, барлық шақыруларын рұқсат етеді. NCF Agent Interconnect қолданбасының басқа құралдары, іске қосу режимдері, қолданыстағы рұқсаттар және ұйым саясаты өзгермейді.',
    entryLabel: 'MCP рұқсаттар тізімінің жазбасы',
    copy: 'Рұқсат жазбасын көшіру',
    copied: 'Рұқсат жазбасы көшірілді.',
    copyFailed: 'Рұқсат жазбасын көшіру мүмкін болмады. Оны таңдап, қолмен көшіріңіз.',
  },
  ja: {
    title: 'Cursor で自動返信を許可する',
    intro:
      'Cursor の自動レビューにより、NCF Agent Interconnect から送信する返信がアプリに届く前にブロックされることがあります。',
    instructions:
      'Cursor で Settings → Agents → Approvals & Execution を開き、この項目を現在有効な MCP 許可リストに追加してください。権限が別の場所で管理されていると Cursor に表示された場合は、その管理元のリストに追加してください。',
    scope:
      'この項目は、現在の権限範囲で返信に限らず agent_send ツールのすべての呼び出しを許可します。NCF Agent Interconnect のほかのツール、実行モード、既存の権限、組織のポリシーは変更されません。',
    entryLabel: 'MCP 許可リストの項目',
    copy: '許可リストの項目をコピー',
    copied: '許可リストの項目をコピーしました。',
    copyFailed:
      '許可リストの項目をコピーできませんでした。項目を選択して手動でコピーしてください。',
  },
  'pt-BR': {
    title: 'Permitir respostas automáticas no Cursor',
    intro:
      'A revisão automática do Cursor pode bloquear respostas enviadas pelo NCF Agent Interconnect antes que elas cheguem ao aplicativo.',
    instructions:
      'No Cursor, abra Settings → Agents → Approvals & Execution e adicione esta entrada à lista de permissões MCP ativa. Se o Cursor informar que as permissões são gerenciadas em outro local, adicione-a à lista responsável por esse gerenciamento.',
    scope:
      'A entrada permite todas as chamadas à ferramenta agent_send no escopo de permissão atual, não apenas respostas. As outras ferramentas do NCF Agent Interconnect, os modos de execução, as permissões existentes e a política da organização permanecem inalterados.',
    entryLabel: 'Entrada da lista de permissões MCP',
    copy: 'Copiar entrada de permissão',
    copied: 'Entrada de permissão copiada.',
    copyFailed:
      'Não foi possível copiar a entrada de permissão. Selecione-a e copie-a manualmente.',
  },
  ko: {
    title: 'Cursor에서 자동 응답 허용',
    intro:
      'Cursor 자동 검토가 NCF Agent Interconnect를 통해 보내는 응답을 앱에 도달하기 전에 차단할 수 있습니다.',
    instructions:
      'Cursor에서 Settings → Agents → Approvals & Execution을 열고 이 항목을 현재 적용 중인 MCP 허용 목록에 추가하세요. 권한이 다른 위치에서 관리된다고 Cursor에 표시되면 해당 관리 목록에 추가하세요.',
    scope:
      '이 항목은 현재 권한 범위에서 응답뿐 아니라 agent_send 도구의 모든 호출을 허용합니다. NCF Agent Interconnect의 다른 도구, 실행 모드, 기존 권한과 조직 정책은 변경되지 않습니다.',
    entryLabel: 'MCP 허용 목록 항목',
    copy: '허용 목록 항목 복사',
    copied: '허용 목록 항목을 복사했습니다.',
    copyFailed: '허용 목록 항목을 복사하지 못했습니다. 항목을 선택해 직접 복사하세요.',
  },
  tr: {
    title: 'Cursor’da otomatik yanıtlara izin verin',
    intro:
      'Cursor otomatik incelemesi, NCF Agent Interconnect üzerinden gönderilen yanıtları uygulamaya ulaşmadan engelleyebilir.',
    instructions:
      'Cursor’da Settings → Agents → Approvals & Execution bölümünü açın ve bu girdiyi etkin MCP izin listesine ekleyin. Cursor izinlerin başka bir yerde yönetildiğini belirtiyorsa girdiyi ilgili yönetim listesine ekleyin.',
    scope:
      'Bu girdi, geçerli izin kapsamında yalnızca yanıtları değil agent_send aracının tüm çağrılarını etkinleştirir. Diğer NCF Agent Interconnect araçları, çalıştırma modları, mevcut izinler ve kuruluş ilkesi değişmez.',
    entryLabel: 'MCP izin listesi girdisi',
    copy: 'İzin listesi girdisini kopyala',
    copied: 'İzin listesi girdisi kopyalandı.',
    copyFailed: 'İzin listesi girdisi kopyalanamadı. Girdiyi seçip elle kopyalayın.',
  },
  pl: {
    title: 'Zezwól na automatyczne odpowiedzi w Cursor',
    intro:
      'Automatyczna weryfikacja Cursor może zablokować odpowiedzi wysyłane przez NCF Agent Interconnect, zanim dotrą one do aplikacji.',
    instructions:
      'W Cursor otwórz Settings → Agents → Approvals & Execution i dodaj ten wpis do aktywnej listy dozwolonych narzędzi MCP. Jeśli Cursor wskazuje, że uprawnienia są zarządzane w innym miejscu, dodaj wpis do właściwej listy zarządzającej.',
    scope:
      'Wpis zezwala na wszystkie wywołania narzędzia agent_send w bieżącym zakresie uprawnień, a nie tylko na odpowiedzi. Pozostałe narzędzia NCF Agent Interconnect, tryby uruchamiania, istniejące uprawnienia i zasady organizacji pozostają bez zmian.',
    entryLabel: 'Wpis listy dozwolonych narzędzi MCP',
    copy: 'Kopiuj wpis listy',
    copied: 'Wpis listy skopiowano.',
    copyFailed: 'Nie udało się skopiować wpisu listy. Zaznacz go i skopiuj ręcznie.',
  },
  nl: {
    title: 'Automatische antwoorden in Cursor toestaan',
    intro:
      'De automatische controle van Cursor kan antwoorden via NCF Agent Interconnect blokkeren voordat ze de app bereiken.',
    instructions:
      'Open in Cursor Settings → Agents → Approvals & Execution en voeg deze vermelding toe aan de actieve MCP-toelatingslijst. Als Cursor aangeeft dat machtigingen elders worden beheerd, voeg de vermelding dan toe aan de lijst die ze beheert.',
    scope:
      'Deze vermelding staat binnen het huidige machtigingsbereik alle aanroepen van het hulpmiddel agent_send toe, niet alleen antwoorden. Andere hulpmiddelen van NCF Agent Interconnect, uitvoeringsmodi, bestaande machtigingen en het organisatiebeleid blijven ongewijzigd.',
    entryLabel: 'Vermelding in de MCP-toelatingslijst',
    copy: 'Toelatingsvermelding kopiëren',
    copied: 'Toelatingsvermelding gekopieerd.',
    copyFailed:
      'De toelatingsvermelding kon niet worden gekopieerd. Selecteer en kopieer deze handmatig.',
  },
  uk: {
    title: 'Дозвольте автоматичні відповіді в Cursor',
    intro:
      'Автоперевірка Cursor може заблокувати відповіді через NCF Agent Interconnect до їх передавання застосунку.',
    instructions:
      'Відкрийте в Cursor розділ Settings → Agents → Approvals & Execution і додайте цей запис до активного списку дозволених MCP-інструментів. Якщо Cursor повідомляє, що дозволами керують в іншому місці, додайте запис до відповідного керівного списку.',
    scope:
      'Запис дозволяє всі виклики інструмента agent_send у поточній області дозволів, а не лише відповіді. Інші інструменти NCF Agent Interconnect, режими запуску, наявні дозволи та політика організації не змінюються.',
    entryLabel: 'Запис списку дозволених MCP-інструментів',
    copy: 'Копіювати запис',
    copied: 'Запис скопійовано.',
    copyFailed: 'Не вдалося скопіювати запис. Виділіть і скопіюйте його вручну.',
  },
};

export const cursorReplyPermissionMessages = (locale: Locale): CursorReplyPermissionMessages =>
  messages[locale];

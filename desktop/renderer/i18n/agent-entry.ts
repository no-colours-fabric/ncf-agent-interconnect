import type { AgentApplication } from '../agent-entry-model.js';
import type { Locale } from './index.js';

export interface AgentEntryMessages {
  agentsConnectionGuide: string;
  agentsCopyCommand: string;
  agentsCreationConnected: string;
  agentsCreationNoConnected: string;
  agentsManualDiagnosticIntro: string;
  agentsManualDiagnosticLink: string;
  agentsManualDiagnosticAction: string;
  dialogAddAgent: string;
  dialogAddAgentBody: string;
  dialogManualAgentDiagnostic: string;
  agentEmptyPrompt: string;
  aionUiApplication: string;
}

const messages: Record<Locale, AgentEntryMessages> = {
  en: {
    agentsConnectionGuide:
      'Open a new or existing chat in a supported app and ask the assistant to connect under a name you choose.',
    agentsCopyCommand: 'Copy',
    agentsCreationConnected:
      'Start with several chats in one app. Ask each assistant to connect under a name you choose and give it a role in the shared task. Configured apps: {applications}.',
    agentsCreationNoConnected:
      'Choose a name and a role in the shared task, then ask the assistant to connect in a chat in your app. For application or profile setup, open {applicationsPage}. Supported apps: {applications}.',
    agentsManualDiagnosticIntro: 'For diagnostics:',
    agentsManualDiagnosticLink: 'Create an agent manually',
    agentsManualDiagnosticAction: 'Create an agent manually for diagnostics',
    dialogAddAgent: 'Create an agent manually',
    dialogAddAgentBody:
      'Create agents from chats in your apps: ask the assistant to connect under a name you choose and give it a role in the shared task.',
    dialogManualAgentDiagnostic:
      'After creating an agent here, open a chat in a configured app and ask the assistant to connect using the same name. You can also simulate the agent’s activity with this app’s controls for diagnostics.',
    agentEmptyPrompt: 'No agents yet.',
    aionUiApplication: 'AionUi with Cursor Agent',
  },
  ru: {
    agentsConnectionGuide:
      'Откройте новый или существующий чат в поддерживаемой программе и попросите помощника подключиться под выбранным вами именем.',
    agentsCopyCommand: 'Скопировать',
    agentsCreationConnected:
      'Начните с нескольких чатов в одной программе. Попросите каждого помощника подключиться под выбранным вами именем и назначьте ему роль в общей задаче. Настроенные программы: {applications}.',
    agentsCreationNoConnected:
      'Выберите имя и роль в общей задаче, затем попросите помощника подключиться в чате вашей программы. Настройка программ и профилей — в разделе «{applicationsPage}». Поддерживаемые программы: {applications}.',
    agentsManualDiagnosticIntro: 'Для диагностики:',
    agentsManualDiagnosticLink: 'Создать агента вручную',
    agentsManualDiagnosticAction: 'Создать агента вручную для диагностики',
    dialogAddAgent: 'Создать агента вручную',
    dialogAddAgentBody:
      'Создавайте агентов из чатов в ваших программах: попросите помощника подключиться под выбранным вами именем и назначьте ему роль в общей задаче.',
    dialogManualAgentDiagnostic:
      'После создания агента здесь откройте чат в настроенной программе и попросите помощника подключиться под тем же именем. Для диагностики можно также имитировать его работу средствами этого приложения.',
    agentEmptyPrompt: 'Агентов пока нет.',
    aionUiApplication: 'AionUi с Cursor Agent',
  },
  'zh-CN': {
    agentsConnectionGuide: '在支持的应用中打开新聊天或已有聊天，请助手以您选择的名称连接。',
    agentsCopyCommand: '复制',
    agentsCreationConnected:
      '先在同一个应用中打开多个聊天。请每位助手以您指定的名称连接，并为其分配共同任务中的角色。已配置的应用：{applications}。',
    agentsCreationNoConnected:
      '选择名称和共同任务中的角色，然后在您所用应用的聊天中请助手连接。如需设置应用或配置方案，请打开“{applicationsPage}”。支持的应用：{applications}。',
    agentsManualDiagnosticIntro: '诊断用途：',
    agentsManualDiagnosticLink: '手动创建智能体',
    agentsManualDiagnosticAction: '手动创建智能体以进行诊断',
    dialogAddAgent: '手动创建智能体',
    dialogAddAgentBody:
      '在您所用应用的聊天中创建智能体：请助手以您指定的名称连接，并为其分配共同任务中的角色。',
    dialogManualAgentDiagnostic:
      '在此创建智能体后，请在已配置的应用中打开聊天，让助手使用相同名称连接。您也可以使用本应用的控件模拟智能体的活动，以进行诊断。',
    agentEmptyPrompt: '暂无智能体。',
    aionUiApplication: 'AionUi（Cursor Agent）',
  },
  fr: {
    agentsConnectionGuide:
      'Ouvrez une nouvelle discussion ou une discussion existante dans une application prise en charge et demandez à l’assistant de se connecter sous le nom de votre choix.',
    agentsCopyCommand: 'Copier',
    agentsCreationConnected:
      'Commencez avec plusieurs discussions dans une seule application. Demandez à chaque assistant de se connecter sous le nom de votre choix et attribuez-lui un rôle dans la tâche commune. Applications configurées : {applications}.',
    agentsCreationNoConnected:
      'Choisissez un nom et un rôle dans la tâche commune, puis demandez à l’assistant de se connecter dans une discussion de votre application. Pour configurer une application ou un profil, ouvrez « {applicationsPage} ». Applications prises en charge : {applications}.',
    agentsManualDiagnosticIntro: 'Pour le diagnostic :',
    agentsManualDiagnosticLink: 'Créer un agent manuellement',
    agentsManualDiagnosticAction: 'Créer un agent manuellement pour le diagnostic',
    dialogAddAgent: 'Créer un agent manuellement',
    dialogAddAgentBody:
      'Créez les agents depuis les discussions de vos applications : demandez à l’assistant de se connecter sous le nom de votre choix et attribuez-lui un rôle dans la tâche commune.',
    dialogManualAgentDiagnostic:
      'Après avoir créé un agent ici, ouvrez une discussion dans une application configurée et demandez à l’assistant de se connecter avec le même nom. Vous pouvez aussi utiliser les commandes de cette application pour simuler l’activité de l’agent à des fins de diagnostic.',
    agentEmptyPrompt: 'Aucun agent pour le moment.',
    aionUiApplication: 'AionUi avec Cursor Agent',
  },
  de: {
    agentsConnectionGuide:
      'Öffnen Sie in einer unterstützten App einen neuen oder bestehenden Chat und bitten Sie den Assistenten, sich unter einem Namen Ihrer Wahl zu verbinden.',
    agentsCopyCommand: 'Kopieren',
    agentsCreationConnected:
      'Beginnen Sie mit mehreren Chats in einer App. Bitten Sie jeden Assistenten, sich unter einem Namen Ihrer Wahl zu verbinden, und weisen Sie ihm eine Rolle in der gemeinsamen Aufgabe zu. Eingerichtete Apps: {applications}.',
    agentsCreationNoConnected:
      'Wählen Sie einen Namen und eine Rolle in der gemeinsamen Aufgabe. Bitten Sie dann den Assistenten in einem Chat Ihrer App, sich zu verbinden. Zum Einrichten einer App oder eines Profils öffnen Sie „{applicationsPage}“. Unterstützte Apps: {applications}.',
    agentsManualDiagnosticIntro: 'Für die Diagnose:',
    agentsManualDiagnosticLink: 'Agent manuell erstellen',
    agentsManualDiagnosticAction: 'Agent zu Diagnosezwecken manuell erstellen',
    dialogAddAgent: 'Agent manuell erstellen',
    dialogAddAgentBody:
      'Erstellen Sie Agenten über die Chats Ihrer Apps: Bitten Sie den Assistenten, sich unter einem Namen Ihrer Wahl zu verbinden, und weisen Sie ihm eine Rolle in der gemeinsamen Aufgabe zu.',
    dialogManualAgentDiagnostic:
      'Nachdem Sie hier einen Agenten erstellt haben, öffnen Sie einen Chat in einer eingerichteten App und bitten Sie den Assistenten, sich unter demselben Namen zu verbinden. Zur Diagnose können Sie die Aktivität des Agenten auch mit den Bedienelementen dieser App simulieren.',
    agentEmptyPrompt: 'Noch keine Agenten vorhanden.',
    aionUiApplication: 'AionUi mit Cursor Agent',
  },
  it: {
    agentsConnectionGuide:
      'Apri una chat nuova o esistente in un’app supportata e chiedi all’assistente di connettersi con un nome a tua scelta.',
    agentsCopyCommand: 'Copia',
    agentsCreationConnected:
      'Inizia con più chat nella stessa app. Chiedi a ogni assistente di connettersi con un nome a tua scelta e assegnagli un ruolo nel compito comune. App configurate: {applications}.',
    agentsCreationNoConnected:
      'Scegli un nome e un ruolo nel compito comune, poi chiedi all’assistente di connettersi in una chat della tua app. Per configurare un’app o un profilo, apri «{applicationsPage}». App supportate: {applications}.',
    agentsManualDiagnosticIntro: 'Per la diagnostica:',
    agentsManualDiagnosticLink: 'Crea un agente manualmente',
    agentsManualDiagnosticAction: 'Crea un agente manualmente per la diagnostica',
    dialogAddAgent: 'Crea un agente manualmente',
    dialogAddAgentBody:
      'Crea gli agenti dalle chat delle tue app: chiedi all’assistente di connettersi con un nome a tua scelta e assegnagli un ruolo nel compito comune.',
    dialogManualAgentDiagnostic:
      'Dopo aver creato un agente qui, apri una chat in un’app configurata e chiedi all’assistente di connettersi con lo stesso nome. Puoi anche usare i controlli di questa app per simulare l’attività dell’agente a fini diagnostici.',
    agentEmptyPrompt: 'Non ci sono ancora agenti.',
    aionUiApplication: 'AionUi con Cursor Agent',
  },
  es: {
    agentsConnectionGuide:
      'Abre un chat nuevo o existente en una aplicación compatible y pide al asistente que se conecte con el nombre que elijas.',
    agentsCopyCommand: 'Copiar',
    agentsCreationConnected:
      'Empieza con varios chats en una misma aplicación. Pide a cada asistente que se conecte con el nombre que elijas y asígnale un papel en la tarea común. Aplicaciones configuradas: {applications}.',
    agentsCreationNoConnected:
      'Elige un nombre y un papel en la tarea común y pide al asistente que se conecte desde un chat de tu aplicación. Para configurar una aplicación o un perfil, abre «{applicationsPage}». Aplicaciones compatibles: {applications}.',
    agentsManualDiagnosticIntro: 'Para el diagnóstico:',
    agentsManualDiagnosticLink: 'Crear un agente manualmente',
    agentsManualDiagnosticAction: 'Crear un agente manualmente para diagnóstico',
    dialogAddAgent: 'Crear un agente manualmente',
    dialogAddAgentBody:
      'Crea los agentes desde los chats de tus aplicaciones: pide al asistente que se conecte con el nombre que elijas y asígnale un papel en la tarea común.',
    dialogManualAgentDiagnostic:
      'Después de crear un agente aquí, abre un chat en una aplicación configurada y pide al asistente que se conecte con el mismo nombre. También puedes usar los controles de esta aplicación para simular la actividad del agente con fines de diagnóstico.',
    agentEmptyPrompt: 'Aún no hay agentes.',
    aionUiApplication: 'AionUi con Cursor Agent',
  },
  kk: {
    agentsConnectionGuide:
      'Қолдау көрсетілетін қолданбада жаңа не бұрыннан бар чатты ашып, көмекшіден өзіңіз таңдаған атпен қосылуын сұраңыз.',
    agentsCopyCommand: 'Көшіру',
    agentsCreationConnected:
      'Бір қолданбадағы бірнеше чаттан бастаңыз. Әр көмекшіден өзіңіз таңдаған атпен қосылуын сұрап, оған ортақ тапсырмадағы рөлін белгілеңіз. Бапталған қолданбалар: {applications}.',
    agentsCreationNoConnected:
      'Ортақ тапсырма үшін ат пен рөл таңдап, қолданбаңыздың чатында көмекшіден қосылуын сұраңыз. Қолданба мен профильді баптау «{applicationsPage}» бөлімінде. Қолдау көрсетілетін қолданбалар: {applications}.',
    agentsManualDiagnosticIntro: 'Диагностика үшін:',
    agentsManualDiagnosticLink: 'Агентті қолмен жасау',
    agentsManualDiagnosticAction: 'Диагностика үшін агентті қолмен жасау',
    dialogAddAgent: 'Агентті қолмен жасау',
    dialogAddAgentBody:
      'Агенттерді қолданбаларыңыздағы чаттардан жасаңыз: көмекшіден өзіңіз таңдаған атпен қосылуын сұрап, оған ортақ тапсырмадағы рөлін белгілеңіз.',
    dialogManualAgentDiagnostic:
      'Агентті осында жасағаннан кейін, бапталған қолданбада чат ашып, көмекшіден сол атпен қосылуын сұраңыз. Диагностика үшін осы қолданбаның басқару құралдары арқылы агенттің жұмысын имитациялауға да болады.',
    agentEmptyPrompt: 'Әзірге агенттер жоқ.',
    aionUiApplication: 'Cursor Agent қолданылатын AionUi',
  },
  ja: {
    agentsConnectionGuide:
      '対応アプリで新しいチャットまたは既存のチャットを開き、アシスタントに選んだ名前で接続するよう依頼してください。',
    agentsCopyCommand: 'コピー',
    agentsCreationConnected:
      'まずは1つのアプリで複数のチャットを開きます。各アシスタントに、選んだ名前で接続するよう依頼し、共通のタスクでの役割を割り当ててください。設定済みのアプリ：{applications}。',
    agentsCreationNoConnected:
      '名前と共通のタスクでの役割を決めて、利用するアプリのチャットでアシスタントに接続を依頼してください。アプリやプロファイルの設定は「{applicationsPage}」から行えます。対応アプリ：{applications}。',
    agentsManualDiagnosticIntro: '診断用：',
    agentsManualDiagnosticLink: 'エージェントを手動で作成',
    agentsManualDiagnosticAction: '診断用のエージェントを手動で作成',
    dialogAddAgent: 'エージェントを手動で作成',
    dialogAddAgentBody:
      'エージェントは、利用するアプリのチャットから作成します。アシスタントに、選んだ名前で接続するよう依頼し、共通のタスクでの役割を割り当ててください。',
    dialogManualAgentDiagnostic:
      'ここでエージェントを作成した後は、設定済みのアプリでチャットを開き、アシスタントに同じ名前で接続するよう依頼してください。診断のために、このアプリの操作機能でエージェントの動作をシミュレートすることもできます。',
    agentEmptyPrompt: 'エージェントはまだありません。',
    aionUiApplication: 'AionUi（Cursor Agent）',
  },
  'pt-BR': {
    agentsConnectionGuide:
      'Abra um chat novo ou existente em um aplicativo compatível e peça ao assistente que se conecte com um nome escolhido por você.',
    agentsCopyCommand: 'Copiar',
    agentsCreationConnected:
      'Comece com vários chats no mesmo aplicativo. Peça a cada assistente que se conecte com um nome escolhido por você e atribua a ele um papel na tarefa conjunta. Aplicativos configurados: {applications}.',
    agentsCreationNoConnected:
      'Escolha um nome e um papel na tarefa conjunta e depois peça ao assistente que se conecte em um chat do seu aplicativo. Para configurar um aplicativo ou perfil, abra “{applicationsPage}”. Aplicativos compatíveis: {applications}.',
    agentsManualDiagnosticIntro: 'Para diagnóstico:',
    agentsManualDiagnosticLink: 'Criar um agente manualmente',
    agentsManualDiagnosticAction: 'Criar um agente manualmente para diagnóstico',
    dialogAddAgent: 'Criar um agente manualmente',
    dialogAddAgentBody:
      'Crie agentes a partir dos chats dos seus aplicativos: peça ao assistente que se conecte com um nome escolhido por você e atribua a ele um papel na tarefa conjunta.',
    dialogManualAgentDiagnostic:
      'Depois de criar um agente aqui, abra um chat em um aplicativo configurado e peça ao assistente que se conecte com o mesmo nome. Você também pode usar os controles deste aplicativo para simular a atividade do agente para fins de diagnóstico.',
    agentEmptyPrompt: 'Ainda não há agentes.',
    aionUiApplication: 'AionUi com Cursor Agent',
  },
  ko: {
    agentsConnectionGuide:
      '지원하는 앱에서 새 채팅이나 기존 채팅을 열고 어시스턴트에게 원하는 이름으로 연결해 달라고 요청하세요.',
    agentsCopyCommand: '복사',
    agentsCreationConnected:
      '먼저 한 앱에서 여러 채팅을 여세요. 각 어시스턴트에게 원하는 이름으로 연결하도록 요청하고 공동 작업에서 맡을 역할을 정해 주세요. 설정된 앱: {applications}.',
    agentsCreationNoConnected:
      '공동 작업에서 사용할 이름과 역할을 정한 뒤, 사용하는 앱의 채팅에서 어시스턴트에게 연결을 요청하세요. 앱이나 프로필을 설정하려면 ‘{applicationsPage}’를 여세요. 지원하는 앱: {applications}.',
    agentsManualDiagnosticIntro: '진단용:',
    agentsManualDiagnosticLink: '에이전트 수동 생성',
    agentsManualDiagnosticAction: '진단을 위해 에이전트 수동 생성',
    dialogAddAgent: '에이전트 수동 생성',
    dialogAddAgentBody:
      '사용하는 앱의 채팅에서 에이전트를 만드세요. 어시스턴트에게 원하는 이름으로 연결하도록 요청하고 공동 작업에서 맡을 역할을 정해 주세요.',
    dialogManualAgentDiagnostic:
      '여기서 에이전트를 만든 뒤에는 설정된 앱에서 채팅을 열고 어시스턴트에게 같은 이름으로 연결하도록 요청하세요. 이 앱의 기능으로 에이전트의 동작을 시뮬레이션하여 진단할 수도 있습니다.',
    agentEmptyPrompt: '아직 에이전트가 없습니다.',
    aionUiApplication: 'AionUi(Cursor Agent)',
  },
  tr: {
    agentsConnectionGuide:
      'Desteklenen bir uygulamada yeni veya mevcut bir sohbet açın ve asistandan seçtiğiniz adla bağlanmasını isteyin.',
    agentsCopyCommand: 'Kopyala',
    agentsCreationConnected:
      'Tek bir uygulamada birden fazla sohbetle başlayın. Her asistandan seçtiğiniz adla bağlanmasını isteyin ve ortak görevdeki rolünü belirleyin. Yapılandırılmış uygulamalar: {applications}.',
    agentsCreationNoConnected:
      'Ortak görev için bir ad ve rol seçin, ardından kullandığınız uygulamanın sohbetinde asistandan bağlanmasını isteyin. Uygulama veya profil yapılandırması için “{applicationsPage}” bölümünü açın. Desteklenen uygulamalar: {applications}.',
    agentsManualDiagnosticIntro: 'Tanılama için:',
    agentsManualDiagnosticLink: 'Manuel ajan oluştur',
    agentsManualDiagnosticAction: 'Tanılama için manuel ajan oluştur',
    dialogAddAgent: 'Manuel ajan oluştur',
    dialogAddAgentBody:
      'Ajanları kullandığınız uygulamaların sohbetlerinden oluşturun: asistandan seçtiğiniz adla bağlanmasını isteyin ve ortak görevdeki rolünü belirleyin.',
    dialogManualAgentDiagnostic:
      'Burada bir ajan oluşturduktan sonra yapılandırılmış bir uygulamada sohbet açın ve asistandan aynı adla bağlanmasını isteyin. Tanılama amacıyla bu uygulamanın kontrollerini kullanarak ajanın etkinliğini de simüle edebilirsiniz.',
    agentEmptyPrompt: 'Henüz ajan yok.',
    aionUiApplication: 'Cursor Agent ile AionUi',
  },
  pl: {
    agentsConnectionGuide:
      'Otwórz nowy lub istniejący czat w obsługiwanej aplikacji i poproś asystenta, aby połączył się pod wybraną przez Ciebie nazwą.',
    agentsCopyCommand: 'Kopiuj',
    agentsCreationConnected:
      'Zacznij od kilku czatów w jednej aplikacji. Poproś każdego asystenta, aby połączył się pod wybraną przez Ciebie nazwą, i przydziel mu rolę we wspólnym zadaniu. Skonfigurowane aplikacje: {applications}.',
    agentsCreationNoConnected:
      'Wybierz nazwę i rolę we wspólnym zadaniu, a następnie poproś asystenta na czacie w swojej aplikacji, aby się połączył. Aby skonfigurować aplikację lub profil, otwórz sekcję „{applicationsPage}”. Obsługiwane aplikacje: {applications}.',
    agentsManualDiagnosticIntro: 'Do diagnostyki:',
    agentsManualDiagnosticLink: 'Utwórz agenta ręcznie',
    agentsManualDiagnosticAction: 'Utwórz agenta ręcznie do celów diagnostycznych',
    dialogAddAgent: 'Utwórz agenta ręcznie',
    dialogAddAgentBody:
      'Twórz agentów z poziomu czatów w swoich aplikacjach: poproś asystenta, aby połączył się pod wybraną przez Ciebie nazwą, i przydziel mu rolę we wspólnym zadaniu.',
    dialogManualAgentDiagnostic:
      'Po utworzeniu agenta tutaj otwórz czat w skonfigurowanej aplikacji i poproś asystenta, aby połączył się pod tą samą nazwą. Możesz też użyć elementów sterujących tej aplikacji, aby symulować działanie agenta do celów diagnostycznych.',
    agentEmptyPrompt: 'Nie ma jeszcze agentów.',
    aionUiApplication: 'AionUi z Cursor Agent',
  },
  nl: {
    agentsConnectionGuide:
      'Open een nieuwe of bestaande chat in een ondersteunde app en vraag de assistent verbinding te maken onder een naam naar keuze.',
    agentsCopyCommand: 'Kopiëren',
    agentsCreationConnected:
      'Begin met meerdere chats in één app. Vraag elke assistent verbinding te maken onder een naam naar keuze en geef elke assistent een rol in de gezamenlijke taak. Ingestelde apps: {applications}.',
    agentsCreationNoConnected:
      'Kies een naam en een rol in de gezamenlijke taak. Vraag de assistent daarna in een chat van uw app om verbinding te maken. Voor het instellen van een app of profiel opent u ‘{applicationsPage}’. Ondersteunde apps: {applications}.',
    agentsManualDiagnosticIntro: 'Voor diagnose:',
    agentsManualDiagnosticLink: 'Handmatig een agent maken',
    agentsManualDiagnosticAction: 'Handmatig een agent maken voor diagnose',
    dialogAddAgent: 'Handmatig een agent maken',
    dialogAddAgentBody:
      'Maak agenten vanuit de chats in uw apps: vraag de assistent verbinding te maken onder een naam naar keuze en geef de assistent een rol in de gezamenlijke taak.',
    dialogManualAgentDiagnostic:
      'Nadat u hier een agent hebt gemaakt, opent u een chat in een ingestelde app en vraagt u de assistent verbinding te maken onder dezelfde naam. U kunt ook de bedieningselementen van deze app gebruiken om de activiteit van de agent te simuleren voor diagnose.',
    agentEmptyPrompt: 'Er zijn nog geen agenten.',
    aionUiApplication: 'AionUi met Cursor Agent',
  },
  uk: {
    agentsConnectionGuide:
      'Відкрийте новий або наявний чат у підтримуваній програмі та попросіть помічника підключитися під обраним вами ім’ям.',
    agentsCopyCommand: 'Копіювати',
    agentsCreationConnected:
      'Почніть із кількох чатів в одній програмі. Попросіть кожного помічника підключитися під обраним вами ім’ям і призначте йому роль у спільному завданні. Налаштовані програми: {applications}.',
    agentsCreationNoConnected:
      'Виберіть ім’я та роль у спільному завданні, потім попросіть помічника підключитися в чаті вашої програми. Налаштування програм і профілів — у розділі «{applicationsPage}». Підтримувані програми: {applications}.',
    agentsManualDiagnosticIntro: 'Для діагностики:',
    agentsManualDiagnosticLink: 'Створити агента вручну',
    agentsManualDiagnosticAction: 'Створити агента вручну для діагностики',
    dialogAddAgent: 'Створити агента вручну',
    dialogAddAgentBody:
      'Створюйте агентів із чатів у ваших програмах: попросіть помічника підключитися під обраним вами ім’ям і призначте йому роль у спільному завданні.',
    dialogManualAgentDiagnostic:
      'Після створення агента тут відкрийте чат у налаштованій програмі та попросіть помічника підключитися під тим самим ім’ям. Для діагностики можна також імітувати роботу агента засобами цього застосунку.',
    agentEmptyPrompt: 'Агентів поки немає.',
    aionUiApplication: 'AionUi з Cursor Agent',
  },
};

const supportedApplications: AgentApplication[] = [
  'codex-desktop',
  'claude-code',
  'cursor',
  'opencode',
  'aionui',
];

export function agentEntryMessages(locale: Locale): AgentEntryMessages {
  return messages[locale];
}

export function agentApplicationLabel(locale: Locale, application: AgentApplication): string {
  if (application.startsWith('client:')) return application.slice('client:'.length);
  if (application === 'codex-desktop') return 'Codex Desktop';
  if (application === 'claude-code') return 'Claude Code';
  if (application === 'cursor') return 'Cursor';
  if (application === 'opencode') return 'OpenCode';
  return messages[locale].aionUiApplication;
}

export function formatAgentApplications(
  locale: Locale,
  applications: readonly AgentApplication[],
): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(
    applications.map((application) => agentApplicationLabel(locale, application)),
  );
}

export function supportedAgentApplications(locale: Locale): string {
  return formatAgentApplications(locale, supportedApplications);
}

export function formatAgentEntryMessage(
  locale: Locale,
  key: 'agentsCreationConnected' | 'agentsCreationNoConnected',
  values: Record<string, string>,
): string {
  return messages[locale][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? values[name] : placeholder,
  );
}

import type { Locale } from './index.js';

const messages: Record<Locale, readonly [title: string, body: string, dismiss: string]> = {
  en: [
    'Restart your agent apps',
    'NCF Agent Interconnect has been reinstalled or updated. Quit and reopen any of these apps that are running to reconnect them.',
    'Got it',
  ],
  ru: [
    'Перезапустите агентские приложения',
    'NCF Agent Interconnect обновлён или переустановлен. Закройте и снова откройте запущенные приложения из списка, чтобы они подключились заново.',
    'Понятно',
  ],
  'zh-CN': [
    '重新启动智能体应用',
    'NCF Agent Interconnect 已重新安装或更新。请退出并重新打开列表中正在运行的应用，以便重新连接。',
    '知道了',
  ],
  fr: [
    'Redémarrez vos applications d’agents',
    'NCF Agent Interconnect a été réinstallé ou mis à jour. Quittez puis rouvrez les applications de cette liste qui sont en cours d’exécution pour les reconnecter.',
    'Compris',
  ],
  de: [
    'Agentenanwendungen neu starten',
    'NCF Agent Interconnect wurde neu installiert oder aktualisiert. Beenden und öffnen Sie alle laufenden Anwendungen aus dieser Liste erneut, damit sie sich wieder verbinden.',
    'Verstanden',
  ],
  it: [
    'Riavvia le app degli agenti',
    'NCF Agent Interconnect è stato reinstallato o aggiornato. Chiudi e riapri le app in esecuzione in questo elenco per riconnetterle.',
    'Ho capito',
  ],
  es: [
    'Reinicia tus aplicaciones de agentes',
    'NCF Agent Interconnect se ha reinstalado o actualizado. Cierra y vuelve a abrir las aplicaciones de esta lista que estén en ejecución para que se conecten de nuevo.',
    'Entendido',
  ],
  kk: [
    'Агент қолданбаларын қайта іске қосыңыз',
    'NCF Agent Interconnect қайта орнатылды немесе жаңартылды. Қайта қосылуы үшін тізімдегі іске қосылған қолданбаларды жауып, қайта ашыңыз.',
    'Түсінікті',
  ],
  ja: [
    'エージェントアプリを再起動してください',
    'NCF Agent Interconnect が再インストールまたは更新されました。再接続するには、一覧のうち実行中のアプリを終了して開き直してください。',
    '了解',
  ],
  'pt-BR': [
    'Reinicie seus aplicativos de agentes',
    'O NCF Agent Interconnect foi reinstalado ou atualizado. Feche e reabra os aplicativos desta lista que estiverem em execução para reconectá-los.',
    'Entendi',
  ],
  ko: [
    '에이전트 앱을 다시 시작하세요',
    'NCF Agent Interconnect가 다시 설치되었거나 업데이트되었습니다. 다시 연결하려면 목록에서 실행 중인 앱을 종료한 후 다시 여세요.',
    '확인',
  ],
  tr: [
    'Aracı uygulamalarınızı yeniden başlatın',
    'NCF Agent Interconnect yeniden yüklendi veya güncellendi. Yeniden bağlanmaları için bu listedeki açık uygulamaları kapatıp yeniden açın.',
    'Anladım',
  ],
  pl: [
    'Uruchom ponownie aplikacje agentów',
    'NCF Agent Interconnect został ponownie zainstalowany lub zaktualizowany. Zamknij i ponownie otwórz uruchomione aplikacje z tej listy, aby je połączyć.',
    'Rozumiem',
  ],
  nl: [
    'Start je agent-apps opnieuw',
    'NCF Agent Interconnect is opnieuw geïnstalleerd of bijgewerkt. Sluit de actieve apps in deze lijst en open ze opnieuw om ze weer te verbinden.',
    'Begrepen',
  ],
  uk: [
    'Перезапустіть застосунки агентів',
    'NCF Agent Interconnect перевстановлено або оновлено. Закрийте й знову відкрийте запущені застосунки з цього списку, щоб вони підключилися знову.',
    'Зрозуміло',
  ],
};

export function installationRestartMessages(locale: Locale) {
  const [title, body, dismiss] = messages[locale];
  return { title, body, dismiss };
}

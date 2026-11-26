import type { Locale } from './index.js';
import type { Snapshot } from '../../shared/contracts.js';
import type { OpenCodeV2SetupStatus } from '../../shared/mcp-setup.js';

const messages: Record<Locale, readonly [string, string, string, string]> = {
  en: [
    'Waiting for plugin registration',
    'Plugin connected',
    'Unsupported plugin interface',
    'NCF node stopped',
  ],
  ru: [
    'Ожидание регистрации плагина',
    'Плагин подключён',
    'Интерфейс плагина не поддерживается',
    'Узел NCF остановлен',
  ],
  'zh-CN': ['等待插件注册', '插件已连接', '不支持此插件接口', 'NCF 节点已停止'],
  fr: [
    'En attente de l’enregistrement du module',
    'Module connecté',
    'Interface de module non prise en charge',
    'Nœud NCF arrêté',
  ],
  de: [
    'Warten auf die Plugin-Registrierung',
    'Plugin verbunden',
    'Plugin-Schnittstelle wird nicht unterstützt',
    'NCF-Knoten angehalten',
  ],
  it: [
    'In attesa della registrazione del plugin',
    'Plugin connesso',
    'Interfaccia del plugin non supportata',
    'Nodo NCF arrestato',
  ],
  es: [
    'Esperando el registro del complemento',
    'Complemento conectado',
    'Interfaz del complemento no compatible',
    'Nodo NCF detenido',
  ],
  kk: [
    'Плагиннің тіркелуі күтілуде',
    'Плагин қосылды',
    'Плагин интерфейсіне қолдау көрсетілмейді',
    'NCF түйіні тоқтатылды',
  ],
  ja: [
    'プラグインの登録待ち',
    'プラグイン接続済み',
    '未対応のプラグインインターフェース',
    'NCF ノードは停止中',
  ],
  ko: [
    '플러그인 등록 대기 중',
    '플러그인 연결됨',
    '지원하지 않는 플러그인 인터페이스',
    'NCF 노드 중지됨',
  ],
  nl: [
    'Wachten op registratie van de plug-in',
    'Plug-in verbonden',
    'Plug-ininterface wordt niet ondersteund',
    'NCF-knooppunt gestopt',
  ],
  pl: [
    'Oczekiwanie na rejestrację wtyczki',
    'Wtyczka połączona',
    'Nieobsługiwany interfejs wtyczki',
    'Węzeł NCF zatrzymany',
  ],
  'pt-BR': [
    'Aguardando o registro do plugin',
    'Plugin conectado',
    'Interface do plugin sem suporte',
    'Nó NCF parado',
  ],
  tr: [
    'Eklentinin kaydolması bekleniyor',
    'Eklenti bağlandı',
    'Eklenti arayüzü desteklenmiyor',
    'NCF düğümü durduruldu',
  ],
  uk: [
    'Очікування реєстрації плагіна',
    'Плагін підключено',
    'Інтерфейс плагіна не підтримується',
    'Вузол NCF зупинено',
  ],
};

export type OpenCodeRuntimeSnapshot = Partial<Pick<Snapshot, 'running' | 'openCodeV2Runtime'>>;
export function openCodeRuntimeText(
  locale: Locale,
  status?: OpenCodeV2SetupStatus,
  snapshot?: OpenCodeRuntimeSnapshot,
): string {
  if (status?.state !== 'configured') return '';
  const [waiting, registered, unsupported, stopped] = messages[locale];
  if (snapshot?.running === false) return stopped;
  const entries =
    snapshot?.openCodeV2Runtime?.filter(
      (entry) => entry.targetId === status.targetId && entry.generation === status.generation,
    ) ?? [];
  if (!entries.length) return waiting;
  return [
    ...new Set(
      entries.map((entry) =>
        [
          entry.state === 'registered' ? registered : unsupported,
          entry.version && 'OpenCode ' + entry.version,
        ]
          .filter(Boolean)
          .join(' · '),
      ),
    ),
  ].join(' / ');
}

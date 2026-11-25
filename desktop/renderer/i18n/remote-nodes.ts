import type { Locale } from './index.js';

const removal = {
  en: [
    'Remove node',
    'Remove this paired node?',
    'The connection will close. Pair the node again to reconnect.',
    'Could not remove the node.',
  ],
  ru: [
    'Удалить узел',
    'Удалить этот парный узел?',
    'Соединение закроется. Для повторного подключения нужно снова выполнить сопряжение.',
    'Не удалось удалить узел.',
  ],
  'zh-CN': [
    '移除节点',
    '移除此配对节点？',
    '连接将关闭。要重新连接，请再次配对该节点。',
    '无法移除该节点。',
  ],
  fr: [
    'Supprimer le nœud',
    'Supprimer ce nœud associé ?',
    'La connexion sera fermée. Associez de nouveau le nœud pour le reconnecter.',
    'Impossible de supprimer le nœud.',
  ],
  de: [
    'Knoten entfernen',
    'Diesen gekoppelten Knoten entfernen?',
    'Die Verbindung wird geschlossen. Koppeln Sie den Knoten erneut, um ihn wieder zu verbinden.',
    'Der Knoten konnte nicht entfernt werden.',
  ],
  it: [
    'Rimuovi nodo',
    'Rimuovere questo nodo associato?',
    'La connessione verrà chiusa. Associa di nuovo il nodo per riconnetterlo.',
    'Impossibile rimuovere il nodo.',
  ],
  es: [
    'Eliminar nodo',
    '¿Eliminar este nodo emparejado?',
    'Se cerrará la conexión. Vuelve a emparejar el nodo para conectarlo de nuevo.',
    'No se pudo eliminar el nodo.',
  ],
  kk: [
    'Түйінді жою',
    'Осы жұптастырылған түйін жойылсын ба?',
    'Байланыс жабылады. Қайта қосу үшін түйінді қайта жұптастырыңыз.',
    'Түйінді жою мүмкін болмады.',
  ],
  ja: [
    'ノードを削除',
    'このペアリング済みノードを削除しますか？',
    '接続は切断されます。再接続するには、ノードを再度ペアリングしてください。',
    'ノードを削除できませんでした。',
  ],
  'pt-BR': [
    'Remover nó',
    'Remover este nó pareado?',
    'A conexão será encerrada. Pareie o nó novamente para reconectá-lo.',
    'Não foi possível remover o nó.',
  ],
  ko: [
    '노드 제거',
    '페어링된 이 노드를 제거할까요?',
    '연결이 종료됩니다. 다시 연결하려면 노드를 다시 페어링하세요.',
    '노드를 제거하지 못했습니다.',
  ],
  tr: [
    'Düğümü kaldır',
    'Bu eşleştirilmiş düğüm kaldırılsın mı?',
    'Bağlantı kapatılacak. Yeniden bağlanmak için düğümü tekrar eşleştirin.',
    'Düğüm kaldırılamadı.',
  ],
  pl: [
    'Usuń węzeł',
    'Usunąć ten sparowany węzeł?',
    'Połączenie zostanie zamknięte. Aby połączyć się ponownie, sparuj węzeł jeszcze raz.',
    'Nie udało się usunąć węzła.',
  ],
  nl: [
    'Knooppunt verwijderen',
    'Dit gekoppelde knooppunt verwijderen?',
    'De verbinding wordt gesloten. Koppel het knooppunt opnieuw om weer verbinding te maken.',
    'Het knooppunt kon niet worden verwijderd.',
  ],
  uk: [
    'Видалити вузол',
    'Видалити цей спарений вузол?',
    'З’єднання закриється. Щоб підключитися знову, повторіть спарювання вузла.',
    'Не вдалося видалити вузол.',
  ],
} satisfies Record<Locale, readonly [string, string, string, string]>;

export function remoteNodeRemovalMessages(locale: Locale) {
  const [remove, title, consequence, failed] = removal[locale];
  return { remove, title, consequence, failed };
}

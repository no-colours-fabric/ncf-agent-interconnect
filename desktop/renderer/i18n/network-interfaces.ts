import type { Locale } from './index.js';

const translations = {
  en: {
    title: 'Network interfaces',
    help: 'Listen on all IPv4 interfaces except those disabled here. Save to apply.',
    enabled: 'Listening enabled',
    disabled: 'Listening disabled',
    noAddresses: 'No usable IPv4 addresses',
    absent: 'Interface not present',
    remove: 'Remove exclusion',
    unavailable: 'Listener unavailable',
    details: 'Technical details',
    identityHint:
      'Names and MAC addresses are matching hints. A renamed interface without a stable MAC may need to be disabled again.',
    ambiguous:
      'This exclusion matches multiple interfaces. Removing it affects every listed match.',
    emptyEndpoint: 'No listening address',
    addressLabel: 'Connection address',
    unverified: 'Unverified',
    saveFailed: 'Network settings could not be saved.',
    localHelp:
      'Only this computer has a listening address. Enable a network interface in Settings.',
  },
  ru: {
    title: 'Сетевые интерфейсы',
    help: 'Прослушиваются все интерфейсы IPv4, кроме отключённых здесь. Сохраните изменения для применения.',
    enabled: 'Прослушивание разрешено',
    disabled: 'Прослушивание отключено',
    noAddresses: 'Нет пригодных адресов IPv4',
    absent: 'Интерфейс отсутствует',
    remove: 'Удалить исключение',
    unavailable: 'Прослушивание недоступно',
    details: 'Технические сведения',
    identityHint:
      'Имя и MAC используются для сопоставления. После переименования интерфейса без стабильного MAC может потребоваться повторное отключение.',
    ambiguous:
      'Исключение соответствует нескольким интерфейсам. Его удаление затронет все перечисленные совпадения.',
    emptyEndpoint: 'Нет прослушиваемого адреса',
    addressLabel: 'Адрес подключения',
    unverified: 'Не проверен',
    saveFailed: 'Не удалось сохранить настройки сети.',
    localHelp:
      'Прослушиваемый адрес есть только на этом компьютере. Разрешите сетевой интерфейс в настройках.',
  },
  'zh-CN': {
    title: '网络接口',
    help: '监听所有 IPv4 接口，但不监听在此禁用的接口。保存以应用更改。',
    enabled: '已允许监听',
    disabled: '已禁用监听',
    noAddresses: '没有可用的 IPv4 地址',
    absent: '接口不存在',
    remove: '移除排除项',
    unavailable: '无法监听',
    details: '技术详情',
    identityHint: '名称和 MAC 地址仅用于匹配。没有稳定 MAC 地址的接口在重命名后可能需要再次禁用。',
    ambiguous: '此排除项匹配多个接口。移除后将影响列出的所有匹配项。',
    emptyEndpoint: '没有监听地址',
    addressLabel: '连接地址',
    unverified: '未经验证',
    saveFailed: '无法保存网络设置。',
    localHelp: '仅此计算机具有监听地址。请在设置中启用网络接口。',
  },
  fr: {
    title: 'Interfaces réseau',
    help: 'Écouter sur toutes les interfaces IPv4 sauf celles désactivées ici. Enregistrez pour appliquer.',
    enabled: 'Écoute autorisée',
    disabled: 'Écoute désactivée',
    noAddresses: 'Aucune adresse IPv4 utilisable',
    absent: 'Interface absente',
    remove: 'Supprimer l’exclusion',
    unavailable: 'Écoute indisponible',
    details: 'Détails techniques',
    identityHint:
      'Les noms et adresses MAC servent au rapprochement. Une interface renommée sans MAC stable peut devoir être désactivée à nouveau.',
    ambiguous:
      'Cette exclusion correspond à plusieurs interfaces. Sa suppression affecte toutes les correspondances indiquées.',
    emptyEndpoint: 'Aucune adresse d’écoute',
    addressLabel: 'Adresse de connexion',
    unverified: 'Non vérifié',
    saveFailed: 'Impossible d’enregistrer les paramètres réseau.',
    localHelp:
      'Seul cet ordinateur dispose d’une adresse d’écoute. Activez une interface réseau dans les paramètres.',
  },
  de: {
    title: 'Netzwerkschnittstellen',
    help: 'Auf allen IPv4-Schnittstellen lauschen, außer den hier deaktivierten. Zum Anwenden speichern.',
    enabled: 'Lauschen erlaubt',
    disabled: 'Lauschen deaktiviert',
    noAddresses: 'Keine nutzbaren IPv4-Adressen',
    absent: 'Schnittstelle nicht vorhanden',
    remove: 'Ausschluss entfernen',
    unavailable: 'Lauschen nicht verfügbar',
    details: 'Technische Details',
    identityHint:
      'Namen und MAC-Adressen dienen der Zuordnung. Eine umbenannte Schnittstelle ohne stabile MAC muss eventuell erneut deaktiviert werden.',
    ambiguous:
      'Dieser Ausschluss passt zu mehreren Schnittstellen. Seine Entfernung betrifft alle aufgeführten Treffer.',
    emptyEndpoint: 'Keine überwachte Adresse',
    addressLabel: 'Verbindungsadresse',
    unverified: 'Nicht verifiziert',
    saveFailed: 'Netzwerkeinstellungen konnten nicht gespeichert werden.',
    localHelp:
      'Nur dieser Computer hat eine überwachte Adresse. Aktivieren Sie eine Netzwerkschnittstelle in den Einstellungen.',
  },
  it: {
    title: 'Interfacce di rete',
    help: 'Ascolta su tutte le interfacce IPv4 tranne quelle disabilitate qui. Salva per applicare.',
    enabled: 'Ascolto consentito',
    disabled: 'Ascolto disabilitato',
    noAddresses: 'Nessun indirizzo IPv4 utilizzabile',
    absent: 'Interfaccia assente',
    remove: 'Rimuovi esclusione',
    unavailable: 'Ascolto non disponibile',
    details: 'Dettagli tecnici',
    identityHint:
      'Nomi e indirizzi MAC servono per l’abbinamento. Un’interfaccia rinominata senza MAC stabile potrebbe dover essere disabilitata di nuovo.',
    ambiguous:
      'Questa esclusione corrisponde a più interfacce. Rimuoverla interessa tutte le corrispondenze elencate.',
    emptyEndpoint: 'Nessun indirizzo in ascolto',
    addressLabel: 'Indirizzo di connessione',
    unverified: 'Non verificato',
    saveFailed: 'Impossibile salvare le impostazioni di rete.',
    localHelp:
      'Solo questo computer ha un indirizzo in ascolto. Abilita un’interfaccia di rete nelle impostazioni.',
  },
  es: {
    title: 'Interfaces de red',
    help: 'Escuchar en todas las interfaces IPv4 salvo las desactivadas aquí. Guarda para aplicar.',
    enabled: 'Escucha permitida',
    disabled: 'Escucha desactivada',
    noAddresses: 'No hay direcciones IPv4 utilizables',
    absent: 'Interfaz ausente',
    remove: 'Eliminar exclusión',
    unavailable: 'Escucha no disponible',
    details: 'Detalles técnicos',
    identityHint:
      'Los nombres y las direcciones MAC sirven para identificar coincidencias. Una interfaz renombrada sin MAC estable puede requerir desactivarla de nuevo.',
    ambiguous:
      'Esta exclusión coincide con varias interfaces. Eliminarla afecta a todas las coincidencias indicadas.',
    emptyEndpoint: 'No hay dirección de escucha',
    addressLabel: 'Dirección de conexión',
    unverified: 'Sin verificar',
    saveFailed: 'No se pudo guardar la configuración de red.',
    localHelp:
      'Solo este equipo tiene una dirección de escucha. Habilita una interfaz de red en la configuración.',
  },
  kk: {
    title: 'Желілік интерфейстер',
    help: 'Мұнда өшірілгендерден басқа барлық IPv4 интерфейстері тыңдалады. Қолдану үшін сақтаңыз.',
    enabled: 'Тыңдауға рұқсат етілген',
    disabled: 'Тыңдау өшірілген',
    noAddresses: 'Жарамды IPv4 мекенжайлары жоқ',
    absent: 'Интерфейс жоқ',
    remove: 'Ерекшелікті жою',
    unavailable: 'Тыңдау қолжетімсіз',
    details: 'Техникалық мәліметтер',
    identityHint:
      'Атау мен MAC мекенжайы сәйкестендіру үшін қолданылады. Тұрақты MAC жоқ интерфейстің атауы өзгерсе, оны қайта өшіру қажет болуы мүмкін.',
    ambiguous:
      'Бұл ерекшелік бірнеше интерфейске сәйкес келеді. Оны жою тізімдегі барлық сәйкестікке әсер етеді.',
    emptyEndpoint: 'Тыңдалатын мекенжай жоқ',
    addressLabel: 'Қосылу мекенжайы',
    unverified: 'Тексерілмеген',
    saveFailed: 'Желі параметрлерін сақтау мүмкін болмады.',
    localHelp:
      'Тыңдалатын мекенжай тек осы компьютерде бар. Параметрлерде желілік интерфейске рұқсат беріңіз.',
  },
  ja: {
    title: 'ネットワークインターフェース',
    help: 'ここで無効にしたものを除く、すべての IPv4 インターフェースで待ち受けます。保存すると適用されます。',
    enabled: '待ち受けを許可',
    disabled: '待ち受けを無効化',
    noAddresses: '使用可能な IPv4 アドレスがありません',
    absent: 'インターフェースが存在しません',
    remove: '除外を削除',
    unavailable: '待ち受けできません',
    details: '技術情報',
    identityHint:
      '名前と MAC アドレスを照合に使用します。固定 MAC のないインターフェースは、名前変更後に再度無効にする必要がある場合があります。',
    ambiguous:
      'この除外は複数のインターフェースに一致します。削除すると、表示されたすべての一致に影響します。',
    emptyEndpoint: '待ち受けアドレスがありません',
    addressLabel: '接続先アドレス',
    unverified: '未確認',
    saveFailed: 'ネットワーク設定を保存できませんでした。',
    localHelp:
      'このコンピューター内でのみ待ち受けています。設定でネットワークインターフェースを有効にしてください。',
  },
  'pt-BR': {
    title: 'Interfaces de rede',
    help: 'Escutar em todas as interfaces IPv4, exceto as desativadas aqui. Salve para aplicar.',
    enabled: 'Escuta permitida',
    disabled: 'Escuta desativada',
    noAddresses: 'Nenhum endereço IPv4 utilizável',
    absent: 'Interface ausente',
    remove: 'Remover exclusão',
    unavailable: 'Escuta indisponível',
    details: 'Detalhes técnicos',
    identityHint:
      'Nomes e endereços MAC servem para correspondência. Uma interface renomeada sem MAC estável pode precisar ser desativada novamente.',
    ambiguous:
      'Esta exclusão corresponde a várias interfaces. Removê-la afeta todas as correspondências listadas.',
    emptyEndpoint: 'Nenhum endereço de escuta',
    addressLabel: 'Endereço de conexão',
    unverified: 'Não verificado',
    saveFailed: 'Não foi possível salvar as configurações de rede.',
    localHelp:
      'Apenas este computador tem um endereço de escuta. Ative uma interface de rede nas configurações.',
  },
  ko: {
    title: '네트워크 인터페이스',
    help: '여기서 비활성화한 인터페이스를 제외한 모든 IPv4 인터페이스에서 수신합니다. 저장하면 적용됩니다.',
    enabled: '수신 허용',
    disabled: '수신 비활성화',
    noAddresses: '사용 가능한 IPv4 주소 없음',
    absent: '인터페이스 없음',
    remove: '제외 항목 제거',
    unavailable: '수신 불가',
    details: '기술 세부 정보',
    identityHint:
      '이름과 MAC 주소는 일치 여부를 확인하는 데 사용됩니다. 고정 MAC이 없는 인터페이스는 이름 변경 후 다시 비활성화해야 할 수 있습니다.',
    ambiguous:
      '이 제외 항목은 여러 인터페이스와 일치합니다. 제거하면 나열된 모든 일치 항목에 영향을 줍니다.',
    emptyEndpoint: '수신 주소 없음',
    addressLabel: '연결 주소',
    unverified: '확인되지 않음',
    saveFailed: '네트워크 설정을 저장하지 못했습니다.',
    localHelp: '이 컴퓨터에서만 수신할 수 있습니다. 설정에서 네트워크 인터페이스를 활성화하세요.',
  },
  tr: {
    title: 'Ağ arayüzleri',
    help: 'Burada devre dışı bırakılanlar dışında tüm IPv4 arayüzlerini dinle. Uygulamak için kaydedin.',
    enabled: 'Dinlemeye izin verildi',
    disabled: 'Dinleme devre dışı',
    noAddresses: 'Kullanılabilir IPv4 adresi yok',
    absent: 'Arayüz mevcut değil',
    remove: 'Hariç tutmayı kaldır',
    unavailable: 'Dinleme kullanılamıyor',
    details: 'Teknik ayrıntılar',
    identityHint:
      'Adlar ve MAC adresleri eşleştirme ipuçlarıdır. Sabit MAC adresi olmayan bir arayüzün adı değişirse yeniden devre dışı bırakılması gerekebilir.',
    ambiguous:
      'Bu hariç tutma birden fazla arayüzle eşleşiyor. Kaldırılması listelenen tüm eşleşmeleri etkiler.',
    emptyEndpoint: 'Dinleme adresi yok',
    addressLabel: 'Bağlantı adresi',
    unverified: 'Doğrulanmamış',
    saveFailed: 'Ağ ayarları kaydedilemedi.',
    localHelp:
      'Dinleme adresi yalnızca bu bilgisayarda kullanılabilir. Ayarlardan bir ağ arayüzünü etkinleştirin.',
  },
  pl: {
    title: 'Interfejsy sieciowe',
    help: 'Nasłuchuj na wszystkich interfejsach IPv4 poza wyłączonymi tutaj. Zapisz, aby zastosować.',
    enabled: 'Nasłuchiwanie dozwolone',
    disabled: 'Nasłuchiwanie wyłączone',
    noAddresses: 'Brak użytecznych adresów IPv4',
    absent: 'Interfejs nieobecny',
    remove: 'Usuń wykluczenie',
    unavailable: 'Nasłuchiwanie niedostępne',
    details: 'Szczegóły techniczne',
    identityHint:
      'Nazwy i adresy MAC służą do dopasowania. Interfejs bez stałego MAC może wymagać ponownego wyłączenia po zmianie nazwy.',
    ambiguous:
      'To wykluczenie pasuje do wielu interfejsów. Usunięcie go wpływa na wszystkie wymienione dopasowania.',
    emptyEndpoint: 'Brak adresu nasłuchiwania',
    addressLabel: 'Adres połączenia',
    unverified: 'Niezweryfikowany',
    saveFailed: 'Nie udało się zapisać ustawień sieci.',
    localHelp:
      'Adres nasłuchiwania jest dostępny tylko na tym komputerze. Włącz interfejs sieciowy w ustawieniach.',
  },
  nl: {
    title: 'Netwerkinterfaces',
    help: 'Luister op alle IPv4-interfaces behalve de hier uitgeschakelde. Sla op om toe te passen.',
    enabled: 'Luisteren toegestaan',
    disabled: 'Luisteren uitgeschakeld',
    noAddresses: 'Geen bruikbare IPv4-adressen',
    absent: 'Interface niet aanwezig',
    remove: 'Uitsluiting verwijderen',
    unavailable: 'Luisteren niet beschikbaar',
    details: 'Technische details',
    identityHint:
      'Namen en MAC-adressen helpen bij het herkennen. Een hernoemde interface zonder stabiel MAC-adres moet mogelijk opnieuw worden uitgeschakeld.',
    ambiguous:
      'Deze uitsluiting komt overeen met meerdere interfaces. Verwijderen heeft gevolgen voor alle vermelde overeenkomsten.',
    emptyEndpoint: 'Geen luisteradres',
    addressLabel: 'Verbindingsadres',
    unverified: 'Niet geverifieerd',
    saveFailed: 'Netwerkinstellingen konden niet worden opgeslagen.',
    localHelp:
      'Alleen deze computer heeft een luisteradres. Schakel een netwerkinterface in via de instellingen.',
  },
  uk: {
    title: 'Мережеві інтерфейси',
    help: 'Прослуховуються всі інтерфейси IPv4, крім вимкнених тут. Збережіть зміни для застосування.',
    enabled: 'Прослуховування дозволено',
    disabled: 'Прослуховування вимкнено',
    noAddresses: 'Немає придатних адрес IPv4',
    absent: 'Інтерфейс відсутній',
    remove: 'Видалити виключення',
    unavailable: 'Прослуховування недоступне',
    details: 'Технічні відомості',
    identityHint:
      'Ім’я та MAC використовуються для зіставлення. Після перейменування інтерфейсу без сталого MAC може знадобитися повторне вимкнення.',
    ambiguous:
      'Виключення відповідає кільком інтерфейсам. Його видалення вплине на всі перелічені збіги.',
    emptyEndpoint: 'Немає адреси прослуховування',
    addressLabel: 'Адреса підключення',
    unverified: 'Не перевірено',
    saveFailed: 'Не вдалося зберегти налаштування мережі.',
    localHelp:
      'Адреса прослуховування є лише на цьому комп’ютері. Дозвольте мережевий інтерфейс у налаштуваннях.',
  },
} satisfies Record<
  Locale,
  Record<
    | 'title'
    | 'help'
    | 'enabled'
    | 'disabled'
    | 'noAddresses'
    | 'absent'
    | 'remove'
    | 'unavailable'
    | 'details'
    | 'identityHint'
    | 'ambiguous'
    | 'emptyEndpoint'
    | 'addressLabel'
    | 'unverified'
    | 'saveFailed'
    | 'localHelp',
    string
  >
>;
export function networkInterfaceMessages(locale: Locale) {
  return { ...(translations[locale] ?? translations.en) };
}

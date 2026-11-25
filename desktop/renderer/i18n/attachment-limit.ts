import type { Locale } from './index.js';

type AttachmentLimitMessages = {
  title: string;
  help: string;
  size: string;
  unlimited: string;
  invalid: string;
  failed: string;
  exceeded: string;
};

const dictionaries: Record<Locale, AttachmentLimitMessages> = {
  en: {
    title: 'Attachment size limit',
    help: 'Applies to each file sent from this computer. Receiving ignores this setting. Older destinations may have their own limit.',
    size: 'Maximum size (MiB)',
    unlimited: 'No size limit',
    invalid: 'Enter a positive whole number.',
    failed: 'Could not save the size limit. Try again.',
    exceeded: 'The file exceeds this computer’s attachment size limit.',
  },
  ru: {
    title: 'Ограничение размера вложений',
    help: 'Действует для каждого файла, отправляемого с этого компьютера. На приём файлов эта настройка не влияет. На старых узлах может действовать собственный лимит.',
    size: 'Максимальный размер (МиБ)',
    unlimited: 'Без ограничения',
    invalid: 'Введите положительное целое число.',
    failed: 'Не удалось сохранить ограничение. Повторите попытку.',
    exceeded: 'Размер файла превышает ограничение этого компьютера.',
  },
  'zh-CN': {
    title: '附件大小限制',
    help: '适用于从此计算机发送的每个文件。此设置不影响接收文件。旧版目标节点可能有自己的限制。',
    size: '最大大小（MiB）',
    unlimited: '不限大小',
    invalid: '请输入正整数。',
    failed: '无法保存大小限制。请重试。',
    exceeded: '文件超出此计算机的附件大小限制。',
  },
  fr: {
    title: 'Taille maximale des pièces jointes',
    help: 'S’applique à chaque fichier envoyé depuis cet ordinateur. La réception ne dépend pas de ce réglage. Les anciens nœuds destinataires peuvent appliquer leur propre limite.',
    size: 'Taille maximale (Mio)',
    unlimited: 'Aucune limite de taille',
    invalid: 'Saisissez un nombre entier positif.',
    failed: 'Impossible d’enregistrer la limite. Réessayez.',
    exceeded: 'Le fichier dépasse la taille maximale des pièces jointes sur cet ordinateur.',
  },
  de: {
    title: 'Größenlimit für Anhänge',
    help: 'Gilt für jede Datei, die von diesem Computer gesendet wird. Der Empfang ist von dieser Einstellung unabhängig. Ältere Zielknoten können ein eigenes Limit haben.',
    size: 'Maximale Größe (MiB)',
    unlimited: 'Kein Größenlimit',
    invalid: 'Geben Sie eine positive ganze Zahl ein.',
    failed: 'Das Größenlimit konnte nicht gespeichert werden. Versuchen Sie es erneut.',
    exceeded: 'Die Datei überschreitet das Größenlimit für Anhänge auf diesem Computer.',
  },
  it: {
    title: 'Limite di dimensione degli allegati',
    help: 'Si applica a ogni file inviato da questo computer. La ricezione non dipende da questa impostazione. I nodi di destinazione meno recenti possono avere un proprio limite.',
    size: 'Dimensione massima (MiB)',
    unlimited: 'Nessun limite di dimensione',
    invalid: 'Inserisci un numero intero positivo.',
    failed: 'Impossibile salvare il limite. Riprova.',
    exceeded: 'Il file supera il limite di dimensione degli allegati di questo computer.',
  },
  es: {
    title: 'Límite de tamaño de los archivos adjuntos',
    help: 'Se aplica a cada archivo enviado desde este equipo. La recepción no depende de este ajuste. Los nodos de destino antiguos pueden tener su propio límite.',
    size: 'Tamaño máximo (MiB)',
    unlimited: 'Sin límite de tamaño',
    invalid: 'Introduce un número entero positivo.',
    failed: 'No se pudo guardar el límite. Inténtalo de nuevo.',
    exceeded: 'El archivo supera el límite de tamaño de los archivos adjuntos de este equipo.',
  },
  kk: {
    title: 'Тіркеме өлшемінің шегі',
    help: 'Осы компьютерден жіберілетін әр файлға қолданылады. Бұл параметр файл қабылдауға әсер етпейді. Ескі қабылдаушы түйіндерде өз шектеуі болуы мүмкін.',
    size: 'Ең үлкен өлшем (МиБ)',
    unlimited: 'Өлшем шектелмейді',
    invalid: 'Оң бүтін сан енгізіңіз.',
    failed: 'Өлшем шегін сақтау мүмкін болмады. Қайталап көріңіз.',
    exceeded: 'Файл өлшемі осы компьютердегі тіркеме шегінен асады.',
  },
  ja: {
    title: '添付ファイルのサイズ上限',
    help: 'このコンピューターから送信するファイルごとに適用されます。受信には影響しません。旧バージョンの受信ノードには独自の上限がある場合があります。',
    size: '最大サイズ（MiB）',
    unlimited: 'サイズ制限なし',
    invalid: '正の整数を入力してください。',
    failed: 'サイズ上限を保存できませんでした。もう一度お試しください。',
    exceeded: 'ファイルがこのコンピューターの添付ファイル上限を超えています。',
  },
  'pt-BR': {
    title: 'Limite de tamanho dos anexos',
    help: 'Aplica-se a cada arquivo enviado deste computador. O recebimento independe dessa configuração. Nós de destino antigos podem ter um limite próprio.',
    size: 'Tamanho máximo (MiB)',
    unlimited: 'Sem limite de tamanho',
    invalid: 'Digite um número inteiro positivo.',
    failed: 'Não foi possível salvar o limite. Tente novamente.',
    exceeded: 'O arquivo excede o limite de tamanho de anexos deste computador.',
  },
  ko: {
    title: '첨부 파일 크기 제한',
    help: '이 컴퓨터에서 보내는 각 파일에 적용됩니다. 파일 수신에는 영향을 주지 않습니다. 이전 버전의 대상 노드에는 자체 제한이 있을 수 있습니다.',
    size: '최대 크기(MiB)',
    unlimited: '크기 제한 없음',
    invalid: '양의 정수를 입력하세요.',
    failed: '크기 제한을 저장하지 못했습니다. 다시 시도하세요.',
    exceeded: '파일이 이 컴퓨터의 첨부 파일 크기 제한을 초과합니다.',
  },
  tr: {
    title: 'Ek boyutu sınırı',
    help: 'Bu bilgisayardan gönderilen her dosya için geçerlidir. Alma işlemi bu ayardan etkilenmez. Eski hedef düğümlerin kendi sınırı olabilir.',
    size: 'En büyük boyut (MiB)',
    unlimited: 'Boyut sınırı yok',
    invalid: 'Pozitif bir tam sayı girin.',
    failed: 'Boyut sınırı kaydedilemedi. Yeniden deneyin.',
    exceeded: 'Dosya bu bilgisayarın ek boyutu sınırını aşıyor.',
  },
  pl: {
    title: 'Limit rozmiaru załącznika',
    help: 'Dotyczy każdego pliku wysyłanego z tego komputera. Ustawienie nie wpływa na odbieranie plików. Starsze węzły docelowe mogą stosować własny limit.',
    size: 'Maksymalny rozmiar (MiB)',
    unlimited: 'Bez limitu rozmiaru',
    invalid: 'Wpisz dodatnią liczbę całkowitą.',
    failed: 'Nie udało się zapisać limitu. Spróbuj ponownie.',
    exceeded: 'Plik przekracza limit rozmiaru załączników na tym komputerze.',
  },
  nl: {
    title: 'Maximale bijlagegrootte',
    help: 'Geldt voor elk bestand dat vanaf deze computer wordt verstuurd. De instelling heeft geen invloed op ontvangen bestanden. Oudere bestemmingsknooppunten kunnen een eigen limiet hebben.',
    size: 'Maximale grootte (MiB)',
    unlimited: 'Geen groottelimiet',
    invalid: 'Voer een positief geheel getal in.',
    failed: 'De groottelimiet kon niet worden opgeslagen. Probeer het opnieuw.',
    exceeded: 'Het bestand overschrijdt de maximale bijlagegrootte op deze computer.',
  },
  uk: {
    title: 'Обмеження розміру вкладень',
    help: 'Діє для кожного файлу, надісланого з цього комп’ютера. На отримання файлів налаштування не впливає. Старі вузли отримувача можуть мати власний ліміт.',
    size: 'Максимальний розмір (МіБ)',
    unlimited: 'Без обмеження розміру',
    invalid: 'Введіть додатне ціле число.',
    failed: 'Не вдалося зберегти обмеження. Спробуйте ще раз.',
    exceeded: 'Розмір файлу перевищує обмеження для вкладень на цьому комп’ютері.',
  },
};

export const attachmentLimitMessages = (locale: Locale): AttachmentLimitMessages =>
  dictionaries[locale];

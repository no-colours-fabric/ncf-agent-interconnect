import type { Locale } from './index.js';

interface RenameMessages {
  title: string;
  nickname_in_use: string;
  stale: string;
  failed: string;
}

export const agentRenameMessages: Record<Locale, RenameMessages> = {
  en: {
    title: 'Rename agent',
    nickname_in_use: 'This name is already used by another agent.',
    stale: 'The selected agent has changed. Reopen the dialog.',
    failed: 'Could not rename the agent.',
  },
  ru: {
    title: 'Переименовать агента',
    nickname_in_use: 'Это имя уже занято другим агентом.',
    stale: 'Выбранный агент изменился. Откройте диалог заново.',
    failed: 'Не удалось переименовать агента.',
  },
  'zh-CN': {
    title: '重命名代理',
    nickname_in_use: '此名称已被其他代理使用。',
    stale: '所选代理已发生变化。请重新打开对话框。',
    failed: '无法重命名代理。',
  },
  fr: {
    title: 'Renommer l’agent',
    nickname_in_use: 'Ce nom est déjà utilisé par un autre agent.',
    stale: 'L’agent sélectionné a changé. Rouvrez la boîte de dialogue.',
    failed: 'Impossible de renommer l’agent.',
  },
  de: {
    title: 'Agent umbenennen',
    nickname_in_use: 'Dieser Name wird bereits von einem anderen Agenten verwendet.',
    stale: 'Der ausgewählte Agent hat sich geändert. Öffnen Sie den Dialog erneut.',
    failed: 'Der Agent konnte nicht umbenannt werden.',
  },
  it: {
    title: 'Rinomina agente',
    nickname_in_use: 'Questo nome è già in uso da un altro agente.',
    stale: 'L’agente selezionato è cambiato. Riapri la finestra di dialogo.',
    failed: 'Impossibile rinominare l’agente.',
  },
  es: {
    title: 'Cambiar el nombre del agente',
    nickname_in_use: 'Otro agente ya usa este nombre.',
    stale: 'El agente seleccionado ha cambiado. Vuelve a abrir el cuadro de diálogo.',
    failed: 'No se pudo cambiar el nombre del agente.',
  },
  kk: {
    title: 'Агенттің атын өзгерту',
    nickname_in_use: 'Бұл атты басқа агент пайдаланып жүр.',
    stale: 'Таңдалған агент өзгерді. Диалог терезесін қайта ашыңыз.',
    failed: 'Агенттің атын өзгерту мүмкін болмады.',
  },
  ja: {
    title: 'エージェント名を変更',
    nickname_in_use: 'この名前は別のエージェントが使用しています。',
    stale: '選択したエージェントが変更されました。ダイアログを開き直してください。',
    failed: 'エージェント名を変更できませんでした。',
  },
  'pt-BR': {
    title: 'Renomear agente',
    nickname_in_use: 'Outro agente já está usando este nome.',
    stale: 'O agente selecionado mudou. Abra a caixa de diálogo novamente.',
    failed: 'Não foi possível renomear o agente.',
  },
  ko: {
    title: '에이전트 이름 변경',
    nickname_in_use: '다른 에이전트가 이미 이 이름을 사용하고 있습니다.',
    stale: '선택한 에이전트가 변경되었습니다. 대화 상자를 다시 여세요.',
    failed: '에이전트 이름을 변경할 수 없습니다.',
  },
  tr: {
    title: 'Ajanı yeniden adlandır',
    nickname_in_use: 'Bu adı başka bir ajan kullanıyor.',
    stale: 'Seçili ajan değişti. İletişim kutusunu yeniden açın.',
    failed: 'Ajan yeniden adlandırılamadı.',
  },
  pl: {
    title: 'Zmień nazwę agenta',
    nickname_in_use: 'Inny agent używa już tej nazwy.',
    stale: 'Wybrany agent się zmienił. Otwórz okno dialogowe ponownie.',
    failed: 'Nie udało się zmienić nazwy agenta.',
  },
  nl: {
    title: 'Agent hernoemen',
    nickname_in_use: 'Een andere agent gebruikt deze naam al.',
    stale: 'De geselecteerde agent is gewijzigd. Open het dialoogvenster opnieuw.',
    failed: 'De agent kon niet worden hernoemd.',
  },
  uk: {
    title: 'Перейменувати агента',
    nickname_in_use: 'Це ім’я вже використовує інший агент.',
    stale: 'Вибраний агент змінився. Відкрийте діалог знову.',
    failed: 'Не вдалося перейменувати агента.',
  },
};

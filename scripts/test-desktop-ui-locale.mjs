import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createUiEnvironment, createUiProfile, uiClientConfigPaths } from './ui-test-profile.mjs';

const cases = [
  ['en', 'English', 'Overview', 'Settings'],
  ['ru', 'Русский', 'Обзор', 'Настройки'],
  ['zh-CN', '中文（简体）', '概览', '设置'],
  ['fr', 'Français', 'Aperçu', 'Réglages'],
  ['de', 'Deutsch', 'Übersicht', 'Einstellungen'],
  ['it', 'Italiano', 'Panoramica', 'Impostazioni'],
  ['es', 'Español', 'Resumen', 'Ajustes'],
  ['kk', 'Қазақша', 'Шолу', 'Параметрлер'],
  ['ja', '日本語', '概要', '設定'],
  ['pt-BR', 'Português (Brasil)', 'Visão geral', 'Configurações'],
  ['ko', '한국어', '개요', '설정'],
  ['tr', 'Türkçe', 'Genel Bakış', 'Ayarlar'],
  ['pl', 'Polski', 'Przegląd', 'Ustawienia'],
  ['nl', 'Nederlands', 'Overzicht', 'Instellingen'],
  ['uk', 'Українська', 'Огляд', 'Налаштування'],
];
const setupLabels = {
  en: {
    aionAddress: 'AionUi WebUI address',
    aionCode: 'Pairing code',
    aionNotPaired: 'Not paired',

    chatClose: 'Close chat',
    configureCursor: 'Configure Cursor',
    configureOpencode: 'Configure OpenCode',
    configureCodex: 'Configure Codex',
    pathLabel: 'Configuration file path',
    apply: 'Apply',
    cancel: 'Cancel',
    userControl:
      'Connect your application with a button. Settings change only after you click Apply.',
    copyPrompt: 'Copy connection prompt',
    connectionPrompt: 'Connect as agent <a name you choose>.',
    missing: 'Not configured',
  },
  ru: {
    aionAddress: 'Адрес WebUI AionUi',
    aionCode: 'Код сопряжения',
    aionNotPaired: 'Нет сопряжения',

    chatClose: 'Закрыть чат',
    configureCursor: 'Настроить Cursor',
    configureOpencode: 'Настроить OpenCode',
    configureCodex: 'Настроить Codex',
    pathLabel: 'Путь к файлу конфигурации',
    apply: 'Применить',
    cancel: 'Отмена',
    userControl:
      'Подключите приложение с помощью кнопки. Настройки изменяются только после нажатия «Применить».',
    copyPrompt: 'Скопировать запрос подключения',
    connectionPrompt: 'Подключись как агент <выбранное вами имя>.',
    missing: 'Не настроено',
  },
  de: {
    aionAddress: 'AionUi-WebUI-Adresse',
    aionCode: 'Kopplungscode',
    aionNotPaired: 'Nicht gekoppelt',

    chatClose: 'Chat schließen',
    configureCursor: 'Cursor einrichten',
    configureOpencode: 'OpenCode einrichten',
    configureCodex: 'Codex einrichten',
    pathLabel: 'Pfad der Konfigurationsdatei',
    apply: 'Anwenden',
    cancel: 'Abbrechen',
    userControl:
      'Verbinden Sie Ihre Anwendung per Schaltfläche. Einstellungen ändern sich erst nach einem Klick auf „Anwenden“.',
    copyPrompt: 'Verbindungsaufforderung kopieren',
    connectionPrompt: 'Verbinde dich als Agent <ein Name deiner Wahl>.',
    missing: 'Nicht eingerichtet',
  },
  fr: {
    aionAddress: 'Adresse WebUI AionUi',
    aionCode: 'Code d’association',
    aionNotPaired: 'Non associé',

    chatClose: 'Fermer le chat',
    configureCursor: 'Configurer Cursor',
    configureOpencode: 'Configurer OpenCode',
    configureCodex: 'Configurer Codex',
    pathLabel: 'Chemin du fichier de configuration',
    apply: 'Appliquer',
    cancel: 'Annuler',
    userControl:
      'Connectez votre application à l’aide d’un bouton. Les réglages ne changent qu’après un clic sur « Appliquer ».',
    copyPrompt: 'Copier la demande de connexion',
    connectionPrompt: 'Connecte-toi en tant qu’agent <un nom de ton choix>.',
    missing: 'Non configuré',
  },
  es: {
    aionAddress: 'Dirección WebUI de AionUi',
    aionCode: 'Código de vinculación',
    aionNotPaired: 'Sin vincular',

    chatClose: 'Cerrar chat',
    configureCursor: 'Configurar Cursor',
    configureOpencode: 'Configurar OpenCode',
    configureCodex: 'Configurar Codex',
    pathLabel: 'Ruta del archivo de configuración',
    apply: 'Aplicar',
    cancel: 'Cancelar',
    userControl:
      'Conecta tu aplicación con un botón. Los ajustes solo cambian después de pulsar «Aplicar».',
    copyPrompt: 'Copiar solicitud de conexión',
    connectionPrompt: 'Conéctate como agente <el nombre que elijas>.',
    missing: 'Sin configurar',
  },
  it: {
    aionAddress: 'Indirizzo WebUI AionUi',
    aionCode: 'Codice di associazione',
    aionNotPaired: 'Non associato',

    chatClose: 'Chiudi chat',
    configureCursor: 'Configura Cursor',
    configureOpencode: 'Configura OpenCode',
    configureCodex: 'Configura Codex',
    pathLabel: 'Percorso del file di configurazione',
    apply: 'Applica',
    cancel: 'Annulla',
    userControl:
      'Collega l’applicazione con un pulsante. Le impostazioni cambiano solo dopo un clic su «Applica».',
    copyPrompt: 'Copia richiesta di connessione',
    connectionPrompt: 'Collegati come agente <un nome a tua scelta>.',
    missing: 'Non configurato',
  },
  ja: {
    aionAddress: 'AionUi WebUIアドレス',
    aionCode: 'ペアリングコード',
    aionNotPaired: '未ペアリング',

    chatClose: 'チャットを閉じる',
    configureCursor: 'Cursorを設定',
    configureOpencode: 'OpenCodeを設定',
    configureCodex: 'Codexを設定',
    pathLabel: '設定ファイルのパス',
    apply: '適用',
    cancel: 'キャンセル',
    userControl:
      'ボタンでアプリケーションを接続します。「適用」をクリックした後にのみ設定が変更されます。',
    copyPrompt: '接続プロンプトをコピー',
    connectionPrompt: 'エージェント<任意の名前>として接続してください。',
    missing: '未設定',
  },
  kk: {
    aionAddress: 'AionUi WebUI мекенжайы',
    aionCode: 'Жұптау коды',
    aionNotPaired: 'Жұпталмаған',

    chatClose: 'Чатты жабу',
    configureCursor: 'Cursor баптау',
    configureOpencode: 'OpenCode баптау',
    configureCodex: 'Codex баптау',
    pathLabel: 'Конфигурация файлының жолы',
    apply: 'Қолдану',
    cancel: 'Бас тарту',
    userControl:
      'Қолданбаны батырма арқылы қосыңыз. Баптаулар «Қолдану» батырмасын басқаннан кейін ғана өзгереді.',
    copyPrompt: 'Қосылу сұрауын көшіру',
    connectionPrompt: '<Өзіңіз таңдаған ат> атты агент ретінде қосыл.',
    missing: 'Бапталмаған',
  },
  ko: {
    aionAddress: 'AionUi WebUI 주소',
    aionCode: '페어링 코드',
    aionNotPaired: '페어링 안 됨',

    chatClose: '채팅 닫기',
    configureCursor: 'Cursor 설정',
    configureOpencode: 'OpenCode 설정',
    configureCodex: 'Codex 설정',
    pathLabel: '설정 파일 경로',
    apply: '적용',
    cancel: '취소',
    userControl: '버튼으로 애플리케이션을 연결하세요. 설정은 ‘적용’을 클릭한 후에만 변경됩니다.',
    copyPrompt: '연결 프롬프트 복사',
    connectionPrompt: '에이전트 <원하는 이름>으로 연결해 주세요.',
    missing: '설정되지 않음',
  },
  nl: {
    aionAddress: 'AionUi-WebUI-adres',
    aionCode: 'Koppelcode',
    aionNotPaired: 'Niet gekoppeld',

    chatClose: 'Chat sluiten',
    configureCursor: 'Cursor instellen',
    configureOpencode: 'OpenCode instellen',
    configureCodex: 'Codex instellen',
    pathLabel: 'Pad naar configuratiebestand',
    apply: 'Toepassen',
    cancel: 'Annuleren',
    userControl:
      'Verbind uw toepassing met een knop. Instellingen veranderen pas nadat u op ‘Toepassen’ klikt.',
    copyPrompt: 'Verbindingsprompt kopiëren',
    connectionPrompt: 'Verbind als agent <een naam naar keuze>.',
    missing: 'Niet ingesteld',
  },
  pl: {
    aionAddress: 'Adres WebUI AionUi',
    aionCode: 'Kod parowania',
    aionNotPaired: 'Nie sparowano',

    chatClose: 'Zamknij czat',
    configureCursor: 'Skonfiguruj Cursor',
    configureOpencode: 'Skonfiguruj OpenCode',
    configureCodex: 'Skonfiguruj Codex',
    pathLabel: 'Ścieżka pliku konfiguracji',
    apply: 'Zastosuj',
    cancel: 'Anuluj',
    userControl:
      'Połącz aplikację przyciskiem. Ustawienia zmienią się dopiero po kliknięciu „Zastosuj”.',
    copyPrompt: 'Kopiuj polecenie połączenia',
    connectionPrompt: 'Połącz się jako agent <wybrana przez ciebie nazwa>.',
    missing: 'Nie skonfigurowano',
  },
  'pt-BR': {
    aionAddress: 'Endereço WebUI do AionUi',
    aionCode: 'Código de pareamento',
    aionNotPaired: 'Não pareado',

    chatClose: 'Fechar chat',
    configureCursor: 'Configurar Cursor',
    configureOpencode: 'Configurar OpenCode',
    configureCodex: 'Configurar Codex',
    pathLabel: 'Caminho do arquivo de configuração',
    apply: 'Aplicar',
    cancel: 'Cancelar',
    userControl:
      'Conecte seu aplicativo com um botão. As configurações só mudam depois de clicar em “Aplicar”.',
    copyPrompt: 'Copiar solicitação de conexão',
    connectionPrompt: 'Conecte-se como agente <um nome de sua escolha>.',
    missing: 'Não configurado',
  },
  tr: {
    aionAddress: 'AionUi WebUI adresi',
    aionCode: 'Eşleştirme kodu',
    aionNotPaired: 'Eşleştirilmedi',

    chatClose: 'Sohbeti kapat',
    configureCursor: 'Cursor uygulamasını yapılandır',
    configureOpencode: 'OpenCode uygulamasını yapılandır',
    configureCodex: 'Codex uygulamasını yapılandır',
    pathLabel: 'Yapılandırma dosyası yolu',
    apply: 'Uygula',
    cancel: 'İptal',
    userControl:
      'Uygulamanızı bir düğmeyle bağlayın. Ayarlar yalnızca “Uygula” düğmesine tıkladıktan sonra değişir.',
    copyPrompt: 'Bağlantı istemini kopyala',
    connectionPrompt: '<Seçtiğiniz bir ad> adlı ajan olarak bağlan.',
    missing: 'Yapılandırılmadı',
  },
  uk: {
    aionAddress: 'Адреса WebUI AionUi',
    aionCode: 'Код сполучення',
    aionNotPaired: 'Не сполучено',

    chatClose: 'Закрити чат',
    configureCursor: 'Налаштувати Cursor',
    configureOpencode: 'Налаштувати OpenCode',
    configureCodex: 'Налаштувати Codex',
    pathLabel: 'Шлях до файлу конфігурації',
    apply: 'Застосувати',
    cancel: 'Скасувати',
    userControl:
      'Підключіть застосунок за допомогою кнопки. Налаштування змінюються лише після натискання «Застосувати».',
    copyPrompt: 'Скопіювати запит підключення',
    connectionPrompt: 'Підключись як агент <вибране вами ім’я>.',
    missing: 'Не налаштовано',
  },
  'zh-CN': {
    aionAddress: 'AionUi WebUI 地址',
    aionCode: '配对码',
    aionNotPaired: '未配对',

    chatClose: '关闭聊天',
    configureCursor: '配置 Cursor',
    configureOpencode: '配置 OpenCode',
    configureCodex: '配置 Codex',
    pathLabel: '配置文件路径',
    apply: '应用',
    cancel: '取消',
    userControl: '通过按钮连接应用程序。仅在点击“应用”后才会修改设置。',
    copyPrompt: '复制连接提示词',
    connectionPrompt: '以代理<您选择的名称>的身份连接。',
    missing: '尚未配置',
  },
};
const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-interconnect-locale-'));
const profile = path.join(temp, 'desktop');
const testEnvironment = await createUiEnvironment(path.join(temp, 'clients'));
const clientConfigurations = uiClientConfigPaths(testEnvironment);
const configurationContents = () =>
  Promise.all(
    clientConfigurations.map(async (filename) => {
      try {
        return await readFile(filename, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    }),
  );
const configurationBefore = await configurationContents();
const nodeLabel = 'Locale node $& {node} 東京';
const agentName = 'Locale agent $& {count} Ж';
const targetName = 'Locale target {size} 漢字';
const message = "Literal $& $$ $` $' {name} {size} Москва 東京";
const screenshots = [];
const pageErrors = [];
let application, page;
const packaged = process.env.INTERCONNECT_TEST_EXECUTABLE;
const invoke = (method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
const navigate = (name) => page.getByTestId('nav-' + name).click();
async function selectLanguage(label) {
  await page.getByTestId('interface-language').getByRole('combobox').click();
  await page.getByRole('option', { name: label, exact: true }).click();
}
async function expectLanguage(locale, overview, settings) {
  await navigate('overview');
  await page.getByTestId('page-title').filter({ hasText: overview }).waitFor();
  assert.equal(await page.getByTestId('page-title').innerText(), overview);
  await page.getByTestId('nav-settings').getByText(settings, { exact: true }).waitFor();
  assert.equal(await page.locator('html').getAttribute('lang'), locale);
  const control = await page.getByTestId('node-toggle').boundingBox();
  const width = await page.evaluate(() => innerWidth);
  assert.ok(control && control.x >= 0 && control.x + control.width <= width + 1);
}
async function capture(name) {
  const filename = 'release/locale-' + name + '.png';
  await page.mouse.move(1, 1);
  await page.screenshot({ path: filename });
  screenshots.push(filename);
}
async function closeChat(locale) {
  const drawer = page.getByRole('dialog', { name: agentName, exact: true });
  await drawer.getByRole('button', { name: setupLabels[locale].chatClose, exact: true }).click();
  await drawer.waitFor({ state: 'detached' });
}
async function checkMcpSetup(locale) {
  const expected = setupLabels[locale];
  assert.equal(await page.getByRole('tab').count(), 4);
  assert.equal(await page.locator('main').getByRole('combobox').count(), 0);
  assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  await page.getByText(expected.userControl, { exact: true }).waitFor();
  for (const [client, label, configure] of [
    ['cursor', 'Cursor', expected.configureCursor],
    ['opencode', 'OpenCode', expected.configureOpencode],
    ['codex', 'Codex', expected.configureCodex],
  ]) {
    await page.getByRole('tab', { name: label, exact: true }).click();
    assert.equal(await page.getByTestId('mcp-configure-' + client).innerText(), configure);
    await page.getByTestId('mcp-settings-status').filter({ hasText: expected.missing }).waitFor();
  }
  await page.getByRole('tab', { name: 'AionUi', exact: true }).click();
  const aionSetup = page.getByTestId('aionui-setup');
  await aionSetup.getByText(expected.aionNotPaired, { exact: true }).waitFor();
  await page.getByTestId('aionui-configure-access').click();
  const accessDialog = page.getByRole('dialog');
  assert.equal(
    await accessDialog
      .getByRole('textbox', { name: expected.aionAddress, exact: true })
      .inputValue(),
    'http://127.0.0.1:25808',
  );
  assert.equal(
    await accessDialog.getByLabel(expected.aionCode, { exact: true }).getAttribute('type'),
    'password',
  );
  await accessDialog.getByRole('button', { name: expected.cancel, exact: true }).click();
  assert.equal(await page.locator('pre, textarea, [contenteditable="true"]').count(), 0);
  await page.getByRole('tab', { name: 'Cursor', exact: true }).click();
  await page.getByRole('button', { name: expected.copyPrompt, exact: true }).waitFor();
  await page.getByText(expected.connectionPrompt, { exact: true }).waitFor();
  await page.getByTestId('mcp-configure-cursor').click();
  const dialog = page.getByRole('dialog', { name: expected.configureCursor, exact: true });
  const selectedPath = await dialog
    .getByRole('textbox', { name: expected.pathLabel, exact: true })
    .inputValue();
  assert.ok(clientConfigurations.includes(selectedPath));
  await dialog.getByRole('button', { name: expected.apply, exact: true }).waitFor();
  await page.waitForFunction(() => {
    const apply = document.querySelector('[data-testid="mcp-apply"]');
    return apply && !apply.disabled;
  });
  await dialog.getByRole('button', { name: expected.cancel, exact: true }).click();
  await dialog.waitFor({ state: 'detached' });
  assert.deepEqual(
    await configurationContents(),
    configurationBefore,
    locale + ': settings must not change before Apply',
  );
}
async function launch() {
  const env = testEnvironment;
  application = await electron.launch({
    executablePath: packaged ?? require('electron'),
    args: [...(packaged ? [] : [process.cwd()]), '--data-dir', profile],
    cwd: temp,
    env,
    timeout: 30000,
  });
  page = await application.firstWindow();
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.getByTestId('interface-language').waitFor();
  await application.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setSize(1050, 700),
  );
}
try {
  await mkdir('release', { recursive: true });
  await createUiProfile(profile, nodeLabel);
  await launch();
  await expectLanguage('en', 'Overview', 'Settings');
  assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.locale')), null);
  await selectLanguage('Русский');
  await expectLanguage('ru', 'Обзор', 'Настройки');
  assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.locale')), 'ru');
  await application.close();
  application = null;
  await launch();
  await expectLanguage('ru', 'Обзор', 'Настройки');
  await selectLanguage('English');
  await expectLanguage('en', 'Overview', 'Settings');
  await invoke('registerAgent', { nickname: agentName });
  await navigate('agents');
  await page
    .getByTestId('agent-row')
    .filter({ hasText: agentName })
    .getByRole('button')
    .first()
    .click();
  await page.getByRole('textbox', { name: 'Recipient agent name', exact: true }).fill(targetName);
  await page.getByRole('textbox', { name: 'Message from the user', exact: true }).fill(message);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByText(message, { exact: true }).waitFor();
  const historyBefore = await invoke('history', { nickname: agentName });
  assert.equal(historyBefore.messages.length, 1);
  await closeChat('en');
  await navigate('mcp');
  await checkMcpSetup('en');
  const results = [];
  for (const [locale, label, overview, settings] of cases) {
    await selectLanguage(label);
    await expectLanguage(locale, overview, settings);
    assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.locale')), locale);
    const bounds = await page.getByTestId('interface-language').boundingBox();
    const height = await page.evaluate(() => innerHeight);
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= height + 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok((await page.locator('body').textContent()).includes(nodeLabel));
    await capture(locale + '-overview');
    for (const name of ['agents', 'network', 'mcp', 'clients', 'settings']) {
      await navigate(name);
      await page.getByTestId('page-title').waitFor();
      const toggleBounds = await page.getByTestId('node-toggle').boundingBox();
      const width = await page.evaluate(() => innerWidth);
      assert.ok(
        toggleBounds && toggleBounds.x >= 0 && toggleBounds.x + toggleBounds.width <= width + 1,
        locale + ': node controls must remain inside the window',
      );
      assert.ok(
        await page
          .locator('main')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      );
      if (name === 'agents') {
        await page
          .getByTestId('agent-row')
          .filter({ hasText: agentName })
          .getByRole('button')
          .first()
          .click();
        await page.getByText(message, { exact: true }).waitFor();
        assert.ok((await page.getByRole('dialog').textContent()).includes(targetName));
        await capture(locale + '-agents');
        await closeChat(locale);
      }
      if (name === 'mcp') {
        await checkMcpSetup(locale);
      }
    }
    assert.deepEqual(await invoke('history', { nickname: agentName }), historyBefore);
    results.push({
      locale,
      aionUiSetupLocalized: true,
      mcpTabs: 4,
      pages: 6,
      htmlLang: true,
      headerControlsVisible: true,
      headerControlBounds: await page.getByTestId('node-toggle').boundingBox(),
      literalContent: true,
      privateClientConfigurationsUnchangedWithoutApply: true,
    });
  }
  await selectLanguage('English');
  await expectLanguage('en', 'Overview', 'Settings');
  await page.addInitScript(() => {
    const failure = window.name;
    if (failure === 'deny-getter')
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('Test storage getter unavailable', 'SecurityError');
        },
      });
    if (failure === 'deny-read')
      Storage.prototype.getItem = () => {
        throw new DOMException('Test storage read unavailable', 'SecurityError');
      };
    if (failure === 'deny-write')
      Storage.prototype.setItem = () => {
        throw new DOMException('Test storage full', 'QuotaExceededError');
      };
  });
  for (const failure of ['deny-getter', 'deny-read', 'deny-write']) {
    await page.evaluate(() => {
      window.name = '';
    });
    await page.reload();
    await page.getByTestId('interface-language').waitFor();
    await page.evaluate((failure) => {
      localStorage.setItem('interconnect.locale', 'en');
      window.name = failure;
    }, failure);
    await page.reload();
    await expectLanguage('en', 'Overview', 'Settings');
    await selectLanguage('Русский');
    await expectLanguage('ru', 'Обзор', 'Настройки');
    if (failure === 'deny-write')
      assert.equal(await page.evaluate(() => localStorage.getItem('interconnect.locale')), 'en');
  }
  assert.deepEqual(pageErrors, []);
  const runtime = await application.evaluate(({ app }) => ({
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));
  const result = {
    runtime,
    defaultEnglish: true,
    persistedAcrossRestart: true,
    locales: results,
    supportedWindowSize: [1050, 700],
    storageFailuresRecover: ['getter', 'read', 'write'],
    pageErrors,
    screenshots,
    liveAgentsContacted: false,
  };
  await writeFile('release/locale-verification.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally {
  if (application) await application.close();
  await rm(temp, { recursive: true, force: true });
}

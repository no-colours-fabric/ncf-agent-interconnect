import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createUiProfile } from './ui-test-profile.mjs';

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
const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-interconnect-locale-'));
const profile = path.join(temp, 'desktop');
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
async function launch() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
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
  await page
    .getByRole('dialog')
    .getByRole('button')
    .filter({ has: page.locator('[data-testid="CloseOutlinedIcon"]') })
    .click();
  await navigate('mcp');
  await page.locator('pre').waitFor();
  const configuration = await page.locator('pre').textContent();
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
        assert.equal(await page.getByText(message, { exact: true }).isVisible(), true);
        assert.ok((await page.getByRole('dialog').textContent()).includes(targetName));
        await capture(locale + '-agents');
        await page
          .getByRole('dialog')
          .getByRole('button')
          .filter({ has: page.locator('[data-testid="CloseOutlinedIcon"]') })
          .click();
      }
      if (name === 'mcp') {
        await page.locator('pre').waitFor();
        assert.equal(await page.locator('pre').textContent(), configuration);
      }
    }
    assert.deepEqual(await invoke('history', { nickname: agentName }), historyBefore);
    results.push({
      locale,
      pages: 6,
      htmlLang: true,
      headerControlsVisible: true,
      headerControlBounds: await page.getByTestId('node-toggle').boundingBox(),
      literalContent: true,
      configurationUnchanged: true,
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

import { _electron as electron } from 'playwright';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const temp = await mkdtemp(path.join(os.tmpdir(), 'ncf-interconnect-locale-'));
let application;
try {
  const launch = () =>
    electron.launch({
      executablePath: require('electron'),
      args: [process.cwd(), '--data-dir', path.join(temp, 'desktop')],
      cwd: temp,
      timeout: 30000,
    });
  const getPage = async () => await application.firstWindow();
  application = await launch();
  let current = await getPage();

  await current.getByText('Connect agents', { exact: true }).waitFor();
  assert.equal(
    await current.evaluate(() => window.localStorage.getItem('interconnect.locale')),
    null,
    'fresh app profile defaults to English without a stored locale',
  );

  await current.getByRole('button', { name: 'Agents', exact: true }).waitFor();
  await current.getByText('Local messaging node', { exact: true }).waitFor();
  await current.getByText('Node running', { exact: true }).waitFor();
  await current.getByRole('combobox', { name: 'Interface language' }).waitFor();

  await current.getByRole('combobox', { name: 'Interface language' }).click();
  await current.getByRole('option', { name: 'Русский' }).click();

  await current.getByText('Локальный узел', { exact: false }).waitFor();
  await current.getByText('Узел работает', { exact: true }).waitFor();
  await current.getByRole('combobox', { name: 'Язык интерфейса' }).waitFor();
  await current.getByRole('heading', { name: 'Обзор', exact: true }).waitFor();
  await current.getByRole('button', { name: 'Агенты', exact: true }).waitFor();
  await current.getByRole('heading', { name: 'Подключение агентов', exact: true }).waitFor();
  assert.equal(
    await current.evaluate(() => window.localStorage.getItem('interconnect.locale')),
    'ru',
    'Russian choice is persisted in the app profile',
  );
  await current.screenshot({ path: 'release/preview-overview-ru.png' });

  await current.getByRole('button', { name: 'Агенты', exact: true }).click();
  await current.getByRole('button', { name: 'Добавить агента', exact: true }).waitFor();
  await current.getByRole('button', { name: 'Агенты', exact: true }).first().waitFor();
  await current.getByText('Добавьте агента с именем на ваш выбор.', { exact: true }).waitFor();

  await application.close();
  application = null;

  application = await launch();
  current = await getPage();
  await current.getByRole('heading', { name: 'Подключение агентов', exact: true }).waitFor();
  await current.getByText('Узел работает', { exact: true }).waitFor();
  assert.equal(
    await current.evaluate(() => window.localStorage.getItem('interconnect.locale')),
    'ru',
    'restart keeps the persisted Russian interface',
  );

  await current.getByRole('combobox', { name: 'Язык интерфейса' }).click();
  await current.getByRole('option', { name: 'English' }).click();
  await current.getByText('Connect agents', { exact: true }).waitFor();
  assert.equal(
    await current.evaluate(() => window.localStorage.getItem('interconnect.locale')),
    'en',
    'switching back to English is persisted',
  );

  console.log(
    JSON.stringify({
      defaultLanguage: 'English',
      switchToRussian: true,
      persistedAcrossRestart: true,
      switchBackToEnglish: true,
      screenshots: ['release/preview-overview-ru.png'],
    }),
  );
} finally {
  if (application) await application.close();
  await rm(temp, { recursive: true, force: true });
}

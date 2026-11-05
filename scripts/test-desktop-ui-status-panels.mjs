import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { createUiEnvironment } from './ui-test-profile.mjs';
import { createHistoryLayoutObservation } from './ui-history-layout-observer.mjs';

// Renderer-only fixtures. No node, adapter, client configuration or live profile is opened.
const require = createRequire(import.meta.url);
const root = process.cwd();
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ncf-status-panels-'));
const baselineOnly = process.argv.includes('--baseline-only');
const sendStyleOnly = process.argv.includes('--send-style-only');
const aionLayoutOnly = process.argv.includes('--aion-layout-only');
const output = path.join(root, 'release', 'ui-status-panel', ...(baselineOnly ? ['baseline'] : []));
const id = (value) => '30000000-0000-4000-8000-' + String(value).padStart(12, '0');
const local = id(1),
  remote = id(2),
  owner = 'Owner Ж',
  remoteName = 'Remote reviewer';
const stamp = '2026-11-05T09:00:00.000Z';
const agentDefinitions = [
  [owner, 'manual', 'Cursor', true],
  ['Other manual', 'manual', 'Generic MCP', false],
  ['OpenCode first', 'opencode-http', 'OpenCode', true],
  ['OpenCode second', 'opencode-http', 'OpenCode', false],
  ['Codex agent', 'codex-desktop', 'Codex', true],
  ['Aion agent', 'aionui', 'AionUi', true],
];
const snapshot = {
  running: true,
  nodeId: '30000000-0000-4000-8000-000000000001',
  nodeLabel: 'Status panel fixture',
  mcpUrl: 'http://127.0.0.1:42000/mcp',
  peerUrl: 'wss://127.0.0.1:7336/peer',
  listenHost: '127.0.0.1',
  localAddresses: ['127.0.0.1', '192.0.2.10'],
  agents: agentDefinitions.map(([nickname, , client], index) => ({
    key: nickname.toLowerCase(),
    nickname,
    incarnation: id(10 + index),
    binding: {
      client,
      adapterId: id(20 + index),
      connectionId: id(30 + index),
      chatId: 'exact-fixture-' + index,
      generation: 1,
    },
    unread: 0,
    messageCount: 12,
    incomingCount: 7,
    outgoingCount: 5,
    lastMessageAt: stamp,
  })),
  adapters: agentDefinitions.map(([, kind, , ready], index) => ({
    id: id(20 + index),
    kind,
    label: kind,
    state: 'ready',
    error: null,
    lastOwnerVerifiedAt: stamp,
    capabilities: {
      wakeIdle: ready,
      receiveActive: false,
      nativeDisplay: false,
      exactSession: true,
    },
  })),
  directories: [
    {
      nodeId: local,
      nodeLabel: 'Status panel fixture',
      local: true,
      state: 'ready',
      agents: agentDefinitions.map(([nickname]) => ({
        nickname,
        availability: 'online',
        delivery: 'mcp',
      })),
    },
    {
      nodeId: remote,
      nodeLabel: 'Review station',
      local: false,
      state: 'ready',
      agents: [{ nickname: remoteName, availability: 'online', delivery: 'mcp' }],
    },
  ].map((directory) => ({
    ...directory,
    epoch: id(40),
    revision: 1,
    updatedAt: stamp,
    total: directory.agents.length,
    truncated: false,
  })),
  peers: [
    {
      id: remote,
      label: 'Review station',
      address: 'wss://192.0.2.20:7336/peer',
      connected: true,
      error: null,
    },
  ],
  exportRoots: Array.from({ length: 20 }, (_, index) =>
    path.join(temporary, 'exports', 'folder-' + index),
  ),
  errors: [],
};
const messages = Array.from({ length: 30 }, (_, index) => ({
  sequence: index + 1,
  direction: index % 2 ? 'in' : 'out',
  state: 'ready',
  error: null,
  envelope: {
    protocol: 2,
    id: id(100 + index),
    fromNode: local,
    toNode: local,
    fromNickname: index % 2 ? 'OpenCode first' : owner,
    toNickname: index % 2 ? owner : 'OpenCode first',
    createdAt: stamp,
    text:
      'Review ' +
      index +
      ' Москва 東京\n' +
      'Preserve the message anchor and exact delivery. '.repeat((index % 3) + 1),
    replyTo: null,
    attachments: [],
  },
}));
const clients = Object.fromEntries(
  ['cursor', 'opencode', 'codex', 'aionui'].map((client) => [
    client,
    {
      client,
      state: client === 'codex' ? 'needs-update' : 'configured',
      remembered: true,
      files: [
        {
          id: 'configuration',
          path: path.join(
            temporary,
            'clients',
            client,
            client === 'codex' ? 'config.toml' : 'mcp.json',
          ),
          state: client === 'codex' ? 'needs-update' : 'configured',
        },
      ],
    },
  ]),
);
let application, page;
const errors = [],
  results = [],
  screenshots = [];
const invoke = (method, params = {}) =>
  page.evaluate(({ method, params }) => window.interconnect.invoke(method, params), {
    method,
    params,
  });
const chat = () => page.getByRole('dialog', { name: owner, exact: true });
const text = () =>
  page.getByRole('dialog').getByRole('textbox', { name: 'Message from the user', exact: true });
const recipient = () => chat().getByRole('textbox', { name: 'Recipient agent name', exact: true });
const composeToggle = () => page.getByTestId('agent-chat-compose-toggle');
async function until(predicate, label) {
  const deadline = Date.now() + 10000;
  while (!(await predicate())) {
    if (Date.now() > deadline) throw Error('Timed out: ' + label);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function settled() {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations))
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
}
async function resize(width, height) {
  const window = await application.browserWindow(page);
  await window.evaluate((window, size) => window.setContentSize(size.width, size.height), {
    width,
    height,
  });
  await page.waitForFunction(
    ({ width, height }) => innerWidth === width && innerHeight === height,
    { width, height },
  );
  const native = await window.evaluate((window) => window.getContentBounds());
  const dom = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.equal(page.viewportSize(), null);
  assert.equal(native.width, width);
  assert.equal(native.height, height);
  assert.equal(dom.width, width);
  assert.equal(dom.height, height);
  assert.ok(dom.scrollWidth <= width);
  return { native, dom };
}
async function capture(name) {
  await page.mouse.move(1, 1);
  await settled();
  const file = path.join(output, name + '.png');
  await page.screenshot({ path: file, animations: 'disabled' });
  screenshots.push(file);
}
async function stickyLabelEvidence() {
  await page.getByTestId('nav-settings').click();
  await page.getByRole('textbox', { name: 'Node name', exact: true }).waitFor();
  await page.locator('main').evaluate((main) => {
    main.scrollTop = 0;
  });
  await settled();
  const input = page.getByRole('textbox', { name: 'Node name', exact: true });
  const labelId = await input.getAttribute('id');
  const label = page.locator('label[for=' + JSON.stringify(labelId) + ']');
  const scroll = await label.evaluate((element) => {
    const header = document.querySelector('main > header'),
      main = document.querySelector('main');
    const original = element.getBoundingClientRect(),
      head = header.getBoundingClientRect();
    const requested = main.scrollTop + original.top - (head.top + head.height / 2 - 10);
    main.scrollTop = requested;
    return {
      requested,
      actual: main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
    };
  });
  await settled();
  return label.evaluate((element, scroll) => {
    const header = document.querySelector('main > header');
    const bounds = (node) => {
      const b = node.getBoundingClientRect();
      return {
        x: b.x,
        y: b.y,
        width: b.width,
        height: b.height,
        top: b.top,
        right: b.right,
        bottom: b.bottom,
        left: b.left,
      };
    };
    const styles = (node) => {
      const s = getComputedStyle(node);
      return {
        tag: node.tagName,
        className: node.className,
        position: s.position,
        zIndex: s.zIndex,
        display: s.display,
        opacity: s.opacity,
        transform: s.transform,
        filter: s.filter,
        backdropFilter: s.backdropFilter,
        isolation: s.isolation,
        contain: s.contain,
        perspective: s.perspective,
        willChange: s.willChange,
      };
    };
    const ancestors = (node) => {
      const found = [];
      for (let item = node; item; item = item.parentElement) found.push(styles(item));
      return found;
    };
    const labelBounds = bounds(element),
      headerBounds = bounds(header);
    const point = {
      x: labelBounds.x + Math.min(labelBounds.width - 1, 10),
      y: labelBounds.top + labelBounds.height / 2,
    };
    const hit = document.elementFromPoint(point.x, point.y);
    const stack = document.elementsFromPoint(point.x, point.y);
    return {
      scroll,
      label: bounds(element),
      header: headerBounds,
      labelStyle: styles(element),
      headerStyle: styles(header),
      labelAncestors: ancestors(element),
      headerAncestors: ancestors(header),
      point,
      hit: hit ? styles(hit) : null,
      hitIsLabel: hit === element,
      hitIsHeader: !!hit && (hit === header || header.contains(hit)),
      overlap: labelBounds.top < headerBounds.bottom && labelBounds.bottom > headerBounds.top,
      hitStack: stack.map(styles),
    };
  }, scroll);
}
async function flatSendEvidence() {
  const send = page.getByRole('dialog').getByRole('button', { name: 'Send message', exact: true });
  const normal = await send.evaluate((element) => {
    const s = getComputedStyle(element);
    return {
      borderWidth: s.borderWidth,
      backgroundImage: s.backgroundImage,
      boxShadow: s.boxShadow,
      outlineWidth: s.outlineWidth,
      outlineStyle: s.outlineStyle,
      outlineColor: s.outlineColor,
      focused: document.activeElement === element,
      visibleClass: element.classList.contains('Mui-focusVisible'),
    };
  });
  assert.equal(normal.borderWidth, '0px');
  assert.equal(normal.backgroundImage, 'none');
  assert.equal(normal.boxShadow, 'none');
  assert.equal(normal.outlineStyle, 'none');
  await text().press('Tab');
  assert.equal(await send.evaluate((element) => document.activeElement === element), true);
  const focus = await send.evaluate((element) => {
    const s = getComputedStyle(element);
    return {
      visible: element.classList.contains('Mui-focusVisible'),
      outlineWidth: s.outlineWidth,
      outlineStyle: s.outlineStyle,
    };
  });
  assert.equal(focus.visible, true);
  assert.equal(focus.outlineWidth, '2px');
  assert.equal(focus.outlineStyle, 'solid');
  await writeFile(
    path.join(output, 'send-style-observed.json'),
    JSON.stringify({ normal, focus }, null, 2),
  );
  return { normal, focus };
}
async function exposedLabelAndPortal() {
  await page.locator('main').evaluate((main) => {
    main.scrollTop = 0;
  });
  await settled();
  const field = page.getByRole('textbox', { name: 'Node name', exact: true });
  const id = await field.getAttribute('id');
  await page.locator('label[for=' + JSON.stringify(id) + ']').click();
  assert.equal(await field.evaluate((element) => document.activeElement === element), true);
  const select = page.getByRole('combobox', {
    name: 'Local IP for incoming connections',
    exact: true,
  });
  await select.click();
  const list = page.getByRole('listbox');
  await list.waitFor();
  const portal = await list.evaluate((element) => {
    const b = element.getBoundingClientRect();
    const hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    const modal = element.closest('.MuiModal-root');
    return {
      inMain: !!element.closest('main'),
      zIndex: modal ? getComputedStyle(modal).zIndex : null,
      hitInside: !!hit && element.contains(hit),
      height: b.height,
    };
  });
  assert.equal(portal.inMain, false);
  assert.equal(portal.hitInside, true);
  assert.ok(Number(portal.zIndex) > 1100);
  await page.getByRole('option', { name: '192.0.2.10', exact: true }).click();
  await list.waitFor({ state: 'detached' });
  assert.ok((await select.innerText()).includes('192.0.2.10'));
  return portal;
}
async function verifyClientPanel(client, count, delivery) {
  await page.locator('#mcp-tab-' + client).click();
  await settled();
  const panel = page.getByTestId('client-status-panel');
  await panel.waitFor();
  assert.equal(await panel.count(), 1);
  assert.equal(await panel.getAttribute('data-client'), client);
  assert.equal(await page.getByTestId('client-setup-description').count(), 0);
  assert.equal(
    await page
      .locator('[data-testid^="application-"]')
      .filter({ has: page.locator('table') })
      .count(),
    0,
  );
  assert.equal(await page.getByTestId('application-manual').count(), 0);
  const heading = await page
    .getByRole('tabpanel')
    .getByRole('heading', {
      name: { cursor: 'Cursor', opencode: 'OpenCode', codex: 'Codex', aionui: 'AionUi' }[client],
      exact: true,
    })
    .boundingBox();
  const bounds = await panel.boundingBox();
  assert.ok(bounds.y >= heading.y + heading.height);
  assert.equal(await panel.getByTestId('application-agent-count').innerText(), count);
  if (client === 'cursor') {
    assert.equal(await panel.getByTestId('application-last-activity').innerText(), 'Unknown');
    assert.equal(await panel.getByTestId('application-delivery-status').count(), 0);
  } else {
    assert.equal(
      await panel.getByTestId('application-last-activity').innerText(),
      new Date(stamp).toLocaleString('en'),
    );
    assert.equal(await panel.getByTestId('application-delivery-status').innerText(), delivery);
  }
  if (client === 'opencode') {
    await panel.getByText('MCP and plugin settings', { exact: true }).waitFor();
    await panel
      .getByText('This checks saved settings, not whether the plugin is running.', { exact: true })
      .waitFor();
  }
  return { client, count, delivery, status: await panel.getAttribute('data-status'), bounds };
}
async function finalCases() {
  const observation = createHistoryLayoutObservation(page, settled);
  await observation.instrumentResizeObserver();
  for (const theme of ['dark', 'light']) {
    await page.getByTestId('nav-settings').click();
    const themeToggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
    if ((await themeToggle.isChecked()) !== (theme === 'dark')) await themeToggle.click();
    for (const width of [900, 1440]) {
      const dimensions = await resize(width, width === 900 ? 620 : 900);
      const sticky = await stickyLabelEvidence();
      assert.equal(sticky.overlap, true);
      assert.equal(sticky.hitIsHeader, true);
      assert.equal(sticky.hitIsLabel, false);
      assert.equal(sticky.headerStyle.zIndex, '1100');
      await capture(theme + '-' + width + '-sticky-label');
      const portal = await exposedLabelAndPortal();
      await invoke('fixtureResetStates');
      await page.getByTestId('nav-overview').click();
      await settled();
      const stats = await page.getByTestId('overview-statistics').boundingBox(),
        apps = await page.getByTestId('overview-applications').boundingBox(),
        connections = await page.getByTestId('overview-connections').boundingBox();
      assert.ok(apps.y >= stats.y + stats.height);
      assert.ok(connections.y >= apps.y + apps.height);
      await capture(theme + '-' + width + '-overview');
      await page.getByTestId('nav-mcp').click();
      const panels = [];
      for (const [client, count, delivery] of [
        ['cursor', 'Unknown', null],
        ['opencode', '2', 'Some agents connected'],
        ['codex', '1', 'Previously verified'],
        ['aionui', '1', 'Connected'],
      ])
        panels.push(await verifyClientPanel(client, count, delivery));
      const aion = page.getByTestId('aionui-authorization');
      assert.equal(
        await aion.evaluate((element) => element.closest('.MuiPaper-root')?.dataset.testid),
        'client-status-panel',
      );
      await page
        .getByTestId('aionui-authorization-status')
        .getByText('Not paired', { exact: true })
        .waitFor();
      await page
        .getByTestId('aionui-bridge-status')
        .getByText('Bridge not connected to a verified chat', { exact: true })
        .waitFor();
      await capture(theme + '-' + width + '-status-panel');
      if (theme === 'dark' && width === 900) {
        await invoke('fixtureAionState', { state: 'paired', bridgeConnected: false });
        await page
          .getByTestId('aionui-authorization-status')
          .getByText('Authorization saved', { exact: true })
          .waitFor();
        assert.ok(
          (await page.getByTestId('aionui-bridge-status').innerText()).includes('not connected'),
        );
        await invoke('fixtureAionState', { state: 'paired', bridgeConnected: true });
        await page
          .getByTestId('aionui-bridge-status')
          .getByText('Bridge connected to a verified chat', { exact: true })
          .waitFor();
        await invoke('fixtureAionState', { state: 'paired', bridgeConnected: false });
        await page
          .getByTestId('aionui-bridge-status')
          .getByText('Bridge not connected to a verified chat', { exact: true })
          .waitFor();
        await page.getByTestId('aionui-configure-access').click();
        const accessDialog = page.getByRole('dialog');
        await accessDialog
          .getByRole('textbox', { name: 'AionUi WebUI address', exact: true })
          .fill('http://127.0.0.1:25808');
        await accessDialog
          .getByLabel('Pairing code', { exact: true })
          .fill('synthetic-cancel-only');
        await accessDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await accessDialog.waitFor({ state: 'detached' });
        await page.getByTestId('mcp-configure-aionui').click();
        const setupDialog = page.getByRole('dialog');
        const pathField = setupDialog.getByRole('textbox', {
          name: 'Configuration file path',
          exact: true,
        });
        await pathField.fill((await pathField.inputValue()) + '-review');
        await until(
          () => setupDialog.getByRole('button', { name: 'Apply', exact: true }).isEnabled(),
          'setup review',
        );
        await setupDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await setupDialog.waitFor({ state: 'detached' });
        for (const state of ['missing', 'not-configured', 'needs-update']) {
          await invoke('fixtureSetStatus', { client: 'opencode', state });
          await page.locator('#mcp-tab-cursor').click();
          await page.locator('#mcp-tab-opencode').click();
          await until(
            async () =>
              (await page
                .locator('#mcp-tab-opencode [data-mcp-state]')
                .getAttribute('data-mcp-state')) === state,
            'changed OpenCode state',
          );
          if (state === 'needs-update') {
            assert.equal(
              await page.getByTestId('client-status-panel').getAttribute('data-status'),
              state,
            );
            assert.equal(
              await page.getByTestId('application-delivery-status').innerText(),
              'Some agents connected',
            );
          } else {
            assert.equal(await page.getByTestId('client-status-panel').count(), 0);
            assert.ok(
              (await page.getByTestId('client-setup-description').innerText()).includes(
                'Connect OpenCode v1',
              ),
            );
          }
        }
        await invoke('fixtureHoldStatus', { client: 'opencode' });
        await page.locator('#mcp-tab-cursor').click();
        await page.locator('#mcp-tab-opencode').click();
        await until(
          async () =>
            (await page
              .locator('#mcp-tab-opencode [data-mcp-state]')
              .getAttribute('data-mcp-state')) === 'unknown',
          'checking status',
        );
        assert.equal(await page.getByTestId('client-status-panel').count(), 0);
        assert.equal(
          await page.getByTestId('client-setup-description').innerText(),
          'Checking settings…',
        );
        await invoke('fixtureReleaseStatus', { client: 'opencode', state: 'unavailable' });
        await until(
          async () =>
            (await page
              .locator('#mcp-tab-opencode [data-mcp-state]')
              .getAttribute('data-mcp-state')) === 'unavailable',
          'unavailable status',
        );
        assert.equal(await page.getByTestId('client-status-panel').count(), 0);
        assert.equal(
          await page.getByTestId('client-setup-description').innerText(),
          'Could not check settings',
        );
      }
      await page.getByTestId('nav-agents').click();
      await page.getByRole('button', { name: 'Open chat with ' + owner, exact: true }).click();
      await chat().waitFor();
      await settled();
      const history = page.getByTestId('agent-chat-history');
      const header = await page.getByTestId('agent-chat-compose-header').boundingBox(),
        button = await composeToggle().boundingBox();
      assert.ok(Math.abs(header.width - button.width) <= 1);
      assert.equal(button.height, 44);
      const opens = await observation.sampleViewportChange(history, 'bottom', async () => {
        await composeToggle().click({ position: { x: 8, y: 22 } });
      });
      assert.equal(opens.pass, true);
      assert.equal(
        await composeToggle().evaluate((element) => document.activeElement === element),
        true,
        'Opening restores focus to the replacement close toggle',
      );
      await recipient().fill('Target ' + theme + width);
      await text().fill('ABA ' + theme + width);
      const flatLocal = await flatSendEvidence();
      await invoke('fixtureHoldNextSend');
      await chat().getByRole('button', { name: 'Send message', exact: true }).click();
      await text().fill('Intermediate');
      await text().fill('ABA ' + theme + width);
      await invoke('fixtureFinishSend', { success: true });
      assert.equal(await text().inputValue(), 'ABA ' + theme + width);
      await recipient().fill('Other target ' + theme + width);
      assert.equal(await text().inputValue(), '');
      await text().fill('Other draft');
      await recipient().fill('Target ' + theme + width);
      assert.equal(await text().inputValue(), 'ABA ' + theme + width);
      await history.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await settled();
      let inert;
      const closes = await observation.sampleViewportChange(history, 'bottom', async () => {
        await composeToggle().click();
        inert = await page.getByTestId('agent-chat-compose').evaluate((element) => {
          const wrapper = element.closest('[inert]');
          return { inert: !!wrapper, hidden: wrapper?.getAttribute('aria-hidden') };
        });
        assert.equal(
          await page.getByRole('textbox', { name: 'Message from the user', exact: true }).count(),
          0,
        );
      });
      assert.equal(closes.pass, true);
      assert.deepEqual(inert, { inert: true, hidden: 'true' });
      assert.equal(await page.getByTestId('agent-chat-compose').count(), 0);
      assert.equal(
        await composeToggle().evaluate((element) => document.activeElement === element),
        true,
      );
      const keyboardOpen = await observation.sampleViewportChange(history, 'bottom', () =>
        composeToggle().press('Enter'),
      );
      assert.equal(keyboardOpen.pass, true);
      assert.equal(
        await composeToggle().evaluate((element) => document.activeElement === element),
        true,
      );
      assert.equal(await text().inputValue(), 'ABA ' + theme + width);
      await history.evaluate((element) => {
        element.scrollTop = element.scrollHeight * 0.4;
      });
      await settled();
      const readingClose = await observation.sampleViewportChange(history, 'reading', () =>
        composeToggle().click(),
      );
      assert.equal(readingClose.pass, true);
      const readingOpen = await observation.sampleViewportChange(history, 'reading', () =>
        composeToggle().press('Enter'),
      );
      assert.equal(readingOpen.pass, true);
      if (theme === 'dark' && width === 900) {
        await text().fill('Failed retained draft');
        await invoke('fixtureHoldNextSend');
        await chat().getByRole('button', { name: 'Send message', exact: true }).click();
        await composeToggle().click();
        await settled();
        await history.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await settled();
        const lateError = await observation.sampleViewportChange(history, 'bottom', () =>
          invoke('fixtureFinishSend', { success: false }),
        );
        assert.equal(lateError.pass, true);
        await chat().getByRole('alert').filter({ hasText: 'Synthetic send rejected' }).waitFor();
        results.push({ lateError });
        await composeToggle().press('Enter');
        await settled();
        assert.equal(await text().inputValue(), 'Failed retained draft');
      }
      await capture(theme + '-' + width + '-chat');
      await chat().getByRole('button', { name: 'Close chat', exact: true }).click();
      await chat().waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Open chat with ' + remoteName, exact: true }).click();
      const remoteDialog = page.getByRole('dialog', { name: remoteName, exact: true });
      await remoteDialog.waitFor();
      await remoteDialog.getByRole('combobox', { name: 'Sender agent', exact: true }).click();
      await page.getByRole('option', { name: owner, exact: true }).click();
      await text().fill('Remote ' + theme + width);
      const flatRemote = await flatSendEvidence();
      await capture(theme + '-' + width + '-remote');
      await page.keyboard.press('Escape');
      await remoteDialog.waitFor({ state: 'detached' });
      results.push({
        theme,
        width,
        dimensions,
        sticky,
        portal,
        overview: { stats, apps, connections },
        panels,
        flatLocal,
        flatRemote,
        inert,
        animation: { opens, closes, keyboardOpen, readingClose, readingOpen },
      });
    }
  }
  const calls = await invoke('fixtureCalls');
  assert.equal(
    calls.filter(
      ({ method }) =>
        method === 'mcpSetupApply' || method === 'aionUiPair' || method === 'aionUiDisconnect',
    ).length,
    0,
    'Cancel/setup/status checks must not write or pair',
  );
}
async function aionLayoutCases() {
  for (const theme of ['dark', 'light']) {
    await page.getByTestId('nav-settings').click();
    const themeToggle = page.getByRole('switch', { name: 'Dark theme', exact: true });
    if ((await themeToggle.isChecked()) !== (theme === 'dark')) await themeToggle.click();
    for (const width of [900, 1440]) {
      const dimensions = await resize(width, width === 900 ? 620 : 900);
      await page.getByTestId('nav-settings').click();
      const nodeName = page.getByRole('textbox', { name: 'Node name', exact: true });
      const unsaved = 'Unsaved ' + theme + width;
      await nodeName.fill(unsaved);
      await invoke('fixtureResetStates');
      await invoke('fixtureHoldStatus', { client: 'aionui' });
      await page.getByTestId('nav-overview').click();
      await page.getByTestId('nav-mcp').click();
      await page.locator('#mcp-tab-aionui').click();
      await until(
        async () =>
          (await page
            .locator('#mcp-tab-aionui [data-mcp-state]')
            .getAttribute('data-mcp-state')) === 'unknown',
        'pending Aion settings',
      );
      assert.equal(await page.getByTestId('client-status-panel').count(), 0);
      await page
        .getByTestId('aionui-authorization-status')
        .getByText('Not paired', { exact: true })
        .waitFor();
      await page.getByTestId('aionui-configure-access').click();
      const dialog = page.getByRole('dialog');
      await dialog.waitFor();
      await dialog
        .getByText(
          'Enable WebUI in AionUi on this computer, enter its address and pairing code, then confirm access in AionUi.',
          { exact: true },
        )
        .waitFor();
      const url = dialog.getByRole('textbox', { name: 'AionUi WebUI address', exact: true }),
        code = dialog.getByLabel('Pairing code', { exact: true });
      const enteredUrl = 'http://127.0.0.1:25809',
        enteredCode = 'synthetic-owner-lifetime';
      await url.fill(enteredUrl);
      await code.fill(enteredCode);
      await dialog.evaluate((element) => {
        element.dataset.fixtureOwner = 'same';
      });
      await invoke('fixtureReleaseStatus', { client: 'aionui', state: 'configured' });
      await page.getByTestId('client-status-panel').waitFor();
      await settled();
      assert.equal(await dialog.getAttribute('data-fixture-owner'), 'same');
      assert.equal(await url.inputValue(), enteredUrl);
      assert.equal(await code.inputValue(), enteredCode);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'detached' });
      const panel = page.getByTestId('client-status-panel');
      assert.equal(await panel.count(), 1);
      assert.equal(await panel.getAttribute('data-client'), 'aionui');
      assert.equal(await page.getByTestId('client-setup-description').count(), 0);
      const auth = page.getByTestId('aionui-authorization');
      const facts = page.getByTestId('aionui-status-facts');
      const authLabel = auth.getByText('Authorization', { exact: true }),
        bridgeLabel = auth.getByText('Live bridge', { exact: true });
      const authValue = page.getByTestId('aionui-authorization-status'),
        bridgeValue = page.getByTestId('aionui-bridge-status');
      const boxes = {
        authorizationLabel: await authLabel.boundingBox(),
        authorizationValue: await authValue.boundingBox(),
        bridgeLabel: await bridgeLabel.boundingBox(),
        bridgeValue: await bridgeValue.boundingBox(),
        facts: await facts.boundingBox(),
      };
      assert.ok(
        Math.abs(boxes.authorizationLabel.y - boxes.bridgeLabel.y) <= 1,
        'Both fact labels share one row',
      );
      assert.ok(
        boxes.authorizationLabel.y + boxes.authorizationLabel.height <=
          boxes.authorizationValue.y + 1,
      );
      assert.ok(boxes.bridgeLabel.y + boxes.bridgeLabel.height <= boxes.bridgeValue.y + 1);
      assert.ok(
        boxes.authorizationValue.x + boxes.authorizationValue.width < boxes.bridgeValue.x,
        'Authorization and live bridge are side by side',
      );
      assert.equal(await authValue.innerText(), 'Not paired');
      assert.equal(await bridgeValue.innerText(), 'Bridge not connected to a verified chat');
      const helperOutside = page
        .getByRole('tabpanel')
        .getByText(
          'Enable WebUI in AionUi on this computer, enter its address and pairing code, then confirm access in AionUi.',
          { exact: true },
        );
      assert.equal(await helperOutside.count(), 0);
      await capture(theme + '-' + width + '-aion-columns');
      await page.getByTestId('nav-settings').click();
      assert.equal(
        await page.getByRole('textbox', { name: 'Node name', exact: true }).inputValue(),
        unsaved,
        'Cancel and the status presentation transition preserve the unsaved node form',
      );
      const state = await invoke('aionUiStatus');
      assert.equal(state.state, 'not-paired');
      assert.equal(state.url, 'http://127.0.0.1:25808');
      results.push({
        theme,
        width,
        dimensions,
        boxes,
        ownerDialogRetained: true,
        pairCancelReadOnly: true,
        unsavedFormRetained: true,
      });
    }
  }
  const calls = await invoke('fixtureCalls');
  assert.equal(
    calls.filter(
      ({ method }) =>
        method === 'mcpSetupApply' ||
        method === 'aionUiPair' ||
        method === 'aionUiDisconnect' ||
        method === 'aionUiCancelPair',
    ).length,
    0,
  );
}
try {
  await mkdir(output, { recursive: true });
  const preload = path.join(temporary, 'preload.cjs'),
    main = path.join(temporary, 'main.cjs');
  await writeFile(
    preload,
    `
const{contextBridge}=require('electron');const snapshot=${JSON.stringify(snapshot)},messages=${JSON.stringify(messages)},clients=${JSON.stringify(clients)},baselineOnly=${baselineOnly},calls=[],listeners=new Set(),holds={};
let aion={state:'not-paired',url:'http://127.0.0.1:25808',bridgeConnected:false},holdNextSend=false,pendingSend=null;
const status=client=>JSON.parse(JSON.stringify(clients[client]));
const setStatus=(client,state)=>{clients[client].state=state;for(const file of clients[client].files)file.state=state;};
contextBridge.exposeInMainWorld('interconnect',{
 invoke:async(method,params={})=>{
  calls.push({method,...params});
  if(method==='snapshot')return snapshot;
  if(method==='appVersion')return '0.14.0-status-fixture';
  if(method==='loginState')return {supported:true,openAtLogin:false};
  if(method==='mcpSetupStatus'){
    if(baselineOnly)return {client:params.client,remembered:false,state:'missing',files:[]};
    if(holds[params.client])return new Promise(resolve=>holds[params.client].push(resolve));
    return status(params.client);
  }
  if(method==='mcpSetupDefaults')return {client:params.client,files:clients[params.client].files.map(file=>({...file,format:params.client==='codex'?'toml':'jsonc',alternatives:[]}))};
  if(method==='mcpSetupPreview')return {client:params.client,planId:'synthetic-plan-'+params.client,expiresAt:'2099-01-01T00:00:00.000Z',requiresReplacement:false,files:params.files.map(file=>({...file,action:'update',changes:[]}))};
  if(method==='mcpSetupDiscard')return {};
  if(method==='aionUiStatus')return aion;
  if(method==='chatHistory')return {messages,nextCursor:1,hasMore:false};
  if(method==='send'){
    if(!holdNextSend||pendingSend)throw Error('Unexpected synthetic send');holdNextSend=false;
    return new Promise((resolve,reject)=>{pendingSend={resolve,reject};});
  }
  if(method==='fixtureResetStates'){for(const client of Object.keys(clients))setStatus(client,client==='codex'?'needs-update':'configured');aion={state:'not-paired',url:'http://127.0.0.1:25808',bridgeConnected:false};for(const listener of listeners)listener();return true;}
  if(method==='fixtureSetStatus'){setStatus(params.client,params.state);return true;}
  if(method==='fixtureHoldStatus'){holds[params.client]=[];return true;}
  if(method==='fixtureReleaseStatus'){setStatus(params.client,params.state);const pending=holds[params.client]||[];delete holds[params.client];for(const resolve of pending)resolve(status(params.client));return true;}
  if(method==='fixtureAionState'){aion={...aion,...params};for(const listener of listeners)listener();return true;}
  if(method==='fixtureHoldNextSend'){holdNextSend=true;return true;}
  if(method==='fixtureFinishSend'){if(!pendingSend)throw Error('No pending synthetic send');const pending=pendingSend;pendingSend=null;if(params.success)pending.resolve({accepted:true});else pending.reject(Error('Synthetic send rejected'));return true;}
  if(method==='fixtureCalls')return calls;
  throw Error('Unexpected status-panel fixture operation '+method);
 },onChange:listener=>{listeners.add(listener);return()=>listeners.delete(listener);},onNavigate:()=>()=>{}
});`,
    { mode: 0o600 },
  );
  await writeFile(
    main,
    `const{app,BrowserWindow}=require('electron');app.setPath('userData',${JSON.stringify(path.join(temporary, 'profile'))});app.whenReady().then(()=>{const window=new BrowserWindow({width:1440,height:900,enableLargerThanScreen:true,webPreferences:{preload:${JSON.stringify(preload)},contextIsolation:true,sandbox:true}});window.loadFile(${JSON.stringify(path.join(root, 'build/renderer/index.html'))});});app.on('window-all-closed',()=>app.quit());`,
    { mode: 0o600 },
  );
  application = await electron.launch({
    executablePath: require('electron'),
    args: [main],
    cwd: temporary,
    env: await createUiEnvironment(path.join(temporary, 'home')),
    timeout: 30000,
  });
  page = await application.firstWindow();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.getByTestId('page-title').waitFor();
  const bundle = await page.locator('script[type="module"]').getAttribute('src');
  if (baselineOnly)
    for (const width of [900, 1440]) {
      const dimensions = await resize(width, width === 900 ? 620 : 900);
      const evidence = await stickyLabelEvidence();
      await capture('dark-' + width + '-sticky-label');
      await writeFile(
        path.join(output, 'dark-' + width + '-evidence.json'),
        JSON.stringify(evidence, null, 2),
      );
      assert.ok(
        evidence.overlap,
        'The fixture must place a real label within the sticky header bounds',
      );
      if (baselineOnly)
        assert.equal(
          evidence.hitIsLabel,
          true,
          'The baseline must confirm that the label paints above and intercepts the header',
        );
      else
        assert.equal(evidence.hitIsHeader, true, 'The sticky header must cover the scrolled label');
      results.push({ width, dimensions, ...evidence });
    }
  else if (sendStyleOnly) {
    await resize(900, 620);
    await page.getByTestId('nav-agents').click();
    await page.getByRole('button', { name: 'Open chat with ' + owner, exact: true }).click();
    await composeToggle().click();
    await settled();
    await recipient().fill('Style recipient');
    await text().fill('Style message');
    results.push({ flatLocal: await flatSendEvidence() });
  } else if (aionLayoutOnly) await aionLayoutCases();
  else await finalCases();
  assert.deepEqual(errors, []);
  const report = {
    bundle,
    syntheticOnly: true,
    nativeSizing: true,
    baselineOnly,
    results,
    screenshots,
    errors,
  };
  await writeFile(
    path.join(
      output,
      baselineOnly
        ? 'sticky-label-summary.json'
        : sendStyleOnly
          ? 'send-style-summary.json'
          : aionLayoutOnly
            ? 'aion-layout-summary.json'
            : 'summary.json',
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      bundle,
      baselineOnly,
      results: baselineOnly
        ? results.map(
            ({
              width,
              labelStyle,
              headerStyle,
              label,
              header,
              hitIsLabel,
              hitIsHeader,
              scroll,
            }) => ({
              width,
              labelStyle,
              headerStyle,
              label,
              header,
              hitIsLabel,
              hitIsHeader,
              scroll,
            }),
          )
        : results.map((result) => ({
            theme: result.theme,
            width: result.width,
            statusPanels: result.panels?.length,
            animation: result.animation
              ? Object.fromEntries(
                  Object.entries(result.animation).map(([name, value]) => [
                    name,
                    {
                      pass: value.pass,
                      callbacks: value.productCallbacks,
                      maxPostDeviation: value.maxPostDeviation,
                    },
                  ]),
                )
              : undefined,
            lateError: result.lateError
              ? { pass: result.lateError.pass, maxPostDeviation: result.lateError.maxPostDeviation }
              : undefined,
          })),
      errors,
    }),
  );
} catch (error) {
  if (page)
    await page
      .screenshot({ path: path.join(output, 'failure.png'), animations: 'disabled' })
      .catch(() => {});
  await writeFile(
    path.join(output, 'failure.json'),
    JSON.stringify({ error: String(error), results, errors }, null, 2),
  );
  throw error;
} finally {
  if (application) await application.close();
  await rm(temporary, { recursive: true, force: true });
}

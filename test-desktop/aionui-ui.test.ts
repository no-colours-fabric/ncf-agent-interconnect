import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { McpSetup } from '../desktop/renderer/McpSetup.js';
import { AionUiAuthorization } from '../desktop/renderer/AionUiSetup.js';
import { ApplicationConnections } from '../desktop/renderer/application-connections.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';

test('AionUi has its own application row and owner pairing instructions in every supported locale', () => {
  let calls = 0;
  const invoke = async () => {
    calls++;
    throw new Error('Rendering must not perform setup or write client configuration.');
  };
  const escaped = (text: string) =>
    renderToStaticMarkup(createElement('span', null, text)).slice(6, -7);
  for (const locale of supportedLocales) {
    const messages = mcpSetupMessages(locale);
    const html = renderToStaticMarkup(
      createElement(McpSetup, {
        client: 'aionui',
        onClientChange: () => {},
        invoke,
        messages,
        locale,
      }),
    );
    assert.ok(html.includes('data-testid="aionui-setup"'), locale);
    assert.ok(html.includes('data-testid="aionui-connection-steps"'), locale);
    assert.ok(html.includes('data-testid="mcp-shared-configuration-note"'), locale);
    assert.ok(html.includes(escaped(messages.cursorSharedConfiguration)), locale);
    assert.ok(html.includes(escaped(messages.aionMcpHelp)), locale);
    const tab = html.match(/<button\b[^>]*\bid="mcp-tab-aionui"[^>]*>/)?.[0] ?? '';
    assert.match(tab, /role="tab"/, locale);
    assert.match(tab, /aria-selected="true"/, locale);
    assert.match(tab, /aria-controls="mcp-panel-aionui"/, locale);
    for (const text of [
      messages.aionConfigureAccess,
      messages.aionConfigure,
      messages.statusAuthorization,
      messages.statusLiveBridge,
    ])
      assert.ok(html.includes(escaped(text)), `${locale}: ${text}`);
    assert.ok(!html.includes('data-testid="client-status-panel"'), locale);
    assert.ok(html.includes('data-testid="client-setup-description"'), locale);
    for (const text of [messages.aionPairTitle, messages.aionPairHelp])
      assert.ok(!html.includes(escaped(text)), `${locale}: closed owner dialog`);
    assert.ok(!html.includes('id="aionui-access-title"'), locale);
    assert.ok(!html.includes('data-testid="aionui-address"'), locale);
    assert.ok(!html.includes('data-testid="aionui-code"'), locale);
    assert.ok(!html.includes('<pre'), locale);
    assert.ok(!html.includes('Copy MCP configuration'), locale);

    const cursor = renderToStaticMarkup(
      createElement(McpSetup, {
        client: 'cursor',
        onClientChange: () => {},
        invoke,
        messages,
        locale,
      }),
    );
    assert.ok(cursor.includes('data-testid="mcp-shared-configuration-note"'), locale);
    assert.ok(cursor.includes(escaped(messages.cursorSharedConfiguration)), locale);
    assert.ok(cursor.includes(escaped(messages.aionMcpHelp)), locale);
    assert.ok(!cursor.includes('data-testid="aionui-connection-steps"'), locale);

    // Standalone mode renders the owner instructions; GUI covers opening and cancelling the dialog.
    const authorization = renderToStaticMarkup(
      createElement(AionUiAuthorization, { invoke, messages }),
    );
    for (const text of [messages.aionPairTitle, messages.aionPairHelp])
      assert.ok(authorization.includes(escaped(text)), `${locale}: ${text}`);
    const applications = renderToStaticMarkup(
      createElement(ApplicationConnections, {
        snapshot: { agents: [], adapters: [] },
        locale,
        onSetup: () => {},
      }),
    );
    assert.ok(applications.includes('data-testid="application-aionui"'));
    assert.ok(applications.includes(escaped(t(locale, 'clientsKindAionui'))));
  }
  assert.equal(calls, 0);
});

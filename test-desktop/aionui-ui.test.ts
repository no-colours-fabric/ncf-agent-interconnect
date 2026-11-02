import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { McpSetup } from '../desktop/renderer/McpSetup.js';
import { ApplicationConnections } from '../desktop/renderer/application-connections.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';

test('AionUi has its own application row and owner pairing instructions in every supported locale', () => {
  const invoke = async () => {
    throw new Error('Rendering must not perform setup or write client configuration.');
  };
  for (const locale of supportedLocales) {
    const messages = mcpSetupMessages(locale);
    const html = renderToStaticMarkup(
      createElement(McpSetup, { client: 'aionui', onClientChange: () => {}, invoke, messages }),
    );
    assert.ok(html.includes('data-testid="aionui-setup"'));
    assert.ok(html.includes('mcp-tab-aionui'));
    assert.ok(html.includes('127.0.0.1:25808'));
    for (const text of [messages.aionAddress, messages.aionCode, messages.aionPair])
      assert.ok(html.includes(text));
    const applications = renderToStaticMarkup(
      createElement(ApplicationConnections, {
        snapshot: { agents: [], adapters: [] },
        locale,
        onSetup: () => {},
      }),
    );
    assert.ok(applications.includes('data-testid="application-aionui"'));
    assert.ok(applications.includes(t(locale, 'clientsKindAionui')));
  }
});

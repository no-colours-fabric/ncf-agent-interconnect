import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AionUiSetupDialog, CursorSetupDialog, McpSetup } from '../desktop/renderer/McpSetup.js';
import { AionUiAuthorization } from '../desktop/renderer/AionUiSetup.js';
import { ApplicationConnections } from '../desktop/renderer/application-connections.js';
import { applicationSetupMessages } from '../desktop/renderer/i18n/application-setup.js';
import { mcpSetupMessages } from '../desktop/renderer/i18n/mcp-setup.js';
import { supportedLocales, t } from '../desktop/renderer/i18n/index.js';
import { McpSetupFlow } from '../desktop/renderer/mcp-setup-model.js';
import type { McpSetupClient, McpSetupInvoke } from '../desktop/shared/mcp-setup.js';

function preparedFlow(client: McpSetupClient): McpSetupFlow {
  const invoke = (async (
    method: string,
    input: { files?: Array<{ id: string; path: string }> },
  ) => {
    if (method === 'mcpSetupDefaults')
      return {
        client,
        files: [
          {
            id: 'configuration',
            path: `/isolated/${client}.json`,
            format: 'jsonc',
            alternatives: [],
          },
        ],
      };
    if (method === 'mcpSetupPreview')
      return {
        client,
        planId: `${client}-manual-form`,
        files: (input.files ?? []).map((file) => ({
          ...file,
          action: 'create',
          changes: [],
        })),
        requiresReplacement: false,
      };
    throw new Error(`Unexpected isolated setup method: ${method}`);
  }) as McpSetupInvoke;
  return new McpSetupFlow(client, invoke);
}

test('AionUi has its own application row and owner pairing instructions in every supported locale', async () => {
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
    assert.ok(html.includes(escaped(applicationSetupMessages(locale).aionUiName)), locale);
    assert.ok(html.includes('data-testid="ArrowBackOutlinedIcon"'), locale);
    for (const text of [
      messages.aionConfigureAccess,
      messages.statusAuthorization,
      messages.statusLiveBridge,
    ])
      assert.ok(html.includes(escaped(text)), `${locale}: ${text}`);
    assert.ok(!html.includes('data-testid="client-status-panel"'), locale);
    assert.ok(!html.includes(escaped(messages.aionContinue)), locale);
    assert.ok(html.includes('data-testid="mcp-settings-status"'), locale);
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
    assert.ok(!cursor.includes('data-testid="aionui-connection-steps"'), locale);

    const cursorFlow = preparedFlow('cursor');
    const aionUiFlow = preparedFlow('aionui');
    await Promise.all([cursorFlow.begin(), aionUiFlow.begin()]);
    const cursorManual = renderToStaticMarkup(
      createElement(CursorSetupDialog, {
        flow: cursorFlow,
        inline: true,
        invoke,
        messages,
        locale,
      }),
    );
    const aionUiManual = renderToStaticMarkup(
      createElement(AionUiSetupDialog, {
        flow: aionUiFlow,
        inline: true,
        invoke,
        messages,
        locale,
      }),
    );
    assert.ok(cursorManual.includes('data-testid="cursor-shared-configuration-note"'), locale);
    assert.ok(aionUiManual.includes('data-testid="aionui-global-cursor-warning"'), locale);
    for (const html of [cursorManual, aionUiManual])
      assert.ok(html.includes(escaped(messages.aionMcpHelp)), `${locale}: shared warning`);
    cursorFlow.dispose();
    aionUiFlow.dispose();

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

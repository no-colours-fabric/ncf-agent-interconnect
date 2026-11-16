import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApplicationDiscovery } from '../desktop/renderer/ApplicationDiscovery.js';
import { mcpSetupClients } from '../desktop/shared/mcp-setup.js';
import type { ApplicationDiscoveryModel } from '../desktop/renderer/useApplicationDiscovery.js';
import { discoveryMessages } from '../desktop/renderer/i18n/application-discovery.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';

test('all five tiles distinguish installation from setup and expose manual setup for unknown/missing', () => {
  const model: ApplicationDiscoveryModel = {
    busy: false,
    failed: false,
    refresh: async () => {},
    choose: async () => {},
    snapshot: {
      checkedAt: '2026-11-16T00:00:00.000Z',
      platform: 'linux',
      offers: [],
      stateError: false,
      applications: mcpSetupClients.map((client, index) => ({
        client,
        status: index === 0 ? 'detected' : index === 1 ? 'unknown' : 'not-found-in-known-locations',
        instances: [],
        coverage: [],
      })),
    },
  };
  const html = renderToStaticMarkup(
    React.createElement(ApplicationDiscovery, { model, locale: 'en', onSetup: () => {} }),
  );
  for (const client of mcpSetupClients) assert.ok(html.includes('installation-' + client));
  assert.equal(html.match(/>View setup</g)?.length, 5);
  assert.ok(html.includes('Not found in known locations'));
  assert.equal(html.includes('Not installed'), false);
  assert.equal(html.includes('Ready'), false);
});

test('discovery labels have a complete English fallback in every supported locale', () => {
  const expected = Object.keys(discoveryMessages('en'));
  for (const locale of supportedLocales) {
    const messages = discoveryMessages(locale);
    assert.deepEqual(Object.keys(messages), expected);
    assert.ok(Object.values(messages).every((text) => typeof text === 'string' && text.length > 0));
  }
});

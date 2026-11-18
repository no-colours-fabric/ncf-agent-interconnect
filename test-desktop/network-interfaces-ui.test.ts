import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NetworkInterfacesSettings } from '../desktop/renderer/NetworkInterfacesSettings.js';
import { computeNetworkInterfacePolicy } from '../desktop/core/network-interfaces.js';
import { supportedLocales } from '../desktop/renderer/i18n/index.js';
import { networkInterfaceMessages } from '../desktop/renderer/i18n/network-interfaces.js';
import { OwnConnectionCard } from '../desktop/renderer/OwnConnectionCard.js';

const policy = () =>
  computeNetworkInterfacePolicy(
    {
      'Ethernet Ж <&>': [
        {
          address: '192.0.2.10',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '02:00:00:00:00:01',
          internal: false,
        },
      ],
    },
    [{ name: 'Absent VPN' }],
  );

test('UI fixture environment installs loopback inventory before child application imports', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ncf-network-ui-isolation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { createUiEnvironment } = await import(
    new URL('../scripts/ui-test-profile.mjs', import.meta.url).href
  );
  const env = await createUiEnvironment(directory);
  const child = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      "import { networkInterfaces } from 'node:os'; process.stdout.write(JSON.stringify(Object.values(networkInterfaces()).flat().map(entry => entry.address)));",
    ],
    { env, encoding: 'utf8' },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), ['127.0.0.1']);
});
test('all 15 locales cover interface state, exclusion recovery, diagnostics and accessible actions', () => {
  const english = networkInterfaceMessages('en');
  for (const locale of supportedLocales) {
    const m = networkInterfaceMessages(locale);
    assert.deepEqual(Object.keys(m).sort(), Object.keys(english).sort());
    assert.ok(Object.values(m).every((value) => value.trim()));
    if (locale !== 'en') assert.notEqual(m.help, english.help);
    const html = renderToStaticMarkup(
      createElement(NetworkInterfacesSettings, {
        status: { ...policy(), listeners: [], inventoryError: null },
        value: [{ name: 'Absent VPN' }],
        locale,
        onChange: () => assert.fail('Rendering must never save settings'),
      }),
    );
    assert.ok(html.includes('Ethernet Ж &lt;&amp;&gt;'));
    assert.ok(html.includes('Absent VPN'));
    assert.ok(html.includes(m.remove));
    assert.ok(html.includes('aria-label='));
    m.help = 'Changed by caller';
    assert.notEqual(networkInterfaceMessages(locale).help, m.help);
  }
});
test('an all-excluded node keeps the access-code dialog action available', () => {
  const html = renderToStaticMarkup(
    createElement(OwnConnectionCard, {
      node: { nodeId: 'fixture', running: true, peerUrl: '', listenHost: '', peerUrls: [] },
      code: null,
      onCodeChange: () => assert.fail('Rendering must never change a code'),
      locale: 'en',
      invoke: async () => assert.fail('Rendering must never call the service'),
      onSettings: () => {},
    }),
  );
  assert.ok(html.includes('Get connection code'));
  assert.ok(!html.includes('wss://0.0.0.0'));
});

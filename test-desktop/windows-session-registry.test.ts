import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
type RegistryResult = {
  conflict: boolean;
  published: boolean;
  selectorOwned: boolean;
  autorunOwned: boolean;
};
const bridge = require('../desktop/integrations/codex-windows-bridge.cjs') as {
  runPowerShell(script: string, data: unknown, timeout?: number): Promise<string>;
};
const runtime = require('../desktop/integrations/codex-windows-service.cjs') as {
  address(settings: { pipeId: string }): string;
  registry(
    options: { appExecutable: string },
    settings: { pipeId: string },
    action: string,
  ): Promise<RegistryResult>;
};

test(
  'native registry transaction preserves foreign values in an isolated non-startup hive',
  { skip: process.platform !== 'win32' },
  async (t) => {
    const root = 'Software\\NCF-Session-QA-' + randomUUID();
    assert.match(root, /^Software\\NCF-Session-QA-[a-f0-9-]{36}$/);
    const original = bridge.runPowerShell;
    const environment = 'Environment';
    const run = 'Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    const envKey = root + '\\Environment';
    const runKey = root + '\\Run';
    bridge.runPowerShell = (script, data, timeout) => {
      // Execute the actual product transaction, changing only its two fixed key
      // locations. These keys cannot affect the process environment or logon.
      assert.equal(script.split("'" + environment + "'").length - 1, 2);
      assert.equal(script.split("'" + run + "'").length - 1, 2);
      const isolated = script
        .split("'" + environment + "'")
        .join("'" + envKey + "'")
        .split("'" + run + "'")
        .join("'" + runKey + "'");
      assert.ok(!isolated.includes("'" + environment + "'"));
      assert.ok(!isolated.includes("'" + run + "'"));
      return original(isolated, data, timeout);
    };
    t.after(async () => {
      bridge.runPowerShell = original;
      await original(
        "$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json;if($d.root -notmatch '^Software\\\\NCF-Session-QA-[a-f0-9-]{36}$'){throw 'scope'};[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($d.root,$false);[Console]::Write('OK')",
        { root },
      );
    });
    const options = { appExecutable: 'C:\\NCF QA\\NCF Agent Interconnect.exe' };
    const settings = { pipeId: randomUUID() };
    const read = async () =>
      JSON.parse(
        await original(
          String.raw`
$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json
$e=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($d.env)
$r=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($d.run)
try {[pscustomobject]@{environment=if($e){$e.GetValue('CODEX_APP_SERVER_WS_URL')}else{$null};run=if($r){$r.GetValue('NCF ChatGPT Session Service')}else{$null}}|ConvertTo-Json -Compress}
finally{if($e){$e.Dispose()};if($r){$r.Dispose()}}
`,
          { env: envKey, run: runKey },
        ),
      ) as { environment: string | null; run: string | null };
    const seed = async (key: string, name: string, value: string) =>
      original(
        "$d=$env:NCF_LAUNCH_DATA|ConvertFrom-Json;$k=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($d.key);try{$k.SetValue($d.name,$d.value,[Microsoft.Win32.RegistryValueKind]::String)}finally{$k.Dispose()};[Console]::Write('OK')",
        { key, name, value },
      );

    assert.deepEqual(await runtime.registry(options, settings, 'status'), {
      conflict: false,
      published: false,
      selectorOwned: false,
      autorunOwned: false,
    });
    assert.deepEqual(await read(), { environment: null, run: null });
    await runtime.registry(options, settings, 'publish');
    assert.deepEqual(await runtime.registry(options, settings, 'status'), {
      conflict: false,
      published: true,
      selectorOwned: true,
      autorunOwned: true,
    });
    assert.equal((await read()).environment, runtime.address(settings));

    await seed(envKey, 'CODEX_APP_SERVER_WS_URL', 'wss://foreign.example.invalid/');
    const before = await read();
    assert.equal((await runtime.registry(options, settings, 'publish')).conflict, true);
    assert.deepEqual(await read(), before);
    await runtime.registry(options, settings, 'withdraw');
    assert.deepEqual(await read(), { environment: 'wss://foreign.example.invalid/', run: null });

    await seed(envKey, 'CODEX_APP_SERVER_WS_URL', runtime.address(settings));
    await seed(runKey, 'NCF ChatGPT Session Service', 'foreign command preserved');
    await runtime.registry(options, settings, 'withdraw');
    assert.deepEqual(await read(), { environment: null, run: 'foreign command preserved' });
  },
);

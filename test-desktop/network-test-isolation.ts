import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';

// Test-only preload: default-all fixtures must never bind a working computer's LAN addresses.
os.networkInterfaces = () => ({
  loopback: [
    {
      address: '127.0.0.1',
      netmask: '255.0.0.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal: true,
      cidr: '127.0.0.1/8',
    },
  ],
});
syncBuiltinESMExports();

// Explicit child-process fixtures do not inherit execArgv; propagate the same test-only preload.
const preload = import.meta.url;
if (!(process.env.NODE_OPTIONS ?? '').includes(preload)) {
  process.env.NODE_OPTIONS =
    `${process.env.NODE_OPTIONS ?? ''} --import=${import.meta.resolve('tsx')} --import=${preload}`.trim();
}

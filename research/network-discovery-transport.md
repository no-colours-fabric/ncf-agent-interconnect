# Network discovery and transport research

## Docker internal bridge, 17 November 2026

The isolated four-node Linux core run on `8443b05` established all six pairings by address and code, with three connected peers per node. A wrong code granted no trust, and a process restart preserved identity and connections. Automatic discovery found no peers in that topology.

A separate two-socket diagnostic ran on the Docker internal bridge without application code. UDP unicast from A reached B. UDP multicast to `239.255.73.36` with TTL 1 did not reach B with loopback enabled or disabled. With loopback enabled, the multicast reached A itself. The result isolates the multicast symptom to the test topology without establishing how discovery behaves on a physical LAN. Native Electron GUI acceptance was outside the successful core run.

## VPN interfaces with /32 masks, 22 November 2026

Matching packaged macOS and Linux cores searched concurrently through VPN interfaces presenting distinct `/32` IPv4 addresses. Neither search reported the other endpoint. The source filter compares an incoming source and the local address under the interface mask. With `/32` both entire addresses must match, so these distinct endpoints fail that filter. Separate direct TCP checks passed in both directions. Product pairing by address and code was not exercised on this VPN.

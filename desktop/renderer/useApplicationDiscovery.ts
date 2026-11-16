import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApplicationDiscoverySnapshot } from '../shared/application-discovery.js';
import type { McpSetupClient, McpSetupInvoke } from '../shared/mcp-setup.js';

export function useApplicationDiscovery(invoke: McpSetupInvoke) {
  const [snapshot, setSnapshot] = useState<ApplicationDiscoverySnapshot>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const request = useCallback(
    async (method: string, params: unknown = {}) => {
      const current = ++generation.current;
      setBusy(true);
      try {
        const result = await invoke<ApplicationDiscoverySnapshot>(method, params);
        if (current === generation.current) {
          setSnapshot(result);
          setFailed(false);
        }
      } catch {
        if (current === generation.current) setFailed(true);
      } finally {
        if (current === generation.current) setBusy(false);
      }
    },
    [invoke],
  );
  useEffect(() => {
    void request('applicationDiscovery');
  }, [request]);
  return {
    snapshot,
    busy,
    failed,
    refresh: () => request('applicationDiscoveryRefresh'),
    choose: (client: McpSetupClient) => request('applicationDiscoveryChoose', { client }),
  };
}

export type ApplicationDiscoveryModel = ReturnType<typeof useApplicationDiscovery>;

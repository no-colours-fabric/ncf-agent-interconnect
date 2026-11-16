import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApplicationDiscoverySnapshot } from '../shared/application-discovery.js';
import type { McpSetupClient, McpSetupInvoke } from '../shared/mcp-setup.js';

export function useApplicationDiscovery(invoke: McpSetupInvoke) {
  const [snapshot, setSnapshot] = useState<ApplicationDiscoverySnapshot>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [offers, setOffers] = useState<McpSetupClient[]>([]);
  const [offerError, setOfferError] = useState(false);
  const acknowledged = useRef(new Set<McpSetupClient>());
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
          setOffers((visible) => [
            ...new Set([
              ...visible,
              ...result.offers.filter((client) => !acknowledged.current.has(client)),
            ]),
          ]);
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
  const acknowledge = useCallback(
    async (clients: McpSetupClient[]) => {
      const unseen = clients.filter((client) => !acknowledged.current.has(client));
      if (!unseen.length) return;
      unseen.forEach((client) => acknowledged.current.add(client));
      try {
        const result = await invoke<{ saved: boolean }>('applicationDiscoveryOffered', {
          clients: unseen,
        });
        if (!result.saved) setOfferError(true);
      } catch {
        setOfferError(true);
      }
    },
    [invoke],
  );
  return {
    snapshot,
    busy,
    failed,
    offers,
    offerError,
    acknowledge,
    dismiss: () => setOffers([]),
    refresh: () => request('applicationDiscoveryRefresh'),
    choose: (client: McpSetupClient) => request('applicationDiscoveryChoose', { client }),
  };
}

export type ApplicationDiscoveryModel = ReturnType<typeof useApplicationDiscovery>;

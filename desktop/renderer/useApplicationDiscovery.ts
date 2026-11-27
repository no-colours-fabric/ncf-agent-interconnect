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
  const inFlight = useRef(false);
  const nativeChangePending = useRef(false);
  const request = useCallback(
    async function requestSnapshot(method: string, params: unknown = {}, background = false) {
      const current = ++generation.current;
      inFlight.current = true;
      if (!background) setBusy(true);
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
        if (current === generation.current && !background) setFailed(true);
      } finally {
        if (current === generation.current) {
          inFlight.current = false;
          if (!background) setBusy(false);
          if (nativeChangePending.current) {
            nativeChangePending.current = false;
            void requestSnapshot('applicationDiscovery', {}, true);
          }
        }
      }
    },
    [invoke],
  );
  useEffect(() => {
    const off = window.interconnect?.onApplicationDiscoveryChange?.(() => {
      if (inFlight.current) nativeChangePending.current = true;
      else void request('applicationDiscovery', {}, true);
    });
    void request('applicationDiscovery');
    const refreshOnFocus = () => {
      // Installation metadata may have changed while another window was active.
      if (!inFlight.current) void request('applicationDiscoveryRefresh', {}, true);
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      ++generation.current;
      inFlight.current = false;
      nativeChangePending.current = false;
      off?.();
      window.removeEventListener('focus', refreshOnFocus);
    };
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

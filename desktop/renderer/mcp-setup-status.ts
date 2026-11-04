import { useCallback, useEffect, useRef, useState } from 'react';
import {
  mcpSetupClients,
  type McpSetupClient,
  type McpSetupInvoke,
  type McpSetupStatus,
} from '../shared/mcp-setup.js';

export interface McpSetupStatuses {
  statuses: Partial<Record<McpSetupClient, McpSetupStatus>>;
  errors: Partial<Record<McpSetupClient, string>>;
  refreshAll: (force?: boolean) => Promise<void>;
}

export function useMcpSetupStatuses(invoke: McpSetupInvoke, enabled = true): McpSetupStatuses {
  const [statuses, setStatuses] = useState<McpSetupStatuses['statuses']>({});
  const [errors, setErrors] = useState<McpSetupStatuses['errors']>({});
  const mounted = useRef(false);
  const inFlight = useRef<Partial<Record<McpSetupClient, Promise<void>>>>({});
  const revisions = useRef<Record<McpSetupClient, number>>({
    cursor: 0,
    opencode: 0,
    codex: 0,
    aionui: 0,
  });
  const refreshAll = useCallback(
    (force = false): Promise<void> => {
      if (!mounted.current) return Promise.resolve();
      return Promise.all(
        mcpSetupClients.map((client) => {
          const current = inFlight.current[client];
          if (current && !force) return current;
          const revision = ++revisions.current[client];
          setStatuses((current) => {
            const next = { ...current };
            delete next[client];
            return next;
          });
          setErrors((current) => {
            const next = { ...current };
            delete next[client];
            return next;
          });
          const pending = (async () => {
            try {
              const status = await invoke<McpSetupStatus>('mcpSetupStatus', { client });
              if (!mounted.current || revisions.current[client] !== revision) return;
              setStatuses((current) => ({ ...current, [client]: status }));
            } catch (error) {
              if (!mounted.current || revisions.current[client] !== revision) return;
              setErrors((current) => ({
                ...current,
                [client]: error instanceof Error ? error.message : String(error),
              }));
            }
          })();
          inFlight.current[client] = pending;
          void pending.finally(() => {
            if (inFlight.current[client] === pending) delete inFlight.current[client];
          });
          return pending;
        }),
      ).then(() => {});
    },
    [invoke],
  );
  useEffect(() => {
    mounted.current = enabled;
    if (enabled) void refreshAll();
    return () => {
      mounted.current = false;
      inFlight.current = {};
      for (const client of mcpSetupClients) ++revisions.current[client];
    };
  }, [refreshAll, enabled]);
  return { statuses, errors, refreshAll };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { OutgoingPairApproval } from '../shared/pairing-approval.js';

type Phase = Exclude<OutgoingPairApproval['state'], 'paired'> | 'requesting' | 'failed';
interface Attempt {
  id: string;
  timer?: ReturnType<typeof setTimeout>;
  confirming?: boolean;
}

export function usePeerApproval(invoke: McpSetupInvoke) {
  const current = useRef<Attempt | undefined>(undefined);
  const latestInvoke = useRef(invoke);
  latestInvoke.current = invoke;
  const [phase, setPhase] = useState<Phase>();
  const [comparisonCode, setComparisonCode] = useState<string>();
  const [confirmed, setConfirmed] = useState(false);
  useEffect(
    () => () => {
      const attempt = current.current;
      current.current = undefined;
      if (attempt) {
        clearTimeout(attempt.timer);
        void latestInvoke.current('cancelPeerApproval', { id: attempt.id }).catch(() => {});
      }
    },
    [],
  );

  const cancel = useCallback(async (): Promise<boolean> => {
    const attempt = current.current;
    if (attempt) {
      try {
        const answer = await latestInvoke.current<{ canceled: boolean }>('cancelPeerApproval', {
          id: attempt.id,
        });
        if (answer?.canceled === false || current.current !== attempt) return false;
      } catch {
        if (current.current === attempt) setPhase('failed');
        return false;
      }
      current.current = undefined;
      clearTimeout(attempt.timer);
    }
    setPhase(undefined);
    setComparisonCode(undefined);
    setConfirmed(false);
    return true;
  }, []);

  const confirm = async () => {
    const attempt = current.current;
    if (!attempt || attempt.confirming) return;
    attempt.confirming = true;
    try {
      const answer = await latestInvoke.current<{ confirmed: boolean }>('confirmPeerApproval', {
        id: attempt.id,
      });
      if (current.current === attempt && answer.confirmed) setConfirmed(true);
    } catch {
      if (current.current === attempt && (await cancel()) && !current.current) setPhase('failed');
    } finally {
      attempt.confirming = false;
    }
  };

  const start = (
    address: string,
    expectedNodeId: string | undefined,
    paired: (id: string) => void,
  ): void => {
    if (current.current || !address.trim()) return;
    const attempt: Attempt = { id: crypto.randomUUID() };
    current.current = attempt;
    setComparisonCode(undefined);
    setConfirmed(false);
    setPhase('requesting');
    const update = async (initial: boolean) => {
      try {
        const state = await latestInvoke.current<OutgoingPairApproval>(
          initial ? 'requestPeerApproval' : 'peerApprovalProgress',
          initial ? { id: attempt.id, address, expectedNodeId } : { id: attempt.id },
        );
        if (current.current !== attempt) return;
        if (state.state === 'waiting' || state.state === 'shown') {
          setPhase(state.state);
          setComparisonCode(state.comparisonCode);
          attempt.timer = setTimeout(() => void update(false), 700);
        } else {
          current.current = undefined;
          setPhase(state.state === 'paired' ? undefined : state.state);
          if (state.state === 'paired') paired(state.id);
        }
      } catch {
        if (current.current !== attempt) return;
        current.current = undefined;
        setPhase('failed');
      }
    };
    void update(true);
  };
  return { phase, comparisonCode, confirmed, confirm, cancel, start };
}

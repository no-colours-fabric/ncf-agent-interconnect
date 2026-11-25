import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type { IncomingPairApproval, PairApprovalDecision } from '../shared/pairing-approval.js';
import { loadLocale, t } from './i18n/index.js';
import { pairingApprovalMessages } from './i18n/remote-nodes.js';

export function PairingApprovalPopup(): React.JSX.Element {
  const [locale] = useState(() => loadLocale(() => window.localStorage));
  const m = pairingApprovalMessages(locale);
  const [request, setRequest] = useState<IncomingPairApproval>();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const sent = useRef(false);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = m.title;
    let alive = true;
    void window.interconnect
      .pairingApproval<IncomingPairApproval>('view')
      .then((request) => {
        if (alive) setRequest(request);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [locale, m.title]);
  useEffect(() => {
    if (request) void window.interconnect.pairingApproval('ready').catch(() => setFailed(true));
  }, [request]);
  const decide = async (decision: PairApprovalDecision) => {
    if (!request || sent.current) return;
    sent.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await window.interconnect.pairingApproval(decision);
    } catch {
      setFailed(true);
    } finally {
      sent.current = false;
      setBusy(false);
    }
  };
  return (
    <Stack component="main" spacing={2} sx={{ p: 3 }}>
      <Typography component="h1" variant="h5">
        {m.title}
      </Typography>
      <Typography variant="body2">{m.explanation}</Typography>
      {request && (
        <>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere', unicodeBidi: 'plaintext' }}>
            {request.label}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {t(locale, 'networkColumnAddress')} · {request.address || '—'}
          </Typography>
          <Box component="details">
            <summary>{m.identity}</summary>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {request.nodeId}
            </Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {request.fingerprint}
            </Typography>
          </Box>
          <Stack
            direction="row"
            useFlexGap
            spacing={1}
            sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}
          >
            <Button
              autoFocus
              disabled={busy}
              onClick={() => void decide('dismiss')}
              sx={{ minHeight: 44 }}
            >
              {t(locale, 'mcpSetup_close')}
            </Button>
            <Button disabled={busy} onClick={() => void decide('suppress')} sx={{ minHeight: 44 }}>
              {m.suppress}
            </Button>
            <Button
              variant="contained"
              disabled={busy}
              onClick={() => void decide('confirm')}
              sx={{ minHeight: 44 }}
            >
              {m.confirm}
            </Button>
          </Stack>
        </>
      )}
      {failed && <Alert severity="error">{m.decisionFailed}</Alert>}
    </Stack>
  );
}

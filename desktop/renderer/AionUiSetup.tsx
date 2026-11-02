import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AionUiApplicationState } from '../shared/aionui.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { McpSetupMessages } from './mcp-setup-messages.js';

export function AionUiAuthorization({
  invoke,
  messages: m,
}: {
  invoke: McpSetupInvoke;
  messages: McpSetupMessages;
}): React.JSX.Element {
  const [status, setStatus] = useState<AionUiApplicationState>();
  const [url, setUrl] = useState('http://127.0.0.1:25808');
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const revision = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void invoke<AionUiApplicationState>('aionUiStatus')
        .then((state) => {
          if (active) setStatus(state);
        })
        .catch(() => {
          if (active) setError(true);
        });
    };
    refresh();
    const off = window.interconnect.onChange(refresh);
    return () => {
      active = false;
      revision.current++;
      if (pending.current) void invoke('aionUiCancelPair').catch(() => {});
      off();
    };
  }, [invoke]);
  const cancel = () => {
    revision.current++;
    if (pending.current) void invoke('aionUiCancelPair').catch(() => {});
    pending.current = false;
    setCode('');
    setOpen(false);
    setBusy(false);
    setError(false);
  };
  const pair = async () => {
    const current = ++revision.current;
    setBusy(true);
    pending.current = true;
    setError(false);
    const input = { url, code };
    setCode('');
    try {
      await invoke('aionUiPair', input);
      const state = await invoke<AionUiApplicationState>('aionUiStatus');
      if (current === revision.current) {
        setStatus(state);
        setSuccess(true);
      }
    } catch {
      if (current === revision.current) setError(true);
    } finally {
      if (current === revision.current) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }} data-testid="aionui-authorization">
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Typography variant="subtitle2" component="h3">
              {m.aionPairTitle}
            </Typography>
            <Chip
              size="small"
              label={
                !status
                  ? m.checking
                  : status.state === 'paired'
                    ? m.aionPaired
                    : status.state === 'revoked'
                      ? m.aionRevoked
                      : m.aionNotPaired
              }
              color={status?.state === 'paired' ? 'success' : 'default'}
              data-testid="aionui-authorization-status"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {m.aionPairHelp}
          </Typography>
          {status?.state === 'paired' && (
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {status.url}
            </Typography>
          )}
          <Typography variant="body2" data-testid="aionui-bridge-status">
            {status?.bridgeConnected ? m.aionBridgeConnected : m.aionBridgeDisconnected}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              data-testid="aionui-configure-access"
              onClick={() => {
                setUrl(status?.url ?? url);
                setCode('');
                setError(false);
                setSuccess(false);
                setOpen(true);
              }}
            >
              {m.aionConfigureAccess}
            </Button>
            {status?.state === 'paired' && (
              <Button
                onClick={() => {
                  void invoke('aionUiDisconnect')
                    .then(() => invoke<AionUiApplicationState>('aionUiStatus'))
                    .then(setStatus)
                    .catch(() => setError(true));
                }}
              >
                {m.aionDisconnect}
              </Button>
            )}
          </Stack>
          {error && !open && <Alert severity="error">{m.aionFailure}</Alert>}
        </Stack>
      </Paper>
      <Typography variant="subtitle2" component="h3">
        {m.aionMcpTitle}
      </Typography>
      <Dialog
        open={open}
        onClose={cancel}
        fullWidth
        maxWidth="sm"
        aria-labelledby="aionui-access-title"
        slotProps={{ paper: { sx: { height: 'min(520px, calc(100dvh - 64px))' } } }}
      >
        <DialogTitle id="aionui-access-title">{m.aionPairTitle}</DialogTitle>
        <DialogContent sx={{ scrollbarGutter: 'stable' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>{m.aionPairHelp}</Typography>
            <TextField
              label={m.aionAddress}
              value={url}
              disabled={busy || success}
              onChange={(event) => setUrl(event.target.value)}
              fullWidth
              slotProps={{ htmlInput: { 'data-testid': 'aionui-address' } }}
            />
            <TextField
              label={m.aionCode}
              type="password"
              autoComplete="off"
              value={code}
              disabled={busy || success}
              onChange={(event) => setCode(event.target.value)}
              fullWidth
              slotProps={{ htmlInput: { maxLength: 100, 'data-testid': 'aionui-code' } }}
            />
            <Box sx={{ minHeight: 72 }} aria-live="polite">
              {error && <Alert severity="error">{m.aionFailure}</Alert>}
              {success && <Alert severity="success">{m.aionPaired}</Alert>}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ minHeight: 56, gap: 1, flexShrink: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flex: 1, minWidth: 0, height: 24, alignItems: 'center' }}
            role="status"
            aria-live="polite"
            data-testid="aionui-pair-progress"
            data-busy={busy}
          >
            <Box sx={{ width: 20, height: 20 }}>{busy && <CircularProgress size={18} />}</Box>
            <Typography variant="body2" noWrap>
              {busy ? m.aionConfirm : ''}
            </Typography>
          </Stack>
          <Button onClick={cancel}>{success ? m.close : m.cancel}</Button>
          {!success && (
            <Button
              variant="contained"
              disabled={busy || !code.trim() || !url.trim()}
              onClick={() => void pair()}
            >
              {m.aionPair}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

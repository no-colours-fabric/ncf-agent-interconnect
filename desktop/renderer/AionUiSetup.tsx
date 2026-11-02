import React, { useEffect, useState } from 'react';
import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import type { AionUiSetupInstructions, AionUiSetupState } from '../shared/aionui.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { McpSetupMessages } from './mcp-setup-messages.js';

export function AionUiSetup({
  invoke,
  messages: m,
}: {
  invoke: McpSetupInvoke;
  messages: McpSetupMessages;
}): React.JSX.Element {
  const [status, setStatus] = useState<AionUiSetupState>();
  const [configuration, setConfiguration] = useState('');
  const [url, setUrl] = useState('http://127.0.0.1:25808');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    void Promise.all([
      invoke<AionUiSetupState>('aionUiStatus'),
      invoke<AionUiSetupInstructions>('aionUiInstructions'),
    ])
      .then(([state, instructions]) => {
        if (active) {
          setStatus(state);
          setUrl(state.url);
          setConfiguration(instructions.configuration);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    const off = window.interconnect.onChange(() => {
      void invoke<AionUiSetupState>('aionUiStatus')
        .then((state) => {
          if (active) setStatus(state);
        })
        .catch(() => {
          if (active) setError(true);
        });
    });
    return () => {
      active = false;
      off();
    };
  }, [invoke]);
  const perform = async (method: 'aionUiPair' | 'aionUiDisconnect') => {
    setBusy(true);
    setError(false);
    const input = { url, code };
    setCode('');
    try {
      setStatus(await invoke<AionUiSetupState>(method, method === 'aionUiPair' ? input : {}));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }} data-testid="aionui-setup">
      <Stack
        direction="row"
        spacing={2}
        sx={{ alignItems: 'center', justifyContent: 'space-between' }}
      >
        <Typography variant="h6" component="h2">
          AionUi
        </Typography>
        <Chip
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
        />
      </Stack>
      <Typography variant="body2">{m.aionDescription}</Typography>
      <Typography variant="subtitle2" component="h3">
        {m.aionPairTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {m.aionPairHelp}
      </Typography>
      <TextField
        label={m.aionAddress}
        value={url}
        disabled={busy}
        onChange={(e) => setUrl(e.target.value)}
        fullWidth
      />
      <TextField
        label={m.aionCode}
        type="password"
        autoComplete="off"
        value={code}
        disabled={busy}
        onChange={(e) => setCode(e.target.value)}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          disabled={busy || !code.trim() || !url.trim()}
          onClick={() => void perform('aionUiPair')}
        >
          {m.aionPair}
        </Button>
        {status?.state === 'paired' && (
          <Button disabled={busy} onClick={() => void perform('aionUiDisconnect')}>
            {m.aionDisconnect}
          </Button>
        )}
      </Stack>
      {busy && <Alert severity="info">{m.aionConfirm}</Alert>}
      {error && <Alert severity="error">{m.aionFailure}</Alert>}
      <Typography variant="subtitle2" component="h3">
        {m.aionMcpTitle}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {m.aionMcpHelp}
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, overflow: 'auto' }}>
        <Typography
          component="pre"
          variant="body2"
          sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
        >
          {configuration}
        </Typography>
      </Paper>
      <Button
        disabled={!configuration}
        onClick={() => {
          void invoke('copy', { text: configuration })
            .then(() => setCopied(true))
            .catch(() => setError(true));
        }}
      >
        {copied ? m.aionCopied : m.aionCopy}
      </Button>
      <Alert severity="info">{m.aionNext}</Alert>
    </Stack>
  );
}

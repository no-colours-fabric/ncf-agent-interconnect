import React, { useEffect, useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { LanDiscoverySnapshot, LanPairSelection } from '../shared/lan-discovery.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import type { Locale } from './i18n/index.js';
import { lanDiscoveryMessages } from './i18n/lan-discovery.js';

export interface DiscoveredLanNodesProps {
  discovery?: LanDiscoverySnapshot;
  running: boolean;
  locale: Locale;
  invoke: McpSetupInvoke;
}

export function DiscoveredLanNodes({
  discovery,
  running,
  locale,
  invoke,
}: DiscoveredLanNodesProps): React.JSX.Element | null {
  const m = lanDiscoveryMessages(locale);
  const id = useId();
  const [selected, setSelected] = useState<LanPairSelection | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ detail?: string } | null>(null);
  const [paired, setPaired] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const cancel = () => {
    if (pending.current) return;
    setSelected(null);
    setCode('');
    setError(null);
  };
  const validCode = /^[A-HJ-NP-Z2-9]{8}$/.test(code);
  const pair = async () => {
    if (!selected || !running || !validCode || pending.current) return;
    // Capture the owner's selection once. Never resolve it against a later snapshot.
    const input = { address: selected.address, code };
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await invoke('connectPeer', input);
      if (mounted.current) {
        setSelected(null);
        setCode('');
        setPaired(true);
      }
    } catch (failure) {
      if (mounted.current)
        setError({ detail: failure instanceof Error ? failure.message : undefined });
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  if (!discovery && !selected) return null;
  const stateText =
    discovery?.state === 'stopped'
      ? m.stopped
      : discovery?.reason === 'no-interfaces'
        ? m.noInterfaces
        : discovery?.reason === 'transport-error'
          ? m.transportError
          : m.searching;
  const announceReason = discovery?.announcement.reason;
  const announcementText = discovery?.announcement.available
    ? m.announcing
    : announceReason === 'listener-local'
      ? m.listenerLocal
      : announceReason === 'listener-unavailable'
        ? m.listenerUnavailable
        : m.notAnnouncing;

  return (
    <>
      {discovery && (
        <Paper
          component="section"
          variant="outlined"
          aria-labelledby={id + '-title'}
          sx={{ p: 2.5 }}
        >
          <Stack spacing={1.5}>
            <Box>
              <Typography id={id + '-title'} variant="h6">
                {m.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m.unverified}
              </Typography>
            </Box>
            <Typography role="status" variant="body2" data-testid="lan-discovery-state">
              {stateText}
            </Typography>
            <Typography variant="body2" color="text.secondary" data-testid="lan-announcement-state">
              {announcementText}
            </Typography>
            {paired && (
              <Alert severity="success" role="status">
                {m.success}
              </Alert>
            )}
            {discovery.nodes.length ? (
              <List disablePadding aria-labelledby={id + '-title'}>
                {discovery.nodes.map((node) => (
                  <ListItem key={node.key} disableGutters sx={{ gap: 2, alignItems: 'center' }}>
                    <Box sx={{ minWidth: 0, flex: 1, overflowWrap: 'anywhere' }}>
                      <Typography variant="body2">{node.label}</Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontFamily: 'monospace' }}
                      >
                        {node.address}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      disabled={!running || busy || selected !== null}
                      aria-label={`${m.pair} ${node.label} (${node.address})`}
                      onClick={() => {
                        setSelected(Object.freeze({ ...node }));
                        setCode('');
                        setError(null);
                        setPaired(false);
                      }}
                    >
                      {m.pair}
                    </Button>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary">
                {m.empty}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}
      <Dialog
        open={selected !== null}
        onClose={cancel}
        fullWidth
        maxWidth="sm"
        aria-labelledby={id + '-dialog-title'}
      >
        <Box
          component="form"
          aria-busy={busy}
          onSubmit={(event) => {
            event.preventDefault();
            void pair();
          }}
        >
          <DialogTitle id={id + '-dialog-title'}>{m.dialogTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <TextField
                label={m.computerLabel}
                value={selected?.label ?? ''}
                fullWidth
                slotProps={{
                  input: { readOnly: true, notched: false },
                  inputLabel: { shrink: true, disableAnimation: true },
                }}
              />
              <TextField
                label={m.addressLabel}
                value={selected?.address ?? ''}
                fullWidth
                slotProps={{
                  input: { readOnly: true, notched: false },
                  inputLabel: { shrink: true, disableAnimation: true },
                }}
              />
              <TextField
                autoFocus
                label={m.codeLabel}
                helperText={m.codeHelp}
                value={code}
                disabled={busy}
                onChange={(event) => {
                  setCode(event.target.value.replace(/[a-z]/g, (letter) => letter.toUpperCase()));
                  setError(null);
                }}
                fullWidth
                slotProps={{
                  input: { notched: false },
                  inputLabel: { shrink: true, disableAnimation: true },
                  htmlInput: {
                    maxLength: 8,
                    autoComplete: 'off',
                    autoCapitalize: 'characters',
                    spellCheck: false,
                  },
                }}
              />
              {error && <Alert severity="error">{error.detail || m.failed}</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancel} disabled={busy}>
              {m.cancel}
            </Button>
            <Button type="submit" variant="contained" disabled={!running || !validCode || busy}>
              {busy ? m.pairing : m.pair}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}

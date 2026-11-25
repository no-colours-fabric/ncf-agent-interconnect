import React, { useId, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { Snapshot } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';
import { lanSearchMessages } from './i18n/lan-search.js';
import { remoteNodeRemovalMessages } from './i18n/remote-nodes.js';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import { designTokens } from './theme.js';

export function RemoteNodesTable({
  snapshot,
  locale,
  nodeName,
  invoke,
}: {
  snapshot: Snapshot;
  locale: Locale;
  nodeName: (id: string) => string;
  invoke?: McpSetupInvoke;
}): React.JSX.Element {
  const title = lanSearchMessages(locale).pairedTitle;
  const m = remoteNodeRemovalMessages(locale);
  const dialogId = useId();
  const [selected, setSelected] = useState<{ id: string; name: string; token: string }>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const submitting = useRef(false);
  const close = () => {
    if (!submitting.current) setSelected(undefined);
  };
  const confirm = async () => {
    if (!selected || !invoke || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await invoke('removePeer', { nodeId: selected.id, token: selected.token });
      setSelected(undefined);
    } catch {
      setFailed(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Typography variant="h6">{title}</Typography>
      <TableContainer component={Paper}>
        <Table
          data-testid="remote-nodes-table"
          aria-label={title}
          sx={{
            minWidth: 660,
            '& td, & th': { verticalAlign: 'middle', overflowWrap: 'anywhere' },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t(locale, 'networkColumnName')}</TableCell>
              <TableCell>{t(locale, 'networkColumnAddress')}</TableCell>
              <TableCell align="right">{t(locale, 'networkColumnAgents')}</TableCell>
              <TableCell>{t(locale, 'networkColumnUpdated')}</TableCell>
              <TableCell>{t(locale, 'networkColumnStatus')}</TableCell>
              {invoke && <TableCell aria-label={m.remove} />}
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshot.peers.map((peer) => {
              const directory = snapshot.directories.find((item) => item.nodeId === peer.id);
              const activeAddress = peer.connected ? peer.activeAddress : null;
              const status = !peer.connected
                ? 'networkWaiting'
                : directory?.state === 'unsupported'
                  ? 'directoryUnsupported'
                  : directory?.state === 'syncing'
                    ? 'directorySyncing'
                    : 'networkConnected';
              return (
                <TableRow key={peer.id} data-testid={'peer-' + peer.id}>
                  <TableCell component="th" scope="row">
                    {nodeName(peer.id)}
                  </TableCell>
                  <TableCell
                    sx={{ fontFamily: activeAddress ? 'monospace' : 'inherit', fontSize: 12 }}
                  >
                    {activeAddress || (peer.connected ? t(locale, 'networkIncoming') : '—')}
                  </TableCell>
                  <TableCell align="right">{directory?.epoch ? directory.total : ''}</TableCell>
                  <TableCell>
                    {directory?.updatedAt
                      ? new Date(directory.updatedAt).toLocaleString(locale)
                      : ''}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          flexShrink: 0,
                          borderRadius: '50%',
                          bgcolor: peer.connected ? 'success.main' : 'text.disabled',
                          boxShadow: peer.connected ? designTokens.statusGlow : 'none',
                        }}
                      />
                      <Typography
                        variant="caption"
                        color={peer.connected ? 'success.main' : 'text.secondary'}
                      >
                        {t(locale, status)}
                      </Typography>
                    </Stack>
                    {peer.error && (
                      <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
                        {peer.error}
                      </Typography>
                    )}
                  </TableCell>
                  {invoke && (
                    <TableCell align="right">
                      {peer.removalToken && (
                        <Button
                          color="error"
                          sx={{ minHeight: 44 }}
                          aria-label={m.remove + ' — ' + nodeName(peer.id)}
                          onClick={() => {
                            setFailed(false);
                            setSelected({
                              id: peer.id,
                              name: nodeName(peer.id),
                              token: peer.removalToken!,
                            });
                          }}
                        >
                          {m.remove}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={!!selected} aria-labelledby={dialogId} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle id={dialogId}>{m.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography sx={{ overflowWrap: 'anywhere' }}>{selected?.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {m.consequence}
            </Typography>
            {failed && <Alert severity="error">{m.failed}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button autoFocus disabled={busy} onClick={close}>
            {t(locale, 'btnCancel')}
          </Button>
          <Button color="error" variant="contained" disabled={busy} onClick={() => void confirm()}>
            {m.remove}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

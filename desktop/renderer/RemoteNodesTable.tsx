import React from 'react';
import {
  Box,
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
import { designTokens } from './theme.js';

export function RemoteNodesTable({
  snapshot,
  locale,
  nodeName,
}: {
  snapshot: Snapshot;
  locale: Locale;
  nodeName: (id: string) => string;
}): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Typography variant="h6">{t(locale, 'navNetwork')}</Typography>
      <TableContainer component={Paper}>
        <Table
          data-testid="remote-nodes-table"
          aria-label={t(locale, 'navNetwork')}
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
            </TableRow>
          </TableHead>
          <TableBody>
            {snapshot.peers.map((peer) => {
              const directory = snapshot.directories.find((item) => item.nodeId === peer.id);
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
                    sx={{ fontFamily: peer.address ? 'monospace' : 'inherit', fontSize: 12 }}
                  >
                    {peer.address || t(locale, 'networkIncoming')}
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
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

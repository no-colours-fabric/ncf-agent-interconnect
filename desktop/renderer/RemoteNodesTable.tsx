import React from 'react';
import {
  Chip,
  Paper,
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
    <TableContainer component={Paper}>
      <Table
        data-testid="remote-nodes-table"
        aria-label={t(locale, 'navNetwork')}
        sx={{ minWidth: 660, '& td, & th': { verticalAlign: 'top', overflowWrap: 'anywhere' } }}
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
                <TableCell>{peer.address || t(locale, 'networkIncoming')}</TableCell>
                <TableCell align="right">{directory?.epoch ? directory.total : ''}</TableCell>
                <TableCell>
                  {directory?.updatedAt ? new Date(directory.updatedAt).toLocaleString(locale) : ''}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={peer.connected ? 'success' : 'default'}
                    label={t(locale, status)}
                  />
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
  );
}

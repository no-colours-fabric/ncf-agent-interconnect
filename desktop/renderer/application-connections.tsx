import type React from 'react';
import {
  Button,
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
import type { AdapterProfile, Snapshot } from '../shared/contracts.js';
import { applicationStatus } from './application-status.js';
import { t, type Locale } from './i18n/index.js';

interface Props {
  snapshot: Pick<Snapshot, 'adapters' | 'agents'>;
  locale: Locale;
  onSetup: (kind: AdapterProfile['kind']) => void;
}

export function applicationActivity(
  kind: AdapterProfile['kind'],
  snapshot: Props['snapshot'],
): string | null {
  const { agents, connections } = applicationStatus(kind, snapshot);
  const dates = [
    ...agents.map((agent) => agent.lastMessageAt),
    ...connections.map(({ profile }) => profile.lastOwnerVerifiedAt),
  ].filter((value): value is string => !!value && Number.isFinite(Date.parse(value)));
  return dates.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

export function ApplicationConnections({ snapshot, locale, onSetup }: Props): React.JSX.Element {
  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {t(locale, 'clientsApplicationsIntro')}
      </Typography>
      <TableContainer component={Paper}>
        <Table
          data-testid="applications-table"
          aria-label={t(locale, 'navClients')}
          sx={{ minWidth: 620 }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t(locale, 'navClients')}</TableCell>
              <TableCell>{t(locale, 'clientsLastActivity')}</TableCell>
              <TableCell align="right">{t(locale, 'clientsColumnAgents')}</TableCell>
              <TableCell align="right">{t(locale, 'agentsColumnActions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(['opencode-http', 'codex-desktop', 'aionui', 'claude-code', 'manual'] as const).map(
              (kind) => {
                const { agents } = applicationStatus(kind, snapshot);
                const activity = applicationActivity(kind, snapshot);
                return (
                  <TableRow key={kind} data-testid={'application-' + kind}>
                    <TableCell component="th" scope="row">
                      {t(
                        locale,
                        kind === 'opencode-http'
                          ? 'clientsKindOpencode'
                          : kind === 'codex-desktop'
                            ? 'clientsKindCodex'
                            : kind === 'aionui'
                              ? 'clientsKindAionui'
                              : kind === 'claude-code'
                                ? 'clientsKindClaude'
                                : 'clientsKindManual',
                      )}
                    </TableCell>
                    <TableCell>
                      {activity ? new Date(activity).toLocaleString(locale) : ''}
                    </TableCell>
                    <TableCell align="right">{agents.length}</TableCell>
                    <TableCell align="right">
                      <Button onClick={() => onSetup(kind)}>{t(locale, 'clientsCta')}</Button>
                    </TableCell>
                  </TableRow>
                );
              },
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

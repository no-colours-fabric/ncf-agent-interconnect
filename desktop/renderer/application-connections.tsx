import type React from 'react';
import {
  Box,
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
import { surfaceSx } from './theme.js';

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

export function ClientApplicationSummary({
  kind,
  snapshot,
  locale,
}: Pick<Props, 'snapshot' | 'locale'> & {
  kind: AdapterProfile['kind'];
}): React.JSX.Element {
  const { agents } = applicationStatus(kind, snapshot);
  const activity = applicationActivity(kind, snapshot);
  return (
    <Paper sx={{ ...surfaceSx('soft'), p: 2 }} data-testid={'application-' + kind}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">
          {t(
            locale,
            kind === 'opencode-http'
              ? 'clientsKindOpencode'
              : kind === 'codex-desktop'
                ? 'clientsKindCodex'
                : kind === 'aionui'
                  ? 'clientsKindAionui'
                  : 'clientsManualConnections',
          )}
        </Typography>
        <Box
          component="dl"
          sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 4, rowGap: 1.5, m: 0 }}
        >
          {[
            { id: 'application-agent-count', label: t(locale, 'statAgents'), value: agents.length },
            {
              id: 'application-last-activity',
              label: t(locale, 'clientsLastActivity'),
              value: activity ? new Date(activity).toLocaleString(locale) : '',
            },
          ].map(({ id, label, value }) => (
            <Box key={id}>
              <Typography component="dt" variant="caption" color="text.secondary">
                {label}
              </Typography>
              <Typography
                component="dd"
                variant="body2"
                data-testid={id}
                sx={{ m: 0, minHeight: '1.5em' }}
              >
                {value}
              </Typography>
            </Box>
          ))}
        </Box>
      </Stack>
    </Paper>
  );
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
            {(['opencode-http', 'codex-desktop', 'aionui', 'manual'] as const).map((kind) => {
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
                            : 'clientsKindManual',
                    )}
                  </TableCell>
                  <TableCell>{activity ? new Date(activity).toLocaleString(locale) : ''}</TableCell>
                  <TableCell align="right">{agents.length}</TableCell>
                  <TableCell align="right">
                    <Button onClick={() => onSetup(kind)}>{t(locale, 'clientsCta')}</Button>
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

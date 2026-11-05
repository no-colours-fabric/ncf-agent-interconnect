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
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import type { AdapterProfile, Snapshot } from '../shared/contracts.js';
import { applicationStatus, type ConnectionSummary } from './application-status.js';
import { t, type Locale } from './i18n/index.js';
import type { Messages } from './i18n/messages.js';
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

const connectionLabels: Record<ConnectionSummary, keyof Messages> = {
  none: 'clientsNoAgents',
  manual: 'clientsReceiveMcp',
  connected: 'clientsConnected',
  partial: 'clientsPartiallyConnected',
  released: 'clientsReleased',
  notConfirmed: 'clientsNotConfirmed',
  paused: 'clientsPaused',
  verifiedAll: 'clientsVerifiedAll',
  verifiedSome: 'clientsVerifiedSome',
};

export function ClientApplicationMetrics({
  kind,
  snapshot,
  locale,
  unknownLabel,
  deliveryLabel,
}: {
  kind?: AdapterProfile['kind'];
  snapshot?: Props['snapshot'];
  locale: Locale;
  unknownLabel: string;
  deliveryLabel: string;
}): React.JSX.Element {
  const aggregate = kind && snapshot ? applicationStatus(kind, snapshot) : undefined;
  const activity = kind && snapshot ? applicationActivity(kind, snapshot) : null;
  const connection = aggregate?.summary;
  const ConnectionIcon =
    connection === 'connected'
      ? CheckCircleOutlineOutlined
      : connection === 'partial' || connection === 'paused'
        ? ErrorOutlineOutlined
        : HelpOutlineOutlined;
  return (
    <>
      {[
        {
          id: 'application-agent-count',
          label: t(locale, 'statAgents'),
          value: aggregate ? aggregate.agents.length : unknownLabel,
        },
        {
          id: 'application-last-activity',
          label: t(locale, 'clientsLastActivity'),
          value: activity ? new Date(activity).toLocaleString(locale) : unknownLabel,
        },
        ...(connection
          ? [
              {
                id: 'application-delivery-status',
                label: deliveryLabel,
                value: t(locale, connectionLabels[connection]),
              },
            ]
          : []),
      ].map(({ id, label, value }) => (
        <Box key={id} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {label}
          </Typography>
          <Stack
            component="dd"
            direction="row"
            spacing={1}
            sx={{ m: 0, minHeight: '1.5em', alignItems: 'flex-start' }}
          >
            {id === 'application-delivery-status' && (
              <ConnectionIcon
                sx={{
                  fontSize: 18,
                  mt: '1px',
                  color:
                    connection === 'connected'
                      ? 'success.main'
                      : connection === 'partial' || connection === 'paused'
                        ? 'warning.main'
                        : 'text.secondary',
                  flexShrink: 0,
                }}
              />
            )}
            <Typography
              component="span"
              variant="body2"
              data-testid={id}
              sx={{ overflowWrap: 'anywhere' }}
            >
              {value}
            </Typography>
          </Stack>
        </Box>
      ))}
    </>
  );
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

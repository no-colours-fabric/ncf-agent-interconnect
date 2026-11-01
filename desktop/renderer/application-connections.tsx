import type React from 'react';
import {
  Box,
  Button,
  Chip,
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
import { applicationStatus, connectionPresentation } from './application-status.js';
import { t, type Locale } from './i18n/index.js';

interface Props {
  snapshot: Pick<Snapshot, 'adapters' | 'agents'>;
  locale: Locale;
  onSetup: (kind: AdapterProfile['kind']) => void;
}

export function ApplicationConnections({ snapshot, locale, onSetup }: Props): React.JSX.Element {
  return (
    <Stack spacing={2.5} sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {t(locale, 'clientsStatusHelp')}
      </Typography>
      {(['opencode-http', 'codex-desktop', 'manual'] as const).map((kind) => {
        const { connections, summary, issues } = applicationStatus(kind, snapshot);
        const title = t(
          locale,
          kind === 'opencode-http'
            ? 'clientsKindOpencode'
            : kind === 'codex-desktop'
              ? 'clientsKindCodex'
              : 'clientsKindManual',
        );
        const visible = connections.filter(
          ({ profile, agents }) =>
            kind !== 'manual' ||
            agents.length ||
            profile.error ||
            profile.state === 'error' ||
            profile.state === 'uncertain',
        );
        const needsAttention = issues.some(
          ({ profile, agents }) => agents.length || profile.state === 'uncertain',
        );
        return (
          <Paper key={kind} sx={{ p: { xs: 2, md: 3 }, minWidth: 0 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              sx={{ justifyContent: 'space-between', alignItems: { md: 'center' } }}
            >
              <Typography variant="h6">{title}</Typography>
              <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                <Chip
                  color={
                    summary === 'connected'
                      ? 'success'
                      : summary === 'partial' || summary === 'notConfirmed'
                        ? 'warning'
                        : 'default'
                  }
                  label={t(
                    locale,
                    summary === 'connected'
                      ? 'clientsConnected'
                      : summary === 'partial'
                        ? 'clientsPartiallyConnected'
                        : summary === 'released'
                          ? 'clientsReleased'
                          : summary === 'notConfirmed'
                            ? 'clientsNotConfirmed'
                            : summary === 'manual'
                              ? 'clientsReceiveMcp'
                              : summary === 'paused'
                                ? 'clientsPaused'
                                : 'clientsNoAgents',
                  )}
                />
                {!!issues.length && (
                  <Chip
                    color={needsAttention ? 'warning' : 'default'}
                    label={t(locale, 'clientsConnectionIssues', { count: issues.length })}
                  />
                )}
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              {t(
                locale,
                kind === 'opencode-http'
                  ? 'clientsDetailOpencode'
                  : kind === 'codex-desktop'
                    ? 'clientsDetailCodex'
                    : 'clientsDetailManual',
              )}
            </Typography>
            {!!visible.length && (
              <TableContainer sx={{ maxWidth: '100%' }}>
                <Table
                  size="small"
                  aria-label={title}
                  sx={{
                    minWidth: 760,
                    tableLayout: 'fixed',
                    '& td, & th': { verticalAlign: 'top', overflowWrap: 'anywhere' },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: '18%' }}>
                        {t(locale, 'clientsColumnAgents')}
                      </TableCell>
                      <TableCell sx={{ width: '18%' }}>
                        {t(locale, 'clientsColumnStatus')}
                      </TableCell>
                      <TableCell sx={{ width: '28%' }}>
                        {t(locale, 'clientsColumnImpact')}
                      </TableCell>
                      <TableCell sx={{ width: '36%' }}>
                        {t(locale, 'clientsColumnAction')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visible.map(({ profile, agents }) => {
                      const presentation = connectionPresentation(profile, !!agents.length),
                        names = agents.map((agent) => agent.nickname).join(', '),
                        identity = names || t(locale, 'clientsNoBoundAgent');
                      return (
                        <TableRow key={profile.id}>
                          <TableCell component="th" scope="row" sx={{ overflowWrap: 'anywhere' }}>
                            {identity}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              color={presentation.tone}
                              label={t(locale, presentation.status)}
                              sx={{
                                height: 'auto',
                                minHeight: 26,
                                maxWidth: '100%',
                                '& .MuiChip-label': {
                                  whiteSpace: 'normal',
                                  overflowWrap: 'anywhere',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>{t(locale, presentation.impact)}</TableCell>
                          <TableCell>
                            {t(locale, presentation.action)}
                            <Box component="details" sx={{ mt: 1, overflowWrap: 'anywhere' }}>
                              <Box
                                component="summary"
                                aria-label={t(locale, 'clientsDetails') + ': ' + identity}
                                sx={{ cursor: 'pointer', color: 'primary.main' }}
                              >
                                {t(locale, 'clientsDetails')}
                              </Box>
                              <Box component="dl" sx={{ my: 1, '& dd': { ml: 0, mb: 1 } }}>
                                <dt>{t(locale, 'clientsConnectionId')}</dt>
                                <Box component="dd" sx={{ fontFamily: 'monospace' }}>
                                  {profile.id}
                                </Box>
                                <dt>{t(locale, 'clientsColumnAgents')}</dt>
                                <dd>{identity}</dd>
                                {profile.error && (
                                  <>
                                    <dt>{t(locale, 'clientsTechnicalMessage')}</dt>
                                    <Box
                                      component="dd"
                                      sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
                                    >
                                      {profile.error}
                                    </Box>
                                  </>
                                )}
                              </Box>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <Button sx={{ mt: 2 }} onClick={() => onSetup(kind)}>
              {t(locale, 'clientsCta')}
            </Button>
          </Paper>
        );
      })}
    </Stack>
  );
}

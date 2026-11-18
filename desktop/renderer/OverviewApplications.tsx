import React from 'react';
import { Box, ButtonBase, Paper, Stack, Tooltip, Typography } from '@mui/material';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import type { Snapshot } from '../shared/contracts.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import { setupApplicationName } from './ApplicationSetup.js';
import { hasConnectedClientChat } from './ClientSetupHelp.js';
import { applicationStatus } from './application-status.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import { t, type Locale } from './i18n/index.js';
import { surfaceSx } from './theme.js';

const applications = [
  { client: 'cursor', kind: 'cursor-hook' },
  { client: 'opencode', kind: 'opencode-http' },
  { client: 'opencode-v2', kind: 'opencode-v2' },
  { client: 'codex', kind: 'codex-desktop' },
  { client: 'aionui', kind: 'aionui' },
  { client: 'claude', kind: 'claude-code' },
] as const;

type ApplicationSnapshot = Pick<Snapshot, 'adapters' | 'agents'>;

export function connectedOverviewApplications(snapshot: ApplicationSnapshot) {
  return applications
    .filter(({ client }) => hasConnectedClientChat(client, snapshot))
    .map((application) => ({
      ...application,
      ...applicationStatus(application.kind, snapshot),
    }));
}

export function OverviewApplications({
  snapshot,
  locale,
  onOpen,
}: {
  snapshot: ApplicationSnapshot;
  locale: Locale;
  onOpen: () => void;
}): React.JSX.Element | null {
  const connected = connectedOverviewApplications(snapshot);
  if (!connected.length) return null;
  return (
    <Paper data-testid="overview-applications" sx={{ p: 2.5 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
        {applicationSetupMessages(locale).applications}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {connected.map(({ client, summary, agents, issues }) => {
          const name = setupApplicationName(client, locale);
          const status = t(
            locale,
            summary === 'connected'
              ? 'clientsConnected'
              : summary === 'partial'
                ? 'clientsPartiallyConnected'
                : summary === 'verifiedAll'
                  ? 'clientsVerifiedAll'
                  : summary === 'verifiedSome'
                    ? 'clientsVerifiedSome'
                    : 'clientsNotConfirmed',
          );
          const unread = agents.reduce((count, agent) => count + agent.unread, 0);
          return (
            <ButtonBase
              key={client}
              disableRipple
              data-testid={'overview-application-' + client}
              onClick={onOpen}
              aria-label={`${name}: ${status}; ${t(locale, 'statAgents')}: ${agents.length}; ${t(locale, 'statInbox')}: ${unread}`}
              sx={{
                ...surfaceSx('soft'),
                width: 248,
                maxWidth: '100%',
                minHeight: 88,
                p: 1.5,
                gap: 1.5,
                alignItems: 'center',
                justifyContent: 'flex-start',
                textAlign: 'left',
                '&:hover': { borderColor: 'text.secondary' },
              }}
            >
              <ClientLogo client={client === 'opencode-v2' ? 'opencode' : client} size={32} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {name}
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mt: 0.25 }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 6,
                      height: 6,
                      flexShrink: 0,
                      borderRadius: '50%',
                      bgcolor:
                        summary === 'connected' || summary === 'verifiedAll'
                          ? 'success.main'
                          : 'warning.main',
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {status}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 0.75, color: 'text.secondary' }}>
                  {[
                    { label: t(locale, 'statAgents'), value: agents.length, Icon: ForumOutlined },
                    { label: t(locale, 'statInbox'), value: unread, Icon: InboxOutlined },
                    ...(issues.length
                      ? [
                          {
                            label: t(locale, 'clientsConnectionIssues', { count: issues.length }),
                            value: issues.length,
                            Icon: ErrorOutlineOutlined,
                          },
                        ]
                      : []),
                  ].map(({ label, value, Icon }) => (
                    <Tooltip title={label} key={label}>
                      <Box
                        component="span"
                        aria-label={`${label}: ${value}`}
                        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        <Icon sx={{ fontSize: 14 }} />
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {value}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Paper>
  );
}

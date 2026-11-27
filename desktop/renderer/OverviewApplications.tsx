import React from 'react';
import {
  ChatgptCompatibilityNotice,
  ChatgptDisablingIndicator,
  useChatgptDeliveryPresentation,
} from './ChatgptCompatibilityNotice.js';
import { ApplicationCardGrid } from './ApplicationCardGrid.js';
import { Alert, Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import InboxOutlined from '@mui/icons-material/InboxOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import CheckRounded from '@mui/icons-material/CheckRounded';
import type { Snapshot } from '../shared/contracts.js';
import {
  applicationSetupClients,
  type ApplicationSetupFlow,
  type ApplicationSetupStates,
} from './application-setup-model.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import {
  ReadyChatGuidance,
  SetupDetails,
  setupFailure,
  applicationNextStep,
  applicationSetupAction,
  setupApplicationName,
  setupView,
} from './ApplicationSetup.js';
import { hasConnectedClientChat } from './ClientSetupHelp.js';
import { applicationStatus } from './application-status.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';
import type { McpSetupStatuses } from './mcp-setup-status.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';
import { t, type Locale } from './i18n/index.js';
import { designTokens, surfaceSx } from './theme.js';

const applications = [
  { client: 'cursor', kind: 'cursor-hook' },
  { client: 'opencode-v2', kind: 'opencode-v2' },
  { client: 'opencode', kind: 'opencode-http' },
  { client: 'codex', kind: 'codex-desktop' },
  { client: 'aionui', kind: 'aionui' },
  { client: 'claude', kind: 'claude-code' },
] as const;

type ApplicationSnapshot = Pick<Snapshot, 'adapters' | 'agents'>;

const cardSx = {
  ...surfaceSx('soft'),
  minHeight: 360,
  p: 2.5,
  gap: 2,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'space-between',
  textAlign: 'left',
  backgroundImage: 'none',
  boxShadow: 'none',
} as const;

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
  discovery,
  flow,
  states,
  statuses,
  locale,
}: {
  snapshot: ApplicationSnapshot;
  discovery: ApplicationDiscoveryModel;
  flow: ApplicationSetupFlow;
  states: ApplicationSetupStates;
  statuses: McpSetupStatuses;
  locale: Locale;
}): React.JSX.Element | null {
  const { warning: chatgptWarning, state: chatgptDelivery } = useChatgptDeliveryPresentation(
    flow.chatDelivery,
    discovery.snapshot,
  );
  const connect = (client: (typeof applications)[number]['client']) =>
    flow.connect(client, undefined, {
      showRestartNotice: client === 'codex' && discovery.snapshot?.platform === 'darwin',
    });
  const connected = connectedOverviewApplications(snapshot);
  const openCodeV2Target = states['opencode-v2'].target;
  const detected = new Set(
    discovery.snapshot?.applications
      .filter((item) => item.status === 'detected')
      .map((item) => item.client),
  );
  const visible = applications.filter(({ client }) => {
    if (connected.some((item) => item.client === client)) return true;
    if (client !== 'opencode-v2') return detected.has(client);
    // The generic OpenCode installation probe does not establish the major version.
    return (
      !!(openCodeV2Target?.installationId && openCodeV2Target.installationPath) ||
      (detected.has('opencode') && connected.some((item) => item.client === client))
    );
  });
  if (!visible.length) return null;
  const anyBusy = applicationSetupClients.some((client) => flow.busy(client));
  const copy = applicationSetupMessages(locale);
  const setupCopy = mcpSetupMessages(locale);
  return (
    <Box component="section" data-testid="overview-applications">
      <Stack spacing={0.5} sx={{ mb: 1.5, textAlign: 'center' }}>
        <Typography variant="h6" component="h2">
          {copy.readyTitle}
        </Typography>
        <Typography
          variant="body2"
          component="p"
          color="text.secondary"
          data-testid="overview-chat-guidance"
          sx={{ overflowWrap: 'anywhere' }}
        >
          <ReadyChatGuidance locale={locale} />
        </Typography>
      </Stack>
      <ApplicationCardGrid testId="overview-applications-grid">
        {visible.map(({ client }) => {
          const name = setupApplicationName(client, locale);
          const active = connected.find((item) => item.client === client);
          const view = setupView(client, states, statuses, discovery, snapshot, chatgptDelivery);
          const { state } = view;
          const pending = state.phase === 'uncertain' || state.phase === 'rechecking';
          const failed = state.phase === 'failed';
          const busy = flow.busy(client);
          const configured = view.configured && !pending && !busy;
          const ready = view.adapterReady && !pending && !failed && !busy;
          const action = applicationSetupAction(view, locale, busy, anyBusy);
          const status = configured
            ? copy.configuredStatus
            : pending
              ? setupCopy.statusUnknown
              : ready
                ? t(locale, 'clientsConnected')
                : view.configurationState === 'not-configured'
                  ? setupCopy['not-configured']
                  : active && !view.detected
                    ? setupCopy.statusUnknown
                    : copy.detected;
          const compatibilityWarning = client === 'codex' ? chatgptWarning : undefined;
          const actionButton = action && (
            <Button
              variant="contained"
              disabled={action.disabled}
              onClick={() => void connect(client)}
              aria-label={`${action.label} — ${name}`}
              sx={{ minHeight: 44, px: 1, overflowWrap: 'anywhere' }}
            >
              {action.label}
            </Button>
          );
          const heading = (
            <Stack spacing={1.25} sx={{ minWidth: 0 }}>
              <ClientLogo client={client === 'opencode-v2' ? 'opencode' : client} size={48} />
              <Typography
                component="h3"
                sx={{ fontSize: 16, fontWeight: 600, overflowWrap: 'anywhere' }}
              >
                {name}
              </Typography>
              <Stack
                component="span"
                direction="row"
                useFlexGap
                spacing={1}
                sx={{
                  alignItems: 'flex-start',
                  color:
                    ready || (configured && client !== 'codex') ? 'success.main' : 'text.secondary',
                }}
              >
                {ready || (configured && client !== 'codex') ? (
                  <CheckRounded sx={{ fontSize: 17, mt: '2px' }} />
                ) : (
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      width: 6,
                      height: 6,
                      mt: '7px',
                      flexShrink: 0,
                      borderRadius: '50%',
                      bgcolor: 'currentColor',
                    }}
                  />
                )}
                <Typography component="span" variant="body2">
                  {status}
                </Typography>
              </Stack>
              {client === 'codex' && chatgptDelivery.disabling && (
                <ChatgptDisablingIndicator locale={locale} />
              )}
              {compatibilityWarning && (
                <ChatgptCompatibilityNotice
                  model={flow.chatDelivery}
                  locale={locale}
                  warning={compatibilityWarning}
                  showSwitch
                  disabled={anyBusy || state.phase === 'confirmation'}
                  onConnect={
                    view.automatic &&
                    !view.checking &&
                    view.hasStatus &&
                    !anyBusy &&
                    state.phase !== 'confirmation'
                      ? () => void connect(client)
                      : undefined
                  }
                />
              )}
              {(configured || ready) &&
                !compatibilityWarning &&
                !(client === 'codex' && chatgptDelivery.disabling) && (
                  <Typography component="span" variant="caption" color="text.secondary">
                    {ready
                      ? copy.applicationReadyHelp
                      : applicationNextStep(client, locale, setupCopy)}
                  </Typography>
                )}
              {(pending || failed) && (
                <Alert severity={pending ? 'warning' : 'error'}>
                  {pending ? copy.uncertain : setupFailure(state, locale)}
                </Alert>
              )}
              {!active && <SetupDetails state={state} locale={locale} />}
            </Stack>
          );
          const testId = 'overview-application-' + client;
          if (!active) {
            return (
              <Box
                key={client}
                data-testid={testId}
                data-compatibility-warning={!!compatibilityWarning || undefined}
                data-chatgpt-restart-focus={client === 'codex' ? '' : undefined}
                aria-label={client === 'codex' ? name : undefined}
                tabIndex={client === 'codex' ? -1 : undefined}
                sx={cardSx}
              >
                {heading}
                {actionButton}
              </Box>
            );
          }
          const { agents, issues } = active;
          const unread = agents.reduce((count, agent) => count + agent.unread, 0);
          const issueLabel = issues.length
            ? t(locale, 'clientsConnectionIssues', { count: issues.length })
            : '';
          return (
            <Box
              key={client}
              data-testid={testId}
              data-connected={ready || undefined}
              data-compatibility-warning={!!compatibilityWarning || undefined}
              data-chatgpt-restart-focus={client === 'codex' ? '' : undefined}
              aria-label={client === 'codex' ? name : undefined}
              tabIndex={client === 'codex' ? -1 : undefined}
              sx={{
                ...cardSx,
                ...(ready
                  ? {
                      backgroundColor: designTokens.successAlertBackground,
                      borderColor: designTokens.successAlertBorder,
                    }
                  : {}),
              }}
            >
              {heading}
              <Stack
                component="span"
                direction="row"
                useFlexGap
                sx={{
                  gap: 1.25,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  minHeight: 44,
                  alignItems: 'center',
                  color: 'text.secondary',
                }}
              >
                {[
                  { label: t(locale, 'statAgents'), value: agents.length, Icon: ForumOutlined },
                  { label: t(locale, 'statInbox'), value: unread, Icon: InboxOutlined },
                  ...(issueLabel
                    ? [{ label: issueLabel, value: issues.length, Icon: ErrorOutlineOutlined }]
                    : []),
                ].map(({ label, value, Icon }) => (
                  <Tooltip title={label} key={label}>
                    <Box
                      component="span"
                      aria-label={`${label}: ${value}`}
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Icon sx={{ fontSize: 16 }} />
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
              {actionButton}
            </Box>
          );
        })}
      </ApplicationCardGrid>
    </Box>
  );
}

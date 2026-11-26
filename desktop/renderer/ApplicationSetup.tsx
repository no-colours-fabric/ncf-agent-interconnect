import { sessionDeliveryMessages } from './i18n/session-delivery.js';
import { configurationProfile } from '../shared/desktop-session-delivery.js';
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Link,
  Paper,
  Stack,
  Switch,
  Tooltip,
  Typography,
  type IconButtonProps,
} from '@mui/material';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import type { AionUiApplicationState } from '../shared/aionui.js';
import type { Snapshot } from '../shared/contracts.js';
import { applicationNames } from '../shared/application-discovery.js';
import {
  mcpSetupClients,
  type McpSetupClient,
  type McpSetupFilePreview,
  type McpSetupInvoke,
} from '../shared/mcp-setup.js';
import {
  ApplicationSetupFlow,
  applicationSetupClients,
  type ApplicationSetupClient,
  type ApplicationSetupState,
  type ApplicationSetupStates,
} from './application-setup-model.js';
import { openCodeV2TargetKey, openCodeV2AutomaticAvailable } from './opencode-v2-setup-model.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import {
  ChatgptCompatibilityNotice,
  showsChatgptCompatibilityNotice,
} from './ChatgptCompatibilityNotice.js';
import { ApplicationCardGrid } from './ApplicationCardGrid.js';
import { StartupApplicationTile } from './StartupApplicationTiles.js';
import { clientNextStep, hasConnectedClientChat, setupAdapterKinds } from './ClientSetupHelp.js';
import { ClientApplicationMetrics } from './application-connections.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import { discoveryMessages } from './i18n/application-discovery.js';
import { lanSearchMessages } from './i18n/lan-search.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';
import { t, type Locale } from './i18n/index.js';
import type { McpSetupStatuses } from './mcp-setup-status.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';
import { surfaceSx } from './theme.js';

export const setupApplicationName = (client: ApplicationSetupClient, locale: Locale): string =>
  client === 'opencode-v2'
    ? 'OpenCode v2'
    : client === 'aionui'
      ? applicationSetupMessages(locale).aionUiName
      : client === 'opencode'
        ? 'OpenCode v1'
        : applicationNames[client];

export function applicationNextStep(
  client: ApplicationSetupClient,
  locale: Locale,
  messages = mcpSetupMessages(locale),
): string {
  if (client === 'codex') return sessionDeliveryMessages[locale].connectRestart;
  if (client === 'opencode-v2') return applicationSetupMessages(locale).openCodeV2Next;
  if (client === 'claude') return messages.claudeNext;
  if (client === 'aionui') return messages.aionNext;
  return clientNextStep(client, locale, messages);
}

interface SetupPresentationState {
  phase: ApplicationSetupState['phase'];
  error?: string;
  result?: ApplicationSetupState['result'];
  uncertain?: { error: string };
}

const hasPendingSetupResult = (state: SetupPresentationState): boolean =>
  state.phase === 'uncertain' || state.phase === 'rechecking';

export function setupFailure(
  state: SetupPresentationState & { deliveryIssue?: ApplicationSetupState['deliveryIssue'] },
  locale: Locale,
) {
  const issue = state.deliveryIssue;
  return issue
    ? sessionDeliveryMessages[locale][issue === 'close-required' ? 'quitBeforeChange' : issue]
    : applicationSetupMessages(locale).failed;
}

function setupActionLabel(state: SetupPresentationState, locale: Locale, busy: boolean): string {
  const copy = applicationSetupMessages(locale);
  return hasPendingSetupResult(state)
    ? copy.checkSetupResult
    : busy
      ? copy.connecting
      : state.phase === 'failed'
        ? copy.retry
        : t(locale, 'btnConnect');
}

export function useApplicationSetup(
  invoke: McpSetupInvoke,
  onApplied: () => Promise<void>,
  shared?: ApplicationSetupFlow,
) {
  const applied = useRef(onApplied);
  applied.current = onApplied;
  const flow = useMemo(
    () => shared ?? new ApplicationSetupFlow(invoke, () => applied.current()),
    [invoke, shared],
  );
  useEffect(() => {
    void flow.openCodeV2.refresh();
  }, [flow]);
  useEffect(
    () => () => {
      if (!shared) flow.dispose();
    },
    [flow, shared],
  );
  return flow;
}

interface SetupProps {
  discovery: ApplicationDiscoveryModel;
  flow: ApplicationSetupFlow;
  statuses: McpSetupStatuses;
  invoke: McpSetupInvoke;
  locale: Locale;
  onManualSetup: (client: McpSetupClient) => void;
  snapshot?: Pick<Snapshot, 'adapters' | 'agents'>;
  disabled?: boolean;
}

export function SetupDetails({ state, locale }: { state: SetupPresentationState; locale: Locale }) {
  const m = mcpSetupMessages(locale);
  if (!state.result?.warning && !state.result?.files.some((file) => file.backupPath)) return null;
  return (
    <Box>
      {state.result.warning && <Alert severity="warning">{state.result.warning}</Alert>}
      {state.result.files.map(
        (file) =>
          file.backupPath && (
            <Typography variant="body2" key={file.path}>
              {m.backup}: {file.backupPath}
            </Typography>
          ),
      )}
    </Box>
  );
}

export function ReadyChatGuidance({ locale }: { locale: Locale }) {
  const [beforeCommand, afterCommand] =
    applicationSetupMessages(locale).readyChatHelp.split('{command}');
  const command = mcpSetupMessages(locale).connectionPrompt.replace(/[.。]$/u, '');
  return (
    <>
      {beforeCommand}
      <Box
        component="code"
        sx={{
          fontFamily: 'inherit',
          fontSize: 'inherit',
          fontStyle: 'italic',
          bgcolor: 'action.hover',
          px: 0.5,
          py: 0.125,
          borderRadius: 0.5,
          boxDecorationBreak: 'clone',
        }}
      >
        {command}
      </Box>
      {afterCommand}
    </>
  );
}

export function NextStep({
  client,
  invoke,
  locale,
  compact,
  onManualSetup,
  showConnectionPrompt = true,
  inline = false,
  working = false,
}: {
  client: ApplicationSetupClient;
  invoke: McpSetupInvoke;
  locale: Locale;
  compact?: boolean;
  onManualSetup?: () => void;
  showConnectionPrompt?: boolean;
  inline?: boolean;
  working?: boolean;
}) {
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const [copyError, setCopyError] = useState(false);
  if (inline) {
    return (
      <Typography
        component="p"
        variant="body2"
        color="text.secondary"
        data-testid={'application-guidance-' + client}
        sx={{ mt: 1.5, overflowWrap: 'anywhere', whiteSpace: 'normal' }}
      >
        {client === 'codex' ? (
          sessionDeliveryMessages[locale].connectRestart
        ) : working ? (
          <ReadyChatGuidance locale={locale} />
        ) : (
          applicationNextStep(client, locale, m)
        )}
      </Typography>
    );
  }
  return (
    <Stack
      spacing={1.5}
      data-testid={'setup-next-' + client}
      sx={{
        mt: 2,
        maxWidth: compact ? 640 : undefined,
        alignItems: compact ? 'flex-start' : undefined,
      }}
    >
      <Typography variant="subtitle2" component="h3">
        {copy.nextStep}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {applicationNextStep(client, locale, m)}
      </Typography>
      {showConnectionPrompt && (
        <Box
          component="code"
          sx={{ ...surfaceSx('inset'), p: 1.5, fontSize: 12, overflowWrap: 'anywhere' }}
        >
          {m.connectionPrompt}
        </Box>
      )}
      {client === 'claude' && (
        <Box>
          <Typography variant="caption" color="text.secondary">
            {m.claudeLaunch}
          </Typography>
          <Typography component="code" variant="body2" sx={{ display: 'block', mt: 0.5 }}>
            claude
          </Typography>
        </Box>
      )}
      {showConnectionPrompt && (
        <>
          <Button
            variant="outlined"
            startIcon={<ContentCopyOutlined />}
            onClick={() => {
              void invoke('copy', { text: m.connectionPrompt })
                .then(() => setCopyError(false))
                .catch(() => setCopyError(true));
            }}
          >
            {m.copyPrompt}
          </Button>
          {copyError && <Alert severity="error">{copy.copyFailed}</Alert>}
        </>
      )}
      {client === 'aionui' && onManualSetup && (
        <Button onClick={onManualSetup}>{m.aionConfigureAccess}</Button>
      )}
    </Stack>
  );
}

export function ClaudePermissionChanges({ file }: { file: McpSetupFilePreview }) {
  const prefix = 'permissions.allow ';
  const added = file.changes.filter(
    (change) => change.action === 'add' && change.scope.startsWith(prefix),
  );
  if (!added.length) return null;
  return (
    <Box component="ul" sx={{ my: 0.5, pl: 3, overflowWrap: 'anywhere' }}>
      {added.map(({ scope }) => (
        <Typography component="li" variant="body2" key={scope}>
          <code>{scope.slice(prefix.length)}</code>
        </Typography>
      ))}
    </Box>
  );
}

export function OpenCodePermissionPreview({
  client,
  file,
  locale,
}: {
  client: ApplicationSetupClient;
  file: McpSetupFilePreview;
  locale: Locale;
}) {
  if (client !== 'opencode' && client !== 'opencode-v2') return null;
  const prefix = (client === 'opencode' ? 'permission' : 'permissions') + '.';
  const added = file.changes.filter(
    ({ scope, action }) => action === 'add' && scope.startsWith(prefix),
  );
  if (!added.length) return null;
  return (
    <Box sx={{ overflowWrap: 'anywhere' }}>
      <Typography variant="body2">{mcpSetupMessages(locale).opencodeToolPermissions}</Typography>
      <Box component="ul" sx={{ pl: 2.5, mt: 0.5, mb: 0 }}>
        {added.map(({ scope }) => (
          <li key={scope}>
            <Typography component="code" variant="body2">
              {scope.slice(prefix.length)}
            </Typography>
          </li>
        ))}
      </Box>
    </Box>
  );
}

export function ApplicationSetupConfirmation({
  flow,
  locale,
}: {
  flow: ApplicationSetupFlow;
  locale: Locale;
}) {
  const states = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const client = applicationSetupClients.find((item) => states[item].phase === 'confirmation');
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const choices = states.codex.configurations;
  const profileName = (file: string) => {
    const profile = configurationProfile(file);
    return (
      profile
        ?.split(/[\\/]/)
        .at(-1)
        ?.replace(/^\.codex[-_]/i, '') ||
      profile ||
      file
    );
  };
  if (choices?.length)
    return (
      <Dialog open onClose={() => flow.cancel('codex')} aria-labelledby="codex-profile-choice">
        <DialogTitle id="codex-profile-choice">
          {sessionDeliveryMessages[locale].chooseProfile}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            {choices.map((configuration) => (
              <Button
                key={configuration}
                onClick={() => void flow.connect('codex', configuration)}
                sx={{ textTransform: 'none' }}
              >
                {choices.filter((file) => profileName(file) === profileName(configuration)).length >
                1
                  ? configurationProfile(configuration)
                  : profileName(configuration)}
              </Button>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => flow.cancel('codex')}>{m.cancel}</Button>
        </DialogActions>
      </Dialog>
    );
  const preview = client ? states[client].preview : undefined;
  return (
    <Dialog
      open={!!client}
      onClose={() => {
        if (client) flow.cancel(client);
      }}
      fullWidth
      maxWidth="sm"
      slotProps={{ paper: { sx: { '& .MuiButton-root': { minHeight: 44, fontSize: 14 } } } }}
      aria-labelledby="setup-replacement-title"
    >
      <DialogTitle id="setup-replacement-title">{copy.confirmTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>
            {client && states[client].renewed ? copy.reviewHelp : copy.confirmHelp}
          </Typography>
          {client && (
            <Typography variant="subtitle2">{setupApplicationName(client, locale)}</Typography>
          )}
          {preview?.files.map((file) => (
            <Box key={file.id} sx={{ overflowWrap: 'anywhere' }}>
              <Typography component="code" variant="body2">
                {file.path}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m[file.action]}
              </Typography>
              {client === 'claude' && <ClaudePermissionChanges file={file} />}
              {client && <OpenCodePermissionPreview client={client} file={file} locale={locale} />}
              {file.backupPath && (
                <Typography variant="body2">
                  {m.backup}: {file.backupPath}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            if (client) flow.cancel(client);
          }}
        >
          {m.cancel}
        </Button>
        <Button
          variant="contained"
          onClick={() => {
            if (client) void flow.confirm(client);
          }}
        >
          {m.apply}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ManualSetupButton({
  label,
  disabled,
  onClick,
  testId,
  sx = [],
}: Pick<IconButtonProps, 'disabled' | 'onClick' | 'sx'> & {
  label: string;
  testId?: string;
}) {
  return (
    <Tooltip title={disabled ? '' : label}>
      <IconButton
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        data-testid={testId}
        sx={[
          { width: 44, height: 44, flexShrink: 0, border: '1px solid', borderColor: 'divider' },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <SettingsOutlined sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
}

function useOpenCodeV1Visibility(discovery: ApplicationDiscoveryModel, statuses: McpSetupStatuses) {
  const [override, setOverride] = useState<boolean>();
  const configured =
    !statuses.errors.opencode && statuses.statuses.opencode?.openCodeV1Configuration === true;
  const detected = discovery.snapshot?.applications.some(
    (application) =>
      application.client === 'opencode' &&
      application.status === 'detected' &&
      application.instances.some((instance) => instance.openCodeMajor === 1),
  );
  return [override ?? (configured || detected === true), setOverride] as const;
}

function OpenCodeV1Toggle({
  expanded,
  onChange,
  disabled,
  locale,
}: {
  expanded: boolean;
  onChange: (expanded: boolean) => void;
  disabled: boolean;
  locale: Locale;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2 }}>
      <FormControlLabel
        label="OpenCode v1"
        labelPlacement="start"
        sx={{
          m: 0,
          gap: 1,
          minHeight: 44,
          '& .MuiFormControlLabel-label': { fontSize: 12, color: 'text.secondary' },
        }}
        control={
          <Switch
            size="small"
            checked={expanded}
            disabled={disabled}
            onChange={(_event, checked) => onChange(checked)}
            slotProps={{ input: { 'aria-label': applicationSetupMessages(locale).showOpenCodeV1 } }}
          />
        }
      />
    </Box>
  );
}

export function setupView(
  client: ApplicationSetupClient,
  states: ApplicationSetupStates,
  statuses: McpSetupStatuses,
  discovery: ApplicationDiscoveryModel,
) {
  if (client === 'opencode-v2') {
    const state = states[client];
    const status =
      state.status &&
      state.target &&
      openCodeV2TargetKey(state.status.target) === openCodeV2TargetKey(state.target)
        ? state.status
        : undefined;
    return {
      state,
      configured:
        state.phase === 'succeeded' ||
        (state.availability === 'available' && status?.state === 'configured'),
      detected:
        state.availability === 'available' &&
        !!state.target?.installationId &&
        !!state.target.installationPath,
      hasStatus: !!status,
      configurationState: state.availability === 'available' ? status?.state : undefined,
      checking: state.checking,
      automatic: openCodeV2AutomaticAvailable(state),
      unavailable: state.availability === 'unavailable' || status?.state === 'unavailable',
    };
  }
  const state = states[client];
  return {
    state,
    configured:
      (state.phase === 'succeeded' && !state.deliveryIssue) ||
      (!state.deliveryIssue &&
        !state.manualConfiguration &&
        !statuses.statuses[client]?.codexConnectRequired &&
        !statuses.errors[client] &&
        statuses.statuses[client]?.state === 'configured'),
    detected: !!discovery.snapshot?.applications.some(
      (item) => item.client === client && item.status === 'detected',
    ),
    hasStatus: !!statuses.statuses[client],
    configurationState: statuses.errors[client] ? undefined : statuses.statuses[client]?.state,
    checking: false,
    automatic: !!discovery.snapshot?.applications.some(
      (item) => item.client === client && item.status === 'detected',
    ),
    unavailable: !!statuses.errors[client],
  };
}

export function applicationSetupAction(
  { state, configured, automatic, checking, hasStatus }: ReturnType<typeof setupView>,
  locale: Locale,
  busy: boolean,
  anyBusy: boolean,
) {
  const pending = hasPendingSetupResult(state);
  const retry = state.phase === 'failed' || pending;
  if ((configured && !pending) || (!automatic && !retry)) return undefined;
  return {
    label: setupActionLabel(state, locale, busy),
    disabled: anyBusy || checking || state.phase === 'confirmation' || (!hasStatus && !retry),
  };
}

function ApplicationCompactList({
  discovery,
  flow,
  statuses,
  invoke,
  locale,
  onManualSetup,
  disabled = false,
  offers = [],
  context,
}: SetupProps & {
  offers?: readonly McpSetupClient[];
  context: 'application' | 'startup' | 'overview';
}) {
  const states = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const [showV1, setShowV1] = useOpenCodeV1Visibility(discovery, statuses);
  const [expanded, setExpanded] = useState<Partial<Record<ApplicationSetupClient, boolean>>>({});
  const [guidanceClient, setGuidanceClient] = useState<ApplicationSetupClient | null>(null);
  const anyBusy = disabled || applicationSetupClients.some((client) => flow.busy(client));
  const guidancePhase = guidanceClient ? states[guidanceClient].phase : undefined;
  useEffect(() => {
    if (guidanceClient && guidancePhase === 'succeeded')
      setExpanded((current) =>
        current[guidanceClient] ? current : { ...current, [guidanceClient]: true },
      );
  }, [guidancePhase, guidanceClient]);
  const manual = (client: ApplicationSetupClient) => {
    if (client === 'opencode' || client === 'opencode-v2')
      flow.openCodeV2.selectManualMajor(client === 'opencode' ? 1 : 2);
    onManualSetup(client === 'opencode-v2' ? 'opencode' : client);
  };
  const row = (client: ApplicationSetupClient, border: boolean) => {
    const { state, configured, detected, hasStatus, unavailable, checking, automatic } = setupView(
      client,
      states,
      statuses,
      discovery,
    );
    const busy = flow.busy(client);
    const pending = hasPendingSetupResult(state);
    const needsRetry = state.phase === 'failed' || pending;
    const connect = (!configured || pending) && (automatic || needsRetry);
    const configuredDetails = configured && !needsRetry;
    const detailsId = 'application-info-' + context + '-' + client;
    const detection = detected
      ? copy.detected
      : automatic
        ? copy.automaticAvailable
        : copy.automaticUnavailable;
    const setupStatus = busy
      ? copy.connecting
      : checking
        ? m.checking
        : pending
          ? m.statusUnknown
          : configured
            ? m.configured
            : unavailable || state.phase === 'failed'
              ? m.unavailable
              : hasStatus
                ? m['not-configured']
                : m.statusUnknown;
    const briefStatus =
      busy ||
      checking ||
      configured ||
      pending ||
      unavailable ||
      !hasStatus ||
      state.phase === 'failed'
        ? setupStatus
        : detection;
    const offerClient = client === 'opencode-v2' ? 'opencode' : client;
    return (
      <Box
        key={client}
        data-testid={
          context === 'application'
            ? 'application-row-' + client
            : context + '-application-' + client
        }
        sx={{
          px: 2,
          py: 1,
          minHeight: 64,
          boxSizing: 'border-box',
          borderTop: border ? '1px solid' : 0,
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: 'max-content minmax(0, 1fr) max-content',
          gridColumn: '1 / -1',
          columnGap: 1.5,
          rowGap: 1,
        }}
      >
        <Box sx={{ gridColumn: 1, alignSelf: 'start', mt: 0.75 }}>
          <ClientLogo client={client === 'opencode-v2' ? 'opencode' : client} size={32} />
        </Box>
        <Box
          component="details"
          id={detailsId}
          open={!!expanded[client]}
          data-testid={context + '-details-' + client}
          onToggle={(event) => {
            const open = (event.currentTarget as HTMLDetailsElement).open;
            setExpanded((current) =>
              !!current[client] === open ? current : { ...current, [client]: open },
            );
          }}
          sx={{
            gridColumn: 2,
            minWidth: 0,
            '&[open] > summary .application-disclosure-icon': { transform: 'rotate(90deg)' },
          }}
        >
          <Box
            component="summary"
            aria-label={copy.details + ': ' + setupApplicationName(client, locale)}
            data-offer-client={
              client !== 'opencode' && offers.includes(offerClient as McpSetupClient)
                ? offerClient
                : undefined
            }
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              minHeight: 44,
              cursor: 'pointer',
              listStyle: 'none',
              borderRadius: 0.5,
              '&::-webkit-details-marker': { display: 'none' },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            <ChevronRightOutlined
              className="application-disclosure-icon"
              sx={{ fontSize: 16, flexShrink: 0, color: 'text.secondary' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h3" sx={{ fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>
                {setupApplicationName(client, locale)}
              </Typography>
              <Typography
                component="p"
                color={configured && !pending ? 'success.main' : 'text.secondary'}
                sx={{ fontSize: 12, lineHeight: '18px', overflowWrap: 'anywhere' }}
              >
                {briefStatus}
              </Typography>
              {client === 'claude' && connect && (
                <Typography variant="caption" color="text.secondary">
                  {m.claudeDescription}
                </Typography>
              )}
            </Box>
          </Box>
          <Stack spacing={1} sx={{ pt: 1, pb: 1, pl: 3, minWidth: 0 }}>
            {expanded[client] && configured && !pending && (
              <NextStep
                client={client}
                invoke={invoke}
                locale={locale}
                compact
                showConnectionPrompt={context !== 'application'}
                onManualSetup={() => manual(client)}
              />
            )}
            {(connect || configuredDetails) && (
              <ManualSetupButton
                label={copy.manual}
                disabled={anyBusy}
                onClick={() => manual(client)}
                sx={{ alignSelf: 'flex-start' }}
              />
            )}
            {client !== 'codex' && <SetupDetails state={state} locale={locale} />}
          </Stack>
        </Box>
        {connect ? (
          <Button
            variant="contained"
            disabled={
              anyBusy || checking || state.phase === 'confirmation' || (!hasStatus && !needsRetry)
            }
            onClick={() => {
              setGuidanceClient(client);
              void flow.connect(client);
            }}
            data-testid={context + '-connect-' + client}
            title={
              client === 'opencode' || client === 'opencode-v2'
                ? m.opencodeToolPermissions
                : undefined
            }
            sx={{ gridColumn: 3, alignSelf: 'start', justifySelf: 'end' }}
          >
            {setupActionLabel(state, locale, busy)}
          </Button>
        ) : configuredDetails ? (
          <Button
            variant="text"
            aria-expanded={!!expanded[client]}
            aria-controls={detailsId}
            onClick={() => setExpanded((current) => ({ ...current, [client]: !current[client] }))}
            data-testid={context + '-configured-' + client}
            sx={{ gridColumn: 3, alignSelf: 'start', justifySelf: 'end' }}
          >
            {lanSearchMessages(locale).details}
          </Button>
        ) : (
          <ManualSetupButton
            label={copy.manual}
            disabled={anyBusy}
            onClick={() => manual(client)}
            testId={context + '-manual-' + client}
            sx={{ gridColumn: 3, alignSelf: 'start', justifySelf: 'end' }}
          />
        )}
        {client === 'codex' &&
          (detected || configured || discovery.snapshot?.chatgptCompatibility?.version) && (
            <ChatgptCompatibilityNotice
              compatibility={discovery.snapshot?.chatgptCompatibility}
              locale={locale}
            />
          )}
        {(state.phase === 'failed' || pending) && (
          <Alert
            severity={pending ? 'warning' : 'error'}
            sx={{ gridColumn: '2 / -1', minWidth: 0 }}
          >
            {pending ? copy.uncertain : setupFailure(state, locale)}
            {client === 'claude' && state.error?.startsWith('Claude Code permissions.') && (
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {state.error}
              </Typography>
            )}
          </Alert>
        )}
      </Box>
    );
  };
  return (
    <Paper
      variant="outlined"
      data-testid={context + '-application-tiles'}
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        backgroundImage: 'none',
        boxShadow: 'none',
        '& .MuiButton-root': {
          minHeight: 44,
          fontSize: 13,
          whiteSpace: 'normal',
          maxWidth: '100%',
        },
      }}
    >
      {mcpSetupClients.map((client, index) =>
        client === 'opencode' ? (
          <Box
            key="opencode"
            data-testid={context + '-group-opencode'}
            sx={{
              borderTop: index ? '1px solid' : 0,
              borderColor: 'divider',
            }}
          >
            {row('opencode-v2', false)}
            {showV1 && row('opencode', true)}
            <Box>
              <OpenCodeV1Toggle
                expanded={showV1}
                onChange={setShowV1}
                disabled={anyBusy}
                locale={locale}
              />
            </Box>
          </Box>
        ) : (
          row(client, index > 0)
        ),
      )}
    </Paper>
  );
}

function ConfiguredApplicationStatus({
  client,
  snapshot,
  locale,
}: Pick<SetupProps, 'snapshot' | 'locale'> & { client: ApplicationSetupClient }) {
  const m = mcpSetupMessages(locale);

  return (
    <Stack
      spacing={1.25}
      data-testid="client-status-panel"
      data-client={client}
      data-status="configured"
      sx={{
        mt: 2,
        pt: 1.75,
        borderTop: '1px solid',
        borderColor: 'divider',
        minWidth: 0,
        containerType: 'inline-size',
      }}
    >
      <Box
        component="dl"
        sx={{
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          '@container (min-width: 280px)': {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          },
          '@container (min-width: 740px)': {
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          },
          columnGap: 2.5,
          rowGap: 1.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {client === 'codex' || client === 'aionui' ? m.statusMcpConfig : m.statusOpencodeConfig}
          </Typography>
          <Stack component="dd" direction="row" spacing={1} sx={{ m: 0, alignItems: 'flex-start' }}>
            <CheckCircleOutlineOutlined
              sx={{ fontSize: 18, color: 'success.main', flexShrink: 0, mt: '1px' }}
            />
            <Typography variant="body2" component="span" data-testid="mcp-settings-status">
              {m.configured}
            </Typography>
          </Stack>
        </Box>
        <ClientApplicationMetrics
          kind={setupAdapterKinds[client]}
          snapshot={snapshot}
          locale={locale}
          unknownLabel={m.statusUnknown}
          deliveryLabel={m.statusDelivery}
        />
      </Box>
      {client === 'opencode' && (
        <Typography variant="caption" color="text.secondary">
          {m.statusOpencodeHint}
        </Typography>
      )}
    </Stack>
  );
}

export function ApplicationRows({
  discovery,
  flow,
  statuses,
  invoke,
  locale,
  onManualSetup,
  snapshot,
  disabled = false,
}: SetupProps) {
  const states = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const discoveryCopy = discoveryMessages(locale);
  const [showV1, setShowV1] = useOpenCodeV1Visibility(discovery, statuses);
  const aionUiConfigured = setupView('aionui', states, statuses, discovery).configured;
  const [aionUiPaired, setAionUiPaired] = useState(false);
  useEffect(() => {
    if (!aionUiConfigured) {
      setAionUiPaired(false);
      return;
    }
    let revision = 0;
    const refresh = () => {
      const request = ++revision;
      void invoke<AionUiApplicationState>('aionUiStatus').then(
        (status) => {
          if (request === revision) setAionUiPaired(status?.state === 'paired');
        },
        () => {
          if (request === revision) setAionUiPaired(false);
        },
      );
    };
    refresh();
    const off = window.interconnect.onChange(refresh);
    return () => {
      revision++;
      off();
    };
  }, [aionUiConfigured, invoke]);
  const anyBusy = disabled || applicationSetupClients.some((client) => flow.busy(client));
  const manual = (client: ApplicationSetupClient) => {
    if (client === 'opencode' || client === 'opencode-v2')
      flow.openCodeV2.selectManualMajor(client === 'opencode' ? 1 : 2);
    onManualSetup(client === 'opencode-v2' ? 'opencode' : client);
  };
  const row = (client: ApplicationSetupClient, border = false) => {
    const view = setupView(client, states, statuses, discovery);
    const {
      state,
      configured,
      detected,
      hasStatus,
      unavailable,
      checking,
      automatic,
      configurationState,
    } = view;
    const busy = flow.busy(client);
    const action = applicationSetupAction(view, locale, busy, anyBusy);
    const pending = hasPendingSetupResult(state);
    const needsRetry = state.phase === 'failed' || pending;
    const cursorPermissionUnconfirmed =
      client === 'cursor' &&
      state.phase === 'succeeded' &&
      state.result?.cursorPermission?.state === 'unconfirmed';
    const working = hasConnectedClientChat(client, snapshot);
    const showStatus =
      configured &&
      !busy &&
      !checking &&
      !needsRetry &&
      !cursorPermissionUnconfirmed &&
      (client !== 'aionui' || aionUiPaired);
    const showGuidance = !busy && !checking && !needsRetry && (configured || working);
    const setupStatus = busy
      ? copy.connecting
      : checking
        ? m.checking
        : pending
          ? m.statusUnknown
          : configured
            ? cursorPermissionUnconfirmed
              ? `${m.configured}. ${t(locale, 'clientsUnavailableImpact')}`
              : m.configured
            : unavailable || state.phase === 'failed'
              ? m.unavailable
              : configurationState === 'needs-update'
                ? m['needs-update']
                : hasStatus
                  ? m['not-configured']
                  : m.statusUnknown;
    return (
      <Box
        key={client}
        data-testid={'application-row-' + client}
        sx={{
          px: 3,
          py: 2.5,
          minHeight: 112,
          boxSizing: 'border-box',
          borderTop: border ? '1px solid' : 0,
          borderColor: 'divider',
          display: 'grid',
          gridTemplateColumns: 'subgrid',
          gridColumn: '1 / -1',
          '& > *': { gridColumn: '1 / -1' },
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'subgrid',
            columnGap: 2.5,
            rowGap: 1,
            alignItems: 'center',
          }}
        >
          <ClientLogo client={client === 'opencode-v2' ? 'opencode' : client} size={44} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 500 }}>
              {setupApplicationName(client, locale)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {detected
                ? copy.detected
                : automatic
                  ? copy.automaticAvailable
                  : copy.automaticUnavailable}
            </Typography>
            {client === 'claude' && action && (
              <Typography variant="caption" color="text.secondary">
                {m.claudeDescription}
              </Typography>
            )}
          </Box>
          {!showStatus && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
                gridColumn: { xs: '2', md: '2', lg: 'auto' },
                gridRow: { md: '2', lg: 'auto' },
                minWidth: 0,
              }}
              aria-label={m.statusMcpConfig}
            >
              {configured && !pending && (
                <CheckOutlined sx={{ fontSize: 18, color: 'success.main' }} />
              )}
              <Typography
                variant="body2"
                color={configured && !pending ? 'success.main' : 'text.secondary'}
                data-testid={
                  cursorPermissionUnconfirmed ? 'cursor-permission-unconfirmed' : undefined
                }
              >
                {setupStatus}
              </Typography>
            </Stack>
          )}
          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{
              flexWrap: 'wrap',
              gridColumn: { xs: '2', md: '3', lg: '4' },
              gridRow: { md: showStatus ? '1' : '1 / 3', lg: '1' },
              maxWidth: 360,
              justifyContent: { md: 'flex-end' },
            }}
          >
            {action && (
              <Button
                variant="contained"
                disabled={action.disabled}
                onClick={() => {
                  void flow.connect(client);
                }}
                data-testid={'application-connect-' + client}
                title={
                  client === 'opencode' || client === 'opencode-v2'
                    ? m.opencodeToolPermissions
                    : undefined
                }
              >
                {action.label}
              </Button>
            )}
            <ManualSetupButton
              label={copy.manual}
              disabled={anyBusy}
              onClick={() => manual(client)}
              testId={'application-manual-' + client}
            />
          </Stack>
        </Box>
        {client === 'codex' && action && !showGuidance && !states.codex.deliveryIssue && (
          <Typography variant="body2" color="text.secondary">
            {sessionDeliveryMessages[locale].connectRestart}
          </Typography>
        )}
        {client === 'codex' &&
          (detected ||
            configured ||
            working ||
            discovery.snapshot?.chatgptCompatibility?.version) && (
            <ChatgptCompatibilityNotice
              compatibility={discovery.snapshot?.chatgptCompatibility}
              locale={locale}
              marginTop="12px"
            />
          )}
        {(state.phase === 'failed' || hasPendingSetupResult(state)) && (
          <Alert severity={hasPendingSetupResult(state) ? 'warning' : 'error'} sx={{ mt: 2 }}>
            {hasPendingSetupResult(state) ? copy.uncertain : setupFailure(state, locale)}
            {client === 'claude' && state.error?.startsWith('Claude Code permissions.') && (
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {state.error}
              </Typography>
            )}
          </Alert>
        )}
        {client !== 'codex' && <SetupDetails state={state} locale={locale} />}
        {showGuidance && (
          <NextStep
            client={client}
            invoke={invoke}
            locale={locale}
            inline
            working={working}
            showConnectionPrompt={false}
          />
        )}
        {showStatus && (
          <ConfiguredApplicationStatus client={client} snapshot={snapshot} locale={locale} />
        )}
      </Box>
    );
  };
  return (
    <Stack
      spacing={2}
      useFlexGap
      data-testid="application-setup-list"
      sx={{ '& .MuiButton-root': { minHeight: 44, fontSize: 14 } }}
    >
      <Stack
        direction="row"
        sx={{
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          columnGap: 3,
          rowGap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: '1 1 14rem', minWidth: 0 }}>
          {copy.detectionHelp}
        </Typography>
        <Link
          component="button"
          type="button"
          variant="body2"
          underline="always"
          disabled={discovery.busy || anyBusy}
          onClick={() => {
            flow.invalidateSucceeded();
            void discovery.refresh();
            void statuses.refreshAll(true);
            void flow.openCodeV2.refresh();
          }}
          sx={{
            display: 'inline',
            flexShrink: 0,
            ml: 'auto',
            p: 0,
            minHeight: 0,
            whiteSpace: 'nowrap',
            '&:disabled': { color: 'text.disabled', cursor: 'default', textDecoration: 'none' },
          }}
        >
          <RefreshOutlined sx={{ fontSize: '1em', verticalAlign: '-0.125em', mr: 0.5 }} />
          {discoveryCopy.refresh}
        </Link>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'max-content minmax(0, 1fr)',
            md: 'max-content minmax(0, 1fr) auto',
            lg: 'max-content minmax(140px, 1fr) minmax(120px, .8fr) auto',
          },
          columnGap: 2.5,
          rowGap: 2,
        }}
      >
        {mcpSetupClients.map((client) => (
          <Paper
            key={client}
            component="article"
            data-testid={client === 'opencode' ? 'application-group-opencode' : undefined}
            sx={{
              overflow: 'hidden',
              display: 'grid',
              gridTemplateColumns: 'subgrid',
              gridColumn: '1 / -1',
              '& > *': { gridColumn: '1 / -1' },
            }}
          >
            {client === 'opencode' ? (
              <>
                {row('opencode-v2')}
                {showV1 && row('opencode', true)}
                <OpenCodeV1Toggle
                  expanded={showV1}
                  onChange={setShowV1}
                  disabled={anyBusy}
                  locale={locale}
                />
              </>
            ) : (
              row(client)
            )}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

export function ApplicationTiles({
  context = 'overview',
  ...props
}: SetupProps & { offers?: readonly McpSetupClient[]; context?: 'startup' | 'overview' }) {
  return <ApplicationCompactList {...props} context={context} />;
}

export interface ApplicationStartup {
  open: boolean;
  clients: readonly ApplicationSetupClient[];
  close: () => void;
}

function startupOfferClients(
  discovery: ApplicationDiscoveryModel,
  states: ApplicationSetupStates,
  statuses: McpSetupStatuses,
  snapshot?: Pick<Snapshot, 'adapters' | 'agents'>,
): ApplicationSetupClient[] | null {
  if (!discovery.snapshot) return discovery.failed ? [] : null;
  const { applications, offers } = discovery.snapshot;
  const candidates = mcpSetupClients
    .filter(
      (client) =>
        offers.includes(client) &&
        applications.some((item) => item.client === client && item.status === 'detected'),
    )
    // Generic OpenCode discovery supplies no v1 installation proof.
    .map((client) => (client === 'opencode' ? ('opencode-v2' as const) : client));
  if (
    candidates.some((client) => {
      if (client === 'opencode-v2') {
        const state = states[client];
        return state.checking || state.availability === 'checking';
      }
      return !statuses.statuses[client] && statuses.errors[client] === undefined;
    })
  )
    return null;
  return candidates.filter((client) => {
    const view = setupView(client, states, statuses, discovery);
    return (
      view.detected &&
      view.automatic &&
      !view.unavailable &&
      !view.configured &&
      !hasConnectedClientChat(client, snapshot) &&
      (view.configurationState === 'missing' || view.configurationState === 'not-configured')
    );
  });
}

export function useApplicationSetupStartup(
  discovery: ApplicationDiscoveryModel,
  states: ApplicationSetupStates,
  statuses: McpSetupStatuses,
  snapshot?: Pick<Snapshot, 'adapters' | 'agents'>,
): ApplicationStartup {
  const [initialOffers, setInitialOffers] = useState<ApplicationSetupClient[] | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (initialOffers !== null) return;
    const clients = startupOfferClients(discovery, states, statuses, snapshot);
    if (clients !== null && (snapshot || !clients.length)) setInitialOffers(clients);
  }, [initialOffers, discovery, states, statuses, snapshot]);
  const clients = initialOffers ?? [];
  return {
    open: !closed && clients.length > 0,
    clients,
    close: () => {
      setClosed(true);
      discovery.dismiss();
    },
  };
}

export function ApplicationSetup({
  discovery,
  flow,
  statuses,
  invoke,
  locale,
  onManualSetup,
  startup,
}: SetupProps & { startup: ApplicationStartup }) {
  const states = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [attempted, setAttempted] = useState<ApplicationSetupClient[]>([]);
  const completed = attempted.filter((client) => states[client].phase === 'succeeded');
  const remaining = startup.clients.filter((client) => {
    const { configured, state } = setupView(client, states, statuses, discovery);
    return !configured || hasPendingSetupResult(state);
  });
  const visibleOffers = remaining.join(',');
  const open = startup.open;
  const operationBusy = applicationSetupClients.some((client) =>
    ['preparing', 'rechecking', 'applying'].includes(states[client].phase),
  );
  useEffect(() => {
    const target = content;
    if (!open || !target) return;
    const visible = new Set<McpSetupClient>();
    const acknowledge = () => {
      if (document.visibilityState === 'visible' && !target.closest('[aria-hidden="true"]'))
        void discovery.acknowledge([...visible]);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const client = entry.target.getAttribute('data-offer-client') as McpSetupClient;
          if (entry.isIntersecting && entry.intersectionRatio >= 1) visible.add(client);
          else visible.delete(client);
        }
        acknowledge();
      },
      { threshold: 1 },
    );
    for (const item of target.querySelectorAll('[data-offer-client]')) observer.observe(item);
    const changes = new MutationObserver(acknowledge);
    changes.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden'],
    });
    document.addEventListener('visibilitychange', acknowledge);
    return () => {
      observer.disconnect();
      changes.disconnect();
      document.removeEventListener('visibilitychange', acknowledge);
    };
  }, [content, open, visibleOffers, discovery.acknowledge]);
  const close = () => {
    if (!operationBusy) {
      startup.close();
    }
  };
  const manual = (client: McpSetupClient) => {
    close();
    onManualSetup(client);
  };
  return (
    <>
      <Dialog
        open={open}
        fullWidth
        maxWidth={false}
        onClose={close}
        aria-labelledby="application-setup-title"
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.default',
              backgroundImage: 'none',
              m: 3,
              width: 'calc(100% - 48px)',
              maxWidth: 1280,
              maxHeight: 'calc(100dvh - 48px)',
              overflow: 'hidden',
              '& .MuiButton-root': { minHeight: 44, fontSize: 14 },
            },
          },
        }}
      >
        <Box
          component="header"
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 4,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <Typography variant="subtitle1" component="p">
            NCF Agent Interconnect
          </Typography>
          <IconButton
            aria-label={m.close}
            onClick={close}
            disabled={operationBusy}
            sx={{ width: 44, height: 44 }}
          >
            <CloseOutlined />
          </IconButton>
        </Box>
        <Stack
          ref={setContent}
          spacing={2}
          sx={{
            px: 3,
            py: 2,
            width: '100%',
            maxWidth: 1280,
            mx: 'auto',
            boxSizing: 'border-box',
            flexShrink: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
          data-testid="application-startup-setup"
        >
          <Typography
            variant="h3"
            component="h1"
            id="application-setup-title"
            sx={{ fontSize: 28, lineHeight: 1.25 }}
          >
            {copy.startupTitle}
          </Typography>
          {remaining.length > 0 && (
            <ApplicationCardGrid testId="startup-application-grid">
              {remaining.map((client) => {
                const view = setupView(client, states, statuses, discovery);
                const pending = hasPendingSetupResult(view.state);
                const failed = view.state.phase === 'failed';
                const busy = flow.busy(client);
                const name = setupApplicationName(client, locale);
                const action = applicationSetupAction(view, locale, busy, operationBusy);
                return (
                  <StartupApplicationTile
                    key={client}
                    client={client}
                    offer={client === 'opencode-v2' ? 'opencode' : client}
                    name={name}
                    status={busy ? copy.connecting : copy.detected}
                    busy={busy}
                    compatibilityWarning={
                      client === 'codex' &&
                      showsChatgptCompatibilityNotice(discovery.snapshot?.chatgptCompatibility)
                    }
                    action={action}
                    onConnect={() => {
                      setAttempted((current) =>
                        current.includes(client) ? current : [...current, client],
                      );
                      void flow.connect(client);
                    }}
                  >
                    {client === 'codex' && (
                      <ChatgptCompatibilityNotice
                        compatibility={discovery.snapshot?.chatgptCompatibility}
                        locale={locale}
                      />
                    )}
                    {client === 'claude' && action && (
                      <Typography variant="caption" color="text.secondary">
                        {m.claudeDescription}
                      </Typography>
                    )}
                    {(pending || failed) && (
                      <Alert severity={pending ? 'warning' : 'error'}>
                        {pending ? copy.uncertain : setupFailure(view.state, locale)}
                      </Alert>
                    )}
                    {client !== 'codex' && <SetupDetails state={view.state} locale={locale} />}
                  </StartupApplicationTile>
                );
              })}
            </ApplicationCardGrid>
          )}
          {completed.map((client) => (
            <Box key={client} role="status">
              <Typography component="h2" variant="subtitle2" color="success.main">
                {setupApplicationName(client, locale)} · {copy.configuredStatus}
              </Typography>
              <NextStep
                client={client}
                invoke={invoke}
                locale={locale}
                compact
                onManualSetup={client === 'aionui' ? () => manual('aionui') : undefined}
              />
              {client !== 'codex' && <SetupDetails state={states[client]} locale={locale} />}
            </Box>
          ))}
        </Stack>
        <Box
          component="footer"
          sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider' }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
              maxWidth: 1280,
              width: '100%',
              mx: 'auto',
              boxSizing: 'border-box',
              px: { xs: 3, md: 4 },
              py: 2,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '65ch' }}>
              {copy.returnHelp}
            </Typography>
            <Button
              variant={completed.length ? 'contained' : 'outlined'}
              onClick={close}
              disabled={operationBusy}
              sx={{ flexShrink: 0 }}
            >
              {completed.length ? copy.continue : copy.continueWithoutSetup}
            </Button>
          </Stack>
        </Box>
      </Dialog>
      <ApplicationSetupConfirmation flow={flow} locale={locale} />
    </>
  );
}

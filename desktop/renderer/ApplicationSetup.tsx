import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  Typography,
} from '@mui/material';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import ChevronRightOutlined from '@mui/icons-material/ChevronRightOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import type { Snapshot } from '../shared/contracts.js';
import { applicationNames } from '../shared/application-discovery.js';
import { mcpSetupClients, type McpSetupClient, type McpSetupInvoke } from '../shared/mcp-setup.js';
import {
  ApplicationSetupFlow,
  applicationSetupClients,
  type ApplicationSetupClient,
  type ApplicationSetupState,
  type ApplicationSetupStates,
} from './application-setup-model.js';
import { openCodeV2TargetKey, openCodeV2AutomaticAvailable } from './opencode-v2-setup-model.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import { clientNextStep, hasConnectedClientChat } from './ClientSetupHelp.js';
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

interface SetupPresentationState {
  phase: ApplicationSetupState['phase'];
  error?: string;
  result?: ApplicationSetupState['result'];
  uncertain?: { error: string };
}

const hasPendingSetupResult = (state: SetupPresentationState): boolean =>
  state.phase === 'uncertain' || state.phase === 'rechecking';

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
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  if (!state.error && !state.uncertain && !state.result?.warning && state.phase !== 'failed')
    return null;
  return (
    <Box component="details" sx={{ fontSize: 12, overflowWrap: 'anywhere' }}>
      <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
        {copy.details}
      </Box>
      {state.uncertain && (
        <Typography variant="body2">
          {copy.uncertain} {state.uncertain.error}
        </Typography>
      )}
      {state.error && state.error !== state.uncertain?.error && (
        <Typography variant="body2">{state.error}</Typography>
      )}
      {state.result?.warning && <Typography variant="body2">{state.result.warning}</Typography>}
      {state.result?.files.map((file) => (
        <Box key={file.path} sx={{ mt: 1 }}>
          <Typography variant="body2">{file.path}</Typography>
          {file.backupPath && (
            <Typography variant="body2">
              {m.backup}: {file.backupPath}
            </Typography>
          )}
          {file.error && <Typography variant="body2">{file.error}</Typography>}
        </Box>
      ))}
    </Box>
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
    const [beforeCommand, afterCommand] = copy.readyChatHelp.split('{command}');
    const instruction =
      client === 'opencode-v2'
        ? copy.openCodeV2Next
        : client === 'claude'
          ? m.claudeNext
          : client === 'aionui'
            ? m.aionNext
            : clientNextStep(client, locale, m);
    return (
      <Typography
        component="p"
        variant="body2"
        color="text.secondary"
        data-testid={'application-guidance-' + client}
        sx={{ mt: 1.5, overflowWrap: 'anywhere', whiteSpace: 'normal' }}
      >
        {working ? (
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
              {m.connectionPrompt.replace(/[.。]$/u, '')}
            </Box>
            {afterCommand}
          </>
        ) : (
          instruction
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
        {client === 'opencode-v2'
          ? copy.openCodeV2Next
          : client === 'claude'
            ? m.claudeNext
            : client === 'aionui'
              ? m.aionNext
              : clientNextStep(client, locale, m)}
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

function setupView(
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
      checking: state.checking,
      automatic: openCodeV2AutomaticAvailable(state),
      unavailable: state.availability === 'unavailable' || status?.state === 'unavailable',
    };
  }
  const state = states[client];
  return {
    state,
    configured:
      state.phase === 'succeeded' ||
      (!statuses.errors[client] && statuses.statuses[client]?.state === 'configured'),
    detected: !!discovery.snapshot?.applications.some(
      (item) => item.client === client && item.status === 'detected',
    ),
    hasStatus: !!statuses.statuses[client],
    checking: false,
    automatic: !!discovery.snapshot?.applications.some(
      (item) => item.client === client && item.status === 'detected',
    ),
    unavailable: !!statuses.errors[client],
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
  const [showV1, setShowV1] = useState(false);
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
          gridTemplateColumns: 'subgrid',
          gridColumn: '1 / -1',
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
              <Button
                variant="text"
                disabled={anyBusy}
                onClick={() => manual(client)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {copy.manual}
              </Button>
            )}
            <Box component="details" sx={{ minWidth: 0, fontSize: 13 }}>
              <Box
                component="summary"
                sx={{ minHeight: 44, alignContent: 'center', cursor: 'pointer' }}
              >
                {copy.details}
              </Box>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  {copy.intro}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {detection}
                </Typography>
                <Typography variant="body2" aria-label={m.statusMcpConfig}>
                  {m.statusMcpConfig}: {setupStatus}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {copy.detectionHelp}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {copy.newApps}
                </Typography>
                <SetupDetails state={state} locale={locale} />
              </Stack>
            </Box>
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
          <Button
            variant="outlined"
            disabled={anyBusy}
            onClick={() => manual(client)}
            data-testid={context + '-manual-' + client}
            sx={{ gridColumn: 3, alignSelf: 'start', justifySelf: 'end' }}
          >
            {copy.manual}
          </Button>
        )}
        {(state.phase === 'failed' || pending) && (
          <Alert
            severity={pending ? 'warning' : 'error'}
            sx={{ gridColumn: '2 / -1', minWidth: 0 }}
          >
            {pending ? copy.uncertain : copy.failed}
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
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr) max-content',
        columnGap: 1.5,
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
              display: 'grid',
              gridTemplateColumns: 'subgrid',
              gridColumn: '1 / -1',
            }}
          >
            {row('opencode-v2', false)}
            {showV1 && row('opencode', true)}
            <Box sx={{ gridColumn: '1 / -1' }}>
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
  const [showV1, setShowV1] = useState(false);
  const anyBusy = disabled || applicationSetupClients.some((client) => flow.busy(client));
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
    const working = hasConnectedClientChat(client, snapshot);
    const showGuidance = !busy && !checking && !needsRetry && (configured || working);
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
          </Box>
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
            >
              {setupStatus}
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={1.5}
            useFlexGap
            sx={{
              flexWrap: 'wrap',
              gridColumn: { xs: '2', md: '3', lg: 'auto' },
              gridRow: { md: '1 / 3', lg: 'auto' },
              maxWidth: 360,
              justifyContent: { md: 'flex-end' },
            }}
          >
            {(!configured || hasPendingSetupResult(state)) && (automatic || needsRetry) && (
              <Button
                variant="contained"
                disabled={
                  anyBusy ||
                  checking ||
                  state.phase === 'confirmation' ||
                  (!hasStatus && !needsRetry)
                }
                onClick={() => {
                  void flow.connect(client);
                }}
                data-testid={'application-connect-' + client}
              >
                {setupActionLabel(state, locale, busy)}
              </Button>
            )}
            <Button
              variant="outlined"
              disabled={anyBusy}
              onClick={() => manual(client)}
              data-testid={'application-manual-' + client}
            >
              {copy.manual}
            </Button>
          </Stack>
        </Box>
        {(state.phase === 'failed' || hasPendingSetupResult(state)) && (
          <Alert severity={hasPendingSetupResult(state) ? 'warning' : 'error'} sx={{ mt: 2 }}>
            {hasPendingSetupResult(state) ? copy.uncertain : copy.failed}
          </Alert>
        )}
        <SetupDetails state={state} locale={locale} />
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
      </Box>
    );
  };
  return (
    <Stack
      spacing={3}
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
      <Paper
        sx={{
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: {
            xs: 'max-content minmax(0, 1fr)',
            md: 'max-content minmax(0, 1fr) auto',
            lg: 'max-content minmax(140px, 1fr) minmax(120px, .8fr) auto',
          },
          columnGap: 2.5,
        }}
      >
        {mcpSetupClients.map((client, index) =>
          client === 'opencode' ? (
            <Box
              key="opencode"
              data-testid="application-group-opencode"
              sx={{
                borderTop: index ? '1px solid' : 0,
                borderColor: 'divider',
                display: 'grid',
                gridTemplateColumns: 'subgrid',
                gridColumn: '1 / -1',
                '& > *': { gridColumn: '1 / -1' },
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: 'subgrid', gridAutoRows: '1fr' }}>
                {row('opencode-v2', false)}
                {showV1 && row('opencode', true)}
              </Box>
              <OpenCodeV1Toggle
                expanded={showV1}
                onChange={setShowV1}
                disabled={anyBusy}
                locale={locale}
              />
            </Box>
          ) : (
            row(client, index > 0)
          ),
        )}
      </Paper>
      <Typography variant="body2" color="text.secondary">
        {copy.newApps}
      </Typography>
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
  clients: readonly McpSetupClient[];
  close: () => void;
}

export function useApplicationSetupStartup(
  discovery: ApplicationDiscoveryModel,
): ApplicationStartup {
  const [initialOffers, setInitialOffers] = useState<McpSetupClient[] | null>(null);
  const [closed, setClosed] = useState(false);
  useEffect(() => {
    if (initialOffers !== null) return;
    if (discovery.snapshot) setInitialOffers([...discovery.snapshot.offers]);
    else if (discovery.failed) setInitialOffers([]);
  }, [initialOffers, discovery.snapshot, discovery.failed]);
  const clients = initialOffers ?? discovery.snapshot?.offers ?? [];
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
  snapshot,
  startup,
}: SetupProps & { snapshot?: Pick<Snapshot, 'adapters' | 'agents'>; startup: ApplicationStartup }) {
  const states = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const startupOffers = startup.clients;
  const visibleOffers = startupOffers.join(',');
  const open = startup.open;
  const operationBusy = applicationSetupClients.some((client) =>
    ['preparing', 'rechecking', 'applying'].includes(states[client].phase),
  );
  const saved = applicationSetupClients.some((client) => states[client].phase === 'succeeded');
  const ready = applicationSetupClients.some((client) => hasConnectedClientChat(client, snapshot));
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
        maxWidth="md"
        onClose={close}
        aria-labelledby="application-setup-title"
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.default',
              backgroundImage: 'none',
              m: 3,
              width: 'calc(100% - 48px)',
              maxWidth: 900,
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
            maxWidth: 900,
            mx: 'auto',
            boxSizing: 'border-box',
            flexShrink: 1,
            minHeight: 0,
            overflowY: 'auto',
          }}
          data-testid="application-startup-setup"
        >
          <Box>
            <Typography
              variant="h3"
              component="h1"
              id="application-setup-title"
              sx={{ fontSize: 28, lineHeight: 1.25, mb: 1 }}
            >
              {copy.startupTitle}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: '78ch' }}>
              {ready ? copy.readyHelp : saved ? copy.savedHelp : copy.startupHelp}
            </Typography>
          </Box>
          <ApplicationTiles
            discovery={discovery}
            flow={flow}
            statuses={statuses}
            invoke={invoke}
            locale={locale}
            onManualSetup={manual}
            offers={startupOffers}
            context="startup"
          />
          {operationBusy && (
            <Stack direction="row" spacing={2} role="status" sx={{ alignItems: 'center' }}>
              <CircularProgress size={20} />
              <Typography variant="body2">{copy.connecting}</Typography>
            </Stack>
          )}
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
              maxWidth: 900,
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
              variant={saved || ready ? 'contained' : 'outlined'}
              onClick={close}
              disabled={operationBusy}
              sx={{ flexShrink: 0 }}
            >
              {saved || ready ? copy.continue : copy.later}
            </Button>
          </Stack>
        </Box>
      </Dialog>
      <ApplicationSetupConfirmation flow={flow} locale={locale} />
    </>
  );
}

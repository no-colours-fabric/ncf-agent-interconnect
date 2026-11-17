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
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckOutlined from '@mui/icons-material/CheckOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import type { Snapshot } from '../shared/contracts.js';
import { applicationNames } from '../shared/application-discovery.js';
import { mcpSetupClients, type McpSetupClient, type McpSetupInvoke } from '../shared/mcp-setup.js';
import { ApplicationSetupFlow, type ApplicationSetupState } from './application-setup-model.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import { clientNextStep, hasConnectedClientChat } from './ClientSetupHelp.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import { discoveryMessages } from './i18n/application-discovery.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';
import { t, type Locale } from './i18n/index.js';
import type { McpSetupStatuses } from './mcp-setup-status.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';
import { surfaceSx } from './theme.js';

export const setupApplicationName = (client: McpSetupClient): string =>
  client === 'opencode' ? 'OpenCode v1' : applicationNames[client];

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
  disabled?: boolean;
}

function SetupDetails({ state, locale }: { state: ApplicationSetupState; locale: Locale }) {
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

function NextStep({
  client,
  invoke,
  locale,
  compact,
  onManualSetup,
}: {
  client: McpSetupClient;
  invoke: McpSetupInvoke;
  locale: Locale;
  compact?: boolean;
  onManualSetup?: () => void;
}) {
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const [copyError, setCopyError] = useState(false);
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
        {client === 'claude'
          ? m.claudeNext
          : client === 'aionui'
            ? m.aionNext
            : clientNextStep(client, locale, m)}
      </Typography>
      <Box
        component="code"
        sx={{ ...surfaceSx('inset'), p: 1.5, fontSize: 12, overflowWrap: 'anywhere' }}
      >
        {m.connectionPrompt}
      </Box>
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
  const client = mcpSetupClients.find((item) => states[item].phase === 'confirmation');
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
          {client && <Typography variant="subtitle2">{setupApplicationName(client)}</Typography>}
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

export function ApplicationRows({
  discovery,
  flow,
  statuses,
  invoke,
  locale,
  onManualSetup,
  disabled = false,
}: SetupProps) {
  const states = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const copy = applicationSetupMessages(locale);
  const m = mcpSetupMessages(locale);
  const discoveryCopy = discoveryMessages(locale);
  const [guidanceClient, setGuidanceClient] = useState<McpSetupClient | null>(null);
  const anyBusy = disabled || mcpSetupClients.some((client) => flow.busy(client));
  return (
    <Stack
      spacing={3}
      data-testid="application-setup-list"
      sx={{ '& .MuiButton-root': { minHeight: 44, fontSize: 14 } }}
    >
      <Typography color="text.secondary">{copy.intro}</Typography>
      <Stack
        direction="row"
        sx={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}
      >
        <Box>
          <Typography variant="h5" component="h2" sx={{ mb: 1 }}>
            {copy.yourApps}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {copy.detectionHelp}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshOutlined />}
          disabled={discovery.busy || anyBusy}
          onClick={() => {
            flow.invalidateSucceeded();
            void discovery.refresh();
            void statuses.refreshAll(true);
          }}
          sx={{ flexShrink: 0 }}
        >
          {discoveryCopy.refresh}
        </Button>
      </Stack>
      <Paper sx={{ overflow: 'hidden' }}>
        {mcpSetupClients.map((client, index) => {
          const state = states[client];
          const detected = discovery.snapshot?.applications.some(
            (item) => item.client === client && item.status === 'detected',
          );
          const configured =
            state.phase === 'succeeded' ||
            (!statuses.errors[client] && statuses.statuses[client]?.state === 'configured');
          const busy = flow.busy(client);
          const needsRetry = state.phase === 'failed' || state.phase === 'uncertain';
          return (
            <Box
              key={client}
              data-testid={'application-row-' + client}
              sx={{ px: 3, py: 2.5, borderTop: index ? '1px solid' : 0, borderColor: 'divider' }}
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '44px minmax(0, 1fr)',
                    md: '44px minmax(0, 1fr) auto',
                    lg: '44px minmax(140px, 1fr) minmax(120px, .8fr) auto',
                  },
                  columnGap: 2.5,
                  rowGap: 1,
                  alignItems: 'center',
                }}
              >
                <ClientLogo client={client} size={44} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="subtitle1" component="h3" sx={{ fontWeight: 500 }}>
                    {setupApplicationName(client)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {detected ? copy.detected : copy.automaticUnavailable}
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
                  {configured && <CheckOutlined sx={{ fontSize: 18, color: 'success.main' }} />}
                  <Typography
                    variant="body2"
                    color={configured ? 'success.main' : 'text.secondary'}
                  >
                    {busy
                      ? copy.connecting
                      : configured
                        ? m.configured
                        : statuses.errors[client]
                          ? m.unavailable
                          : statuses.statuses[client]
                            ? m['not-configured']
                            : m.checking}
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
                  {!configured && (detected || needsRetry) && (
                    <Button
                      variant="contained"
                      disabled={
                        anyBusy ||
                        state.phase === 'confirmation' ||
                        (!statuses.statuses[client] && !needsRetry)
                      }
                      onClick={() => {
                        setGuidanceClient(client);
                        void flow.connect(client);
                      }}
                      data-testid={'application-connect-' + client}
                    >
                      {busy ? copy.connecting : needsRetry ? copy.retry : t(locale, 'btnConnect')}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    disabled={anyBusy}
                    onClick={() => onManualSetup(client)}
                  >
                    {copy.manual}
                  </Button>
                </Stack>
              </Box>
              {(state.phase === 'failed' || state.phase === 'uncertain') && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {state.phase === 'uncertain' ? copy.uncertain : copy.failed}
                </Alert>
              )}
              <SetupDetails state={state} locale={locale} />
              {state.phase === 'succeeded' && guidanceClient === client && (
                <NextStep client={client} invoke={invoke} locale={locale} compact />
              )}
            </Box>
          );
        })}
      </Paper>
      <Typography variant="body2" color="text.secondary">
        {copy.newApps}
      </Typography>
    </Stack>
  );
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
  const busy = mcpSetupClients.some((client) => flow.busy(client));
  const saved = mcpSetupClients.some((client) => states[client].phase === 'succeeded');
  const ready = mcpSetupClients.some((client) => hasConnectedClientChat(client, snapshot));
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
    if (!busy) {
      startup.close();
    }
  };
  return (
    <>
      <Dialog
        open={open}
        fullScreen
        onClose={close}
        aria-labelledby="application-setup-title"
        slotProps={{
          paper: {
            sx: {
              bgcolor: 'background.default',
              backgroundImage: 'none',
              m: 0,
              width: '100%',
              height: '100%',
              maxWidth: 'none',
              maxHeight: 'none',
              borderRadius: 0,
              border: 0,
              boxShadow: 'none',
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
            disabled={busy}
            sx={{ width: 44, height: 44 }}
          >
            <CloseOutlined />
          </IconButton>
        </Box>
        <Stack
          ref={setContent}
          spacing={3}
          sx={{
            px: { xs: 3, md: 4 },
            py: 3,
            width: '100%',
            maxWidth: 1180,
            mx: 'auto',
            boxSizing: 'border-box',
            flex: 1,
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
              sx={{ fontSize: 36, lineHeight: 1.2, mb: 2 }}
            >
              {copy.startupTitle}
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: '78ch' }}>
              {ready ? copy.readyHelp : saved ? copy.savedHelp : copy.startupHelp}
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            {mcpSetupClients.map((client) => {
              const state = states[client];
              const detected = discovery.snapshot?.applications.some(
                (app) => app.client === client && app.status === 'detected',
              );
              const configured =
                state.phase === 'succeeded' ||
                (!statuses.errors[client] && statuses.statuses[client]?.state === 'configured');
              const retry = state.phase === 'failed' || state.phase === 'uncertain';
              return (
                <Paper
                  key={client}
                  sx={{ p: 3, minWidth: 0, display: 'flex', flexDirection: 'column' }}
                  data-testid={'startup-application-' + client}
                >
                  <Stack
                    spacing={1.5}
                    data-offer-client={startupOffers.includes(client) ? client : undefined}
                  >
                    <ClientLogo client={client} size={48} />
                    <Typography variant="h6" component="h2">
                      {setupApplicationName(client)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {detected ? copy.detected : copy.automaticUnavailable}
                    </Typography>
                  </Stack>
                  {configured ? (
                    <>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 2, alignItems: 'center', color: 'success.main' }}
                        aria-label={m.statusMcpConfig}
                      >
                        <CheckOutlined sx={{ fontSize: 18 }} />
                        <Typography variant="body2">{m.configured}</Typography>
                      </Stack>
                      <NextStep
                        client={client}
                        invoke={invoke}
                        locale={locale}
                        onManualSetup={() => {
                          close();
                          onManualSetup(client);
                        }}
                      />
                    </>
                  ) : (
                    <Box sx={{ mt: 'auto', pt: 3 }}>
                      {detected || retry ? (
                        <Button
                          fullWidth
                          variant="contained"
                          disabled={
                            busy ||
                            state.phase === 'confirmation' ||
                            (!statuses.statuses[client] && !retry)
                          }
                          onClick={() => void flow.connect(client)}
                        >
                          {flow.busy(client)
                            ? copy.connecting
                            : retry
                              ? copy.retry
                              : t(locale, 'btnConnect')}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            close();
                            onManualSetup(client);
                          }}
                          disabled={busy}
                        >
                          {copy.manual}
                        </Button>
                      )}
                    </Box>
                  )}
                  {(state.phase === 'failed' || state.phase === 'uncertain') && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {state.phase === 'uncertain' ? copy.uncertain : copy.failed}
                    </Alert>
                  )}
                  <SetupDetails state={state} locale={locale} />
                </Paper>
              );
            })}
          </Box>
          {busy && (
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
              maxWidth: 1180,
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
              disabled={busy}
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

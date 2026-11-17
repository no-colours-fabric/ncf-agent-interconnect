import { ApplicationDiscovery, ClientLogo } from './ApplicationDiscovery.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';
import {
  ApplicationRows,
  ApplicationSetupConfirmation,
  useApplicationSetup,
} from './ApplicationSetup.js';
import { applicationSetupClients, type ApplicationSetupFlow } from './application-setup-model.js';
import { OpenCodeV2SetupFlow, openCodeV2TargetKey } from './opencode-v2-setup-model.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineOutlined from '@mui/icons-material/CheckCircleOutlineOutlined';
import RemoveCircleOutlineOutlined from '@mui/icons-material/RemoveCircleOutlineOutlined';
import SyncProblemOutlined from '@mui/icons-material/SyncProblemOutlined';
import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import HelpOutlineOutlined from '@mui/icons-material/HelpOutlineOutlined';
import {
  claudeLaunchCommand,
  mcpSetupClients,
  type McpSetupClient,
  type McpSetupInvoke,
  type McpSetupApplication,
  type McpSetupStatus,
  type McpSetupApplyResult,
} from '../shared/mcp-setup.js';
import type { Snapshot } from '../shared/contracts.js';
import { McpSetupFlow } from './mcp-setup-model.js';
import { mcpSetupEnglish, type McpSetupMessages } from './mcp-setup-messages.js';
import { designTokens, surfaceSx } from './theme.js';
import { ClientApplicationMetrics } from './application-connections.js';
import { useMcpSetupStatuses, type McpSetupStatuses } from './mcp-setup-status.js';
import type { Locale } from './i18n/index.js';

import { AionUiAuthorization } from './AionUiSetup.js';
import { ClientSetupHelp, hasUsableClientSetup } from './ClientSetupHelp.js';

const labels = {
  cursor: 'Cursor',
  opencode: 'OpenCode v1',
  codex: 'Codex',
  aionui: 'AionUi',
  claude: 'Claude Code',
};
const keys = {
  cursor: {
    title: 'cursorTitle',
    description: 'cursorDescription',
    next: 'cursorNext',
    button: 'configureCursor',
  },
  opencode: {
    title: 'opencodeTitle',
    description: 'opencodeDescription',
    next: 'opencodeNext',
    button: 'configureOpencode',
  },
  aionui: {
    title: 'aionMcpTitle',
    description: 'aionMcpHelp',
    next: 'aionNext',
    button: 'aionConfigure',
  },
  codex: {
    title: 'codexTitle',
    description: 'codexDescription',
    next: 'codexNext',
    button: 'configureCodex',
  },
  claude: {
    title: 'claudeTitle',
    description: 'claudeDescription',
    next: 'claudeNext',
    button: 'configureClaude',
  },
} as const;
function SetupErrorNote({
  summary,
  error,
  locale,
  severity = 'error',
}: {
  summary: string;
  error: string;
  locale: Locale;
  severity?: 'error' | 'warning';
}): React.JSX.Element {
  const copy = applicationSetupMessages(locale);
  return (
    <Stack spacing={1}>
      <Alert severity={severity}>{summary}</Alert>
      <Box component="details">
        <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
          {copy.details}
        </Box>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
          {error}
        </Typography>
      </Box>
    </Stack>
  );
}

function SetupFormContainer({
  inline,
  client,
  open,
  onClose,
  children,
}: {
  inline?: boolean;
  client: McpSetupClient;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return inline ? (
    <Paper
      id={'mcp-setup-form-' + client}
      sx={{ mt: 3 }}
      aria-labelledby={'mcp-setup-title-' + client}
    >
      {children}
    </Paper>
  ) : (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={'mcp-setup-title-' + client}
      slotProps={{
        paper: {
          sx: {
            width: 640,
            maxWidth: 'calc(100% - 48px)',
            height:
              client === 'opencode'
                ? 'min(660px, calc(100dvh - 64px))'
                : 'min(520px, calc(100dvh - 64px))',
          },
        },
      }}
    >
      {children}
    </Dialog>
  );
}

interface DialogProps {
  invoke: McpSetupInvoke;
  messages: McpSetupMessages;
  inline?: boolean;
  flow?: McpSetupFlow;
  onCloseManual?: () => void;
  setupBusy?: boolean;
  snapshot?: Pick<Snapshot, 'adapters' | 'agents'>;
  locale?: Locale;
  onApplied?: () => Promise<void>;
  check?: { status?: McpSetupStatus; error?: string };
  aionUiComplete?: boolean;
  registerConfigureMcp?: (action: () => void) => void;
}

function ClientSetupDialog({
  client,
  invoke,
  messages: m,
  before,
  snapshot,
  locale = 'en',
  onApplied,
  check,
  aionUiComplete,
  registerConfigureMcp,
  inline,
  flow: providedFlow,
  onCloseManual,
  setupBusy,
}: DialogProps & { client: McpSetupClient; before?: React.ReactNode }): React.JSX.Element {
  const flow = useMemo(
    () => providedFlow ?? new McpSetupFlow(client, invoke),
    [client, invoke, providedFlow],
  );
  const copy = applicationSetupMessages(locale);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const result: McpSetupApplyResult | undefined =
    state.result ?? (state.verified ? { status: 'unchanged', files: [] } : undefined);
  const checkingOriginalResult =
    !!state.uncertain && !result && state.preview?.planId === state.uncertain.preview.planId;
  useEffect(() => {
    registerConfigureMcp?.(() => {
      void flow.begin();
      if (inline)
        document
          .getElementById('mcp-setup-form-' + client)
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }, [flow, registerConfigureMcp, inline, client]);
  useEffect(() => {
    void flow.refreshStatus();
    return () => {
      if (!providedFlow) flow.dispose();
    };
  }, [flow, providedFlow]);
  useEffect(() => {
    if (inline) void flow.begin();
  }, [flow, inline]);
  useEffect(() => setReplaceConfirmed(false), [state.preview?.planId]);
  useEffect(() => {
    if (
      !state.open ||
      state.busy ||
      state.preview ||
      result ||
      state.error ||
      !state.files.length ||
      state.files.some((file) => !file.path.trim())
    )
      return;
    const timer = setTimeout(() => void flow.review(), 300);
    return () => clearTimeout(timer);
  }, [flow, state]);
  const k = keys[client];
  const description = client === 'opencode' ? copy.openCodeV1Description : m[k.description];
  const status = state.status;
  const shownState = check ? (check.error ? 'unavailable' : check.status?.state) : status?.state;
  const hasConfiguration = shownState === 'configured' || shownState === 'needs-update';
  const sharedCursorConfiguration = client === 'cursor' || client === 'aionui';
  const canOpen =
    !!status?.files[0]?.path &&
    !!shownState &&
    shownState !== 'missing' &&
    shownState !== 'unavailable';
  const openHint = !shownState
    ? m.checking
    : shownState === 'missing'
      ? m.openFileMissing
      : shownState === 'unavailable'
        ? m.unavailable
        : m.openFile;
  return (
    <>
      <Stack
        spacing={3}
        sx={{ pt: 3 }}
        data-testid={client === 'aionui' ? 'aionui-setup' : undefined}
      >
        <Stack
          direction="row"
          spacing={2}
          useFlexGap
          sx={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 280px' }}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <ClientLogo client={client} size={44} />
              <Typography variant="h5" component="h2">
                {client === 'aionui' ? copy.aionUiName : labels[client]}
              </Typography>
            </Stack>
          </Box>
          {client !== 'aionui' && !hasConfiguration && (
            <Chip
              variant="outlined"
              size="small"
              label={shownState ? m[shownState] : m.checking}
              icon={
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'text.disabled',
                    boxShadow: 'none',
                  }}
                />
              }
              data-testid={shownState ? 'mcp-settings-status' : undefined}
              sx={{
                flexShrink: 0,
                maxWidth: '100%',
                color: 'text.secondary',
                border: 0,
                bgcolor: 'transparent',
                boxShadow: 'none',
                '& .MuiChip-icon': { ml: 0, mr: 1 },
                '& .MuiChip-label': { pl: 0, pr: 0 },
              }}
            />
          )}
        </Stack>
        {hasUsableClientSetup(
          client,
          check?.status ?? status,
          check?.error,
          snapshot,
          aionUiComplete,
        ) && <ClientSetupHelp client={client} locale={locale} messages={m} />}
        {client === 'aionui' ? (
          <Paper
            sx={{ ...surfaceSx('soft'), p: 2.5 }}
            data-testid={aionUiComplete ? 'aionui-complete-panel' : 'aionui-setup-panel'}
          >
            <Stack spacing={2}>
              {!aionUiComplete && (
                <Typography variant="body2" data-testid="client-setup-description">
                  {m.aionContinue}
                </Typography>
              )}
              {before}
            </Stack>
          </Paper>
        ) : hasConfiguration ? (
          <Paper
            sx={{ ...surfaceSx('soft'), p: 2.5 }}
            data-testid="client-status-panel"
            data-client={client}
            data-status={shownState}
          >
            <Stack spacing={2}>
              <Typography variant="subtitle2" component="h3">
                {m.statusTitle}
              </Typography>
              <Box
                component="dl"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    lg: 'repeat(4, minmax(0, 1fr))',
                  },
                  columnGap: 3,
                  rowGap: 2,
                  m: 0,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    component="dt"
                    variant="caption"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    {client === 'opencode' || client === 'cursor' || client === 'claude'
                      ? m.statusOpencodeConfig
                      : m.statusMcpConfig}
                  </Typography>
                  <Stack
                    component="dd"
                    direction="row"
                    spacing={1}
                    sx={{ m: 0, alignItems: 'flex-start' }}
                  >
                    <McpSetupStatusIcon status={check?.status ?? status} messages={m} />
                    <Typography variant="body2" component="span" data-testid="mcp-settings-status">
                      {m[shownState]}
                    </Typography>
                  </Stack>
                </Box>
                <ClientApplicationMetrics
                  kind={
                    client === 'cursor'
                      ? 'cursor-hook'
                      : client === 'opencode'
                        ? 'opencode-http'
                        : client === 'codex'
                          ? 'codex-desktop'
                          : client === 'claude'
                            ? 'claude-code'
                            : 'aionui'
                  }
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
              {client === 'cursor' && (
                <Typography variant="caption" color="text.secondary">
                  {m.statusCursorMetricsHint}
                </Typography>
              )}
              {before && (
                <>
                  <Divider />
                  {before}
                </>
              )}
            </Stack>
          </Paper>
        ) : (
          <>
            {!inline && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ maxWidth: '76ch', lineHeight: 1.65 }}
                data-testid="client-setup-description"
              >
                {shownState === 'missing' || shownState === 'not-configured'
                  ? description
                  : shownState === 'unavailable'
                    ? m.unavailable
                    : m.checking}
              </Typography>
            )}
            {before}
          </>
        )}
        {!inline && (
          <Paper sx={{ ...surfaceSx('raised'), p: 3 }}>
            <Box sx={{ ...surfaceSx('inset'), p: 1.75 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                <DescriptionOutlined
                  sx={{ mt: 0.25, color: 'text.secondary', fontSize: 20, flexShrink: 0 }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    {sharedCursorConfiguration ? m.cursorSharedConfiguration : m.pathLabel}
                  </Typography>
                  {status?.files.map((file) => (
                    <Box key={file.id}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                          fontSize: 13,
                          lineHeight: 1.7,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {file.path}
                      </Typography>
                      {file.error && (
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                          {file.error}
                        </Typography>
                      )}
                    </Box>
                  ))}
                  {!status && (
                    <Typography variant="body2" color="text.secondary">
                      {m.checking}
                    </Typography>
                  )}
                  {status?.state === 'missing' && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1 }}
                    >
                      {m.openFileMissing}
                    </Typography>
                  )}
                </Box>
                <Tooltip title={openHint}>
                  <Box component="span" sx={{ display: 'inline-flex', flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      color="secondary"
                      aria-label={m.openFile}
                      disabled={!canOpen}
                      data-testid="mcp-open-file"
                      onClick={() => void flow.openFile()}
                    >
                      <OpenInNewOutlined fontSize="small" />
                    </IconButton>
                  </Box>
                </Tooltip>
              </Stack>
            </Box>
            {sharedCursorConfiguration && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5, lineHeight: 1.65 }}
                data-testid="mcp-shared-configuration-note"
              >
                {m.aionMcpHelp}
              </Typography>
            )}
            <Box
              sx={{
                mt: 2.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2.5,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ flex: '1 1 280px', maxWidth: '52ch', lineHeight: 1.65, fontSize: 12 }}
              >
                {m.userControl}
              </Typography>
              <Button
                variant="contained"
                onClick={() => void flow.begin()}
                data-testid={'mcp-configure-' + client}
                sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              >
                {m[k.button]}
              </Button>
            </Box>
          </Paper>
        )}
        {state.error && !state.open && (
          <SetupErrorNote summary={m.unavailable} error={state.error} locale={locale} />
        )}
        {check?.error && check.error !== state.error && (
          <SetupErrorNote summary={m.unavailable} error={check.error} locale={locale} />
        )}
      </Stack>
      <SetupFormContainer
        inline={inline}
        client={client}
        open={state.open}
        onClose={() => flow.cancel()}
      >
        <DialogTitle id={'mcp-setup-title-' + client}>
          {m[k.title]}
          {client === 'opencode' ? ' v1' : ''}
        </DialogTitle>
        <DialogContent sx={{ scrollbarGutter: 'stable' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {client !== 'aionui' && <Typography>{description}</Typography>}
            {state.files.map((file) => {
              const checked = state.preview?.files.find((item) => item.id === file.id);
              return (
                <Stack key={file.id} spacing={1.5}>
                  <TextField
                    fullWidth
                    label={m.pathLabel}
                    value={file.path}
                    disabled={state.busy || !!result}
                    onChange={(event) => flow.setPath(file.id, event.target.value)}
                    helperText={m.pathHint}
                    slotProps={{
                      htmlInput: { spellCheck: false, 'data-testid': 'mcp-path-' + file.id },
                    }}
                  />
                  {sharedCursorConfiguration && (
                    <Alert
                      severity="info"
                      data-testid={
                        client === 'aionui'
                          ? 'aionui-global-cursor-warning'
                          : 'cursor-shared-configuration-note'
                      }
                    >
                      {m.aionMcpHelp}
                    </Alert>
                  )}
                  <Box>
                    <Button
                      variant="outlined"
                      disabled={state.busy || !!result}
                      onClick={() => void flow.browse(file.id)}
                    >
                      {m.browse}
                    </Button>
                    {inline && (
                      <Button
                        startIcon={<OpenInNewOutlined />}
                        disabled={
                          !canOpen ||
                          file.path !== status?.files.find((item) => item.id === file.id)?.path
                        }
                        onClick={() => void flow.openFile()}
                        sx={{ ml: 1.5 }}
                      >
                        {m.openFile}
                      </Button>
                    )}
                  </Box>
                  {file.alternatives.length > 1 && !result && (
                    <Box>
                      <Typography variant="caption">{m.knownPaths}</Typography>
                      {file.alternatives.map((location) => (
                        <Tooltip key={location} title={location}>
                          <Box component="span" sx={{ display: 'block', minWidth: 0 }}>
                            <Button
                              size="small"
                              disabled={state.busy}
                              onClick={() => flow.setPath(file.id, location)}
                              sx={{
                                display: 'flex',
                                justifyContent: 'flex-start',
                                maxWidth: '100%',
                                width: '100%',
                                overflow: 'hidden',
                              }}
                            >
                              <Typography
                                component="span"
                                variant="caption"
                                noWrap
                                sx={{ fontFamily: 'monospace', color: 'secondary.main' }}
                              >
                                {location}
                              </Typography>
                            </Button>
                          </Box>
                        </Tooltip>
                      ))}
                    </Box>
                  )}
                  <Box sx={{ minHeight: '3em' }}>
                    {checked && !result && (
                      <Typography variant="body2">{m[checked.action]}</Typography>
                    )}
                  </Box>
                </Stack>
              );
            })}
            {(state.preview?.requiresReplacement || state.reviewRequired) && !result && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={replaceConfirmed}
                    onChange={(_event, checked) => setReplaceConfirmed(checked)}
                  />
                }
                label={state.reviewRequired ? copy.reviewHelp : copy.confirmHelp}
              />
            )}
            {checkingOriginalResult ? (
              <SetupErrorNote
                summary={copy.uncertain}
                error={
                  state.error && state.error !== state.uncertain!.error
                    ? state.uncertain!.error + '\n' + state.error
                    : state.uncertain!.error
                }
                locale={locale}
                severity="warning"
              />
            ) : (
              state.error && (
                <SetupErrorNote summary={m.failed} error={state.error} locale={locale} />
              )
            )}
            {state.uncertain && !checkingOriginalResult && (
              <Box component="details">
                <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
                  {copy.details}
                </Box>
                <Typography variant="body2">{copy.uncertain}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {state.uncertain.error}
                </Typography>
              </Box>
            )}
            {result && (
              <>
                <Alert severity={result.status === 'failed' ? 'error' : 'success'}>
                  {result.status === 'failed'
                    ? m.failed
                    : result.status === 'unchanged'
                      ? m.noChanges
                      : m.applied}
                </Alert>
                {result.error && (
                  <Typography variant="body2" color="error">
                    {result.error}
                  </Typography>
                )}
                {result.warning && <Alert severity="warning">{result.warning}</Alert>}
                {result.status === 'failed' &&
                  result.files.map((file) => (
                    <Box key={file.path} sx={{ overflowWrap: 'anywhere' }}>
                      <Typography variant="body2">{file.path}</Typography>
                      {file.backupPath && (
                        <Typography variant="body2">
                          {m.backup}: {file.backupPath}
                        </Typography>
                      )}
                    </Box>
                  ))}
                {result.status !== 'failed' && <Typography>{m[k.next]}</Typography>}
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ minHeight: 56, gap: 1, flexShrink: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flex: 1, minWidth: 0, height: 24, alignItems: 'center' }}
            role="status"
            aria-live="polite"
            data-testid="mcp-setup-progress"
            data-busy={state.busy ? 'true' : 'false'}
          >
            <Box sx={{ width: 20, height: 20, flexShrink: 0 }}>
              {state.busy && <CircularProgress size={20} />}
            </Box>
            <Typography variant="body2" noWrap>
              {state.busy ? m.checking : ''}
            </Typography>
          </Stack>
          <Button
            disabled={state.busy}
            onClick={() => {
              flow.cancel();
              if (inline) onCloseManual?.();
            }}
          >
            {result ? m.close : m.cancel}
          </Button>
          {!result && (
            <Button
              data-testid="mcp-apply"
              variant="contained"
              disabled={
                state.busy ||
                setupBusy ||
                !state.preview ||
                ((state.preview.requiresReplacement || state.reviewRequired) && !replaceConfirmed)
              }
              onClick={() =>
                void flow.apply(replaceConfirmed).then(() => {
                  void onApplied?.();
                })
              }
            >
              {checkingOriginalResult ? copy.checkSetupResult : m.apply}
            </Button>
          )}
        </DialogActions>
      </SetupFormContainer>
    </>
  );
}
export function CursorSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="cursor" />;
}
export function OpenCodeSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="opencode" />;
}

export function OpenCodeV2SetupDialog({
  flow,
  messages: m,
  locale,
  onClose,
  setupBusy = false,
}: {
  flow: OpenCodeV2SetupFlow;
  messages: McpSetupMessages;
  locale: Locale;
  onClose: () => void;
  setupBusy?: boolean;
}): React.JSX.Element {
  const copy = applicationSetupMessages(locale);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const [confirmed, setConfirmed] = useState(false);
  const busy = flow.busy() || state.checking;
  const target = state.target;
  const status =
    state.status &&
    target &&
    openCodeV2TargetKey(state.status.target) === openCodeV2TargetKey(target)
      ? state.status
      : undefined;
  const checkingOriginal = flow.checkingOriginal();
  const completed = state.phase === 'succeeded' || state.verified;
  useEffect(() => {
    void flow.beginManual();
  }, [flow]);
  useEffect(() => setConfirmed(false), [state.preview?.planId]);
  useEffect(() => {
    if (
      !state.open ||
      busy ||
      state.preview ||
      completed ||
      state.error ||
      !target?.configurationPath.trim()
    )
      return;
    const timer = setTimeout(() => void flow.review(), 300);
    return () => clearTimeout(timer);
  }, [flow, state, busy, completed, target]);
  return (
    <Stack spacing={3} sx={{ pt: 3 }} data-testid="opencode-v2-manual">
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <ClientLogo client="opencode" size={44} />
        <Typography component="h2" variant="h5">
          OpenCode v2
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {copy.openCodeV2Description}
      </Typography>
      {status && (
        <Typography
          variant="body2"
          color="text.secondary"
          data-testid="opencode-v2-settings-status"
        >
          {m[status.state]}
        </Typography>
      )}
      {(status?.state === 'configured' || completed) && (
        <ClientSetupHelp client="opencode" openCodeMajor={2} locale={locale} messages={m} />
      )}
      <Paper id="mcp-setup-form-opencode-v2" aria-labelledby="mcp-setup-title-opencode-v2">
        <DialogTitle id="mcp-setup-title-opencode-v2">{m.opencodeTitle} v2</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {target && (
              <>
                <TextField
                  fullWidth
                  label={m.pathLabel}
                  value={target.configurationPath}
                  onChange={(event) => flow.setConfigurationPath(event.target.value)}
                  disabled={busy || completed}
                  helperText={m.pathHint}
                  slotProps={{
                    htmlInput: {
                      spellCheck: false,
                      'data-testid': 'opencode-v2-configuration-path',
                    },
                  }}
                />
                <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    disabled={busy || completed || setupBusy}
                    onClick={() => void flow.browse()}
                  >
                    {m.browse}
                  </Button>
                  <Button
                    startIcon={<OpenInNewOutlined />}
                    disabled={busy || !status || ['missing', 'unavailable'].includes(status.state)}
                    onClick={() => void flow.openFile()}
                  >
                    {m.openFile}
                  </Button>
                </Stack>
                <Box component="details" sx={{ overflowWrap: 'anywhere' }}>
                  <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
                    {copy.details}
                  </Box>
                  <Typography variant="caption">{copy.openCodeProfile}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {target.profilePath}
                  </Typography>
                  {target.installationPath && (
                    <>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1.5 }}>
                        {copy.selectedInstallation}
                      </Typography>
                      <Typography variant="body2">{target.installationPath}</Typography>
                    </>
                  )}
                </Box>
                {!completed && state.alternatives.length > 1 && (
                  <Box>
                    <Typography variant="caption">{m.knownPaths}</Typography>
                    {state.alternatives.map((path) => (
                      <Button
                        key={path}
                        disabled={busy || setupBusy}
                        onClick={() => flow.setConfigurationPath(path)}
                        sx={{
                          display: 'block',
                          textAlign: 'left',
                          overflowWrap: 'anywhere',
                          maxWidth: '100%',
                        }}
                      >
                        {path}
                      </Button>
                    ))}
                  </Box>
                )}
              </>
            )}
            {state.preview && !completed && (
              <Box>
                {state.preview.files.map((file) => (
                  <Box key={file.id} sx={{ overflowWrap: 'anywhere' }}>
                    <Typography variant="body2">{m[file.action]}</Typography>
                    {file.backupPath && (
                      <Typography variant="body2">
                        {m.backup}: {file.backupPath}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            )}
            {!completed &&
              !checkingOriginal &&
              (state.preview?.requiresReplacement || state.reviewRequired) && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={confirmed}
                      onChange={(_event, value) => setConfirmed(value)}
                    />
                  }
                  label={state.reviewRequired ? copy.reviewHelp : copy.confirmHelp}
                />
              )}
            {checkingOriginal ? (
              <SetupErrorNote
                summary={copy.uncertain}
                error={state.unconfirmed!.error}
                locale={locale}
                severity="warning"
              />
            ) : (
              state.error && (
                <SetupErrorNote
                  summary={state.phase === 'failed' ? copy.failed : m.unavailable}
                  error={state.error}
                  locale={locale}
                />
              )
            )}
            {state.uncertain && !checkingOriginal && (
              <Box component="details">
                <Box component="summary" sx={{ cursor: 'pointer', py: 1 }}>
                  {copy.details}
                </Box>
                <Typography variant="body2">{copy.uncertain}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {state.uncertain.target.configurationPath}
                </Typography>
                <Typography variant="body2">{state.uncertain.error}</Typography>
              </Box>
            )}
            {(state.result ?? state.failedWrite)?.files.map((file) => (
              <Box key={file.path} sx={{ overflowWrap: 'anywhere' }}>
                {file.backupPath && (
                  <Typography variant="body2">
                    {m.backup}: {file.backupPath}
                  </Typography>
                )}
                {file.error && <Typography variant="body2">{file.error}</Typography>}
              </Box>
            ))}
            {state.result?.warning && <Alert severity="warning">{state.result.warning}</Alert>}
            {completed && (
              <>
                <Alert severity="success">
                  {state.verified || state.result?.status === 'unchanged' ? m.noChanges : m.applied}
                </Alert>
                <Typography>{copy.openCodeV2Next}</Typography>
              </>
            )}
            {state.availability === 'unavailable' && !state.error && (
              <Typography color="text.secondary">{m.unavailable}</Typography>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ minHeight: 56, gap: 1, flexWrap: 'wrap' }}>
          <Stack
            direction="row"
            spacing={1}
            role="status"
            aria-live="polite"
            sx={{ flex: 1, alignItems: 'center' }}
          >
            {busy && (
              <>
                <CircularProgress size={20} />
                <Typography variant="body2">{m.checking}</Typography>
              </>
            )}
          </Stack>
          <Button
            disabled={flow.busy()}
            onClick={() => {
              flow.cancel();
              onClose();
            }}
          >
            {completed ? m.close : m.cancel}
          </Button>
          {!completed && (state.phase === 'failed' || state.availability === 'unavailable') ? (
            <Button disabled={busy || setupBusy} onClick={() => void flow.beginManual()}>
              {copy.retry}
            </Button>
          ) : (
            !completed && (
              <Button
                variant="contained"
                data-testid="opencode-v2-apply"
                disabled={
                  busy ||
                  setupBusy ||
                  !state.preview ||
                  (!checkingOriginal &&
                    !!(state.preview.requiresReplacement || state.reviewRequired) &&
                    !confirmed)
                }
                onClick={() => {
                  if (checkingOriginal) void flow.checkResult();
                  else void flow.apply(confirmed);
                }}
              >
                {checkingOriginal ? copy.checkSetupResult : m.apply}
              </Button>
            )
          )}
        </DialogActions>
      </Paper>
    </Stack>
  );
}
export function CodexSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="codex" />;
}

export function ClaudeSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="claude" />;
}

export function AionUiSetupDialog(props: DialogProps): React.JSX.Element {
  const configureMcp = React.useRef<() => void>(() => {});
  const registerConfigureMcp = React.useCallback((action: () => void) => {
    configureMcp.current = action;
  }, []);
  return (
    <AionUiAuthorization
      invoke={props.invoke}
      messages={props.messages}
      mcpState={props.check?.error ? 'unavailable' : props.check?.status?.state}
      onConfigureMcp={() => configureMcp.current()}
      renderContent={(authorization, complete) => (
        <ClientSetupDialog
          {...props}
          client="aionui"
          before={authorization}
          aionUiComplete={complete}
          registerConfigureMcp={registerConfigureMcp}
        />
      )}
    />
  );
}

export function McpSetupStatusIcon({
  status,
  error,
  messages: m,
}: {
  status?: McpSetupStatus;
  error?: string;
  messages: McpSetupMessages;
}): React.JSX.Element {
  const state = error ? 'unavailable' : status?.state;
  const Icon =
    state === 'configured'
      ? CheckCircleOutlineOutlined
      : state === 'needs-update'
        ? SyncProblemOutlined
        : state === 'unavailable'
          ? ErrorOutlineOutlined
          : state
            ? RemoveCircleOutlineOutlined
            : HelpOutlineOutlined;
  return (
    <Tooltip title={state ? m[state] : m.checking}>
      <Box
        component="span"
        data-mcp-state={state ?? 'unknown'}
        aria-hidden="true"
        sx={{
          display: 'inline-flex',
          color:
            state === 'configured'
              ? 'success.main'
              : state === 'needs-update'
                ? 'warning.main'
                : state === 'unavailable'
                  ? 'error.main'
                  : 'text.disabled',
        }}
      >
        <Icon sx={{ fontSize: 18 }} />
      </Box>
    </Tooltip>
  );
}

function CopyCommand({
  title,
  text,
  copyLabel,
  invoke,
  testId,
  locale = 'en',
}: {
  title: string;
  text: string;
  copyLabel: string;
  invoke: McpSetupInvoke;
  testId: string;
  locale?: Locale;
}): React.JSX.Element {
  const [error, setError] = React.useState('');
  return (
    <Stack spacing={1.5} sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography variant="subtitle2" component="h3">
        {title}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Box
          component="code"
          data-testid={testId}
          sx={{
            minWidth: 0,
            px: 1.25,
            py: 0.75,
            borderRadius: 0.5,
            bgcolor: 'action.hover',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            fontSize: 14,
            lineHeight: 1.6,
            overflowWrap: 'anywhere',
          }}
        >
          {text}
        </Box>
        <Tooltip title={copyLabel}>
          <IconButton
            size="small"
            aria-label={copyLabel}
            sx={{ flexShrink: 0 }}
            onClick={() =>
              void invoke('copy', { text }).catch((reason) => setError((reason as Error).message))
            }
          >
            <ContentCopyOutlined fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      {error && (
        <SetupErrorNote
          summary={applicationSetupMessages(locale).copyFailed}
          error={error}
          locale={locale}
        />
      )}
    </Stack>
  );
}

export function McpSetup({
  discovery,
  client,
  onClientChange,
  invoke,
  messages,
  snapshot,
  locale = 'en',
  setupStatuses,
  setupFlow,
  manualClient,
  onCloseManual,
}: {
  discovery?: ApplicationDiscoveryModel;
  client: McpSetupApplication;
  onClientChange: (client: McpSetupApplication) => void;
  invoke: McpSetupInvoke;
  messages?: Partial<McpSetupMessages>;
  snapshot?: Pick<Snapshot, 'adapters' | 'agents'>;
  locale?: Locale;
  setupStatuses?: McpSetupStatuses;
  setupFlow?: ApplicationSetupFlow;
  manualClient?: McpSetupClient | null;
  onCloseManual?: () => void;
}): React.JSX.Element {
  const [selectedManual, setSelectedManual] = useState<McpSetupClient | null>(manualClient ?? null);
  const activeManualClient = manualClient === undefined ? selectedManual : manualClient;
  const selectedClient = activeManualClient ?? client;
  const m = { ...mcpSetupEnglish, ...messages };
  const SetupDialog = {
    cursor: CursorSetupDialog,
    opencode: OpenCodeSetupDialog,
    codex: CodexSetupDialog,
    aionui: AionUiSetupDialog,
    claude: ClaudeSetupDialog,
  }[selectedClient];
  const [copyError, setCopyError] = React.useState('');
  const ownStatuses = useMcpSetupStatuses(invoke, !setupStatuses);
  const checks = setupStatuses ?? ownStatuses;
  const autoFlow = useApplicationSetup(invoke, () => checks.refreshAll(true), setupFlow);
  const manualFlows = useMemo(
    () =>
      Object.fromEntries(
        mcpSetupClients.map((item) => [item, new McpSetupFlow(item, invoke)]),
      ) as Record<McpSetupClient, McpSetupFlow>,
    [invoke],
  );
  const activeManual = useSyncExternalStore(
    manualFlows[selectedClient].subscribe,
    manualFlows[selectedClient].getSnapshot,
    manualFlows[selectedClient].getSnapshot,
  );
  const quickStates = useSyncExternalStore(
    autoFlow.subscribe,
    autoFlow.getSnapshot,
    autoFlow.getSnapshot,
  );
  const quickBusy = applicationSetupClients.some((item) =>
    ['preparing', 'rechecking', 'applying'].includes(quickStates[item].phase),
  );
  const showOpenCodeV2 =
    selectedClient === 'opencode' && quickStates['opencode-v2'].manualMajor === 2;
  useEffect(
    () => () => {
      for (const item of mcpSetupClients) manualFlows[item].dispose();
    },
    [manualFlows],
  );
  const copy = applicationSetupMessages(locale);
  const closeManual = () => {
    if (showOpenCodeV2) autoFlow.openCodeV2.cancel();
    setSelectedManual(null);
    onCloseManual?.();
  };
  const refreshShared = setupStatuses?.refreshAll;
  useEffect(() => {
    if (refreshShared) void refreshShared();
  }, [refreshShared]);
  return (
    <Box
      sx={{
        minWidth: 0,
        '& .MuiButton-root': { minHeight: 44, fontSize: 14 },
        '& .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
      }}
    >
      {!activeManualClient && discovery ? (
        <ApplicationRows
          discovery={discovery}
          flow={autoFlow}
          statuses={checks}
          invoke={invoke}
          disabled={activeManual.busy}
          locale={locale}
          onManualSetup={(item) => {
            onClientChange(item);
            setSelectedManual(item);
          }}
        />
      ) : (
        <>
          <Button
            startIcon={<ArrowBackOutlined />}
            onClick={closeManual}
            disabled={activeManual.busy || quickBusy}
            sx={{ mb: 2 }}
          >
            {copy.back}
          </Button>
          <Stack spacing={0}>
            {showOpenCodeV2 ? (
              <OpenCodeV2SetupDialog
                flow={autoFlow.openCodeV2}
                messages={m}
                locale={locale}
                onClose={closeManual}
                setupBusy={activeManual.busy || mcpSetupClients.some((item) => autoFlow.busy(item))}
              />
            ) : (
              <SetupDialog
                key={selectedClient}
                inline
                flow={manualFlows[selectedClient]}
                setupBusy={quickBusy}
                onCloseManual={closeManual}
                invoke={invoke}
                messages={m}
                onApplied={() => {
                  autoFlow.invalidateSucceeded(selectedClient);
                  return checks.refreshAll(true);
                }}
                check={{
                  status: checks.statuses[selectedClient],
                  error: checks.errors[selectedClient],
                }}
                snapshot={snapshot}
                locale={locale}
              />
            )}
            {selectedClient === 'claude' && (
              <Box sx={{ mt: 3 }}>
                <CopyCommand
                  title={m.claudeLaunch}
                  text={claudeLaunchCommand}
                  copyLabel={m.copyLaunch}
                  invoke={invoke}
                  testId="claude-launch-command"
                  locale={locale}
                />
              </Box>
            )}
            <Divider sx={{ mt: 2 }} />
            <Stack spacing={1} sx={{ pt: 2 }}>
              <Typography variant="subtitle2" component="h3">
                {m.connect}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Box
                  component="code"
                  sx={{
                    minWidth: 0,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {m.connectionPrompt}
                </Box>
                <Tooltip title={m.copyPrompt}>
                  <IconButton
                    size="small"
                    aria-label={m.copyPrompt}
                    sx={{ flexShrink: 0 }}
                    onClick={() =>
                      void invoke('copy', { text: m.connectionPrompt }).catch((error) =>
                        setCopyError((error as Error).message),
                      )
                    }
                  >
                    <ContentCopyOutlined fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              {copyError && (
                <SetupErrorNote summary={copy.copyFailed} error={copyError} locale={locale} />
              )}
            </Stack>
          </Stack>
          {discovery && (
            <Box sx={{ mt: 3 }}>
              <ApplicationDiscovery model={discovery} locale={locale} client={selectedClient} />
            </Box>
          )}
        </>
      )}
      {!setupFlow && <ApplicationSetupConfirmation flow={autoFlow} locale={locale} />}
    </Box>
  );
}

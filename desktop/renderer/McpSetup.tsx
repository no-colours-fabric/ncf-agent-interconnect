import { DesktopSessionDeliveryControl } from './DesktopSessionDeliveryControl.js';
import { configurationProfile, type DeliveryIssue } from '../shared/desktop-session-delivery.js';
import { DesktopSessionDeliveryModel } from './desktop-session-delivery-model.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';
import {
  ApplicationRows,
  ApplicationSetupConfirmation,
  ClaudePermissionChanges,
  OpenCodePermissionPreview,
  useApplicationSetup,
} from './ApplicationSetup.js';
import { applicationSetupClients, type ApplicationSetupFlow } from './application-setup-model.js';
import { OpenCodeV2SetupFlow, openCodeV2TargetKey } from './opencode-v2-setup-model.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import React, { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Autocomplete,
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
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackOutlined from '@mui/icons-material/ArrowBackOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import {
  mcpSetupClients,
  type McpSetupClient,
  type McpSetupInvoke,
  type McpSetupApplication,
  type McpSetupFileStatus,
  type McpSetupStatus,
  type McpSetupApplyResult,
} from '../shared/mcp-setup.js';
import type { Snapshot } from '../shared/contracts.js';
import { McpSetupFlow } from './mcp-setup-model.js';
import { mcpSetupEnglish, type McpSetupMessages } from './mcp-setup-messages.js';
import { designTokens, surfaceSx } from './theme.js';
import { useMcpSetupStatuses, type McpSetupStatuses } from './mcp-setup-status.js';
import type { Locale } from './i18n/index.js';

import { AionUiAuthorization } from './AionUiSetup.js';
import { ClientSetupHelp, hasUsableClientSetup } from './ClientSetupHelp.js';

const labels = {
  cursor: 'Cursor',
  opencode: 'OpenCode v1',
  codex: 'ChatGPT',
  aionui: 'AionUi',
  claude: 'Claude Code',
};
const keys = {
  cursor: {
    title: 'cursorTitle',
    next: 'cursorNext',
    button: 'configureCursor',
  },
  opencode: {
    title: 'opencodeTitle',
    next: 'opencodeNext',
    button: 'configureOpencode',
  },
  aionui: {
    title: 'aionMcpTitle',
    next: 'aionNext',
    button: 'aionConfigure',
  },
  codex: {
    title: 'codexTitle',
    next: 'codexNext',
    button: 'configureCodex',
  },
  claude: {
    title: 'claudeTitle',
    next: 'claudeNext',
    button: 'configureClaude',
  },
} as const;

type SetupSuccess = Exclude<McpSetupApplyResult['status'], 'failed'>;

function ConfigurationPathField({
  path,
  locations,
  disabled,
  browseDisabled,
  openDisabled,
  testId,
  messages: m,
  onPathChange,
  onBrowse,
  onOpen,
}: {
  path: string;
  locations: readonly string[];
  disabled: boolean;
  browseDisabled: boolean;
  openDisabled: boolean;
  testId: string;
  messages: McpSetupMessages;
  onPathChange: (path: string) => void;
  onBrowse: () => void;
  onOpen: () => void;
}): React.JSX.Element {
  const hintId = useId();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'max-content minmax(0, 1fr) 44px',
        columnGap: 1.5,
        rowGap: 1,
        alignItems: 'center',
      }}
    >
      <Typography
        id={hintId}
        component="p"
        variant="body2"
        color="text.secondary"
        sx={{ gridColumn: '1 / -1', m: 0 }}
      >
        {m.pathHint}
      </Typography>
      <Button
        type="button"
        variant="outlined"
        startIcon={<FolderOpenOutlined />}
        aria-label={m.browse}
        disabled={browseDisabled}
        onClick={onBrowse}
        sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
      >
        {m.browseShort}
      </Button>
      <Autocomplete
        freeSolo
        disableClearable
        size="small"
        forcePopupIcon={locations.length > 0}
        openText={m.knownPaths}
        closeText={m.close}
        options={locations}
        value={path}
        inputValue={path}
        disabled={disabled}
        onInputChange={(_event, value, reason) => {
          if (reason === 'input' && value !== path) onPathChange(value);
        }}
        onChange={(_event, value) => {
          if (value !== path) onPathChange(value);
        }}
        sx={{
          minWidth: 0,
          '&& .MuiOutlinedInput-root': { minHeight: 44, flexWrap: 'nowrap' },
          '&&.MuiAutocomplete-hasPopupIcon .MuiOutlinedInput-root': { pr: 5.5 },
          '&& .MuiAutocomplete-endAdornment': { right: 0 },
          '& .MuiAutocomplete-input': { minWidth: 0 },
        }}
        slotProps={{
          listbox: { sx: { '& .MuiAutocomplete-option': { overflowWrap: 'anywhere' } } },
          popupIndicator: { sx: { m: 0, width: 44, height: 44 } },
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            slotProps={{
              ...params.slotProps,
              input: { ...params.slotProps.input, notched: false },
              htmlInput: {
                ...params.slotProps.htmlInput,
                spellCheck: false,
                'aria-label': m.pathLabel,
                'aria-describedby': hintId,
                'data-testid': testId,
              },
            }}
          />
        )}
      />
      <Tooltip title={m.openFile}>
        <Box component="span" sx={{ display: 'inline-flex' }}>
          <IconButton
            type="button"
            color="secondary"
            aria-label={m.openFile}
            disabled={openDisabled}
            onClick={onOpen}
            sx={{ width: 44, height: 44 }}
          >
            <OpenInNewOutlined fontSize="small" />
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
}

function SetupErrorNote({
  summary,
  error,
  severity = 'error',
}: {
  summary: string;
  error: string;
  severity?: 'error' | 'warning';
}): React.JSX.Element {
  return (
    <Alert severity={severity}>
      <Typography variant="body2">{summary}</Typography>
      <Typography
        variant="body2"
        sx={{ mt: 0.5, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
      >
        {error}
      </Typography>
    </Alert>
  );
}

function SetupPageHeader({
  client,
  name,
  state,
  checking = !state,
  messages: m,
}: {
  client: McpSetupClient | 'opencode-v2';
  name: string;
  state?: McpSetupFileStatus;
  checking?: boolean;
  messages: McpSetupMessages;
}): React.JSX.Element {
  const tone =
    !checking && state === 'configured'
      ? 'success.main'
      : !checking && state === 'needs-update'
        ? 'warning.main'
        : 'text.secondary';
  return (
    <Stack
      direction="row"
      useFlexGap
      spacing={1.5}
      sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', minWidth: 0 }}>
        <ClientLogo client={client === 'opencode-v2' ? 'opencode' : client} size={44} />
        <Typography variant="h5" component="h2" id={'mcp-setup-page-' + client}>
          {name}
        </Typography>
      </Stack>
      <Chip
        variant="outlined"
        size="small"
        label={checking ? m.checking : state ? m[state] : m.statusUnknown}
        icon={
          <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: tone }} />
        }
        data-testid={
          client === 'opencode-v2' ? 'opencode-v2-settings-status' : 'mcp-settings-status'
        }
        sx={{
          ml: 'auto',
          flexShrink: 0,
          maxWidth: '100%',
          height: 'auto',
          minHeight: 26,
          color: tone,
          border: 0,
          bgcolor: 'transparent',
          boxShadow: 'none',
          typography: 'body2',
          '& .MuiChip-icon': { ml: 0, mr: 1 },
          '& .MuiChip-label': { px: 0, whiteSpace: 'normal' },
        }}
      />
    </Stack>
  );
}

function SetupFormContainer({
  inline,
  client,
  title,
  open,
  onClose,
  actions,
  children,
}: {
  inline?: boolean;
  client: McpSetupClient | 'opencode-v2';
  title?: string;
  open?: boolean;
  onClose?: () => void;
  actions: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const content = (
    <Stack spacing={2} sx={inline ? undefined : { pt: 1 }}>
      {children}
    </Stack>
  );
  return inline ? (
    <Paper
      component="section"
      id={'mcp-setup-form-' + client}
      aria-labelledby={'mcp-setup-page-' + client}
      sx={{ mt: 3, p: { xs: 2, sm: 3 } }}
    >
      {content}
      <Stack
        component="footer"
        direction="row"
        useFlexGap
        spacing={1}
        sx={{
          mt: 2,
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
          alignItems: 'center',
          '& .MuiButton-sizeSmall': { minHeight: 36 },
        }}
      >
        {actions}
      </Stack>
    </Paper>
  ) : (
    <Dialog
      open={!!open}
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
      <DialogTitle id={'mcp-setup-title-' + client}>{title}</DialogTitle>
      <DialogContent sx={{ scrollbarGutter: 'stable' }}>{content}</DialogContent>
      <DialogActions sx={{ minHeight: 56, gap: 1, flexShrink: 0 }}>{actions}</DialogActions>
    </Dialog>
  );
}

interface DialogProps {
  invoke: McpSetupInvoke;
  messages: McpSetupMessages;
  inline?: boolean;
  flow?: McpSetupFlow;
  setupBusy?: boolean;
  chatDelivery?: DesktopSessionDeliveryModel;
  snapshot?: Pick<Snapshot, 'adapters' | 'agents'>;
  locale?: Locale;
  onApplied?: () => Promise<void>;
  onSuccess?: (status: SetupSuccess) => void;
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
  onSuccess,
  check,
  aionUiComplete,
  registerConfigureMcp,
  inline,
  flow: providedFlow,
  setupBusy,
  chatDelivery: sharedDelivery,
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
  const configuration = state.files.find((file) => file.id === 'configuration')?.path ?? '';
  const [pendingConfiguration, setPendingConfiguration] = useState<string>();
  const chatDelivery = useMemo(
    () => sharedDelivery ?? new DesktopSessionDeliveryModel(invoke),
    [sharedDelivery, invoke],
  );
  const [deliveryIssue, setDeliveryIssue] = useState<DeliveryIssue>();
  const [deliveryBusy, setDeliveryBusy] = useState(false);
  const verifiedConfiguration =
    state.status?.remembered &&
    state.status.state === 'configured' &&
    state.status.files.some((file) => file.path === configuration);
  const apply = async () => {
    if (result) await flow.begin();
    await flow.apply(!result && replaceConfirmed);
    const current = flow.getSnapshot();
    if (
      client === 'codex' &&
      (current.verified || (current.result && current.result.status !== 'failed'))
    ) {
      const target =
        current.preview?.files.find((file) => file.id === 'configuration')?.path ??
        current.status?.files[0]?.path;
      if (pendingConfiguration && target === pendingConfiguration) {
        setDeliveryBusy(true);
        const { issue } = await chatDelivery.enableForConfiguration(target);
        setDeliveryBusy(false);
        setDeliveryIssue(issue);
        setPendingConfiguration(undefined);
      } else {
        void chatDelivery.refresh();
      }
    }
    if (current.result && current.result !== state.result && current.result.status !== 'failed')
      onSuccess?.(current.result.status);
    else if (current.verified && !state.verified) onSuccess?.('unchanged');
    void onApplied?.();
  };
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
  const status = state.status;
  const shownState = check ? (check.error ? 'unavailable' : check.status?.state) : status?.state;
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
        <SetupPageHeader
          client={client}
          name={client === 'aionui' ? copy.aionUiName : labels[client]}
          state={shownState}
          messages={m}
        />
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
            {before}
          </Paper>
        ) : (
          before
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
                    variant="body2"
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
                      variant="body2"
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
                sx={{ mt: 1.5 }}
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
                sx={{ flex: '1 1 280px', maxWidth: '52ch' }}
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
          <SetupErrorNote summary={m.unavailable} error={state.error} />
        )}
        {check?.error && check.error !== state.error && (
          <SetupErrorNote summary={m.unavailable} error={check.error} />
        )}
      </Stack>
      <SetupFormContainer
        inline={inline}
        client={client}
        title={m[k.title] + (client === 'opencode' ? ' v1' : '')}
        open={state.open}
        onClose={() => flow.cancel()}
        actions={
          <>
            {(inline || !result) && (
              <Button
                size={inline ? 'small' : 'medium'}
                data-testid="mcp-apply"
                variant="contained"
                disabled={
                  state.busy ||
                  deliveryBusy ||
                  setupBusy ||
                  (!result &&
                    (!state.preview ||
                      ((state.preview.requiresReplacement || state.reviewRequired) &&
                        !replaceConfirmed)))
                }
                onClick={() => void apply()}
              >
                {checkingOriginalResult ? copy.checkSetupResult : m.apply}
              </Button>
            )}
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
            {!inline && (
              <Button disabled={state.busy} onClick={() => flow.cancel()}>
                {result ? m.close : m.cancel}
              </Button>
            )}
          </>
        }
      >
        {state.files.map((file) => {
          const checked = state.preview?.files.find((item) => item.id === file.id);
          return (
            <Stack key={file.id} spacing={1.5}>
              <ConfigurationPathField
                path={file.path}
                locations={file.alternatives}
                disabled={state.busy}
                browseDisabled={state.busy}
                openDisabled={
                  !canOpen || file.path !== status?.files.find((item) => item.id === file.id)?.path
                }
                testId={'mcp-path-' + file.id}
                messages={m}
                onPathChange={(path) => flow.setPath(file.id, path)}
                onBrowse={() => void flow.browse(file.id)}
                onOpen={() => void flow.openFile()}
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
              <Box sx={inline ? undefined : { minHeight: '3em' }}>
                {checked && !result && <Typography variant="body2">{m[checked.action]}</Typography>}
                {client === 'claude' && checked && !result && (
                  <ClaudePermissionChanges file={checked} />
                )}
                {checked && !result && (
                  <OpenCodePermissionPreview client={client} file={checked} locale={locale} />
                )}
              </Box>
            </Stack>
          );
        })}
        {client === 'codex' && (
          <DesktopSessionDeliveryControl
            model={chatDelivery}
            locale={locale}
            configuration={configuration}
            configured={!!verifiedConfiguration}
            pending={!!pendingConfiguration && pendingConfiguration === configuration}
            onPendingChange={(value) => setPendingConfiguration(value ? configuration : undefined)}
            applyIssue={deliveryIssue}
            clearIssue={() => setDeliveryIssue(undefined)}
            formBusy={state.busy || deliveryBusy || !!setupBusy}
          />
        )}
        {(state.preview?.requiresReplacement || state.reviewRequired) && !result && (
          <FormControlLabel
            control={
              <Checkbox
                checked={replaceConfirmed}
                onChange={(_event, checked) => setReplaceConfirmed(checked)}
              />
            }
            label={state.reviewRequired ? copy.reviewHelp : copy.confirmHelp}
            slotProps={{ typography: { variant: 'body2' } }}
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
            severity="warning"
          />
        ) : (
          state.error && <SetupErrorNote summary={m.failed} error={state.error} />
        )}
        {state.uncertain && !checkingOriginalResult && (
          <SetupErrorNote
            summary={copy.uncertain}
            error={state.uncertain.error}
            severity="warning"
          />
        )}
        {result && (
          <>
            {result.status === 'failed' && <Alert severity="error">{m.failed}</Alert>}
            {!inline && result.status !== 'failed' && (
              <Alert severity="success">
                {result.status === 'unchanged' ? m.noChanges : m.applied}
              </Alert>
            )}
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
            {result.status !== 'failed' && <Typography variant="body2">{m[k.next]}</Typography>}
          </>
        )}
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
  onSuccess,
  setupBusy = false,
}: {
  flow: OpenCodeV2SetupFlow;
  messages: McpSetupMessages;
  locale: Locale;
  onSuccess?: (status: SetupSuccess) => void;
  setupBusy?: boolean;
}): React.JSX.Element {
  const copy = applicationSetupMessages(locale);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  const [confirmed, setConfirmed] = useState(false);
  const busy = flow.busy() || !!state.checking;
  const target = state.target;
  const status =
    state.status &&
    target &&
    openCodeV2TargetKey(state.status.target) === openCodeV2TargetKey(target)
      ? state.status
      : undefined;
  const checkingOriginal = flow.checkingOriginal();
  const completed = state.phase === 'succeeded' || !!state.verified;
  const apply = async () => {
    if (checkingOriginal) await flow.checkResult();
    else {
      if (completed) await flow.beginManual();
      await flow.apply(!completed && confirmed);
    }
    const current = flow.getSnapshot();
    if (current.phase !== 'succeeded') return;
    if (current.result && current.result !== state.result && current.result.status !== 'failed')
      onSuccess?.(current.result.status);
    else if (current.verified && !state.verified) onSuccess?.('unchanged');
  };
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
      <SetupPageHeader
        client="opencode-v2"
        name="OpenCode v2"
        state={state.availability === 'unavailable' ? 'unavailable' : status?.state}
        checking={state.checking}
        messages={m}
      />
      {(status?.state === 'configured' || completed) && (
        <ClientSetupHelp client="opencode" openCodeMajor={2} locale={locale} messages={m} />
      )}
      <SetupFormContainer
        inline
        client="opencode-v2"
        actions={
          <>
            {!completed && (state.phase === 'failed' || state.availability === 'unavailable') ? (
              <Button
                size="small"
                disabled={busy || setupBusy}
                onClick={() => void flow.beginManual()}
              >
                {copy.retry}
              </Button>
            ) : (
              <Button
                variant="contained"
                size="small"
                data-testid="opencode-v2-apply"
                disabled={
                  busy ||
                  setupBusy ||
                  (!completed &&
                    (!state.preview ||
                      (!checkingOriginal &&
                        !!(state.preview.requiresReplacement || state.reviewRequired) &&
                        !confirmed)))
                }
                onClick={() => void apply()}
              >
                {checkingOriginal ? copy.checkSetupResult : m.apply}
              </Button>
            )}
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
          </>
        }
      >
        {target && (
          <ConfigurationPathField
            path={target.configurationPath}
            locations={state.alternatives}
            disabled={busy}
            browseDisabled={busy || !!setupBusy}
            openDisabled={busy || !status || ['missing', 'unavailable'].includes(status.state)}
            testId="opencode-v2-configuration-path"
            messages={m}
            onPathChange={(path) => flow.setConfigurationPath(path)}
            onBrowse={() => void flow.browse()}
            onOpen={() => void flow.openFile()}
          />
        )}
        {state.preview && !completed && (
          <Box>
            {state.preview.files.map((file) => (
              <Box key={file.id} sx={{ overflowWrap: 'anywhere' }}>
                <Typography variant="body2">{m[file.action]}</Typography>
                <OpenCodePermissionPreview client="opencode-v2" file={file} locale={locale} />
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
                <Checkbox checked={confirmed} onChange={(_event, value) => setConfirmed(value)} />
              }
              label={state.reviewRequired ? copy.reviewHelp : copy.confirmHelp}
              slotProps={{ typography: { variant: 'body2' } }}
            />
          )}
        {checkingOriginal ? (
          <SetupErrorNote
            summary={copy.uncertain}
            error={state.unconfirmed!.error}
            severity="warning"
          />
        ) : (
          state.error && (
            <SetupErrorNote
              summary={state.phase === 'failed' ? copy.failed : m.unavailable}
              error={state.error}
            />
          )
        )}
        {state.uncertain && !checkingOriginal && (
          <SetupErrorNote
            summary={copy.uncertain}
            error={state.uncertain.target.configurationPath + '\n' + state.uncertain.error}
            severity="warning"
          />
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
        {completed && <Typography variant="body2">{copy.openCodeV2Next}</Typography>}
        {state.availability === 'unavailable' && !state.error && (
          <Typography variant="body2" color="text.secondary">
            {m.unavailable}
          </Typography>
        )}
      </SetupFormContainer>
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
  const [notice, setNotice] = useState<{ id: number; status: SetupSuccess; open: boolean }>();
  const showSuccess = (status: SetupSuccess) =>
    setNotice((previous) => ({ id: (previous?.id ?? 0) + 1, status, open: true }));
  const closeNotice = () => setNotice((previous) => previous && { ...previous, open: false });
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
    else {
      const draft = manualFlows[selectedClient].getSnapshot();
      if (selectedClient === 'codex') {
        const target = draft.files.find((file) => file.id === 'configuration')?.path;
        if (target && configurationProfile(target) && !draft.uncertain)
          autoFlow.selectCodexConfiguration(
            draft.status?.remembered && draft.status.files[0]?.path === target ? undefined : target,
          );
      }
      manualFlows[selectedClient].cancel();
    }
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
        '& .MuiButton-root:not(.MuiButton-sizeSmall)': { minHeight: 44, fontSize: 14 },
        '& .MuiIconButton-root': { minWidth: 44, minHeight: 44 },
      }}
    >
      {!activeManualClient && discovery ? (
        <ApplicationRows
          discovery={discovery}
          flow={autoFlow}
          statuses={checks}
          snapshot={snapshot}
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
                onSuccess={showSuccess}
                setupBusy={activeManual.busy || mcpSetupClients.some((item) => autoFlow.busy(item))}
              />
            ) : (
              <SetupDialog
                key={selectedClient}
                inline
                flow={manualFlows[selectedClient]}
                setupBusy={quickBusy}
                chatDelivery={autoFlow.chatDelivery}
                onSuccess={showSuccess}
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
          </Stack>
        </>
      )}
      {!setupFlow && <ApplicationSetupConfirmation flow={autoFlow} locale={locale} />}
      {notice && (
        <Snackbar
          key={notice.id}
          open={notice.open}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          autoHideDuration={4000}
          onClose={(_event, reason) => {
            if (reason !== 'clickaway') closeNotice();
          }}
          message={notice.status === 'unchanged' ? m.noChanges : m.applied}
          action={
            <IconButton
              aria-label={m.close}
              color="inherit"
              size="small"
              onClick={closeNotice}
              sx={{
                color: 'inherit',
                '&:hover': { color: 'inherit', bgcolor: designTokens.snackbarHover },
                '&.Mui-focusVisible': { outlineColor: 'currentColor' },
              }}
            >
              <CloseOutlined fontSize="small" />
            </IconButton>
          }
        />
      )}
    </Box>
  );
}

import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import ExtensionOutlined from '@mui/icons-material/ExtensionOutlined';
import { mcpSetupClients, type McpSetupClient, type McpSetupInvoke } from '../shared/mcp-setup.js';
import { McpSetupFlow } from './mcp-setup-model.js';
import { mcpSetupEnglish, type McpSetupMessages } from './mcp-setup-messages.js';

const labels = { cursor: 'Cursor', opencode: 'OpenCode', codex: 'Codex' };
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
  codex: {
    title: 'codexTitle',
    description: 'codexDescription',
    next: 'codexNext',
    button: 'configureCodex',
  },
} as const;
interface DialogProps {
  invoke: McpSetupInvoke;
  messages: McpSetupMessages;
}

function ClientSetupDialog({
  client,
  invoke,
  messages: m,
}: DialogProps & { client: McpSetupClient }): React.JSX.Element {
  const flow = useMemo(() => new McpSetupFlow(client, invoke), [client, invoke]);
  const state = useSyncExternalStore(flow.subscribe, flow.getSnapshot, flow.getSnapshot);
  useEffect(() => {
    void flow.refreshStatus();
    return () => flow.dispose();
  }, [flow]);
  useEffect(() => {
    if (
      !state.open ||
      state.busy ||
      state.preview ||
      state.result ||
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
  const canOpen = !!status?.files[0]?.path && status.state !== 'missing';
  return (
    <>
      <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: 'flex-start', justifyContent: 'space-between' }}
        >
          <Stack direction="row" spacing={2} sx={{ minWidth: 0 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                flexShrink: 0,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 1,
                bgcolor: 'action.hover',
                color: 'primary.main',
              }}
            >
              <ExtensionOutlined />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" component="h2">
                {labels[client]}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5, maxWidth: 620, lineHeight: 1.6 }}
              >
                {m[k.description]}
              </Typography>
            </Box>
          </Stack>
          {status ? (
            <Chip
              color={status.state === 'configured' ? 'success' : 'default'}
              variant="outlined"
              size="small"
              label={m[status.state]}
              data-testid="mcp-settings-status"
              sx={{ flexShrink: 0, mt: { sm: 0.5 } }}
            />
          ) : (
            <Typography variant="body2">{m.checking}</Typography>
          )}
        </Stack>
        <Box
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'action.hover', p: 2 }}
        >
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
                {m.pathLabel}
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
            </Box>
            {canOpen && (
              <Tooltip title={m.openFile}>
                <IconButton
                  size="small"
                  aria-label={m.openFile}
                  onClick={() => void flow.openFile()}
                  sx={{ flexShrink: 0 }}
                >
                  <OpenInNewOutlined fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between' }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 580, lineHeight: 1.6 }}
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
        </Stack>
        {state.error && !state.open && <Alert severity="error">{state.error}</Alert>}
      </Stack>
      <Dialog
        open={state.open}
        onClose={() => flow.cancel()}
        fullWidth
        maxWidth="sm"
        aria-labelledby={'mcp-setup-title-' + client}
        slotProps={{
          paper: {
            sx: {
              height:
                client === 'opencode'
                  ? 'min(660px, calc(100dvh - 64px))'
                  : 'min(520px, calc(100dvh - 64px))',
            },
          },
        }}
      >
        <DialogTitle id={'mcp-setup-title-' + client}>{m[k.title]}</DialogTitle>
        <DialogContent sx={{ scrollbarGutter: 'stable' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>{m[k.description]}</Typography>
            {state.files.map((file) => {
              const checked = state.preview?.files.find((item) => item.id === file.id);
              return (
                <Stack key={file.id} spacing={1.5}>
                  <TextField
                    fullWidth
                    label={m.pathLabel}
                    value={file.path}
                    disabled={state.busy || !!state.result}
                    onChange={(event) => flow.setPath(file.id, event.target.value)}
                    helperText={m.pathHint}
                    slotProps={{
                      htmlInput: { spellCheck: false, 'data-testid': 'mcp-path-' + file.id },
                    }}
                  />
                  <Box>
                    <Button
                      variant="outlined"
                      disabled={state.busy || !!state.result}
                      onClick={() => void flow.browse(file.id)}
                    >
                      {m.browse}
                    </Button>
                  </Box>
                  {file.alternatives.length > 1 && !state.result && (
                    <Box>
                      <Typography variant="caption">{m.knownPaths}</Typography>
                      {file.alternatives.map((location) => (
                        <Button
                          key={location}
                          size="small"
                          disabled={state.busy}
                          onClick={() => flow.setPath(file.id, location)}
                          sx={{
                            display: 'block',
                            textAlign: 'left',
                            overflowWrap: 'anywhere',
                            maxWidth: '100%',
                          }}
                        >
                          {location}
                        </Button>
                      ))}
                    </Box>
                  )}
                  <Box sx={{ minHeight: '3em' }}>
                    {checked && !state.result && (
                      <Typography variant="body2">{m[checked.action]}</Typography>
                    )}
                  </Box>
                </Stack>
              );
            })}
            {state.error && <Alert severity="error">{state.error}</Alert>}
            {state.result && (
              <>
                <Alert severity={state.result.status === 'failed' ? 'error' : 'success'}>
                  {state.result.status === 'failed'
                    ? m.failed
                    : state.result.status === 'unchanged'
                      ? m.noChanges
                      : m.applied}
                </Alert>
                {state.result.error && (
                  <Typography variant="body2" color="error">
                    {state.result.error}
                  </Typography>
                )}
                {state.result.warning && <Alert severity="warning">{state.result.warning}</Alert>}
                {state.result.status === 'failed' &&
                  state.result.files.map((file) => (
                    <Box key={file.path} sx={{ overflowWrap: 'anywhere' }}>
                      <Typography variant="body2">{file.path}</Typography>
                      {file.backupPath && (
                        <Typography variant="body2">
                          {m.backup}: {file.backupPath}
                        </Typography>
                      )}
                    </Box>
                  ))}
                {state.result.status !== 'failed' && <Typography>{m[k.next]}</Typography>}
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
          <Button disabled={state.busy} onClick={() => flow.cancel()}>
            {state.result ? m.close : m.cancel}
          </Button>
          {!state.result && (
            <Button
              data-testid="mcp-apply"
              variant="contained"
              disabled={state.busy || !state.preview}
              onClick={() => void flow.apply()}
            >
              {m.apply}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
export function CursorSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="cursor" />;
}
export function OpenCodeSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="opencode" />;
}
export function CodexSetupDialog(props: DialogProps): React.JSX.Element {
  return <ClientSetupDialog {...props} client="codex" />;
}

export function McpSetup({
  client,
  onClientChange,
  invoke,
  messages,
}: {
  client: McpSetupClient;
  onClientChange: (client: McpSetupClient) => void;
  invoke: McpSetupInvoke;
  messages?: Partial<McpSetupMessages>;
}): React.JSX.Element {
  const m = { ...mcpSetupEnglish, ...messages };
  const SetupDialog = {
    cursor: CursorSetupDialog,
    opencode: OpenCodeSetupDialog,
    codex: CodexSetupDialog,
  }[client];
  const [copyError, setCopyError] = React.useState('');
  return (
    <Paper sx={{ maxWidth: 1080, overflow: 'hidden' }}>
      <Tabs
        value={client}
        onChange={(_event, value: McpSetupClient) => {
          setCopyError('');
          onClientChange(value);
        }}
        aria-label={m.tabsLabel}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ px: { xs: 2, sm: 3 }, minHeight: 56, borderBottom: 1, borderColor: 'divider' }}
      >
        {mcpSetupClients.map((item) => (
          <Tab
            key={item}
            value={item}
            label={labels[item]}
            id={'mcp-tab-' + item}
            aria-controls={'mcp-panel-' + item}
          />
        ))}
      </Tabs>
      <Stack
        role="tabpanel"
        id={'mcp-panel-' + client}
        aria-labelledby={'mcp-tab-' + client}
        spacing={0}
      >
        <SetupDialog key={client} invoke={invoke} messages={m} />
        <Divider />
        <Stack spacing={1.5} sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="subtitle2" component="h3">
            {m.connect}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              component="code"
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
          {copyError && <Alert severity="error">{copyError}</Alert>}
        </Stack>
      </Stack>
    </Paper>
  );
}

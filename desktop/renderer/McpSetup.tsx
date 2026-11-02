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
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {status ? (
            <Chip
              color={status.state === 'configured' ? 'success' : 'default'}
              label={m[status.state]}
              data-testid="mcp-settings-status"
            />
          ) : (
            <Typography variant="body2">{m.checking}</Typography>
          )}
          {canOpen && (
            <Tooltip title={m.openFile}>
              <IconButton aria-label={m.openFile} onClick={() => void flow.openFile()}>
                <OpenInNewOutlined />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {status?.files.map((file) => (
          <Box key={file.id}>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {file.path}
            </Typography>
            {file.error && (
              <Typography variant="body2" color="error">
                {file.error}
              </Typography>
            )}
          </Box>
        ))}
        <Box>
          <Button
            variant="contained"
            onClick={() => void flow.begin()}
            data-testid={'mcp-configure-' + client}
          >
            {m[k.button]}
          </Button>
        </Box>
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
    <Stack spacing={2.5}>
      <Alert severity="info">{m.userControl}</Alert>
      <Paper sx={{ p: 3 }}>
        <Tabs
          value={client}
          onChange={(_event, value: McpSetupClient) => {
            setCopyError('');
            onClientChange(value);
          }}
          aria-label={m.tabsLabel}
          variant="scrollable"
          scrollButtons="auto"
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
          spacing={2}
          sx={{ pt: 3 }}
        >
          <SetupDialog key={client} invoke={invoke} messages={m} />
          <Typography variant="h6">{m.connect}</Typography>
          <Typography>{m.connectionPrompt}</Typography>
          <Box>
            <Button
              onClick={() =>
                void invoke('copy', { text: m.connectionPrompt }).catch((error) =>
                  setCopyError((error as Error).message),
                )
              }
            >
              {m.copyPrompt}
            </Button>
          </Box>
          {copyError && <Alert severity="error">{copyError}</Alert>}
        </Stack>
      </Paper>
    </Stack>
  );
}

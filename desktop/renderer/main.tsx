import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { createNodeLabelResolver } from './node-labels.js';
import { AgentsPage } from './AgentsPage.js';
import { RemoteNodesTable } from './RemoteNodesTable.js';
import { McpSetup, McpSetupStatusIcon } from './McpSetup.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';
import type { McpSetupApplication } from '../shared/mcp-setup.js';
import {
  ThemeProvider,
  CssBaseline,
  Box,
  Stack,
  Typography,
  Button,
  Paper,
  TextField,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
} from '@mui/material';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import { nicknameKey, type Snapshot } from '../shared/contracts.js';
import { isLocale, loadLocale, persistLocale, t, type Locale } from './i18n/index.js';
import { useMcpSetupStatuses } from './mcp-setup-status.js';
import { mcpSetupClients } from '../shared/mcp-setup.js';
import { AppShell, type Page } from './AppShell.js';
import { createAppTheme, designTokens, surfaceSx } from './theme.js';
import { loadThemeMode, persistThemeMode, type ThemeMode } from './theme-preference.js';

const time = (value: string, locale: Locale) => new Date(value).toLocaleString(locale);
const appLabels = {
  cursor: 'Cursor',
  opencode: 'OpenCode',
  codex: 'Codex',
  aionui: 'AionUi',
  claude: 'Claude Code',
};
const normalizePage = (value: string): Page => (value === 'clients' ? 'mcp' : (value as Page));

function App({
  themeMode,
  onThemeChange,
}: {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
}): React.JSX.Element {
  const [resolveNodeLabels] = useState(createNodeLabelResolver);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [page, setPage] = useState<Page>(normalizePage(location.hash.slice(1)) || 'overview');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [appVersion, setAppVersion] = useState('');
  const [nicknameDialog, setNicknameDialog] = useState(false),
    [nickname, setNickname] = useState('');
  const [address, setAddress] = useState(''),
    [access, setAccess] = useState(''),
    [ownCode, setOwnCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [client, setClient] = useState<McpSetupApplication>('cursor');
  const [nodeLabel, setNodeLabel] = useState(''),
    [listenHost, setListenHost] = useState('');
  const [login, setLogin] = useState({ supported: false, openAtLogin: false });
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => loadLocale(() => window.localStorage));
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const call = useCallback(
    async <T,>(method: string, params: unknown = {}): Promise<T> =>
      window.interconnect.invoke<T>(method, params),
    [],
  );
  const setupStatuses = useMcpSetupStatuses(call);
  const snapshotRequest = useRef(0);
  const run = async (work: () => Promise<unknown>, success = '') => {
    setBusy(true);
    try {
      await work();
      if (success) setNotice(success);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const refresh = useCallback(async () => {
    const request = ++snapshotRequest.current;
    try {
      const value = await call<Snapshot>('snapshot');
      if (request === snapshotRequest.current) setSnapshot(value);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);
  useEffect(() => {
    void refresh();
    void call<string>('appVersion')
      .then(setAppVersion)
      .catch((e: Error) => setError(e.message));
    const off = window.interconnect.onChange(() => {
      void refresh();
    });
    const nav = window.interconnect.onNavigate((tab) => setPage(normalizePage(tab)));
    return () => {
      off();
      nav();
    };
  }, [refresh]);
  useEffect(() => {
    if (snapshot) {
      setNodeLabel(snapshot.nodeLabel);
      setListenHost(snapshot.listenHost);
    }
  }, [snapshot?.nodeLabel, snapshot?.listenHost, snapshot?.agents.length]);
  useEffect(() => {
    if (page === 'settings')
      void call<typeof login>('loginState')
        .then(setLogin)
        .catch((e) => setError((e as Error).message));
  }, [page]);
  if (!snapshot)
    return (
      <Stack spacing={2} sx={{ height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
        <Typography>{t(locale, 'startingNode')}</Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    );
  const nodeName = resolveNodeLabels(snapshot, locale);
  const nameConflicts = (() => {
    try {
      const key = nicknameKey(nickname.trim());
      return snapshot.directories
        .filter((directory) => !directory.local && directory.state === 'ready')
        .flatMap((directory) =>
          directory.agents
            .filter((agent) => nicknameKey(agent.nickname) === key)
            .map((agent) => ({ directory, agent })),
        );
    } catch {
      return [];
    }
  })();
  const copy = (value: string) => run(() => call('copy', { text: value }), t(locale, 'copied'));
  const changeLocale = (next: unknown) => {
    if (!isLocale(next)) return;
    setLocale(next);
    persistLocale(() => window.localStorage, next);
  };
  return (
    <>
      <AppShell
        snapshot={snapshot}
        locale={locale}
        page={page}
        appVersion={appVersion}
        busy={busy}
        onNavigate={setPage}
        onLocaleChange={changeLocale}
        onToggle={() => {
          void run(() => call(snapshot.running ? 'stop' : 'start'));
        }}
      >
        {page === 'overview' && (
          <Stack spacing={3} data-testid="overview-sections">
            <Box
              data-testid="overview-statistics"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
              {[
                {
                  label: t(locale, 'statRemoteNodes'),
                  value: `${snapshot.peers.filter((p) => p.connected).length} / ${snapshot.peers.length}`,
                  hint: t(locale, 'statRemoteNodesHint'),
                },
                {
                  label: t(locale, 'statAgents'),
                  value: snapshot.agents.length,
                  hint: t(locale, 'statAgentsHint'),
                },
                {
                  label: t(locale, 'statInbox'),
                  value: snapshot.agents.reduce((s, c) => s + c.unread, 0),
                  hint: t(locale, 'statInboxHint'),
                },
              ].map((item) => (
                <Paper key={item.label} sx={{ p: 2.5, minWidth: 0 }}>
                  <Typography color="text.secondary" variant="body2">
                    {item.label}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ my: 1.5, fontSize: 40, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {item.value}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    {item.hint}
                  </Typography>
                </Paper>
              ))}
            </Box>
            <Paper data-testid="overview-applications" sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>
                {t(locale, 'navClients')}
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(2, minmax(0, 1fr))',
                    xl: 'repeat(4, minmax(0, 1fr))',
                  },
                  gap: 1,
                }}
              >
                {mcpSetupClients.map((application) => {
                  const status = setupStatuses.statuses[application];
                  const statusError = setupStatuses.errors[application];
                  const messages = mcpSetupMessages(locale);
                  return (
                    <Button
                      key={application}
                      data-testid={'overview-application-' + application}
                      onClick={() => {
                        setClient(application);
                        setPage('mcp');
                      }}
                      sx={{ justifyContent: 'flex-start', gap: 1.25, px: 1, py: 1, minWidth: 0 }}
                    >
                      <McpSetupStatusIcon status={status} error={statusError} messages={messages} />
                      <Box component="span" sx={{ textAlign: 'left', minWidth: 0 }}>
                        <Typography component="span" variant="body2" sx={{ display: 'block' }}>
                          {appLabels[application]}
                        </Typography>
                        <Typography
                          component="span"
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: 'block' }}
                        >
                          {statusError
                            ? messages.unavailable
                            : status
                              ? messages[status.state]
                              : messages.checking}
                        </Typography>
                      </Box>
                    </Button>
                  );
                })}
              </Box>
            </Paper>
            <Box
              data-testid="overview-connections"
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                '@media (min-width: 1000px)': { gridTemplateColumns: '1.45fr 1fr' },
                gap: 2,
              }}
            >
              <Paper
                sx={{
                  ...surfaceSx('raised'),
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  minHeight: 228,
                }}
              >
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'connectAgentsTitle')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {t(locale, 'connectAgentsBody')}
                </Typography>
                <Button sx={{ mt: 'auto' }} variant="contained" onClick={() => setPage('mcp')}>
                  {t(locale, 'connectAgentsCta')}
                </Button>
              </Paper>
              <Paper
                sx={{
                  ...surfaceSx('soft'),
                  p: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  minHeight: 228,
                }}
              >
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'connectPeerTitle')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {t(locale, 'connectPeerBody')}
                </Typography>
                <Button sx={{ mt: 'auto' }} variant="outlined" onClick={() => setPage('network')}>
                  {t(locale, 'connectPeerCta')}
                </Button>
              </Paper>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: '76ch' }}>
              {t(locale, 'overviewIntro')}
            </Typography>
            {snapshot.errors.map((e, i) => (
              <Alert key={i} severity="error">
                {e}
              </Alert>
            ))}
          </Stack>
        )}
        {page === 'agents' && (
          <AgentsPage
            snapshot={snapshot}
            locale={locale}
            nodeName={nodeName}
            call={call}
            run={run}
            onError={setError}
            onAdd={() => setNicknameDialog(true)}
            onCleared={(result, names) => {
              const removed = new Set(names.map(nicknameKey));
              setSnapshot((current) =>
                current
                  ? {
                      ...current,
                      agents:
                        result.scope === 'all'
                          ? []
                          : current.agents.filter((agent) => !removed.has(agent.key)),
                    }
                  : current,
              );
              setNotice(t(locale, result.scope === 'all' ? 'clearAllCompleted' : 'clearCompleted'));
              void refresh();
            }}
          />
        )}
        {page === 'network' && (
          <Stack spacing={3}>
            <Box
              data-testid="network-forms"
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
                gap: 2.5,
              }}
            >
              <Paper sx={{ ...surfaceSx('soft'), p: 3, minWidth: 0 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'networkThisNode')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  {t(locale, 'networkListening', { url: snapshot.peerUrl })}
                </Typography>
                {snapshot.listenHost === '127.0.0.1' && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    {t(locale, 'networkLocalIpHint')}
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  disabled={busy || !snapshot.running}
                  onClick={() => run(async () => setOwnCode(await call('accessCode')))}
                >
                  {t(locale, 'btnAccessCode')}
                </Button>
                {ownCode && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {t(locale, 'networkCodeExpires', { time: time(ownCode.expiresAt, locale) })}
                    </Typography>
                    <TextField
                      label={t(locale, 'networkCodeLabel')}
                      value={ownCode.code}
                      fullWidth
                      slotProps={{
                        input: { readOnly: true },
                        htmlInput: {
                          style: { fontFamily: 'monospace', fontSize: 24, letterSpacing: '0.15em' },
                        },
                      }}
                    />
                    <Button startIcon={<ContentCopyOutlined />} onClick={() => copy(ownCode.code)}>
                      {t(locale, 'btnCopyCode')}
                    </Button>
                  </Box>
                )}
              </Paper>
              <Paper sx={{ ...surfaceSx('raised'), p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {t(locale, 'networkConnectTitle')}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label={t(locale, 'networkAddressLabel')}
                    placeholder={t(locale, 'networkAddressPlaceholder')}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label={t(locale, 'networkAccessLabel')}
                    placeholder={t(locale, 'networkAccessPlaceholder')}
                    helperText={t(locale, 'networkAccessHelper')}
                    value={access}
                    onChange={(e) =>
                      setAccess(e.target.value.replace(/[a-z]/g, (letter) => letter.toUpperCase()))
                    }
                    slotProps={{
                      htmlInput: {
                        maxLength: 8,
                        autoCapitalize: 'characters',
                        autoComplete: 'off',
                        spellCheck: false,
                      },
                    }}
                    fullWidth
                  />
                  <Box>
                    <Button
                      disabled={
                        busy || !address.trim() || access.trim().length !== 8 || !snapshot.running
                      }
                      variant="contained"
                      onClick={() =>
                        run(
                          async () => {
                            await call('connectPeer', { address, code: access.trim() });
                            setAccess('');
                          },
                          t(locale, 'networkConnectOk'),
                        )
                      }
                    >
                      {t(locale, 'btnConnect')}
                    </Button>
                  </Box>
                </Stack>
              </Paper>
            </Box>
            <RemoteNodesTable snapshot={snapshot} locale={locale} nodeName={nodeName} />
          </Stack>
        )}
        {page === 'mcp' && (
          <McpSetup
            client={client}
            onClientChange={setClient}
            invoke={call}
            messages={mcpSetupMessages(locale)}
            snapshot={snapshot}
            locale={locale}
            setupStatuses={setupStatuses}
          />
        )}
        {page === 'settings' && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.5fr) minmax(0, 1fr)' },
              alignItems: 'start',
              gap: 3,
            }}
          >
            <Stack spacing={3}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'settingsAppearance')}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                      color: themeMode === 'light' ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    <LightModeOutlined aria-hidden="true" sx={{ fontSize: 18 }} />
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'nowrap', fontWeight: themeMode === 'light' ? 500 : 400 }}
                    >
                      {t(locale, 'settingsThemeLightLabel')}
                    </Typography>
                  </Stack>
                  <Switch
                    checked={themeMode === 'dark'}
                    onChange={(_, checked) => onThemeChange(checked ? 'dark' : 'light')}
                    slotProps={{ input: { 'aria-label': t(locale, 'settingsDarkTheme') } }}
                  />
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: 'center',
                      color: themeMode === 'dark' ? 'text.primary' : 'text.secondary',
                    }}
                  >
                    <DarkModeOutlined aria-hidden="true" sx={{ fontSize: 18 }} />
                    <Typography
                      variant="body2"
                      sx={{ whiteSpace: 'nowrap', fontWeight: themeMode === 'dark' ? 500 : 400 }}
                    >
                      {t(locale, 'settingsThemeDarkLabel')}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  {t(locale, 'settingsNodeTitle')}
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label={t(locale, 'settingsNodeName')}
                    value={nodeLabel}
                    onChange={(e) => setNodeLabel(e.target.value)}
                  />
                  <TextField
                    select
                    label={t(locale, 'settingsLocalIp')}
                    value={listenHost}
                    onChange={(e) => setListenHost(e.target.value)}
                  >
                    {snapshot.localAddresses.map((ip) => (
                      <MenuItem key={ip} value={ip}>
                        {ip}
                        {ip === '127.0.0.1' ? t(locale, 'settingsLocalOnly') : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Box>
                    <Button
                      variant="contained"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () => call('saveNode', { nodeLabel, listenHost }),
                          t(locale, 'settingsSaved'),
                        )
                      }
                    >
                      {t(locale, 'btnSave')}
                    </Button>
                  </Box>
                </Stack>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'settingsBackground')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  {t(locale, 'settingsBackgroundBody')}
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={login.openAtLogin}
                      disabled={!login.supported || busy}
                      onChange={(_, enabled) =>
                        run(async () => {
                          const result = await call<{ openAtLogin: boolean }>('setLogin', {
                            enabled,
                          });
                          setLogin((previous) => ({ ...previous, ...result }));
                        })
                      }
                    />
                  }
                  label={t(locale, 'settingsStartAtLogin')}
                />
                {!login.supported && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {t(locale, 'settingsStartAtLoginUnavailable')}
                  </Typography>
                )}
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'settingsExportRoots')}
                </Typography>
                {snapshot.exportRoots.map((root) => (
                  <Typography key={root} variant="body2" sx={{ py: 0.5, overflowWrap: 'anywhere' }}>
                    {root}
                  </Typography>
                ))}
                <Button
                  sx={{ mt: 1 }}
                  startIcon={<AddOutlined />}
                  onClick={() => run(() => call('pickExportFolder'))}
                >
                  {t(locale, 'btnAddFolder')}
                </Button>
              </Paper>
            </Stack>
            <Paper sx={{ ...surfaceSx('glass'), p: 3, minWidth: 0 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t(locale, 'settingsDiagnostics')}
              </Typography>
              <Stack component="dl" spacing={2} sx={{ m: 0 }}>
                {(
                  [
                    ['settingsDiagnosticNode', snapshot.nodeId],
                    ['settingsDiagnosticMcp', snapshot.mcpUrl],
                    ['settingsDiagnosticListening', snapshot.peerUrl],
                  ] as const
                ).map(([label, value]) => (
                  <Box key={label}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {t(locale, label)}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="body2"
                      sx={{ m: 0, mt: 0.5, fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Divider sx={{ my: 2 }} />
              {snapshot.errors.length ? (
                snapshot.errors.map((e, i) => (
                  <Alert severity="error" key={i} sx={{ mt: 1 }}>
                    {e}
                  </Alert>
                ))
              ) : (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Box
                    aria-hidden="true"
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: 'success.main',
                      boxShadow: designTokens.statusGlow,
                    }}
                  />
                  <Typography variant="body2" color="success.main">
                    {t(locale, 'settingsNoErrors')}
                  </Typography>
                </Stack>
              )}
            </Paper>
          </Box>
        )}
      </AppShell>
      <Dialog
        open={nicknameDialog}
        onClose={() => setNicknameDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{t(locale, 'dialogAddAgent')}</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            {t(locale, 'dialogAddAgentBody')}
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label={t(locale, 'dialogAgentName')}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          {!!nameConflicts.length && (
            <Alert severity="warning" sx={{ mt: 2, overflowWrap: 'anywhere' }}>
              {t(locale, 'dialogNameUsed', {
                nodes: nameConflicts.map(({ directory }) => nodeName(directory.nodeId)).join(', '),
              })}
            </Alert>
          )}
          {snapshot.directories.some(
            (directory) => !directory.local && (directory.state !== 'ready' || directory.truncated),
          ) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {t(locale, 'dialogSomeDirectories')}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNicknameDialog(false)}>{t(locale, 'btnCancel')}</Button>
          <Button
            variant="contained"
            disabled={!nickname.trim() || busy}
            onClick={() =>
              run(async () => {
                await call('registerAgent', { nickname });
                setNickname('');
                setNicknameDialog(false);
                setPage('agents');
              })
            }
          >
            {t(locale, 'btnAdd')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={!!error} autoHideDuration={12000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!notice}
        autoHideDuration={4000}
        onClose={() => setNotice('')}
        message={notice}
      />
    </>
  );
}
function ThemedApp(): React.JSX.Element {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
    loadThemeMode(() => window.localStorage),
  );
  const theme = useMemo(() => createAppTheme(themeMode), [themeMode]);
  const changeTheme = useCallback((mode: ThemeMode) => {
    setThemeMode(mode);
    persistThemeMode(() => window.localStorage, mode);
  }, []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App themeMode={themeMode} onThemeChange={changeTheme} />
    </ThemeProvider>
  );
}

createRoot(document.getElementById('root')!).render(<ThemedApp />);

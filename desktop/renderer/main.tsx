import { ChatGptConnectDialog, type ChatGptConnectRequest } from './CodexShortcut.js';
import { InstallationRestartNotice } from './InstallationRestartNotice.js';
import { OverviewApplications } from './OverviewApplications.js';
import { OverviewConnections } from './OverviewConnections.js';
import { NetworkInterfacesSettings } from './NetworkInterfacesSettings.js';
import { normalizeInterfaceExclusions } from '../core/network-interfaces.js';
import type { NetworkInterfaceExclusion } from '../shared/network-interfaces.js';
import { networkInterfaceMessages } from './i18n/network-interfaces.js';
import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useSyncExternalStore,
} from 'react';
import { createRoot } from 'react-dom/client';
import { createNodeLabelResolver } from './node-labels.js';
import { AgentsPage, ManualAgentDialogHelp } from './AgentsPage.js';
import { RemoteNodesTable } from './RemoteNodesTable.js';
import {
  NetworkPage,
  PairAttemptLedger,
  type PairAttemptInput,
  type NetworkOverviewActions,
  lanSearchNavigation,
} from './NetworkPage.js';
import { lanSearchMessages } from './i18n/lan-search.js';
import { McpSetup } from './McpSetup.js';
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
  Link,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import LightModeOutlined from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlined from '@mui/icons-material/DarkModeOutlined';
import { nicknameKey, type Snapshot } from '../shared/contracts.js';
import { isLocale, loadLocale, persistLocale, t, type Locale } from './i18n/index.js';
import { applicationSetupMessages } from './i18n/application-setup.js';
import { agentEntryMessages } from './i18n/agent-entry.js';
import { useMcpSetupStatuses } from './mcp-setup-status.js';
import {
  ApplicationSetup,
  useApplicationSetup,
  useApplicationSetupStartup,
} from './ApplicationSetup.js';
import { useApplicationDiscovery } from './useApplicationDiscovery.js';
import { AppShell, type Page } from './AppShell.js';
import { createAppTheme, designTokens, surfaceSx } from './theme.js';
import { loadThemeMode, persistThemeMode, type ThemeMode } from './theme-preference.js';

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
  const [networkSaveError, setNetworkSaveError] = useState<string | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [windowVisible, setWindowVisible] = useState(false);
  const [installationRestartPending, setInstallationRestartPending] = useState(false);
  const installationRestartDismissal = useRef<'idle' | 'recording' | 'dismissed'>('idle');
  const [nicknameDialog, setNicknameDialog] = useState(false),
    [nickname, setNickname] = useState('');
  const [address, setAddress] = useState(''),
    [access, setAccess] = useState(''),
    [ownCode, setOwnCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [client, setClient] = useState<McpSetupApplication>('cursor');
  const [manualClient, setManualClient] = useState<McpSetupApplication | null>(null);
  const [applicationsMounted, setApplicationsMounted] = useState(page === 'mcp');
  const [nodeLabelDraft, setNodeLabelDraft] = useState<string | null>(null);
  const [networkExclusionsDraft, setNetworkExclusionsDraft] = useState<
    NetworkInterfaceExclusion[] | null
  >(null);
  const [login, setLogin] = useState({ supported: false, openAtLogin: false });
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => loadLocale(() => window.localStorage));
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const [pairLedger] = useState(() => new PairAttemptLedger());
  const overviewNetworkActions = useRef<NetworkOverviewActions | null>(null);
  const chatGptRequest = useRef<ChatGptConnectRequest | null>(null);
  const [chatGptConnect, setChatGptConnect] = useState<ChatGptConnectRequest | null>(null);
  const invocationContext = useRef({ snapshot, locale });
  invocationContext.current = { snapshot, locale };
  const call = useCallback(
    async <T,>(method: string, params: unknown = {}): Promise<T> => {
      const invoke = () => window.interconnect.invoke<T>(method, params);
      if (method === 'mcpSetupApplyChatGpt') {
        if (chatGptRequest.current) return null as T;
        const details = params as Pick<ChatGptConnectRequest, 'planId' | 'confirmReplace'>;
        return new Promise<T>((resolve, reject) => {
          const request: ChatGptConnectRequest = {
            ...details,
            complete: (result) => {
              if (chatGptRequest.current !== request) return;
              chatGptRequest.current = null;
              setChatGptConnect(null);
              resolve(result as T);
            },
            fail: (error) => {
              if (chatGptRequest.current !== request) return;
              chatGptRequest.current = null;
              setChatGptConnect(null);
              reject(error);
            },
          };
          chatGptRequest.current = request;
          setChatGptConnect(request);
        });
      }
      if (method === 'connectPeer') {
        const context = invocationContext.current;
        return pairLedger.run(
          context.snapshot,
          params as PairAttemptInput,
          lanSearchMessages(context.locale).uncertain,
          invoke,
        );
      }
      return invoke();
    },
    [pairLedger],
  );
  const setupStatuses = useMcpSetupStatuses(call);
  const discovery = useApplicationDiscovery(call);
  const applicationSetup = useApplicationSetup(call, () => setupStatuses.refreshAll(true));
  const applicationSetupStates = useSyncExternalStore(
    applicationSetup.subscribe,
    applicationSetup.getSnapshot,
    applicationSetup.getSnapshot,
  );
  const applicationStartup = useApplicationSetupStartup(
    discovery,
    applicationSetupStates,
    setupStatuses,
    snapshot ?? undefined,
  );
  const openManualSetup = (application: McpSetupApplication) => {
    setClient(application);
    setManualClient(application);
    setApplicationsMounted(true);
    setPage('mcp');
  };
  const navigate = (next: Page) => {
    if (next === 'mcp') {
      setManualClient(null);
      setApplicationsMounted(true);
    }
    setPage(next);
  };
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
      const [value, state] = await Promise.all([
        call<Snapshot>('snapshot'),
        call<{ visible: boolean; installationRestartPending?: boolean }>('windowState', {}),
      ]);
      if (request === snapshotRequest.current) {
        setSnapshot(value);
        setWindowVisible(state.visible === true);
        setInstallationRestartPending(
          state.installationRestartPending === true &&
            installationRestartDismissal.current !== 'dismissed',
        );
      }
    } catch (e) {
      if (request !== snapshotRequest.current) return;
      setWindowVisible(false);
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
    const nav = window.interconnect.onNavigate((tab) => navigate(normalizePage(tab)));
    return () => {
      snapshotRequest.current++;
      off();
      nav();
    };
  }, [refresh]);
  const savedNodeLabel = snapshot?.nodeLabel;
  const savedNetworkExclusions =
    snapshot?.networkInterfaces?.exclusions.map((record) => record.exclusion) ?? [];
  const savedExclusionsKey = JSON.stringify(normalizeInterfaceExclusions(savedNetworkExclusions));
  useEffect(() => {
    setNodeLabelDraft(null);
    setNetworkExclusionsDraft(null);
  }, [savedNodeLabel, savedExclusionsKey]);
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
  const nodeLabel = nodeLabelDraft ?? snapshot.nodeLabel;
  const networkExclusions = networkExclusionsDraft ?? savedNetworkExclusions;
  const settingsDirty =
    nodeLabel !== snapshot.nodeLabel ||
    (networkExclusionsDraft !== null &&
      JSON.stringify(normalizeInterfaceExclusions(networkExclusionsDraft)) !== savedExclusionsKey);
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
        networkDiscovery={lanSearchNavigation(snapshot)}
        onNavigate={navigate}
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
            <OverviewConnections
              snapshot={snapshot}
              locale={locale}
              nodeName={nodeName}
              onConnect={(nodeId) => overviewNetworkActions.current?.connectFoundNode(nodeId)}
              onSettings={() => navigate('network')}
              onConnectionCode={() => overviewNetworkActions.current?.openConnectionCode()}
            />
            <OverviewApplications
              snapshot={snapshot}
              discovery={discovery}
              flow={applicationSetup}
              states={applicationSetupStates}
              statuses={setupStatuses}
              locale={locale}
            />
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
        <NetworkPage
          active={page === 'network'}
          overviewActive={page === 'overview'}
          overviewActions={overviewNetworkActions}
          onOverviewPaired={() => setNotice(t(locale, 'networkConnectOk'))}
          windowVisible={windowVisible}
          obscured={
            nicknameDialog ||
            installationRestartPending ||
            !!chatGptConnect ||
            applicationStartup.open ||
            Object.values(applicationSetupStates).some((state) => state.phase === 'confirmation')
          }
          snapshot={snapshot}
          locale={locale}
          invoke={call}
          pairLedger={pairLedger}
          ownCode={ownCode}
          onOwnCodeChange={setOwnCode}
          manual={{
            address,
            code: access,
            onAddressChange: setAddress,
            onCodeChange: setAccess,
            content: (
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
            ),
          }}
        >
          <RemoteNodesTable snapshot={snapshot} locale={locale} nodeName={nodeName} />
        </NetworkPage>
        {(page === 'mcp' || applicationsMounted) && (
          <Box hidden={page !== 'mcp'}>
            <McpSetup
              discovery={discovery}
              client={client}
              onClientChange={openManualSetup}
              setupFlow={applicationSetup}
              manualClient={manualClient}
              onCloseManual={() => setManualClient(null)}
              invoke={call}
              messages={mcpSetupMessages(locale)}
              snapshot={snapshot}
              locale={locale}
              setupStatuses={setupStatuses}
            />
          </Box>
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
            <Paper data-testid="settings-appearance" sx={{ gridColumn: '1 / -1', p: 3 }}>
              <Typography component="h2" variant="h6" sx={{ mb: 1 }}>
                {t(locale, 'settingsAppearance')}
              </Typography>
              <Stack
                direction="row"
                useFlexGap
                sx={{ alignItems: 'flex-start', flexWrap: 'wrap', columnGap: 4, rowGap: 1 }}
              >
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
                <Box sx={{ minWidth: 0 }}>
                  <FormControlLabel
                    sx={{ m: 0 }}
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
                </Box>
              </Stack>
            </Paper>
            <Stack spacing={3}>
              <Paper sx={{ p: 2 }}>
                <Stack
                  direction="row"
                  useFlexGap
                  sx={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}
                >
                  <TextField
                    label={t(locale, 'settingsNodeName')}
                    value={nodeLabel}
                    disabled={busy}
                    onChange={(e) => setNodeLabelDraft(e.target.value)}
                    sx={{ width: 360, maxWidth: '100%' }}
                  />
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Typography component="h2" variant="subtitle1" sx={{ mb: 1 }}>
                  {lanSearchMessages(locale).networkSettings}
                </Typography>
                <Stack spacing={1.5}>
                  {snapshot.networkInterfaces && (
                    <NetworkInterfacesSettings
                      status={snapshot.networkInterfaces}
                      value={networkExclusions}
                      onChange={setNetworkExclusionsDraft}
                      locale={locale}
                      disabled={busy}
                    />
                  )}
                  {networkSaveError !== null && (
                    <Alert
                      severity="error"
                      data-testid="network-save-error"
                      onClose={() => setNetworkSaveError(null)}
                      closeText={t(locale, 'mcpSetup_close')}
                    >
                      <Typography data-testid="network-save-summary">
                        {networkInterfaceMessages(locale).saveFailed}
                      </Typography>
                      <Box component="details">
                        <summary>{networkInterfaceMessages(locale).details}</summary>
                        <Typography
                          component="pre"
                          sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                        >
                          {networkSaveError}
                        </Typography>
                      </Box>
                    </Alert>
                  )}
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <Button
                      variant="contained"
                      disabled={busy}
                      sx={{ flexShrink: 0 }}
                      onClick={() => {
                        setBusy(true);
                        setNetworkSaveError(null);
                        setNotice('');
                        void call('saveNode', { nodeLabel, networkExclusions })
                          .then(async () => {
                            await refresh();
                            setNotice(t(locale, 'settingsSaved'));
                          })
                          .catch((error: unknown) =>
                            setNetworkSaveError(
                              error instanceof Error ? error.message : String(error),
                            ),
                          )
                          .finally(() => setBusy(false));
                      }}
                    >
                      {t(locale, 'btnSave')}
                    </Button>
                    <Typography
                      role="status"
                      variant="body2"
                      color="text.secondary"
                      data-testid="network-unsaved-changes"
                      sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
                    >
                      {settingsDirty ? networkInterfaceMessages(locale).unsavedChanges : ''}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>
              <Paper component="section" aria-labelledby="export-folders-title" sx={{ p: 3 }}>
                <Stack
                  direction="row"
                  sx={{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 2 }}
                >
                  <Typography id="export-folders-title" component="h2" variant="h6">
                    {t(locale, 'settingsExportRoots')}
                  </Typography>
                  <Link
                    component="button"
                    type="button"
                    variant="body2"
                    underline="always"
                    disabled={busy}
                    onClick={() => run(() => call('pickExportFolder'))}
                    sx={{ p: 0, minHeight: 0, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    <AddOutlined sx={{ fontSize: '1em', verticalAlign: '-0.125em', mr: 0.5 }} />
                    {t(locale, 'btnAddFolder')}
                  </Link>
                </Stack>
                <Typography
                  id="export-folders-help"
                  variant="body2"
                  color="text.secondary"
                  sx={{ my: 1.5 }}
                >
                  {t(locale, 'settingsExportRootsHelp')}
                </Typography>
                <TableContainer sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <Table
                    size="small"
                    aria-labelledby="export-folders-title"
                    aria-describedby="export-folders-help"
                    sx={{ tableLayout: 'fixed' }}
                  >
                    <TableBody>
                      {snapshot.exportRoots.map((root) => (
                        <TableRow key={root}>
                          <TableCell sx={{ overflowWrap: 'anywhere' }}>{root}</TableCell>
                          <TableCell align="right" sx={{ width: 56, px: 1, py: 0 }}>
                            <IconButton
                              aria-label={t(locale, 'btnRemoveExportFolder', { path: root })}
                              size="small"
                              disabled={busy}
                              onClick={() =>
                                void run(() => call('removeExportFolder', { folder: root }))
                              }
                            >
                              <CloseOutlined fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Stack>
            <Paper sx={{ ...surfaceSx('glass'), p: 3, minWidth: 0 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {t(locale, 'settingsDiagnostics')}
              </Typography>
              <Stack component="dl" spacing={2} sx={{ m: 0 }}>
                {(
                  [
                    ['settingsDiagnosticNode', [snapshot.nodeId]],
                    ['settingsDiagnosticMcp', [snapshot.mcpUrl]],
                    [
                      'settingsDiagnosticListening',
                      [
                        ...new Set(
                          snapshot.peerUrls ?? (snapshot.peerUrl ? [snapshot.peerUrl] : []),
                        ),
                      ],
                    ],
                  ] as const
                ).map(([label, values]) => (
                  <Box key={label}>
                    <Typography component="dt" variant="caption" color="text.secondary">
                      {t(locale, label)}
                    </Typography>
                    {(values.length ? values : ['—']).map((value) => (
                      <Typography
                        key={value}
                        component="dd"
                        variant="body2"
                        sx={{ m: 0, mt: 0.5, fontFamily: 'monospace', overflowWrap: 'anywhere' }}
                      >
                        {value}
                      </Typography>
                    ))}
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
      <ApplicationSetup
        discovery={discovery}
        flow={applicationSetup}
        startup={
          installationRestartPending ? { ...applicationStartup, open: false } : applicationStartup
        }
        statuses={setupStatuses}
        invoke={call}
        locale={locale}
        onManualSetup={openManualSetup}
      />
      {chatGptConnect && (
        <ChatGptConnectDialog invoke={call} locale={locale} request={chatGptConnect} />
      )}
      <InstallationRestartNotice
        open={windowVisible && installationRestartPending}
        locale={locale}
        onClose={() => {
          if (installationRestartDismissal.current !== 'idle') return;
          installationRestartDismissal.current = 'recording';
          void call('acknowledgeInstallationRestart')
            .catch(() => {})
            .finally(() => {
              installationRestartDismissal.current = 'dismissed';
              setInstallationRestartPending(false);
            });
        }}
      />
      <Dialog
        open={nicknameDialog}
        onClose={() => setNicknameDialog(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{agentEntryMessages(locale).dialogAddAgent}</DialogTitle>
        <DialogContent>
          <ManualAgentDialogHelp locale={locale} />
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

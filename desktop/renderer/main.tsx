import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  Stack,
  Typography,
  Button,
  IconButton,
  Paper,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  TextField,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  FormControlLabel,
  Switch,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import HubOutlined from '@mui/icons-material/HubOutlined';
import ForumOutlined from '@mui/icons-material/ForumOutlined';
import CableOutlined from '@mui/icons-material/CableOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import ExtensionOutlined from '@mui/icons-material/ExtensionOutlined';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import AddOutlined from '@mui/icons-material/AddOutlined';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import {
  nicknameKey,
  type Snapshot,
  type Message,
  type McpInstructions,
  type AgentDirectory,
} from '../shared/contracts.js';
import {
  isLocale,
  loadLocale,
  localeLabel,
  persistLocale,
  supportedLocales,
  t,
  type Locale,
} from './i18n/index.js';

const theme = createTheme({
  palette: {
    primary: { main: '#176b62' },
    secondary: { main: '#305d87' },
    background: { default: '#f4f6f8', paper: '#ffffff' },
    text: { primary: '#172b3a', secondary: '#607280' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.6px' },
    h6: { fontWeight: 650 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { border: '1px solid #e2e7ec' } },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
  },
});
type Page = 'overview' | 'agents' | 'network' | 'mcp' | 'clients' | 'settings';
const navigation: {
  id: Page;
  tKey: 'navOverview' | 'navAgents' | 'navNetwork' | 'navMcp' | 'navClients' | 'navSettings';
  icon: React.ReactNode;
}[] = [
  { id: 'overview', tKey: 'navOverview', icon: <HubOutlined /> },
  { id: 'agents', tKey: 'navAgents', icon: <ForumOutlined /> },
  { id: 'network', tKey: 'navNetwork', icon: <CableOutlined /> },
  { id: 'mcp', tKey: 'navMcp', icon: <ExtensionOutlined /> },
  { id: 'clients', tKey: 'navClients', icon: <ExtensionOutlined /> },
  { id: 'settings', tKey: 'navSettings', icon: <SettingsOutlined /> },
];
const time = (value: string, locale: Locale) => new Date(value).toLocaleString(locale);
const messageStateKey = (
  state: Message['state'],
): 'msgStateQueued' | 'msgStateReceived' | 'msgStateReady' | 'msgStateProcessed' =>
  (
    ({
      queued: 'msgStateQueued',
      received: 'msgStateReceived',
      ready: 'msgStateReady',
      processed: 'msgStateProcessed',
    }) as const
  )[state];

function DirectoryList({
  directories,
  choose,
  locale,
}: {
  directories: AgentDirectory[];
  choose: (node: string, nickname: string) => void;
  locale: Locale;
}): React.JSX.Element {
  return (
    <Stack spacing={1.5}>
      {directories.map((directory) => (
        <Box key={directory.nodeId} data-testid={'directory-' + directory.nodeId}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 650 }}>
              {directory.nodeLabel}
            </Typography>
            <Chip
              size="small"
              color={directory.state === 'ready' ? 'success' : 'default'}
              label={
                {
                  ready: t(locale, 'directoryReady'),
                  syncing: t(locale, 'directorySyncing'),
                  unsupported: t(locale, 'directoryUnsupported'),
                  offline: t(locale, 'directoryOffline'),
                }[directory.state]
              }
            />
          </Stack>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', overflowWrap: 'anywhere' }}
          >
            {directory.nodeId}
          </Typography>
          {directory.updatedAt && (
            <Typography variant="caption" color="text.secondary">
              {t(locale, 'directoryUpdated', { time: time(directory.updatedAt, locale) })}
            </Typography>
          )}
          <List dense disablePadding>
            {directory.agents.map((agent) => (
              <ListItemButton
                key={agent.nickname}
                onClick={() => choose(directory.nodeId, agent.nickname)}
              >
                <ListItemText
                  primary={agent.nickname}
                  secondary={
                    agent.availability === 'online'
                      ? t(locale, 'directoryOnline')
                      : t(locale, 'directoryUnknown')
                  }
                />
              </ListItemButton>
            ))}
          </List>
          {directory.state === 'ready' && !directory.agents.length && (
            <Typography variant="caption" color="text.secondary">
              {t(locale, 'directoryNoAgents')}
            </Typography>
          )}
          {directory.state === 'unsupported' && (
            <Typography variant="caption" color="text.secondary">
              {t(locale, 'directoryPeerOld')}
            </Typography>
          )}
          {directory.truncated && (
            <Alert severity="warning">
              {t(locale, 'directoryTruncated', {
                count: directory.agents.length,
                total: directory.total,
              })}
            </Alert>
          )}
        </Box>
      ))}
    </Stack>
  );
}

function App(): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [page, setPage] = useState<Page>((location.hash.slice(1) as Page) || 'overview');
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(''),
    [messages, setMessages] = useState<Message[]>([]),
    [historySize, setHistorySize] = useState(100),
    [hasMore, setHasMore] = useState(false);
  const [nicknameDialog, setNicknameDialog] = useState(false),
    [nickname, setNickname] = useState('');
  const [address, setAddress] = useState(''),
    [access, setAccess] = useState(''),
    [ownCode, setOwnCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [client, setClient] = useState('cursor'),
    [instructions, setInstructions] = useState<McpInstructions | null>(null);
  const [nodeLabel, setNodeLabel] = useState(''),
    [listenHost, setListenHost] = useState('');
  const [login, setLogin] = useState({ supported: false, openAtLogin: false });
  const [recipient, setRecipient] = useState(''),
    [recipientNick, setRecipientNick] = useState(''),
    [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => loadLocale(window.localStorage));
  const call = useCallback(
    async <T,>(method: string, params: unknown = {}): Promise<T> =>
      window.interconnect.invoke<T>(method, params),
    [],
  );
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
    try {
      const value = await call<Snapshot>('snapshot');
      setSnapshot(value);
      setRecipient((previous) => previous || value.nodeId);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call]);
  useEffect(() => {
    void refresh();
    const off = window.interconnect.onChange(() => {
      void refresh();
    });
    const nav = window.interconnect.onNavigate((tab) => setPage(tab as Page));
    return () => {
      off();
      nav();
    };
  }, [refresh]);
  useEffect(() => {
    if (snapshot) {
      setNodeLabel(snapshot.nodeLabel);
      setListenHost(snapshot.listenHost);
      if (!selected && snapshot.agents.length) setSelected(snapshot.agents[0].nickname);
    }
  }, [snapshot?.nodeLabel, snapshot?.listenHost, snapshot?.agents.length]);
  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const all: Message[] = [];
      let nextCursor = 0,
        more = true;
      while (more && all.length < historySize) {
        const value = await call<{ messages: Message[]; nextCursor: number; hasMore: boolean }>(
          'history',
          { nickname: selected, after: nextCursor, limit: Math.min(200, historySize - all.length) },
        );
        all.push(...value.messages);
        nextCursor = value.nextCursor;
        more = value.hasMore;
      }
      if (!cancelled) {
        setMessages(all);
        setHasMore(more);
      }
    })().catch((e) => {
      if (!cancelled) setError((e as Error).message);
    });
    return () => {
      cancelled = true;
    };
  }, [selected, snapshot, historySize]);
  useEffect(() => {
    if (page === 'mcp')
      void call<McpInstructions>('instructions', { client })
        .then(setInstructions)
        .catch((e) => setError((e as Error).message));
  }, [page, client, snapshot?.mcpUrl]);
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
  const selectedAgent = snapshot.agents.find((c) => c.nickname === selected);
  const chooseRemoteAgent = (nodeId: string, agent: string) => {
    setRecipient(nodeId);
    setRecipientNick(agent);
    setPage('agents');
  };
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
  const title = navigation.find((n) => n.id === page)?.tKey ?? 'navOverview';
  const changeLocale = (next: unknown) => {
    if (!isLocale(next)) return;
    setLocale(next);
    persistLocale(window.localStorage, next);
  };
  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Box
        component="aside"
        sx={{
          width: 240,
          flexShrink: 0,
          bgcolor: '#142c39',
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
        }}
      >
        <Stack direction="row" spacing={1.3} sx={{ alignItems: 'center', px: 1, pt: 2, pb: 4 }}>
          <HubOutlined sx={{ color: '#76c9bc', fontSize: 32 }} />
          <Box>
            <Typography sx={{ fontWeight: 750 }}>NCF Agent Interconnect</Typography>
            <Typography variant="caption" sx={{ color: '#aac0cb' }}>
              {t(locale, 'appSubtitle')}
            </Typography>
          </Box>
        </Stack>
        <List sx={{ flex: 1 }}>
          {navigation.map((n) => (
            <ListItemButton
              key={n.id}
              selected={page === n.id}
              onClick={() => setPage(n.id)}
              sx={{
                borderRadius: 2,
                mb: 0.6,
                '&.Mui-selected': { bgcolor: '#284956' },
                '&.Mui-selected:hover': { bgcolor: '#315562' },
              }}
            >
              <ListItemIcon sx={{ color: '#b9d1da', minWidth: 38 }}>{n.icon}</ListItemIcon>
              <ListItemText
                primary={t(locale, n.tKey)}
                slotProps={{ primary: { sx: { fontSize: 14 } } }}
              />
            </ListItemButton>
          ))}
        </List>
        <Box sx={{ bgcolor: '#203f4c', borderRadius: 2, p: 1.5 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: snapshot.running ? '#83d3ad' : '#f0b57c',
              }}
            />
            <Typography variant="body2">
              {snapshot.running ? t(locale, 'nodeRunning') : t(locale, 'nodeStopped')}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.6, color: '#b9d1da', overflowWrap: 'anywhere' }}
          >
            {snapshot.nodeLabel}
          </Typography>
        </Box>
        <Box sx={{ mt: 1.5, px: 0.5 }}>
          <TextField
            select
            size="small"
            label={t(locale, 'localeTitle')}
            value={locale}
            onChange={(e) => changeLocale(e.target.value)}
            slotProps={{
              inputLabel: { sx: { color: '#aac0cb' } },
              select: {
                sx: {
                  color: '#fff',
                  '.MuiSelect-icon': { color: '#b9d1da' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3a5a66' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#4a6b78' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#76c9bc' },
                },
              },
            }}
            fullWidth
          >
            {supportedLocales.map((option) => (
              <MenuItem key={option} value={option}>
                {localeLabel(option)}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>
      <Box component="main" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack
          component="header"
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 4,
            py: 2.7,
            bgcolor: 'background.paper',
            borderBottom: '1px solid #e2e7ec',
          }}
        >
          <Box>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.3 }}>
              {t(locale, 'headerPrefix', { node: snapshot.nodeLabel })}
            </Typography>
            <Typography variant="h4" sx={{ fontSize: 26 }}>
              {t(locale, title)}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              color={snapshot.running ? 'success' : 'default'}
              variant="outlined"
              label={snapshot.running ? t(locale, 'chipRunning') : t(locale, 'chipStopped')}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => run(() => call(snapshot.running ? 'stop' : 'start'))}
            >
              {snapshot.running ? t(locale, 'btnStop') : t(locale, 'btnStart')}
            </Button>
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
          {page === 'overview' && (
            <Stack spacing={3}>
              <Typography color="text.secondary">{t(locale, 'overviewIntro')}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
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
                  <Paper key={item.label} sx={{ p: 2.5 }}>
                    <Typography color="text.secondary" variant="body2">
                      {item.label}
                    </Typography>
                    <Typography variant="h4" sx={{ my: 1 }}>
                      {item.value}
                    </Typography>
                    <Typography color="text.secondary" variant="caption">
                      {item.hint}
                    </Typography>
                  </Paper>
                ))}
              </Box>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'connectAgentsTitle')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {t(locale, 'connectAgentsBody')}
                </Typography>
                <Button variant="contained" onClick={() => setPage('mcp')}>
                  {t(locale, 'connectAgentsCta')}
                </Button>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'connectPeerTitle')}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  {t(locale, 'connectPeerBody')}
                </Typography>
                <Button variant="outlined" onClick={() => setPage('network')}>
                  {t(locale, 'connectPeerCta')}
                </Button>
              </Paper>
              {snapshot.errors.map((e, i) => (
                <Alert key={i} severity="error">
                  {e}
                </Alert>
              ))}
            </Stack>
          )}
          {page === 'agents' && (
            <Paper
              sx={{
                display: 'flex',
                minHeight: 550,
                height: 'calc(100vh - 185px)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: 240,
                  borderRight: '1px solid #e2e7ec',
                  display: 'flex',
                  flexDirection: 'column',
                  flexShrink: 0,
                }}
              >
                <Stack
                  direction="row"
                  sx={{ p: 2, justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Typography sx={{ fontWeight: 650 }}>{t(locale, 'agentsTitle')}</Typography>
                  <IconButton
                    size="small"
                    aria-label={t(locale, 'ariaAddAgent')}
                    onClick={() => setNicknameDialog(true)}
                  >
                    <AddOutlined />
                  </IconButton>
                </Stack>
                <Divider />
                <List sx={{ overflow: 'auto' }}>
                  {snapshot.agents.map((c) => (
                    <ListItemButton
                      key={c.key}
                      selected={c.nickname === selected}
                      onClick={() => {
                        if (c.nickname === selected) return;
                        setMessages([]);
                        setHistorySize(100);
                        setSelected(c.nickname);
                      }}
                    >
                      <ListItemText
                        primary={c.nickname}
                        secondary={
                          c.binding
                            ? t(locale, 'agentListClient', { client: c.binding.client })
                            : t(locale, 'agentNoChat')
                        }
                      />
                      {!!c.unread && <Chip size="small" color="primary" label={c.unread} />}
                    </ListItemButton>
                  ))}
                </List>
                {!snapshot.agents.length && (
                  <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
                    {t(locale, 'agentEmptyPrompt')}
                  </Typography>
                )}
                {!!snapshot.peers.length && (
                  <Box sx={{ p: 2, borderTop: '1px solid #e2e7ec', overflow: 'auto' }}>
                    <Typography sx={{ fontWeight: 650, mb: 1 }}>
                      {t(locale, 'agentsRemoteTitle')}
                    </Typography>
                    <DirectoryList
                      directories={snapshot.directories.filter((directory) => !directory.local)}
                      choose={chooseRemoteAgent}
                      locale={locale}
                    />
                  </Box>
                )}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                {selected ? (
                  <>
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 2,
                        borderBottom: '1px solid #e2e7ec',
                      }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 650 }}>{selected}</Typography>
                        <Typography color="text.secondary" variant="caption">
                          {selectedAgent?.binding
                            ? t(locale, 'agentListClient', { client: selectedAgent.binding.client })
                            : t(locale, 'agentHistoryNoChat')}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(locale, 'agentMessages', {
                          count: selectedAgent?.messageCount ?? 0,
                        })}
                      />
                    </Stack>
                    <Stack
                      spacing={2}
                      sx={{ flex: 1, overflow: 'auto', p: 2.5, bgcolor: '#f8fafb' }}
                    >
                      {messages.map((m) => (
                        <Paper
                          key={m.envelope.id + m.direction}
                          sx={{
                            p: 2,
                            ml: m.direction === 'out' ? 4 : 0,
                            mr: m.direction === 'in' ? 4 : 0,
                            borderLeft: `3px solid ${m.direction === 'in' ? '#91b9d3' : '#72b7a9'}`,
                          }}
                        >
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {m.envelope.fromNickname} → {m.envelope.toNickname}
                            </Typography>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={
                                m.direction === 'in'
                                  ? t(locale, 'msgIncoming')
                                  : t(locale, 'msgOutgoing')
                              }
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {time(m.envelope.createdAt, locale)}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', overflowWrap: 'anywhere' }}
                          >
                            {t(locale, 'msgFromNode', {
                              from: m.envelope.fromNode,
                              to: m.envelope.toNode,
                            })}
                          </Typography>
                          <Typography
                            sx={{
                              whiteSpace: 'pre-wrap',
                              overflowWrap: 'anywhere',
                              mt: 1.2,
                              lineHeight: 1.65,
                            }}
                          >
                            {m.envelope.text}
                          </Typography>
                          {m.envelope.attachments.map((f) => (
                            <Stack
                              key={f.id}
                              direction="row"
                              spacing={1}
                              sx={{
                                alignItems: 'center',
                                bgcolor: '#eff3f5',
                                borderRadius: 1.5,
                                px: 1.5,
                                py: 0.5,
                                mt: 1.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ flex: 1, overflowWrap: 'anywhere' }}
                              >
                                {t(locale, 'msgAttachmentSize', {
                                  name: f.name,
                                  size: Math.ceil(f.size / 1024),
                                })}
                              </Typography>
                              <Tooltip title={t(locale, 'msgOpenVerified')}>
                                <IconButton
                                  aria-label={t(locale, 'msgOpenAria', { name: f.name })}
                                  onClick={() =>
                                    run(() =>
                                      call('openAttachment', {
                                        messageId: m.envelope.id,
                                        fileId: f.id,
                                      }),
                                    )
                                  }
                                >
                                  <OpenInNewOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={t(locale, 'msgSaveAs')}>
                                <IconButton
                                  aria-label={t(locale, 'msgSaveAria', { name: f.name })}
                                  onClick={() =>
                                    run(() =>
                                      call('saveAttachment', {
                                        messageId: m.envelope.id,
                                        fileId: f.id,
                                      }),
                                    )
                                  }
                                >
                                  <DownloadOutlined fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          ))}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 1 }}
                          >
                            {t(locale, messageStateKey(m.state))}
                          </Typography>
                          {m.error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              {m.error}
                            </Alert>
                          )}
                        </Paper>
                      ))}
                      {!messages.length && (
                        <Typography color="text.secondary">{t(locale, 'msgNoMessages')}</Typography>
                      )}
                      {hasMore && (
                        <Button onClick={() => setHistorySize((size) => size + 100)}>
                          {t(locale, 'msgLoadMore')}
                        </Button>
                      )}
                    </Stack>
                    <Box sx={{ borderTop: '1px solid #e2e7ec', p: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          select
                          label={t(locale, 'composeRecipientNode')}
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          sx={{ minWidth: 180 }}
                        >
                          <MenuItem value={snapshot.nodeId}>
                            {t(locale, 'composeThisComputer')}
                          </MenuItem>
                          {snapshot.peers.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label={t(locale, 'composeRecipientAgent')}
                          value={recipientNick}
                          onChange={(e) => setRecipientNick(e.target.value)}
                          fullWidth
                        />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label={t(locale, 'composeMessage')}
                          multiline
                          maxRows={4}
                          fullWidth
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                        <Button
                          variant="contained"
                          aria-label={t(locale, 'composeSend')}
                          disabled={busy || !text.trim() || !recipient || !recipientNick.trim()}
                          onClick={() =>
                            run(async () => {
                              await call('send', {
                                nickname: selected,
                                recipientNode: recipient,
                                recipientNickname: recipientNick,
                                text,
                              });
                              setText('');
                            })
                          }
                        >
                          <SendOutlined />
                        </Button>
                      </Stack>
                    </Box>
                  </>
                ) : (
                  <Stack
                    spacing={2}
                    sx={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <ForumOutlined sx={{ fontSize: 40, color: 'text.secondary' }} />
                    <Typography color="text.secondary">{t(locale, 'agentsSelect')}</Typography>
                  </Stack>
                )}
              </Box>
            </Paper>
          )}
          {page === 'network' && (
            <Stack spacing={3}>
              <Paper sx={{ p: 3 }}>
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
              <Paper sx={{ p: 3 }}>
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
              {snapshot.peers.map((p) => (
                <Paper key={p.id} sx={{ p: 2.5 }}>
                  <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
                    <Box>
                      <Typography sx={{ fontWeight: 650 }}>{p.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {p.address || t(locale, 'networkIncoming')}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {p.id}
                      </Typography>
                    </Box>
                    <Chip
                      color={p.connected ? 'success' : 'default'}
                      label={
                        p.connected ? t(locale, 'networkConnected') : t(locale, 'networkWaiting')
                      }
                    />
                  </Stack>
                  {p.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {p.error}
                    </Alert>
                  )}
                  <Box sx={{ mt: 2 }}>
                    <DirectoryList
                      directories={snapshot.directories.filter(
                        (directory) => directory.nodeId === p.id,
                      )}
                      choose={chooseRemoteAgent}
                      locale={locale}
                    />
                  </Box>
                </Paper>
              ))}
            </Stack>
          )}
          {page === 'mcp' && (
            <Stack spacing={2.5}>
              <Alert severity="info">{t(locale, 'mcpYouControl')}</Alert>
              <Paper sx={{ p: 3 }}>
                <TextField
                  select
                  label={t(locale, 'mcpYourClient')}
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  sx={{ minWidth: 230 }}
                >
                  <MenuItem value="cursor">{t(locale, 'mcpClientCursor')}</MenuItem>
                  <MenuItem value="opencode">{t(locale, 'mcpClientOpencode')}</MenuItem>
                  <MenuItem value="codex">{t(locale, 'mcpClientCodex')}</MenuItem>
                </TextField>
                {instructions && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                      {t(locale, 'mcpStep1')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {instructions.location}
                    </Typography>
                    <Typography sx={{ mb: 2 }}>{instructions.text}</Typography>
                    <Box
                      component="pre"
                      sx={{
                        m: 0,
                        p: 2,
                        bgcolor: '#f0f4f6',
                        borderRadius: 2,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        fontSize: 13,
                      }}
                    >
                      {instructions.configuration}
                    </Box>
                    <Button
                      startIcon={<ContentCopyOutlined />}
                      onClick={() => copy(instructions.configuration)}
                    >
                      {t(locale, 'btnCopyConfig')}
                    </Button>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                      {t(locale, 'mcpStep2')}
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {instructions.testPrompt}
                    </Typography>
                    <Button
                      startIcon={<ContentCopyOutlined />}
                      onClick={() => copy(instructions.testPrompt)}
                    >
                      {t(locale, 'btnCopyPrompt')}
                    </Button>
                  </>
                )}
              </Paper>
              <Typography color="text.secondary">{t(locale, 'mcpFooter')}</Typography>
            </Stack>
          )}
          {page === 'clients' && (
            <Stack spacing={2.5}>
              <Typography color="text.secondary">{t(locale, 'clientsIntro')}</Typography>
              {(['opencode-http', 'codex-desktop', 'manual'] as const).map((kind) => {
                const profiles = snapshot.adapters.filter((a) => a.kind === kind),
                  ids = new Set(profiles.map((a) => a.id));
                const agents = snapshot.agents.filter(
                  (a) => a.binding && ids.has(a.binding.adapterId),
                );
                const ready = profiles.some((a) => a.state === 'ready');
                return (
                  <Paper key={kind} sx={{ p: 3 }}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'center' }}
                    >
                      <Typography variant="h6">
                        {kind === 'opencode-http'
                          ? t(locale, 'clientsKindOpencode')
                          : kind === 'codex-desktop'
                            ? t(locale, 'clientsKindCodex')
                            : t(locale, 'clientsKindManual')}
                      </Typography>
                      <Chip
                        color={ready ? 'success' : 'default'}
                        label={
                          ready
                            ? t(locale, 'clientsConnected')
                            : agents.length
                              ? kind === 'manual'
                                ? t(locale, 'clientsReceiveMcp')
                                : t(locale, 'clientsPaused')
                              : t(locale, 'clientsNoAgents')
                        }
                      />
                    </Stack>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {kind === 'opencode-http'
                        ? t(locale, 'clientsDetailOpencode')
                        : kind === 'codex-desktop'
                          ? t(locale, 'clientsDetailCodex')
                          : t(locale, 'clientsDetailManual')}
                    </Typography>
                    {agents.map((a) => {
                      const state = profiles.find((p) => p.id === a.binding?.adapterId);
                      return (
                        <Typography key={a.key} variant="body2" sx={{ mt: 1.5 }}>
                          {a.nickname} · {a.binding?.client} ·{' '}
                          {state?.state === 'ready'
                            ? t(locale, 'clientsAuto')
                            : kind === 'manual'
                              ? t(locale, 'clientsReceiveMcp')
                              : t(locale, 'clientsPaused')}
                        </Typography>
                      );
                    })}
                    {profiles
                      .filter((a) => a.error)
                      .map((a) => (
                        <Alert
                          key={a.id}
                          severity={a.state === 'uncertain' ? 'warning' : 'error'}
                          sx={{ mt: 2 }}
                        >
                          {agents
                            .filter((agent) => agent.binding?.adapterId === a.id)
                            .map((agent) => agent.nickname)
                            .join(', ') || t(locale, 'clientsConnectionFallback')}
                          : {a.error}
                        </Alert>
                      ))}
                    <Button
                      sx={{ mt: 2 }}
                      onClick={() => {
                        setClient(
                          kind === 'opencode-http'
                            ? 'opencode'
                            : kind === 'codex-desktop'
                              ? 'codex'
                              : 'cursor',
                        );
                        setPage('mcp');
                      }}
                    >
                      {t(locale, 'clientsCta')}
                    </Button>
                  </Paper>
                );
              })}
            </Stack>
          )}
          {page === 'settings' && (
            <Stack spacing={3}>
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
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {t(locale, 'settingsDiagnostics')}
                </Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {t(locale, 'settingsNodeId', { id: snapshot.nodeId })}
                </Typography>
                <Typography variant="body2">
                  {t(locale, 'settingsMcp', { url: snapshot.mcpUrl })}
                </Typography>
                <Typography variant="body2">
                  {t(locale, 'settingsListening', { url: snapshot.peerUrl })}
                </Typography>
                {snapshot.errors.length ? (
                  snapshot.errors.map((e, i) => (
                    <Alert severity="error" key={i} sx={{ mt: 1 }}>
                      {e}
                    </Alert>
                  ))
                ) : (
                  <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                    {t(locale, 'settingsNoErrors')}
                  </Typography>
                )}
              </Paper>
            </Stack>
          )}
        </Box>
      </Box>
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
            <Alert severity="warning" sx={{ mt: 2 }}>
              {t(locale, 'dialogNameUsed', {
                nodes: nameConflicts
                  .map(({ directory }) => `${directory.nodeLabel} (${directory.nodeId})`)
                  .join(', '),
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
                const result = await call<{ nickname: string }>('registerAgent', { nickname });
                setSelected(result.nickname);
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
    </Box>
  );
}
createRoot(document.getElementById('root')!).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);

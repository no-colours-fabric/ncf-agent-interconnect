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
import type { Snapshot, Message, McpInstructions } from '../shared/contracts.js';

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
const navigation: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <HubOutlined /> },
  { id: 'agents', label: 'Agents', icon: <ForumOutlined /> },
  { id: 'network', label: 'Remote nodes', icon: <CableOutlined /> },
  { id: 'mcp', label: 'MCP setup', icon: <ExtensionOutlined /> },
  { id: 'clients', label: 'Applications', icon: <ExtensionOutlined /> },
  { id: 'settings', label: 'Settings', icon: <SettingsOutlined /> },
];
const time = (value: string) => new Date(value).toLocaleString('en-US');

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
        <Typography>Starting the messaging node</Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    );
  const selectedAgent = snapshot.agents.find((c) => c.nickname === selected);
  const copy = (value: string) => run(() => call('copy', { text: value }), 'Copied');
  const title = navigation.find((n) => n.id === page)?.label ?? 'Overview';
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
              Local messaging node
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
              <ListItemText primary={n.label} slotProps={{ primary: { sx: { fontSize: 14 } } }} />
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
              {snapshot.running ? 'Node running' : 'Node stopped'}
            </Typography>
          </Stack>
          <Typography
            variant="caption"
            sx={{ display: 'block', mt: 0.6, color: '#b9d1da', overflowWrap: 'anywhere' }}
          >
            {snapshot.nodeLabel}
          </Typography>
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
              NODE / {snapshot.nodeLabel}
            </Typography>
            <Typography variant="h4" sx={{ fontSize: 26 }}>
              {title}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Chip
              size="small"
              color={snapshot.running ? 'success' : 'default'}
              variant="outlined"
              label={snapshot.running ? 'Running' : 'Stopped'}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={busy}
              onClick={() => run(() => call(snapshot.running ? 'stop' : 'start'))}
            >
              {snapshot.running ? 'Stop' : 'Start'}
            </Button>
          </Stack>
        </Stack>
        <Box sx={{ flex: 1, overflow: 'auto', px: 4, py: 3 }}>
          {page === 'overview' && (
            <Stack spacing={3}>
              <Typography color="text.secondary">
                Messages are stored on this computer and remain available when you switch chats or
                clients.
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 2 }}>
                {[
                  {
                    label: 'Remote nodes',
                    value: `${snapshot.peers.filter((p) => p.connected).length} / ${snapshot.peers.length}`,
                    hint: 'connected',
                  },
                  { label: 'Agents', value: snapshot.agents.length, hint: 'persistent history' },
                  {
                    label: 'Inbox',
                    value: snapshot.agents.reduce((s, c) => s + c.unread, 0),
                    hint: 'not received by agents',
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
                  Connect agents
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Choose your client, copy the configuration and add it to its MCP settings. The app
                  does not change client settings.
                </Typography>
                <Button variant="contained" onClick={() => setPage('mcp')}>
                  Open MCP setup
                </Button>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Connect another computer
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Enter the remote node IP or URL and the access code provided by its user.
                </Typography>
                <Button variant="outlined" onClick={() => setPage('network')}>
                  Set up a connection
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
                  <Typography sx={{ fontWeight: 650 }}>Agents</Typography>
                  <IconButton
                    size="small"
                    aria-label="Add agent"
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
                        setMessages([]);
                        setHistorySize(100);
                        setSelected(c.nickname);
                      }}
                    >
                      <ListItemText
                        primary={c.nickname}
                        secondary={c.binding ? `Client: ${c.binding.client}` : 'No active chat'}
                      />
                      {!!c.unread && <Chip size="small" color="primary" label={c.unread} />}
                    </ListItemButton>
                  ))}
                </List>
                {!snapshot.agents.length && (
                  <Typography color="text.secondary" variant="body2" sx={{ p: 2 }}>
                    Add an agent with a name of your choice.
                  </Typography>
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
                            ? `Client: ${selectedAgent.binding.client}`
                            : 'History is available; no active chat'}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Messages: ${selectedAgent?.messageCount ?? 0}`}
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
                              label={m.direction === 'in' ? 'Incoming message' : 'Outgoing'}
                            />
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {time(m.envelope.createdAt)}
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
                                {f.name} · {Math.ceil(f.size / 1024)} KB
                              </Typography>
                              <Tooltip title="Open verified file">
                                <IconButton
                                  aria-label={`Open ${f.name}`}
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
                              <Tooltip title="Save as">
                                <IconButton
                                  aria-label={`Save ${f.name}`}
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
                            {
                              {
                                queued: 'Sent',
                                received: 'Receiving attachments',
                                ready: m.direction === 'out' ? 'Sent' : 'New message',
                                processed: 'Received by agent',
                              }[m.state]
                            }
                          </Typography>
                          {m.error && (
                            <Alert severity="error" sx={{ mt: 1 }}>
                              {m.error}
                            </Alert>
                          )}
                        </Paper>
                      ))}
                      {!messages.length && (
                        <Typography color="text.secondary">No messages yet.</Typography>
                      )}
                      {hasMore && (
                        <Button onClick={() => setHistorySize((size) => size + 100)}>
                          Load more messages
                        </Button>
                      )}
                    </Stack>
                    <Box sx={{ borderTop: '1px solid #e2e7ec', p: 2 }}>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TextField
                          select
                          label="Recipient node"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          sx={{ minWidth: 180 }}
                        >
                          <MenuItem value={snapshot.nodeId}>This computer</MenuItem>
                          {snapshot.peers.map((p) => (
                            <MenuItem key={p.id} value={p.id}>
                              {p.label}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          label="Recipient agent name"
                          value={recipientNick}
                          onChange={(e) => setRecipientNick(e.target.value)}
                          fullWidth
                        />
                      </Stack>
                      <Stack direction="row" spacing={1}>
                        <TextField
                          label="Message from the user"
                          multiline
                          maxRows={4}
                          fullWidth
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                        <Button
                          variant="contained"
                          aria-label="Send message"
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
                    <Typography color="text.secondary">Select or add an agent</Typography>
                  </Stack>
                )}
              </Box>
            </Paper>
          )}
          {page === 'network' && (
            <Stack spacing={3}>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  This node
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  Listening address: {snapshot.peerUrl}
                </Typography>
                {snapshot.listenHost === '127.0.0.1' && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    To connect another computer, choose a local network IP in Node settings.
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  disabled={busy || !snapshot.running}
                  onClick={() => run(async () => setOwnCode(await call('accessCode')))}
                >
                  Create temporary access code
                </Button>
                {ownCode && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      A code for one other node. Expires at {time(ownCode.expiresAt)}.
                    </Typography>
                    <TextField
                      value={ownCode.code}
                      multiline
                      maxRows={3}
                      fullWidth
                      slotProps={{ input: { readOnly: true } }}
                    />
                    <Button startIcon={<ContentCopyOutlined />} onClick={() => copy(ownCode.code)}>
                      Copy code
                    </Button>
                  </Box>
                )}
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Connect a remote node
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Exact remote IP:port or URL"
                    placeholder="192.0.2.10:7336 or wss://host:port/peer"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    fullWidth
                  />
                  <TextField
                    label="Access code from the remote node user"
                    value={access}
                    onChange={(e) => setAccess(e.target.value)}
                    multiline
                    maxRows={3}
                    fullWidth
                  />
                  <Box>
                    <Button
                      disabled={busy || !address.trim() || !access.trim() || !snapshot.running}
                      variant="contained"
                      onClick={() =>
                        run(async () => {
                          await call('connectPeer', { address, code: access.trim() });
                          setAccess('');
                        }, 'Node authorized. Connecting.')
                      }
                    >
                      Connect
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
                        {p.address || 'Incoming connection'}
                      </Typography>
                    </Box>
                    <Chip
                      color={p.connected ? 'success' : 'default'}
                      label={p.connected ? 'Connected' : 'Waiting for connection'}
                    />
                  </Stack>
                  {p.error && (
                    <Alert severity="error" sx={{ mt: 2 }}>
                      {p.error}
                    </Alert>
                  )}
                </Paper>
              ))}
            </Stack>
          )}
          {page === 'mcp' && (
            <Stack spacing={2.5}>
              <Alert severity="info">
                You control setup. The app does not edit Cursor, OpenCode or Codex configurations.
              </Alert>
              <Paper sx={{ p: 3 }}>
                <TextField
                  select
                  label="Your client"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  sx={{ minWidth: 230 }}
                >
                  <MenuItem value="cursor">Cursor</MenuItem>
                  <MenuItem value="opencode">OpenCode</MenuItem>
                  <MenuItem value="codex">Codex / separate profile</MenuItem>
                </TextField>
                {instructions && (
                  <>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                      1. Add the configuration
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
                      Copy configuration
                    </Button>
                    <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
                      2. Choose an agent name in any chat
                    </Typography>
                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                      {instructions.testPrompt}
                    </Typography>
                    <Button
                      startIcon={<ContentCopyOutlined />}
                      onClick={() => copy(instructions.testPrompt)}
                    >
                      Copy example prompt
                    </Button>
                  </>
                )}
              </Paper>
              <Typography color="text.secondary">
                You choose the name. The current chat is bound automatically. Configure each
                application once; new chats do not need separate setup.
              </Typography>
            </Stack>
          )}
          {page === 'clients' && (
            <Stack spacing={2.5}>
              <Typography color="text.secondary">
                Connect an application once, then choose an agent name in any of its chats. The
                integration manages chat bindings and delivery.
              </Typography>
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
                          ? 'OpenCode and its frontends'
                          : kind === 'codex-desktop'
                            ? 'Codex Desktop'
                            : 'Cursor and other MCP clients'}
                      </Typography>
                      <Chip
                        color={ready ? 'success' : 'default'}
                        label={
                          ready
                            ? 'Connected'
                            : agents.length
                              ? kind === 'manual'
                                ? 'Receive through MCP'
                                : 'Delivery paused'
                              : 'No connected agents'
                        }
                      />
                    </Stack>
                    <Typography color="text.secondary" sx={{ mt: 1 }}>
                      {kind === 'opencode-http'
                        ? 'The bundled plugin identifies the current chat and delivers incoming messages automatically. A busy agent receives messages when it becomes idle.'
                        : kind === 'codex-desktop'
                          ? 'The chat and profile are identified from MCP metadata. Messages include the sender, body and attachment links. The Desktop integration is experimental and depends on the Codex version.'
                          : 'No manual session setup is required. Send and receive through MCP. This connection cannot wake an idle chat automatically.'}
                    </Typography>
                    {agents.map((a) => {
                      const state = profiles.find((p) => p.id === a.binding?.adapterId);
                      return (
                        <Typography key={a.key} variant="body2" sx={{ mt: 1.5 }}>
                          {a.nickname} · {a.binding?.client} ·{' '}
                          {state?.state === 'ready'
                            ? 'Automatic delivery'
                            : kind === 'manual'
                              ? 'Receive through MCP'
                              : 'Delivery paused'}
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
                            .join(', ') || 'Connection'}
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
                      Setup instructions
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
                  Node settings
                </Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Node name"
                    value={nodeLabel}
                    onChange={(e) => setNodeLabel(e.target.value)}
                  />
                  <TextField
                    select
                    label="Local IP for incoming connections"
                    value={listenHost}
                    onChange={(e) => setListenHost(e.target.value)}
                  >
                    {snapshot.localAddresses.map((ip) => (
                      <MenuItem key={ip} value={ip}>
                        {ip}
                        {ip === '127.0.0.1' ? ' — this computer only' : ''}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Box>
                    <Button
                      variant="contained"
                      disabled={busy}
                      onClick={() =>
                        run(() => call('saveNode', { nodeLabel, listenHost }), 'Settings saved')
                      }
                    >
                      Save
                    </Button>
                  </Box>
                </Stack>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Background operation
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }}>
                  Closing the window keeps the node running in the tray. Quit closes the app and its
                  connections.
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
                  label="Start at login"
                />
                {!login.supported && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Start at login is available in the installed app.
                  </Typography>
                )}
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Permitted export folders
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
                  Add folder
                </Button>
              </Paper>
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Diagnostics
                </Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  Node: {snapshot.nodeId}
                </Typography>
                <Typography variant="body2">MCP: {snapshot.mcpUrl}</Typography>
                <Typography variant="body2">Listening: {snapshot.peerUrl}</Typography>
                {snapshot.errors.length ? (
                  snapshot.errors.map((e, i) => (
                    <Alert severity="error" key={i} sx={{ mt: 1 }}>
                      {e}
                    </Alert>
                  ))
                ) : (
                  <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
                    No application errors
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
        <DialogTitle>Add agent</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            You choose the agent name. With your approval, the agent can move to another chat while
            keeping its message history.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Agent name"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNicknameDialog(false)}>Cancel</Button>
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
            Add
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

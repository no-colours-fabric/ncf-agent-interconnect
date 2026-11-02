import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import {
  nicknameKey,
  type AgentClearInput,
  type AgentClearResponse,
  type AgentClearResult,
  type Snapshot,
} from '../shared/contracts.js';
import { AgentClearFlow, agentCacheKey } from './agent-clear-model.js';
import { AgentClearSummary } from './AgentClearControls.js';
import { AgentsTable } from './AgentsTable.js';
import { agentRows, type AgentRow } from './agents-table-model.js';
import { AgentChatHistory } from './AgentChatHistory.js';
import { useChatHistory } from './useChatHistory.js';
import { t, type Locale } from './i18n/index.js';

export function AgentsPage({
  snapshot,
  locale,
  nodeName,
  call,
  run,
  onError,
  onAdd,
  onCleared,
}: {
  snapshot: Snapshot;
  locale: Locale;
  nodeName: (id: string) => string;
  call: <T = unknown>(method: string, params?: unknown) => Promise<T>;
  run: (work: () => Promise<unknown>) => Promise<void>;
  onError: (error: string) => void;
  onAdd: () => void;
  onCleared: (result: AgentClearResult, names: string[]) => void;
}): React.JSX.Element {
  const rows = agentRows(snapshot);
  const [chat, setChat] = useState<AgentRow | null>(null);
  const [historySize, setHistorySize] = useState(100);
  const [recipient, setRecipient] = useState('');
  const [sender, setSender] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const selected = chat?.local
    ? snapshot.agents.find((agent) => agent.key === chat.identity?.key)
    : undefined;
  const source = chat?.local
    ? selected
    : snapshot.agents.find((agent) => agentCacheKey(agent) === sender);
  const current = rows.find((row) => row.id === chat?.id) ?? chat;
  const validChat =
    !!chat &&
    (chat.local
      ? !!selected && agentCacheKey(selected) === agentCacheKey(chat.identity)
      : snapshot.peers.some((peer) => peer.id === chat.nodeId));
  useEffect(() => {
    if (chat && !validChat) {
      setChat(null);
      setText('');
      setRecipient('');
    }
    if (sender && !snapshot.agents.some((agent) => agentCacheKey(agent) === sender)) {
      setSender('');
      setText('');
    }
  }, [snapshot, chat, validChat, sender]);
  const history = useChatHistory({
    owner: validChat && chat?.local ? chat.nickname : '',
    snapshot,
    size: historySize,
    active: validChat && !!chat?.local,
    onError,
  });
  const clear = useMemo(
    () =>
      new AgentClearFlow((input: AgentClearInput) =>
        call<AgentClearResponse>('clearAgents', input),
      ),
    [call],
  );
  const deletion = useSyncExternalStore(clear.subscribe, clear.getSnapshot, clear.getSnapshot);
  useEffect(() => () => clear.cancel(), [clear]);
  const all = deletion.input?.scope === 'all';
  const openChat = (agent: AgentRow) => {
    setHistorySize(100);
    setChat(agent);
    setRecipient('');
    setText('');
  };
  const closeChat = () => {
    setChat(null);
    setText('');
    setRecipient('');
  };
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ justifyContent: 'space-between', flexWrap: 'wrap' }}
      >
        <Button variant="contained" startIcon={<AddOutlined />} onClick={onAdd}>
          {t(locale, 'ariaAddAgent')}
        </Button>
        <Button
          color="error"
          disabled={!!deletion.busy || !snapshot.agents.length}
          data-testid="clear-all-local-agents"
          onClick={() => {
            void clear.begin({ scope: 'all' });
          }}
        >
          {t(locale, 'clearAllLocalAgents')}
        </Button>
      </Stack>
      <AgentsTable
        rows={rows}
        locale={locale}
        nodeName={nodeName}
        onChat={openChat}
        onDelete={(agent) => {
          if (agent.local) void clear.begin({ scope: 'agent', nickname: agent.nickname });
        }}
        labels={{
          name: t(locale, 'agentsColumnName'),
          client: t(locale, 'agentsColumnClient'),
          node: t(locale, 'agentsColumnNode'),
          lastMessage: t(locale, 'agentsColumnLastMessage'),
          incoming: t(locale, 'agentsColumnIncoming'),
          outgoing: t(locale, 'agentsColumnOutgoing'),
          actions: t(locale, 'agentsColumnActions'),
          chat: (name) => t(locale, 'agentsChatAria', { name }),
          remove: (name) => t(locale, 'agentsDeleteAria', { name }),
          remoteRemoval: t(locale, 'agentsRemoteDeleteHelp'),
        }}
      />
      {snapshot.directories
        .filter((directory) => !directory.local && directory.truncated)
        .map((directory) => (
          <Alert severity="warning" key={directory.nodeId}>
            {nodeName(directory.nodeId)}:{' '}
            {t(locale, 'directoryTruncated', {
              count: directory.agents.length,
              total: directory.total,
            })}
          </Alert>
        ))}
      <Drawer
        anchor="right"
        open={validChat}
        onClose={closeChat}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': 'agent-chat-title',
            sx: {
              width: { xs: '100%', sm: 580 },
              maxWidth: '100vw',
              display: 'flex',
              overflow: 'hidden',
            },
          },
        }}
      >
        {chat && current && validChat && (
          <>
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ alignItems: 'center', p: 2.5, borderBottom: '1px solid #e2e7ec' }}
            >
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {Array.from(chat.nickname).slice(0, 2).join('').toLocaleUpperCase(locale)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography id="agent-chat-title" variant="h6" sx={{ overflowWrap: 'anywhere' }}>
                  {chat.nickname}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', overflowWrap: 'anywhere' }}
                >
                  {nodeName(chat.nodeId)}
                  {current.client ? ' · ' + current.client : ''}
                </Typography>
              </Box>
              <Tooltip title={t(locale, 'chatClose')}>
                <IconButton aria-label={t(locale, 'chatClose')} onClick={closeChat}>
                  <CloseOutlined />
                </IconButton>
              </Tooltip>
            </Stack>
            {chat.local ? (
              <AgentChatHistory
                key={agentCacheKey(selected)}
                messages={history.messages}
                hasMore={history.hasMore}
                loading={history.loading}
                loadMore={() => {
                  if (!history.loading) setHistorySize((size) => size + 100);
                }}
                locale={locale}
                run={run}
                call={call}
                nodeName={nodeName}
              />
            ) : (
              <Box sx={{ flex: 1, p: 2.5, bgcolor: '#f4f7f8' }}>
                <Typography variant="body2" color="text.secondary">
                  {t(locale, 'chatRemoteNoHistory')}
                </Typography>
              </Box>
            )}
            <Box data-testid="agent-chat-compose" sx={{ p: 2.5, borderTop: '1px solid #e2e7ec' }}>
              <Stack spacing={1.5}>
                {chat.local ? (
                  <>
                    <Typography variant="caption" color="text.secondary">
                      {t(locale, 'composeSenderAgent')}: {chat.nickname}
                    </Typography>
                    <TextField
                      label={t(locale, 'composeRecipientAgent')}
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      fullWidth
                    />
                  </>
                ) : (
                  <TextField
                    select
                    label={t(locale, 'composeSenderAgent')}
                    value={source ? sender : ''}
                    onChange={(event) => setSender(event.target.value)}
                    fullWidth
                  >
                    {snapshot.agents.map((agent) => (
                      <MenuItem key={agentCacheKey(agent)} value={agentCacheKey(agent)!}>
                        {agent.nickname}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
                  <TextField
                    label={t(locale, 'composeMessage')}
                    multiline
                    minRows={2}
                    maxRows={6}
                    fullWidth
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                  />
                  <Tooltip title={t(locale, 'composeSend')}>
                    <span>
                      <IconButton
                        color="primary"
                        aria-label={t(locale, 'composeSend')}
                        disabled={
                          sending || !source || !text.trim() || (chat.local && !recipient.trim())
                        }
                        onClick={() => {
                          if (!source) return;
                          setSending(true);
                          void run(async () => {
                            await call('send', {
                              nickname: source.nickname,
                              sourceIncarnation: source.incarnation,
                              recipientNode: chat.nodeId,
                              recipientNickname: chat.local ? recipient.trim() : chat.nickname,
                              text,
                            });
                            setText('');
                          }).finally(() => setSending(false));
                        }}
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          borderRadius: 2,
                          '&:hover': { bgcolor: 'primary.dark' },
                        }}
                      >
                        <SendOutlined />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Box>
          </>
        )}
      </Drawer>
      <Dialog
        open={deletion.open}
        onClose={() => clear.cancel()}
        fullWidth
        maxWidth="sm"
        aria-labelledby="agent-clear-title"
      >
        <DialogTitle id="agent-clear-title">
          {t(locale, all ? 'clearAllAgentsTitle' : 'clearAgentTitle')}
        </DialogTitle>
        <DialogContent>
          <AgentClearSummary state={deletion} locale={locale} />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button disabled={deletion.busy === 'confirm'} onClick={() => clear.cancel()}>
            {t(locale, 'btnCancel')}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={!!deletion.busy || !deletion.preview?.agentCount}
            onClick={() => {
              const names = deletion.preview?.targets.map((target) => target.nickname) ?? [];
              void clear.confirm().then((result) => {
                if (result) {
                  if (
                    chat?.local &&
                    names.some((name) => nicknameKey(name) === nicknameKey(chat.nickname))
                  )
                    closeChat();
                  onCleared(result, names);
                }
              });
            }}
          >
            {t(locale, all ? 'clearAllAgentsConfirm' : 'clearAgentConfirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

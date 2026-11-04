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
import ChatBubbleOutlineOutlined from '@mui/icons-material/ChatBubbleOutlineOutlined';
import CloseOutlined from '@mui/icons-material/CloseOutlined';
import SendOutlined from '@mui/icons-material/SendOutlined';
import {
  nicknameKey,
  nicknameSchema,
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
import { designTokens } from './theme.js';

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
  const [composerOpen, setComposerOpen] = useState(false);
  const [routes, setRoutes] = useState<Record<string, { recipient: string; sender: string }>>({});
  const [drafts, setDrafts] = useState<Record<string, { text: string }>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [sendErrors, setSendErrors] = useState<
    Record<string, { message: string; from: string; to: string }>
  >({});
  const chatKey = chat ? chat.id + ':' + (agentCacheKey(chat.identity) ?? 'remote') : '';
  const recipient = routes[chatKey]?.recipient ?? '';
  const sender = routes[chatKey]?.sender ?? '';
  const setRoute = (change: Partial<{ recipient: string; sender: string }>) => {
    retainDraft();
    setRoutes((current) => ({
      ...current,
      [chatKey]: { recipient, sender, ...change },
    }));
  };
  const clearSendError = (key: string) =>
    setSendErrors((current) => {
      if (!current[key]) return current;
      const remaining = { ...current };
      delete remaining[key];
      return remaining;
    });
  const selected = chat?.local
    ? snapshot.agents.find((agent) => agent.key === chat.identity?.key)
    : undefined;
  const source = chat?.local
    ? selected
    : snapshot.agents.find((agent) => agentCacheKey(agent) === sender);
  const destination = chat?.local ? recipient.trim() : (chat?.nickname ?? '');
  const destinationIdentity = nicknameSchema.safeParse(destination);
  const addressKey = JSON.stringify([
    chatKey,
    agentCacheKey(source) ?? sender,
    chat?.nodeId,
    destinationIdentity.success
      ? ['nickname', nicknameKey(destinationIdentity.data)]
      : ['draft', destination],
  ]);
  const draft = drafts[addressKey];
  const text = draft?.text ?? '';
  // Each edit replaces the revision, including an edit back to the same text.
  const setText = (value: string) => {
    setDrafts((current) => ({ ...current, [addressKey]: { text: value } }));
  };
  const retainDraft = () => {
    setDrafts((current) =>
      current[addressKey]
        ? { ...current, [addressKey]: { text: current[addressKey].text } }
        : current,
    );
  };
  const sendError = sendErrors[addressKey];
  const current = rows.find((row) => row.id === chat?.id) ?? chat;
  const validChat =
    !!chat &&
    (chat.local
      ? !!selected && agentCacheKey(selected) === agentCacheKey(chat.identity)
      : snapshot.peers.some((peer) => peer.id === chat.nodeId));
  useEffect(() => {
    if (chat && !validChat) {
      setChat(null);
    }
  }, [chat, validChat]);
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
    retainDraft();
    setHistorySize(100);
    setChat(agent);
    setComposerOpen(false);
  };
  const closeChat = () => {
    retainDraft();
    setChat(null);
    setComposerOpen(false);
  };
  const sendMessage = () => {
    if (!chat || !source || !draft) return;
    const sentDraft = draft;
    const sentAddressKey = addressKey;
    const recipientNickname = chat.local ? recipient.trim() : chat.nickname;
    clearSendError(sentAddressKey);
    setSending((current) => ({ ...current, [sentAddressKey]: true }));
    void run(async () => {
      try {
        await call('send', {
          nickname: source.nickname,
          sourceIncarnation: source.incarnation,
          recipientNode: chat.nodeId,
          recipientNickname,
          text: sentDraft.text,
        });
        setDrafts((current) =>
          current[sentAddressKey] === sentDraft
            ? { ...current, [sentAddressKey]: { text: '' } }
            : current,
        );
      } catch (error) {
        setSendErrors((current) => ({
          ...current,
          [sentAddressKey]: {
            message: error instanceof Error ? error.message : String(error),
            from: source.nickname,
            to: recipientNickname,
          },
        }));
        throw error;
      }
    }).finally(() => setSending((current) => ({ ...current, [sentAddressKey]: false })));
  };
  const sendErrorAlert = sendError && (
    <Alert severity="error" onClose={() => clearSendError(addressKey)}>
      <Typography variant="caption" component="div">
        {sendError.from} → {sendError.to}
      </Typography>
      {sendError.message}
    </Alert>
  );
  const chatHeader = chat && current && (
    <Stack
      direction="row"
      spacing={1.5}
      data-testid="agent-chat-header"
      sx={{
        alignItems: 'center',
        px: 2,
        py: 1.5,
        flexShrink: 0,
        borderBottom: `1px solid ${designTokens.headerBorder}`,
        boxShadow: designTokens.headerShadow,
      }}
    >
      <Avatar sx={{ width: 32, height: 32, fontSize: 13 }}>
        {Array.from(chat.nickname).slice(0, 2).join('').toLocaleUpperCase(locale)}
      </Avatar>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          id="agent-chat-title"
          component="h2"
          sx={{ fontSize: 16, fontWeight: 500, overflowWrap: 'anywhere' }}
        >
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
  );
  const composer = chat && (
    <Box
      id="agent-chat-compose-panel"
      data-testid="agent-chat-compose"
      sx={{
        px: chat.local ? 2 : 0,
        pb: chat.local ? 2 : 0,
        flexShrink: chat.local ? 1 : 0,
        minHeight: 0,
        overflowY: chat.local ? 'auto' : undefined,
      }}
    >
      <Stack spacing={1.5}>
        {sendErrorAlert}
        {chat.local ? (
          <>
            <TextField
              label={t(locale, 'composeRecipientAgent')}
              value={recipient}
              onChange={(event) => setRoute({ recipient: event.target.value })}
              fullWidth
            />
          </>
        ) : (
          <TextField
            select
            label={t(locale, 'composeSenderAgent')}
            value={source ? sender : ''}
            onChange={(event) => setRoute({ sender: event.target.value })}
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
            maxRows={4}
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
                  !!sending[addressKey] ||
                  !source ||
                  !text.trim() ||
                  (chat.local && !recipient.trim())
                }
                onClick={sendMessage}
                sx={{
                  width: 44,
                  height: 44,
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: '8px',
                  border: `1px solid ${designTokens.primaryButtonBorder}`,
                  backgroundImage: designTokens.primaryButtonGradient,
                  boxShadow: designTokens.primaryButtonShadow,
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                    bgcolor: designTokens.disabledBackground,
                    backgroundImage: 'none',
                    borderColor: designTokens.border,
                    boxShadow: 'none',
                  },
                }}
              >
                <SendOutlined />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
  return (
    <Stack spacing={2} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
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
        open={validChat && !!chat?.local}
        onClose={closeChat}
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': 'agent-chat-title',
            sx: {
              width: { xs: '100%', sm: 720 },
              maxWidth: '100vw',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            },
          },
        }}
      >
        {chat?.local && validChat && (
          <>
            {chatHeader}
            <AgentChatHistory
              key={agentCacheKey(selected)}
              layoutKey={composerOpen}
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
            {sendError && !composerOpen && (
              <Box sx={{ px: 2, py: 1, flexShrink: 0 }}>{sendErrorAlert}</Box>
            )}
            <Box
              data-testid="agent-chat-compose-section"
              sx={{
                flexShrink: 0,
                minHeight: 0,
                maxHeight: '60%',
                display: 'flex',
                flexDirection: 'column',
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: designTokens.composerBackground,
              }}
            >
              <Stack
                data-testid="agent-chat-compose-header"
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', flexShrink: 0, px: 2, py: 0.5 }}
              >
                <Typography variant="body2" sx={{ fontWeight: 500, flexShrink: 0 }}>
                  {t(locale, 'chatNewMessage')}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ flex: 1, textAlign: 'right', overflowWrap: 'anywhere' }}
                >
                  {composerOpen ? `${t(locale, 'composeSenderAgent')}: ${chat.nickname}` : ''}
                </Typography>
                <Tooltip title={t(locale, composerOpen ? 'chatCloseComposer' : 'chatOpenComposer')}>
                  <IconButton
                    color={composerOpen ? 'secondary' : 'default'}
                    aria-label={t(locale, composerOpen ? 'chatCloseComposer' : 'chatOpenComposer')}
                    aria-expanded={composerOpen}
                    aria-controls="agent-chat-compose-panel"
                    data-testid="agent-chat-compose-toggle"
                    onClick={() => setComposerOpen((open) => !open)}
                  >
                    {composerOpen ? <CloseOutlined /> : <ChatBubbleOutlineOutlined />}
                  </IconButton>
                </Tooltip>
              </Stack>
              {composerOpen && composer}
            </Box>
          </>
        )}
      </Drawer>
      <Dialog
        open={validChat && !!chat && !chat.local}
        onClose={closeChat}
        fullWidth
        maxWidth="sm"
        aria-labelledby="agent-chat-title"
        data-testid="remote-agent-compose-dialog"
        slotProps={{ paper: { sx: { overflow: 'hidden' } } }}
      >
        {chat && !chat.local && validChat && (
          <>
            {chatHeader}
            <DialogContent sx={{ p: 2, '&:first-of-type': { pt: 2 } }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t(locale, 'chatRemoteNoHistory')}
              </Typography>
              {composer}
            </DialogContent>
          </>
        )}
      </Dialog>
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

import React, { useLayoutEffect, useRef } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import type { Message } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';
import { designTokens, surfaceSx } from './theme.js';

const messageKey = (message: Message | undefined) =>
  message ? message.envelope.id + ':' + message.direction : '';
function scrollPosition(element: HTMLDivElement) {
  const viewport = element.getBoundingClientRect();
  const anchor = [...element.querySelectorAll<HTMLElement>('[data-message-key]')].find((item) => {
    const bounds = item.getBoundingClientRect();
    return bounds.bottom > viewport.top && bounds.top < viewport.bottom;
  });
  return {
    anchor: anchor
      ? {
          key: anchor.dataset.messageKey,
          offset: anchor.getBoundingClientRect().top - viewport.top,
        }
      : null,
    atBottom: element.scrollHeight - element.scrollTop - element.clientHeight < 64,
  };
}
const messageStateKey = {
  queued: 'msgStateQueued',
  received: 'msgStateReceived',
  ready: 'msgStateReady',
  processed: 'msgStateProcessed',
} as const;

export function AgentChatHistory({
  messages,
  hasMore,
  loading,
  loadMore,
  locale,
  run,
  call,
  nodeName,
}: {
  messages: Message[];
  hasMore: boolean;
  loading: boolean;
  loadMore: () => void;
  locale: Locale;
  run: (work: () => Promise<unknown>) => Promise<void>;
  call: (method: string, params: unknown) => Promise<unknown>;
  nodeName: (id: string) => string;
}): React.JSX.Element {
  const scroll = useRef<HTMLDivElement>(null);
  const previous = useRef<ReturnType<typeof scrollPosition> | null>(null);
  useLayoutEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const old = previous.current;
    if (!old || old.atBottom) element.scrollTop = element.scrollHeight;
    else if (old.anchor) {
      // Anchor a visible row through prepends and loading-indicator layout changes.
      const anchor = [...element.querySelectorAll<HTMLElement>('[data-message-key]')].find(
        (item) => item.dataset.messageKey === old.anchor?.key,
      );
      if (anchor)
        element.scrollTop +=
          anchor.getBoundingClientRect().top -
          element.getBoundingClientRect().top -
          old.anchor.offset;
    }
    previous.current = scrollPosition(element);
  }, [messages, hasMore, loading, locale]);

  return (
    <Box
      ref={scroll}
      data-testid="agent-chat-history"
      onScroll={() => {
        const element = scroll.current;
        if (!element) return;
        previous.current = scrollPosition(element);
        if (element.scrollTop < 64 && hasMore && !loading) loadMore();
      }}
      sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowAnchor: 'none' }}
    >
      <Stack spacing={3} sx={{ p: { xs: 2, sm: 3 }, minHeight: '100%', boxSizing: 'border-box' }}>
        {hasMore && (
          <Button disabled={loading} onClick={loadMore} sx={{ alignSelf: 'center' }}>
            {loading ? <CircularProgress size={20} /> : t(locale, 'msgLoadMore')}
          </Button>
        )}
        {!messages.length && loading && <CircularProgress size={24} sx={{ alignSelf: 'center' }} />}
        <Box sx={{ flex: 1 }} />
        {messages.map((message) => {
          const { envelope, direction, state, error } = message;
          const outgoing = direction === 'out';
          return (
            <Stack
              key={messageKey(message)}
              data-testid="chat-message"
              data-message-key={messageKey(message)}
              data-direction={direction}
              data-sequence={message.sequence}
              direction={outgoing ? 'row-reverse' : 'row'}
              spacing={1}
              sx={{ alignItems: 'flex-end', width: '100%' }}
            >
              <Avatar
                aria-label={envelope.fromNickname}
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {Array.from(envelope.fromNickname).slice(0, 2).join('').toLocaleUpperCase(locale)}
              </Avatar>
              <Paper
                sx={{
                  p: 2,
                  maxWidth: '84%',
                  minWidth: 0,
                  backgroundColor: outgoing
                    ? designTokens.chatOutgoingBackground
                    : designTokens.chatIncomingBackground,
                  backgroundImage: outgoing
                    ? designTokens.chatOutgoingGradient
                    : designTokens.chatIncomingGradient,
                  borderColor: outgoing
                    ? designTokens.chatOutgoingBorder
                    : designTokens.chatIncomingBorder,
                  borderTopColor: outgoing
                    ? designTokens.chatOutgoingBorderHighlight
                    : designTokens.chatIncomingBorderHighlight,
                  borderRadius: outgoing ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.75, textAlign: outgoing ? 'right' : 'left' }}
                >
                  {t(locale, outgoing ? 'msgOutgoing' : 'msgIncoming')}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
                  {envelope.fromNickname} → {envelope.toNickname}
                </Typography>
                <Typography
                  data-testid="message-node-labels"
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', overflowWrap: 'anywhere' }}
                >
                  {t(locale, 'msgFromNode', {
                    from: nodeName(envelope.fromNode),
                    to: nodeName(envelope.toNode),
                  })}
                </Typography>
                <Typography
                  data-testid="message-text"
                  variant="body2"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    mt: 1.25,
                    lineHeight: 1.65,
                  }}
                >
                  {envelope.text}
                </Typography>
                {envelope.attachments.map((file) => (
                  <Stack
                    key={file.id}
                    direction="row"
                    spacing={0.5}
                    sx={{
                      alignItems: 'center',
                      ...surfaceSx('inset'),
                      borderRadius: '8px',
                      p: 0.75,
                      mt: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}
                    >
                      {t(locale, 'msgAttachmentSize', {
                        name: file.name,
                        size: Math.ceil(file.size / 1024),
                      })}
                    </Typography>
                    <Tooltip title={t(locale, 'msgOpenVerified')}>
                      <IconButton
                        size="small"
                        aria-label={t(locale, 'msgOpenAria', { name: file.name })}
                        onClick={() =>
                          run(() =>
                            call('openAttachment', { messageId: envelope.id, fileId: file.id }),
                          )
                        }
                      >
                        <OpenInNewOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t(locale, 'msgSaveAs')}>
                      <IconButton
                        size="small"
                        aria-label={t(locale, 'msgSaveAria', { name: file.name })}
                        onClick={() =>
                          run(() =>
                            call('saveAttachment', { messageId: envelope.id, fileId: file.id }),
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
                  color={state === 'received' ? 'success.main' : 'text.secondary'}
                  sx={{ display: 'block', mt: 1.5, textAlign: 'right' }}
                >
                  {new Date(envelope.createdAt).toLocaleString(locale)} ·{' '}
                  {state === 'received' && (
                    <Box
                      component="span"
                      aria-hidden="true"
                      sx={{
                        display: 'inline-block',
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        verticalAlign: 'middle',
                        mr: 0.75,
                        bgcolor: 'success.main',
                        boxShadow: designTokens.statusGlow,
                      }}
                    />
                  )}
                  {t(locale, messageStateKey[state])}
                </Typography>
                {error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {error}
                  </Alert>
                )}
              </Paper>
            </Stack>
          );
        })}
        {!messages.length && !loading && (
          <Typography color="text.secondary">{t(locale, 'msgNoMessages')}</Typography>
        )}
      </Stack>
    </Box>
  );
}

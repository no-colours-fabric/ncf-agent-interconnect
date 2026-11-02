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
      sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowAnchor: 'none', bgcolor: '#f4f7f8' }}
    >
      <Stack spacing={2} sx={{ p: 2.5, minHeight: '100%', boxSizing: 'border-box' }}>
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
              sx={{ alignItems: 'flex-end' }}
            >
              <Avatar
                aria-label={envelope.fromNickname}
                sx={{
                  width: 32,
                  height: 32,
                  fontSize: 13,
                  bgcolor: outgoing ? '#176b62' : '#305d87',
                }}
              >
                {Array.from(envelope.fromNickname).slice(0, 2).join('').toLocaleUpperCase(locale)}
              </Avatar>
              <Paper
                sx={{
                  p: 1.5,
                  maxWidth: 'calc(100% - 60px)',
                  minWidth: 0,
                  bgcolor: outgoing ? '#e1f0eb' : 'background.paper',
                  borderRadius: outgoing ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, overflowWrap: 'anywhere' }}>
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
                    mt: 0.75,
                    lineHeight: 1.6,
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
                      bgcolor: 'rgba(0,0,0,0.035)',
                      borderRadius: 1,
                      p: 0.5,
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
                  color="text.secondary"
                  sx={{ display: 'block', mt: 1, textAlign: 'right' }}
                >
                  {new Date(envelope.createdAt).toLocaleString(locale)} ·{' '}
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

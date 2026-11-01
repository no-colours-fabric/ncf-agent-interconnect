import React from 'react';
import { Alert, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import type { Message } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';

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

export function AgentHistory({
  messages,
  hasMore,
  loadMore,
  locale,
  run,
  call,
  nodeName,
}: {
  messages: Message[];
  hasMore: boolean;
  loadMore: () => void;
  locale: Locale;
  run: (work: () => Promise<unknown>) => Promise<void>;
  call: (method: string, params: unknown) => Promise<unknown>;
  nodeName: (id: string) => string;
}): React.JSX.Element {
  return (
    <Stack spacing={2} sx={{ flex: 1, overflow: 'auto', p: 2.5, bgcolor: '#f8fafb' }}>
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
              label={m.direction === 'in' ? t(locale, 'msgIncoming') : t(locale, 'msgOutgoing')}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            {time(m.envelope.createdAt, locale)}
          </Typography>
          <Typography
            data-testid="message-node-labels"
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', overflowWrap: 'anywhere' }}
          >
            {t(locale, 'msgFromNode', {
              from: nodeName(m.envelope.fromNode),
              to: nodeName(m.envelope.toNode),
            })}
          </Typography>
          <Typography
            data-testid="message-text"
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
              <Typography variant="body2" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
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
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
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
      {hasMore && <Button onClick={loadMore}>{t(locale, 'msgLoadMore')}</Button>}
    </Stack>
  );
}

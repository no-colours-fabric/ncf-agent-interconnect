import React from 'react';
import { Alert, Button, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import OpenInNewOutlined from '@mui/icons-material/OpenInNewOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import type { Message } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';
import { surfaceSx } from './theme.js';

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
    <Stack spacing={3} sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 3 }}>
      {messages.map((m) => (
        <Paper
          key={m.envelope.id + m.direction}
          sx={{
            p: 2,
            width: '84%',
            alignSelf: m.direction === 'out' ? 'flex-end' : 'flex-start',
            backgroundColor: m.direction === 'out' ? '#383d3d' : '#303235',
            backgroundImage:
              m.direction === 'out'
                ? 'linear-gradient(135deg, #424646, #333838)'
                : 'linear-gradient(135deg, #37393c, #2c2e31)',
            borderRadius: m.direction === 'out' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, overflowWrap: 'anywhere' }}>
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
                ...surfaceSx('inset'),
                borderRadius: '8px',
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
          <Typography
            variant="caption"
            color={m.state === 'received' ? 'success.main' : 'text.secondary'}
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
      {hasMore && <Button onClick={loadMore}>{t(locale, 'msgLoadMore')}</Button>}
    </Stack>
  );
}

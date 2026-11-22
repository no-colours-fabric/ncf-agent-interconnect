import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import React, { useId, useState } from 'react';
import type { McpSetupInvoke } from '../shared/mcp-setup.js';
import { cursorReplyPermissionMessages } from './i18n/cursor-reply-permission.js';
import type { Locale } from './i18n/index.js';
import { surfaceSx } from './theme.js';

export const cursorReplyPermissionEntry = 'ncf_agent_interconnect:agent_send';

export const copyCursorReplyPermission = (invoke: McpSetupInvoke): Promise<unknown> =>
  invoke('copy', { text: cursorReplyPermissionEntry });

export function CursorReplyPermission({
  invoke,
  locale,
}: {
  invoke: McpSetupInvoke;
  locale: Locale;
}) {
  const copy = cursorReplyPermissionMessages(locale);
  const titleId = useId();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  return (
    <Stack
      component="section"
      aria-labelledby={titleId}
      data-testid="cursor-reply-permission"
      spacing={1.25}
      sx={{ maxWidth: 720, pt: 1 }}
    >
      <Typography id={titleId} component="h4" variant="subtitle2">
        {copy.title}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {copy.intro}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {copy.instructions}
      </Typography>
      <Box>
        <Typography component="p" variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
          {copy.entryLabel}
        </Typography>
        <Box
          component="code"
          sx={{
            ...surfaceSx('inset'),
            display: 'block',
            p: 1.5,
            fontSize: 12,
            overflowWrap: 'anywhere',
            userSelect: 'text',
          }}
        >
          {cursorReplyPermissionEntry}
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {copy.scope}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<ContentCopyOutlined />}
        onClick={() => {
          setCopyState('idle');
          void copyCursorReplyPermission(invoke)
            .then(() => setCopyState('copied'))
            .catch(() => setCopyState('failed'));
        }}
        sx={{ alignSelf: 'flex-start' }}
      >
        {copy.copy}
      </Button>
      <Box aria-live="polite">
        {copyState === 'copied' && (
          <Typography variant="caption" color="success.main">
            {copy.copied}
          </Typography>
        )}
        {copyState === 'failed' && <Alert severity="error">{copy.copyFailed}</Alert>}
      </Box>
    </Stack>
  );
}

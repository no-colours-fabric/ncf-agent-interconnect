import React from 'react';
import { Alert, Box, ButtonBase, Chip, List, Stack, Typography } from '@mui/material';
import type { AgentDirectory } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';

export function CompactPeerDirectory({
  directories,
  choose,
  locale,
}: {
  directories: AgentDirectory[];
  choose: (node: string, nickname: string) => void;
  locale: Locale;
}): React.JSX.Element {
  return (
    <Stack spacing={1}>
      {directories.map((directory) => (
        <Box key={directory.nodeId} data-testid={'directory-' + directory.nodeId}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 0.75 }}
          >
            {directory.state !== 'ready' && (
              <Chip
                size="small"
                label={
                  {
                    syncing: t(locale, 'directorySyncing'),
                    offline: t(locale, 'directoryOffline'),
                    unsupported: t(locale, 'directoryUnsupported'),
                  }[directory.state]
                }
              />
            )}
            {directory.updatedAt && (
              <Typography variant="caption" color="text.secondary">
                {t(locale, 'directoryUpdated', {
                  time: new Date(directory.updatedAt).toLocaleString(locale),
                })}
              </Typography>
            )}
          </Stack>
          <List dense disablePadding aria-label={t(locale, 'agentsRemoteTitle')}>
            {directory.agents.map((agent) => (
              <Box component="li" key={agent.nickname} sx={{ listStyle: 'none' }}>
                <ButtonBase
                  data-testid="compact-peer-agent"
                  onClick={() => choose(directory.nodeId, agent.nickname)}
                  sx={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: 2,
                    textAlign: 'left',
                    px: 1,
                    py: 0.75,
                    minHeight: 36,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    '&:hover, &.Mui-focusVisible': { bgcolor: 'action.hover' },
                    '&.Mui-focusVisible': {
                      outline: '2px solid',
                      outlineColor: 'primary.main',
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                  >
                    {agent.nickname}
                  </Typography>
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                    sx={{ overflowWrap: 'anywhere', minWidth: 0 }}
                  >
                    {agent.availability === 'online'
                      ? t(locale, 'directoryOnline')
                      : t(locale, 'directoryUnknown')}
                  </Typography>
                </ButtonBase>
              </Box>
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
            <Alert severity="warning" sx={{ mt: 1 }}>
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

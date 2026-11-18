import React from 'react';
import { Box, Chip, Link, Paper, Stack } from '@mui/material';
import AddToQueueOutlined from '@mui/icons-material/AddToQueueOutlined';
import ComputerOutlined from '@mui/icons-material/ComputerOutlined';
import PublicOutlined from '@mui/icons-material/PublicOutlined';
import type { Snapshot } from '../shared/contracts.js';
import { t, type Locale } from './i18n/index.js';
import { lanSearchMessages } from './i18n/lan-search.js';
import { unpairedLanNodes } from './NetworkPage.js';
import { designTokens, surfaceSx } from './theme.js';

function NodeChip({
  name,
  active,
  status,
  local = false,
}: {
  name: string;
  active: boolean;
  status: string;
  local?: boolean;
}) {
  return (
    <Chip
      component="li"
      variant="outlined"
      title={name + ' · ' + status}
      data-active={active}
      icon={local ? <ComputerOutlined /> : <PublicOutlined />}
      label={
        <Stack component="span" direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </Box>
          <Box
            component="span"
            role="img"
            aria-label={status}
            sx={{
              flexShrink: 0,
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: active ? 'success.main' : 'text.disabled',
            }}
          />
        </Stack>
      }
      sx={{
        maxWidth: '100%',
        ...(active && {
          bgcolor: designTokens.successAlertBackground,
          borderColor: designTokens.successAlertBorder,
        }),
      }}
    />
  );
}

export function OverviewConnections({
  snapshot,
  locale,
  nodeName,
  onConnect,
  onSettings,
  onConnectionCode,
}: {
  snapshot: Snapshot;
  locale: Locale;
  nodeName: (nodeId: string) => string;
  onConnect: (nodeId: string) => void;
  onSettings: () => void;
  onConnectionCode: () => void;
}): React.JSX.Element {
  const messages = lanSearchMessages(locale);
  const newlyFound = unpairedLanNodes(snapshot).filter(
    (node) => node.newlyFound && node.nodeId !== snapshot.nodeId,
  );
  return (
    <Paper
      component="section"
      aria-label={t(locale, 'navNetwork')}
      data-testid="overview-connections"
      sx={{ ...surfaceSx('soft'), p: 2.5 }}
    >
      <Stack
        component="ul"
        direction="row"
        useFlexGap
        spacing={1}
        sx={{ p: 0, m: 0, listStyle: 'none', flexWrap: 'wrap', alignItems: 'center' }}
      >
        <NodeChip
          name={nodeName(snapshot.nodeId)}
          active={snapshot.running}
          status={t(locale, snapshot.running ? 'nodeRunning' : 'nodeStopped')}
          local
        />
        {snapshot.peers.map((peer) => {
          const active = snapshot.running && peer.connected;
          return (
            <NodeChip
              key={peer.id}
              name={nodeName(peer.id)}
              active={active}
              status={t(locale, active ? 'networkConnected' : 'networkWaiting')}
            />
          );
        })}
        {newlyFound.map((node) => (
          <Box component="li" key={node.nodeId} sx={{ minWidth: 0, maxWidth: '100%' }}>
            <Chip
              component="button"
              type="button"
              variant="outlined"
              label={node.label}
              title={messages.newLabel + ' · ' + node.label}
              icon={<AddToQueueOutlined />}
              aria-label={t(locale, 'btnConnect') + ' ' + node.label}
              disabled={!snapshot.running}
              onClick={() => onConnect(node.nodeId)}
              sx={{
                maxWidth: '100%',
                color: designTokens.infoAlertText,
                borderColor: designTokens.infoAlertBorder,
                bgcolor: designTokens.infoAlertBackground,
                '& .MuiChip-icon': { color: 'info.main' },
                '&&:hover, &&.Mui-focusVisible': { borderColor: 'info.main' },
              }}
            />
          </Box>
        ))}
      </Stack>
      <Stack direction="row" useFlexGap spacing={2} sx={{ mt: 1.5, flexWrap: 'wrap' }}>
        <Link component="button" type="button" variant="body2" onClick={onSettings}>
          {t(locale, 'connectPeerCta')}
        </Link>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={onConnectionCode}
          disabled={!snapshot.running}
          sx={{ '&:disabled': { color: 'text.disabled', textDecoration: 'none' } }}
        >
          {messages.createCode}
        </Link>
      </Stack>
    </Paper>
  );
}

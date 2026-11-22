import type { ReactNode } from 'react';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { McpSetupClient } from '../shared/mcp-setup.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import type { ApplicationSetupClient } from './application-setup-model.js';
import { surfaceSx } from './theme.js';

export function StartupApplicationTiles({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ containerType: 'inline-size' }}>
      <Box
        data-testid="startup-application-grid"
        sx={{
          '--startup-card-columns': 2,
          '--startup-card-gaps': '16px',
          '@container (max-width: 359px)': {
            '--startup-card-columns': 1,
            '--startup-card-gaps': '0px',
          },
          '@container (min-width: 744px)': {
            '--startup-card-columns': 3,
            '--startup-card-gaps': '32px',
          },
          '@container (min-width: 912px)': {
            '--startup-card-columns': 4,
            '--startup-card-gaps': '48px',
          },
          '@container (min-width: 1056px)': {
            '--startup-card-columns': 6,
            '--startup-card-gaps': '80px',
          },
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          justifyContent: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function StartupApplicationTile({
  client,
  offer,
  name,
  status,
  busy,
  action,
  onConnect,
  children,
}: {
  client: ApplicationSetupClient;
  offer: McpSetupClient;
  name: string;
  status: string;
  busy: boolean;
  action: { label: string; disabled: boolean } | undefined;
  onConnect: () => void;
  children?: ReactNode;
}) {
  return (
    <Stack
      component="article"
      spacing={2}
      aria-label={name}
      data-testid={'startup-application-' + client}
      data-offer-client={offer}
      sx={{
        ...surfaceSx('soft'),
        flex: '0 0 calc((100% - var(--startup-card-gaps)) / var(--startup-card-columns))',
        boxSizing: 'border-box',
        minWidth: 0,
        minHeight: 216,
        p: 2,
        overflowWrap: 'anywhere',
        backgroundImage: 'none',
        boxShadow: 'none',
      }}
    >
      <Stack spacing={1.25} sx={{ flex: 1 }}>
        <ClientLogo client={offer} size={48} />
        <Typography component="h2" sx={{ fontSize: 16, fontWeight: 600 }}>
          {name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }} role="status">
          {busy && <CircularProgress size={14} aria-hidden="true" />}
          <Typography variant="body2" color="text.secondary">
            {status}
          </Typography>
        </Stack>
        {children}
      </Stack>
      {action && (
        <Button
          variant="contained"
          aria-label={action.label + ' — ' + name}
          data-testid={'startup-connect-' + client}
          disabled={action.disabled}
          onClick={onConnect}
        >
          {action.label}
        </Button>
      )}
    </Stack>
  );
}

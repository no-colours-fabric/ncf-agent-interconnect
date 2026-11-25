import type { ReactNode } from 'react';
import { Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { McpSetupClient } from '../shared/mcp-setup.js';
import { ClientLogo } from './ApplicationDiscovery.js';
import type { ApplicationSetupClient } from './application-setup-model.js';
import { surfaceSx } from './theme.js';

export function StartupApplicationTile({
  client,
  offer,
  name,
  status,
  busy,
  compatibilityWarning,
  action,
  onConnect,
  children,
}: {
  client: ApplicationSetupClient;
  offer: McpSetupClient;
  name: string;
  status: string;
  busy: boolean;
  compatibilityWarning: boolean;
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
      data-compatibility-warning={compatibilityWarning || undefined}
      sx={{
        ...surfaceSx('soft'),
        boxSizing: 'border-box',
        minWidth: 0,
        minHeight: 360,
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

import React from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import type { McpSetupClient } from '../shared/mcp-setup.js';
import { applicationNames, type ApplicationInstallation } from '../shared/application-discovery.js';
import type { Locale } from './i18n/index.js';
import {
  discoveryMessages,
  discoveryReasons,
  installationLabel,
} from './i18n/application-discovery.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';

export function InstallationDetails({
  application,
  locale,
}: {
  application: ApplicationInstallation;
  locale: Locale;
}): React.JSX.Element {
  const messages = discoveryMessages(locale);
  return (
    <Box component="details" sx={{ minWidth: 0, fontSize: 12 }}>
      <Box component="summary" sx={{ cursor: 'pointer', py: 0.5 }}>
        {messages.details}
      </Box>
      <Typography variant="caption" component="p" sx={{ mb: 1 }}>
        {messages.limited}
      </Typography>
      {application.instances.map((instance) => (
        <Typography
          component="p"
          variant="caption"
          key={instance.path}
          sx={{ overflowWrap: 'anywhere' }}
        >
          {instance.form === 'desktop' ? messages.desktop : messages.cli}: {instance.path}
        </Typography>
      ))}
      {application.coverage.map((item, index) => (
        <Typography
          key={index}
          component="p"
          variant="caption"
          color="text.secondary"
          sx={{ overflowWrap: 'anywhere' }}
        >
          {item.source}
          {item.reason ? ': ' + discoveryReasons[item.reason] : ''}
        </Typography>
      ))}
    </Box>
  );
}

export function ApplicationDiscovery({
  model,
  locale,
  client,
  onSetup,
}: {
  model: ApplicationDiscoveryModel;
  locale: Locale;
  client?: McpSetupClient;
  onSetup?: (client: McpSetupClient) => void;
}): React.JSX.Element {
  const messages = discoveryMessages(locale);
  const applications =
    model.snapshot?.applications.filter((item) => !client || item.client === client) ?? [];
  return (
    <Paper data-testid="application-discovery" sx={{ p: 2, mb: 2 }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}
      >
        <Typography variant="subtitle2">
          {client ? messages.installation : messages.title}
        </Typography>
        <Button size="small" disabled={model.busy} onClick={() => void model.refresh()}>
          {messages.refresh}
        </Button>
      </Stack>
      <Box role="status" aria-live="polite">
        {model.busy && !model.snapshot && (
          <Typography variant="body2">{messages.checking}</Typography>
        )}
        {model.failed && <Alert severity="warning">{messages.failed}</Alert>}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: client
            ? '1fr'
            : { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        {applications.map((application) => (
          <Box
            key={application.client}
            data-testid={'installation-' + application.client}
            data-installation={application.status}
            sx={{
              p: client ? 0 : 1.5,
              minWidth: 0,
              border: client ? 0 : '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            {!client && (
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {applicationNames[application.client]}
              </Typography>
            )}
            <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
              {installationLabel(application.status, messages)}
            </Typography>
            <Stack direction="row" sx={{ gap: 1, my: 0.5, flexWrap: 'wrap' }}>
              {onSetup && (
                <Button size="small" onClick={() => onSetup(application.client)}>
                  {messages.setup}
                </Button>
              )}
              <Button
                size="small"
                disabled={model.busy}
                onClick={() => void model.choose(application.client)}
              >
                {messages.choose}
              </Button>
            </Stack>
            {application.client === 'claude' &&
              application.instances.some((item) => item.form === 'desktop') && (
                <Typography variant="caption" component="p" sx={{ mb: 1 }}>
                  {messages.claude}
                </Typography>
              )}
            {application.client === 'opencode' && application.status === 'detected' && (
              <Typography variant="caption" component="p" sx={{ mb: 1 }}>
                {messages.opencode}
              </Typography>
            )}
            <InstallationDetails application={application} locale={locale} />
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

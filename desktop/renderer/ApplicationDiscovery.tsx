import React from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import RefreshOutlined from '@mui/icons-material/RefreshOutlined';
import type { McpSetupClient } from '../shared/mcp-setup.js';
import { applicationNames, type ApplicationInstallation } from '../shared/application-discovery.js';
import type { Locale } from './i18n/index.js';
import {
  discoveryMessages,
  discoveryReasonLabel,
  installationLabel,
} from './i18n/application-discovery.js';
import type { ApplicationDiscoveryModel } from './useApplicationDiscovery.js';
import type { McpSetupStatuses } from './mcp-setup-status.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';

const logos: Record<McpSetupClient, string> = {
  cursor: new URL('../assets/client-logos/cursor.svg', import.meta.url).href,
  opencode: new URL('../assets/client-logos/opencode.svg', import.meta.url).href,
  codex: new URL('../assets/client-logos/codex.png', import.meta.url).href,
  aionui: new URL('../assets/client-logos/aionui.svg', import.meta.url).href,
  claude: new URL('../assets/client-logos/claude.png', import.meta.url).href,
};

export function ClientLogo({
  client,
  size = 32,
}: {
  client: McpSetupClient;
  size?: number;
}): React.JSX.Element {
  return (
    <Box
      component="img"
      src={logos[client]}
      alt=""
      width={size}
      height={size}
      sx={{
        objectFit: 'contain',
        flexShrink: 0,
        bgcolor: '#ffffff',
        borderRadius: 0.75,
        p: 0.5,
        boxSizing: 'border-box',
      }}
    />
  );
}

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
          {item.reason ? ': ' + discoveryReasonLabel(item.reason, locale) : ''}
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
  setupStatuses,
}: {
  model: ApplicationDiscoveryModel;
  locale: Locale;
  client?: McpSetupClient;
  onSetup?: (client: McpSetupClient) => void;
  setupStatuses?: McpSetupStatuses;
}): React.JSX.Element {
  const messages = discoveryMessages(locale);
  const setupMessages = mcpSetupMessages(locale);
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
        <Button
          startIcon={<RefreshOutlined />}
          disabled={model.busy}
          onClick={() => void model.refresh()}
        >
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
            : { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' },
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
              <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center', mb: 0.75 }}>
                <ClientLogo client={application.client} />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {applicationNames[application.client]}
                </Typography>
              </Stack>
            )}
            <Typography variant="caption" component="p" sx={{ mt: 0.5 }}>
              {installationLabel(application.status, messages)}
              {client &&
              application.client === 'claude' &&
              application.instances.some((item) => item.form === 'desktop') &&
              !application.instances.some((item) => item.form === 'cli')
                ? ' · ' + messages.desktop
                : ''}
            </Typography>
            {setupStatuses && (
              <Typography variant="caption" component="p" color="text.secondary">
                {setupMessages.statusMcpConfig}:{' '}
                {setupStatuses.errors[application.client]
                  ? setupMessages.unavailable
                  : setupStatuses.statuses[application.client]
                    ? setupMessages[setupStatuses.statuses[application.client]!.state]
                    : setupMessages.checking}
              </Typography>
            )}
            <Stack direction="row" sx={{ gap: 1, my: 0.5, flexWrap: 'wrap' }}>
              {onSetup && (
                <Button
                  size="small"
                  data-testid={'overview-application-' + application.client}
                  onClick={() => onSetup(application.client)}
                >
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
            {client &&
              application.client === 'claude' &&
              application.instances.some((item) => item.form === 'desktop') && (
                <Typography variant="caption" component="p" sx={{ mb: 1 }}>
                  {messages.claude}
                </Typography>
              )}
            {client && application.client === 'opencode' && application.status === 'detected' && (
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

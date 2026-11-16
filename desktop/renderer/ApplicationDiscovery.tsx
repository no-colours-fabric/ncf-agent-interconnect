import React, { useEffect, useRef } from 'react';
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
import type { McpSetupStatuses } from './mcp-setup-status.js';
import { mcpSetupMessages } from './i18n/mcp-setup.js';

const logos: Record<McpSetupClient, string> = {
  cursor: new URL('../assets/client-logos/cursor.svg', import.meta.url).href,
  opencode: new URL('../assets/client-logos/opencode.svg', import.meta.url).href,
  codex: new URL('../assets/client-logos/codex.png', import.meta.url).href,
  aionui: new URL('../assets/client-logos/aionui.svg', import.meta.url).href,
  claude: new URL('../assets/client-logos/claude.png', import.meta.url).href,
};

function ClientLogo({
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

export function ApplicationOffers({
  model,
  locale,
  onSetup,
}: {
  model: ApplicationDiscoveryModel;
  locale: Locale;
  onSetup: (client: McpSetupClient) => void;
}): React.JSX.Element | null {
  const messages = discoveryMessages(locale);
  const element = useRef<HTMLDivElement>(null);
  const visible = model.offers.join(',');
  useEffect(() => {
    const target = element.current;
    if (!target || !visible) return;
    const intersecting = new Set<McpSetupClient>();
    const acknowledge = () => {
      if (document.visibilityState === 'visible' && !target.closest('[aria-hidden="true"]'))
        void model.acknowledge([...intersecting]);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const client = entry.target.getAttribute('data-offer-client') as McpSetupClient;
          if (entry.isIntersecting && entry.intersectionRatio >= 1) intersecting.add(client);
          else intersecting.delete(client);
        }
        acknowledge();
      },
      { threshold: 1 },
    );
    for (const button of target.querySelectorAll('[data-offer-client]')) observer.observe(button);
    const modalChanges = new MutationObserver(acknowledge);
    modalChanges.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden'],
    });
    document.addEventListener('visibilitychange', acknowledge);
    return () => {
      observer.disconnect();
      modalChanges.disconnect();
      document.removeEventListener('visibilitychange', acknowledge);
    };
  }, [visible, model.acknowledge]);
  if (!model.offers.length && !model.snapshot?.stateError && !model.offerError) return null;
  return (
    <Paper ref={element} data-testid="application-offers" sx={{ p: 2, mb: 3 }}>
      {model.offers.length > 0 && (
        <>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', gap: 2, alignItems: 'center' }}
          >
            <Typography variant="subtitle2">{messages.offer}</Typography>
            <Button
              size="small"
              onClick={() => {
                model.dismiss();
              }}
            >
              {messages.dismiss}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {messages.offerHelp}
          </Typography>
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {model.offers.map((client) => (
              <Button
                variant="outlined"
                size="small"
                key={client}
                data-offer-client={client}
                onClick={() => {
                  void model.acknowledge([client]);
                  model.dismiss();
                  onSetup(client);
                }}
              >
                <ClientLogo client={client} size={24} />
                {applicationNames[client]}
              </Button>
            ))}
          </Stack>
        </>
      )}
      {(model.offerError || model.snapshot?.stateError) && (
        <Alert severity="warning">{messages.stateError}</Alert>
      )}
    </Paper>
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

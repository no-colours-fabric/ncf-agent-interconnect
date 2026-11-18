import type React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import type { AdapterProfile, Snapshot } from '../shared/contracts.js';
import type { McpSetupClient, McpSetupStatus } from '../shared/mcp-setup.js';
import type { McpSetupMessages } from './mcp-setup-messages.js';
import type { Locale } from './i18n/index.js';
import { applicationSetupMessages } from './i18n/application-setup.js';

export const setupAdapterKinds: Record<McpSetupClient | 'opencode-v2', AdapterProfile['kind']> = {
  cursor: 'cursor-hook',
  opencode: 'opencode-http',
  'opencode-v2': 'opencode-v2',
  codex: 'codex-desktop',
  aionui: 'aionui',
  claude: 'claude-code',
};

export function hasUsableClientSetup(
  client: McpSetupClient,
  status: McpSetupStatus | undefined,
  error: string | undefined,
  snapshot: Pick<Snapshot, 'adapters' | 'agents'> | undefined,
  aionUiComplete?: boolean,
): boolean {
  const saved =
    !error &&
    status?.client === client &&
    status?.state === 'configured' &&
    (client !== 'aionui' || aionUiComplete === true);
  const working = snapshot?.adapters.some(
    (adapter) =>
      adapter.kind === setupAdapterKinds[client] &&
      !adapter.error &&
      !adapter.released &&
      (adapter.state === 'ready' || adapter.state === 'manual') &&
      snapshot.agents.some((agent) => agent.binding?.adapterId === adapter.id),
  );
  return saved || !!working;
}

export function clientNextStep(
  client: McpSetupClient,
  locale: Locale,
  messages: McpSetupMessages,
): string {
  const copy = applicationSetupMessages(locale);
  return client === 'claude'
    ? copy.claudeReload
    : client === 'cursor'
      ? copy.cursorReload
      : client === 'codex'
        ? messages.codexNext
        : client === 'aionui'
          ? messages.aionRestartAction
          : messages.opencodeNext;
}

/** Requires a current bound chat; saved configuration alone is not a live connection. */
export function hasConnectedClientChat(
  client: McpSetupClient | 'opencode-v2',
  snapshot: Pick<Snapshot, 'adapters' | 'agents'> | undefined,
): boolean {
  return !!snapshot?.adapters.some(
    (adapter) =>
      adapter.kind === setupAdapterKinds[client] &&
      !adapter.error &&
      !adapter.released &&
      adapter.state === 'ready' &&
      snapshot.agents.some((agent) => agent.binding?.adapterId === adapter.id),
  );
}

export function ClientSetupHelp({
  client,
  locale,
  messages,
  openCodeMajor = 1,
}: {
  client: McpSetupClient;
  locale: Locale;
  messages: McpSetupMessages;
  openCodeMajor?: 1 | 2;
}): React.JSX.Element {
  const copy = applicationSetupMessages(locale);
  const next =
    client === 'opencode' && openCodeMajor === 2
      ? copy.openCodeV2Next
      : clientNextStep(client, locale, messages);
  const entries = [
    [copy.confirmQuestion, client === 'claude' ? copy.claudeConfirmAnswer : copy.confirmAnswer],
    [copy.reloadQuestion, next],
    ...(client === 'claude' ? [[copy.permissionsQuestion, copy.permissionsAnswer]] : []),
  ];
  return (
    <Alert
      severity="info"
      role="note"
      data-testid="client-setup-help"
      sx={{ width: '100%', boxSizing: 'border-box' }}
    >
      <Box
        component="ol"
        sx={{
          m: 0,
          pl: 2.5,
          typography: 'body2',
          '& > li + li': { mt: 1.5 },
          '& > li::marker': { fontWeight: 500 },
        }}
      >
        {entries.map(([question, answer]) => (
          <li key={question}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {question}
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              <em>{answer}</em>
            </Typography>
          </li>
        ))}
      </Box>
    </Alert>
  );
}

import type React from 'react';
import { Box, Typography } from '@mui/material';
import type { AdapterProfile, Snapshot } from '../shared/contracts.js';
import type { McpSetupClient, McpSetupStatus } from '../shared/mcp-setup.js';
import type { McpSetupMessages } from './mcp-setup-messages.js';
import type { Locale } from './i18n/index.js';

const kinds: Record<McpSetupClient, AdapterProfile['kind']> = {
  cursor: 'cursor-hook',
  opencode: 'opencode-http',
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
      adapter.kind === kinds[client] &&
      !adapter.error &&
      !adapter.released &&
      (adapter.state === 'ready' || adapter.state === 'manual') &&
      snapshot.agents.some((agent) => agent.binding?.adapterId === adapter.id),
  );
  return saved || !!working;
}

const english = {
  confirmQuestion: 'What may I need to confirm?',
  confirmAnswer:
    'Sign in, trust the workspace and approve client prompts when requested. Moving an occupied agent name needs your approval.',
  reloadQuestion: 'After Apply or an update?',
  claudeReload:
    'Reload the NCF plugins and reconnect MCP in this same chat. If verification is still lost, fully quit and reopen the client.',
  cursorReload: 'Restart Cursor, then send one message in the intended chat to restore delivery.',
  permissionsQuestion: 'Can I save permissions?',
  permissionsAnswer:
    'In /permissions, allow only the NCF tools you want: agent_read, agent_connect and agent_send. Existing deny/ask rules still apply.',
};
const russian: typeof english = {
  confirmQuestion: 'Что может потребовать моего подтверждения?',
  confirmAnswer:
    'Вход в аккаунт, доверие к папке и разрешения клиента. Перенос занятого имени агента требует вашего подтверждения.',
  reloadQuestion: 'Что делать после применения настроек или обновления?',
  claudeReload:
    'Перезагрузите плагины NCF и переподключите MCP в этом же чате. Если проверка связи не восстановилась, полностью выйдите из клиента и откройте его снова.',
  cursorReload:
    'Перезапустите Cursor, затем отправьте одно сообщение в нужном чате для восстановления доставки.',
  permissionsQuestion: 'Можно ли сохранить разрешения?',
  permissionsAnswer:
    'В /permissions разрешите только нужные инструменты NCF: agent_read, agent_connect и agent_send. Правила запрета и обязательного подтверждения сохраняют приоритет.',
};

export function ClientSetupHelp({
  client,
  locale,
  messages,
}: {
  client: McpSetupClient;
  locale: Locale;
  messages: McpSetupMessages;
}): React.JSX.Element {
  const copy = locale === 'ru' ? russian : english;
  const next =
    client === 'claude'
      ? copy.claudeReload
      : client === 'cursor'
        ? copy.cursorReload
        : client === 'codex'
          ? messages.codexNext
          : client === 'aionui'
            ? messages.aionRestartAction
            : messages.opencodeNext;
  const entries = [
    [copy.confirmQuestion, copy.confirmAnswer],
    [copy.reloadQuestion, next],
    ...(client === 'claude' ? [[copy.permissionsQuestion, copy.permissionsAnswer]] : []),
  ];
  return (
    <Box
      component="dl"
      data-testid="client-setup-help"
      sx={{ m: 0, display: 'grid', gap: 1.5, maxWidth: '85ch' }}
    >
      {entries.map(([question, answer]) => (
        <Box key={question}>
          <Typography component="dt" variant="body2" sx={{ fontWeight: 500 }}>
            {question}
          </Typography>
          <Typography component="dd" variant="body2" color="text.secondary" sx={{ m: 0, mt: 0.5 }}>
            {answer}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

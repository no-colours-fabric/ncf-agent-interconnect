import { mcpSetupEnglish, type McpSetupMessages } from '../mcp-setup-messages.js';
import { t, type Locale } from './index.js';

export function mcpSetupMessages(locale: Locale): McpSetupMessages {
  const messages = {} as McpSetupMessages;
  for (const key of Object.keys(mcpSetupEnglish) as (keyof McpSetupMessages)[])
    messages[key] = t(locale, `mcpSetup_${key}`);
  return messages;
}

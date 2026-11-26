// Shared node-side entry to the self-contained shipped plugin's private protocol.
// Importing this module does not start a listener, register a client or write receipts.
export {
  OPEN_CODE_V2_PROTOCOL,
  OPEN_CODE_V2_PIN,
  openCodeV2HostVersion,
  parseOpenCodeV2Provision,
  parseOpenCodeV2Command,
  parseOpenCodeV2Evidence,
  openCodeV2HostMessageId,
  openCodeV2Prompt,
  openCodeV2PayloadHash,
} from '../integrations/opencode-v2.js';
export type {
  OpenCodeV2Provision,
  OpenCodeV2Scope,
  OpenCodeV2Owner,
  OpenCodeV2Command,
  OpenCodeV2Evidence,
  OpenCodeV2Registration,
} from '../integrations/opencode-v2.js';

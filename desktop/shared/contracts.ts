import { z } from 'zod';

export const nicknameSchema = z
  .string()
  .min(1)
  .max(120)
  .refine(
    (s) => s === s.trim() && !/[\x00-\x1f\x7f]/.test(s),
    'Agent names must not contain control characters or leading or trailing spaces',
  );
export const nicknameKey = (nickname: string): string =>
  nicknameSchema
    .parse(nickname)
    .normalize('NFC')
    .toLowerCase()
    .replace(/\u03c2/g, '\u03c3')
    .replace(/ß/g, 'ss');
export const attachmentSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    name: z
      .string()
      .min(1)
      .max(255)
      .refine((v) => !/[\\/\x00-\x1f]/.test(v)),
    size: z
      .number()
      .int()
      .min(0)
      .max(100 * 1024 * 1024),
  })
  .strict();
export type Attachment = z.infer<typeof attachmentSchema>;
export const envelopeSchema = z
  .object({
    protocol: z.literal(2),
    id: z.uuid(),
    fromNode: z.uuid(),
    toNode: z.uuid(),
    fromNickname: nicknameSchema,
    toNickname: nicknameSchema,
    createdAt: z.iso.datetime(),
    text: z.string().min(1).max(65536),
    replyTo: z.uuid().nullable(),
    attachments: z.array(attachmentSchema).max(16),
  })
  .strict();
export type Envelope = z.infer<typeof envelopeSchema>;
export type MessageState = 'queued' | 'received' | 'ready' | 'processed';
export interface Message {
  envelope: Envelope;
  direction: 'in' | 'out';
  state: MessageState;
  sequence: number;
  error: string | null;
}
export interface Binding {
  connectionId: string;
  client: string;
  chatId: string;
  adapterId: string;
  generation: number;
}
export interface AgentIdentity {
  nickname: string;
  key: string;
  binding: Binding | null;
  messageCount: number;
  unread: number;
}
export interface SystemEvent {
  id: number;
  connectionId: string;
  binding: Binding;
  type: 'agent_moved';
  nickname: string;
  text: string;
  createdAt: string;
}
export interface AdapterCapabilities {
  wakeIdle: boolean;
  receiveActive: boolean;
  nativeDisplay: boolean;
  exactSession: boolean;
}
export interface AdapterProfile {
  id: string;
  label: string;
  kind: 'manual' | 'opencode-http' | 'codex-desktop';
  baseUrl?: string;
  sessionId?: string;
  username?: string;
  password?: string;
  threadId?: string;
  socket?: string;
  workspace?: string;
  instanceId?: string;
  hostPid?: number;
  released?: boolean;
}
export interface AdapterState {
  id: string;
  label: string;
  kind: AdapterProfile['kind'];
  capabilities: AdapterCapabilities;
  state: 'manual' | 'ready' | 'checking' | 'error' | 'uncertain';
  error: string | null;
}
export interface Peer {
  id: string;
  label: string;
  address: string;
  secret: string;
  certificate: string;
}
export interface Settings {
  version: 1;
  nodeId: string;
  nodeLabel: string;
  localToken: string;
  mcpPort: number;
  peerPort: number;
  listenHost: string;
  exportRoots: string[];
  peers: Peer[];
  adapters: AdapterProfile[];
}
export interface Snapshot {
  running: boolean;
  nodeId: string;
  nodeLabel: string;
  mcpUrl: string;
  peerUrl: string;
  listenHost: string;
  localAddresses: string[];
  peers: { id: string; label: string; address: string; connected: boolean; error: string | null }[];
  agents: AgentIdentity[];
  adapters: AdapterState[];
  exportRoots: string[];
  errors: string[];
}
export interface McpInstructions {
  client: string;
  location: string;
  text: string;
  configuration: string;
  testPrompt: string;
}
export interface DesktopBridge {
  invoke<T = unknown>(method: string, params?: unknown): Promise<T>;
  onChange(callback: () => void): () => void;
  onNavigate(callback: (tab: string) => void): () => void;
}
declare global {
  interface Window {
    interconnect: DesktopBridge;
  }
}

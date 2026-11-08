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
export const directoryAgentSchema = z
  .object({
    nickname: nicknameSchema,
    availability: z.enum(['online', 'unknown']),
    delivery: z.enum(['mcp', 'automatic', 'unknown']),
  })
  .strict();
export const directorySnapshotSchema = z
  .object({
    epoch: z.uuid(),
    revision: z.number().int().nonnegative(),
    agents: z.array(directoryAgentSchema).max(1000),
    total: z.number().int().nonnegative(),
  })
  .strict()
  .refine((value) => value.total >= value.agents.length, 'Invalid directory count');
export type DirectoryAgent = z.infer<typeof directoryAgentSchema>;
export type DirectorySnapshot = z.infer<typeof directorySnapshotSchema>;
export interface AgentDirectory {
  nodeId: string;
  nodeLabel: string;
  local: boolean;
  state: 'ready' | 'syncing' | 'unsupported' | 'offline';
  epoch: string | null;
  revision: number | null;
  updatedAt: string | null;
  total: number;
  truncated: boolean;
  agents: DirectoryAgent[];
}
export interface NicknameConflict {
  code: 'nickname_on_remote_node';
  nodeId: string;
  nodeLabel: string;
  nickname: string;
  availability: DirectoryAgent['availability'];
}
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
export type DeliveryStatus = 'queued' | 'accepted_by_node' | 'received_by_agent';
export const deliveryStatus = (state: MessageState): DeliveryStatus =>
  state === 'processed' ? 'received_by_agent' : state === 'queued' ? 'queued' : 'accepted_by_node';
export interface SendInput {
  recipientNode: string;
  recipientNickname: string;
  text: string;
  files?: string[];
  id?: string;
  replyTo?: string | null;
}
export interface SendResult {
  id: string;
  accepted: true;
  recipientNode: string;
  recipientNickname: string;
  delivery: DeliveryStatus;
}
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
  incarnation?: string;
  binding: Binding | null;
  messageCount: number;
  unread: number;
  incomingCount?: number;
  outgoingCount?: number;
  lastMessageAt?: string | null;
}
export interface ChatHistoryPage {
  messages: Message[];
  nextCursor: number;
  hasMore: boolean;
}
export interface SystemEvent {
  id: number;
  connectionId: string;
  binding: Binding;
  type: 'agent_moved';
  historyCleared?: true;
  agentRemoved?: true;
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
  kind: 'manual' | 'opencode-http' | 'codex-desktop' | 'cursor-hook' | 'aionui';
  aionConnectionId?: string;
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
  state: 'manual' | 'ready' | 'checking' | 'recovering' | 'error' | 'uncertain';
  error: string | null;
  released?: boolean;
  lastOwnerVerifiedAt?: string;
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
  directories: AgentDirectory[];
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
  managedFiles?: {
    id: string;
    relativePath: string[];
    content: string;
  }[];
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

export type AgentClearScope = 'agent' | 'all';
export interface AgentClearInput {
  scope: AgentClearScope;
  nickname?: string;
  operationId?: string;
  confirm?: boolean;
}
export interface AgentClearPreview {
  status: 'confirmation_required';
  operationId: string;
  scope: AgentClearScope;
  targets: { nickname: string; messageCount: number }[];
  agentCount: number;
  messageCount: number;
  expiresAt: string;
}
export interface AgentClearResult {
  status: 'cleared';
  scope: AgentClearScope;
  agentCount: number;
  messageCount: number;
  limits: string;
}
export type AgentClearResponse = AgentClearPreview | AgentClearResult;

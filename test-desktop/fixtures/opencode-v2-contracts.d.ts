// Narrow independent transcription of the public OpenCode 2.3.0 Promise API.
// Upstream a6b15d33daf6ab7d35569f6d711fdb630b9f04e7:
// packages/plugin/src/promise/{plugin,event,rpc,session}.ts;
// packages/protocol/src/groups/session.ts;
// packages/schema/src/{session-id,session-message,session-inbox,rpc}.ts.
// Runtime tests inject this host; they do not load an account or installed SDK.

export interface PinnedSessionInfo {
  id: string;
  projectID: string;
  location: { directory: string; workspaceID?: string };
  time: { created: number; updated: number; busy?: number; idle?: number };
}

export interface PinnedInboxUser {
  id: string;
  sessionID: string;
  type: 'user';
  time: { created: number };
  delivery: 'steer' | 'queue';
  payload: {
    text: string;
    files?: readonly unknown[];
    agents?: readonly unknown[];
    skills?: readonly unknown[];
    metadata?: Record<string, unknown>;
  };
}

export interface PinnedPromptInput {
  sessionID: string;
  id?: string | null;
  text: string;
  files?: readonly unknown[];
  agents?: readonly unknown[];
  skills?: readonly unknown[];
  metadata?: Record<string, unknown>;
  delivery?: 'steer' | 'queue' | null;
  resume?: boolean | null;
}

export interface PinnedEvent {
  id: string;
  created: number;
  type: PinnedEventType;
  location?: { directory: string; workspaceID?: string };
  durable?: { aggregateID: string; seq: number; version: 1 };
  data: Record<string, unknown>;
}

export type PinnedEventType =
  | 'location.shutdown'
  | 'session.inbox.delivered'
  | 'session.status'
  | 'session.idle'
  | 'session.deleted'
  | 'session.moved'
  | 'session.revert.committed'
  | 'session.compaction.started'
  | 'session.compaction.ended'
  | `rpc.${string}`;

export interface PinnedRpcDefinition {
  id: string;
  methods: Readonly<Record<string, never>>;
  events: Readonly<
    Record<
      string,
      {
        schema: {
          type: 'object';
          properties: Readonly<Record<string, { type: 'string' }>>;
          required: readonly string[];
          additionalProperties: false;
        };
      }
    >
  >;
}

export interface PinnedRegistration {
  dispose(): Promise<void>;
}

export interface PinnedRpcRegistration extends PinnedRegistration {
  events: { emit(name: string, data: Record<string, unknown>): Promise<void> };
}

export interface PinnedContext {
  app: { name: string; version: string; channel: string };
  location: { directory: string; workspaceID?: string };
  options: Readonly<Record<string, unknown>>;
  mcp: {
    transform(
      callback: (editor: {
        get(
          name: string,
        ): { type: string; url?: string; headers?: Record<string, string> } | undefined;
        update(
          name: string,
          change: (entry: { type: string; url?: string; headers?: Record<string, string> }) => void,
        ): void;
      }) => void,
    ): Promise<PinnedRegistration>;
  };
  session: {
    // These return values are direct, not the v1 {data,error,response} envelope.
    get(input: { sessionID: string }): Promise<PinnedSessionInfo>;
    prompt(input: PinnedPromptInput): Promise<PinnedInboxUser>;
    // The pinned Promise adapter takes only input; no cancellation option.
    wait(input: { sessionID: string }): Promise<void>;
  };
  event: {
    subscribe(options?: {
      types?: readonly PinnedEventType[];
      signal?: AbortSignal;
    }): AsyncIterable<PinnedEvent>;
  };
  rpc: {
    register(
      definition: PinnedRpcDefinition,
      handlers: Readonly<Record<string, never>>,
    ): Promise<PinnedRpcRegistration>;
  };
}

export interface PinnedPlugin {
  id: string;
  setup(
    context: PinnedContext,
  ): Promise<(() => Promise<void> | void) | void> | (() => Promise<void> | void) | void;
}

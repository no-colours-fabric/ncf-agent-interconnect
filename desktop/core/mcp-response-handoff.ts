import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { ServerResponse } from 'node:http';
import { isDeepStrictEqual } from 'node:util';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { CallToolResult, JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

const capabilityField = 'ncf/response-handoff';
const maxFrame = 128 * 1024 * 1024;
type Completion = { release(): void; complete(): void; abort(possibleWrite: boolean): void };

/** One actual HTTP invocation. A request ID alone never grants this capability. */
export class ResponseInvocation {
  readonly nonce = randomUUID();
  readonly controller = new AbortController();
  expected?: unknown;
  result?: CallToolResult;
  completion?: Completion;
  writing = false;
  complete = false;
  sealed = false;
  retainedBytes = 0;
  constructor(
    readonly hub: McpResponseHandoff,
    readonly service: string,
    readonly transport: string,
    readonly session: string,
    readonly id: string | number,
    readonly response: ServerResponse,
  ) {}
  assertCurrent(): void {
    if (!this.hub.valid(this)) throw new Error('The MCP response invocation is no longer current');
  }
  associate(completion: Completion): void {
    this.assertCurrent();
    if (this.completion) throw new Error('The MCP invocation already owns a delivery');
    this.completion = completion;
  }
  discardDelivery(): void {
    const completion = this.completion;
    this.completion = undefined;
    try {
      completion?.abort(this.writing);
    } catch {
      /* A failed negative transition must leave the durable fence intact. */
    }
  }
}

/** Local full-response handoff, not a client/model acknowledgement. */
export class McpResponseHandoff {
  readonly context = new AsyncLocalStorage<ResponseInvocation>();
  private readonly active = new Map<string, ResponseInvocation>();
  private readonly capabilities = new Map<string, ResponseInvocation>();
  private readonly transports = new WeakMap<Transport, { id: string; session: string }>();
  private closed = false;
  private retainedBytes = 0;
  private readonly frameLimit: number;
  private readonly invocationLimit: number;
  /** Internal fixtures may lower limits; callers cannot raise production bounds. */
  constructor(
    readonly service: string,
    limits: { frameBytes?: number; invocations?: number } = {},
  ) {
    this.frameLimit = limits.frameBytes ?? maxFrame;
    this.invocationLimit = limits.invocations ?? 128;
    if (
      !Number.isSafeInteger(this.frameLimit) ||
      this.frameLimit < 256 ||
      this.frameLimit > maxFrame ||
      !Number.isSafeInteger(this.invocationLimit) ||
      this.invocationLimit < 1 ||
      this.invocationLimit > 128
    )
      throw new Error('Invalid MCP handoff capacity');
  }
  private key(session: string, id: string | number): string {
    return JSON.stringify([session, typeof id, id]);
  }
  valid(scope: ResponseInvocation): boolean {
    return (
      !this.closed &&
      !scope.controller.signal.aborted &&
      !scope.response.destroyed &&
      this.active.get(this.key(scope.session, scope.id)) === scope
    );
  }
  private forget(scope: ResponseInvocation): void {
    if (this.active.get(this.key(scope.session, scope.id)) === scope)
      this.active.delete(this.key(scope.session, scope.id));
    this.capabilities.delete(scope.nonce);
    this.retainedBytes -= scope.retainedBytes;
    scope.retainedBytes = 0;
    scope.expected = undefined;
    scope.result = undefined;
  }
  private cancelScope(scope: ResponseInvocation): void {
    if (scope.complete || scope.controller.signal.aborted) return;
    scope.controller.abort();
    scope.discardDelivery();
    this.forget(scope);
  }
  cancel(session: string, id: string | number): void {
    const scope = this.active.get(this.key(session, id));
    if (scope) {
      this.cancelScope(scope);
      scope.response.destroy();
    }
  }
  closeSession(session: string): void {
    for (const scope of this.active.values())
      if (scope.session === session) {
        this.cancelScope(scope);
        scope.response.destroy();
      }
  }
  close(): void {
    this.closed = true;
    for (const scope of this.active.values()) {
      this.cancelScope(scope);
      scope.response.destroy();
    }
  }
  begin(
    transport: Transport,
    session: string,
    id: string | number,
    response: ServerResponse,
  ): ResponseInvocation {
    const registered = this.transports.get(transport);
    if (
      this.closed ||
      !registered ||
      registered.session !== session ||
      this.active.size >= this.invocationLimit ||
      this.active.has(this.key(session, id))
    )
      throw new Error('The MCP response invocation is unavailable');
    const scope = new ResponseInvocation(this, this.service, registered.id, session, id, response);
    this.active.set(this.key(session, id), scope);
    this.capabilities.set(scope.nonce, scope);
    const timer = setTimeout(() => {
      this.cancelScope(scope);
      response.destroy();
    }, 300000);
    timer.unref();
    response.once('close', () => {
      clearTimeout(timer);
      this.cancelScope(scope);
    });
    response.once('finish', () => {
      clearTimeout(timer);
      this.cancelScope(scope);
    });
    response.once('error', () => this.cancelScope(scope));
    this.guard(scope);
    return scope;
  }
  seal(scope: ResponseInvocation, result: CallToolResult): CallToolResult {
    scope.assertCurrent();
    if (scope.sealed || Object.hasOwn(result._meta ?? {}, capabilityField))
      throw new Error('The MCP response was already sealed');
    const bytes = Buffer.byteLength(JSON.stringify(result));
    if (bytes > this.frameLimit || this.retainedBytes + bytes > 2 * this.frameLimit)
      throw new Error('The MCP response exceeds the bounded handoff capacity');
    scope.result = structuredClone(result);
    scope.sealed = true;
    scope.retainedBytes = bytes;
    this.retainedBytes += bytes;
    return { ...result, _meta: { ...result._meta, [capabilityField]: scope.nonce } };
  }
  wrap(transport: Transport, session: string): void {
    if (this.transports.has(transport)) throw new Error('The MCP transport is already wrapped');
    const identity = { id: randomUUID(), session };
    this.transports.set(transport, identity);
    const send = transport.send.bind(transport);
    transport.send = async (message, options) => {
      if ('id' in message && ('result' in message || 'error' in message)) {
        const token = 'result' in message ? message.result._meta?.[capabilityField] : undefined;
        const captured = this.context.getStore();
        if (token !== undefined || captured) {
          const scope =
            token === undefined
              ? captured
              : typeof token === 'string'
                ? this.capabilities.get(token)
                : undefined;
          if (
            !scope ||
            !this.valid(scope) ||
            scope.transport !== identity.id ||
            scope.session !== session ||
            typeof scope.id !== typeof message.id ||
            scope.id !== message.id
          )
            throw new Error('The SDK response does not own this HTTP invocation');
          let clean: JSONRPCMessage = message;
          if (token !== undefined) {
            clean = structuredClone(message);
            if (!('result' in clean) || !clean.result._meta || !scope.sealed)
              throw new Error('Invalid response capability');
            delete clean.result._meta[capabilityField];
            if (!Object.keys(clean.result._meta).length) delete clean.result._meta;
            if (!isDeepStrictEqual(clean.result, scope.result))
              throw new Error('The SDK response differs from its sealed result');
          } else {
            // The real SDK rejects unknown tools/schema errors before callbacks.
            // Only the captured invocation, never an ID lookup, permits this path.
            if (
              scope.sealed ||
              !('result' in message) ||
              message.result.isError !== true ||
              !Array.isArray(message.result.content)
            )
              throw new Error('The unsealed SDK response is not a tool error');
            scope.discardDelivery();
          }
          if (scope.expected) throw new Error('The HTTP invocation already has a response');
          scope.expected = JSON.parse(JSON.stringify(clean));
          await send(clean, options);
          return;
        }
      }
      await send(message, options);
    };
  }
  private guard(scope: ResponseInvocation): void {
    const res = scope.response;
    const frameLimit = this.frameLimit;
    const write = res.write.bind(res),
      end = res.end.bind(res),
      writeHead = res.writeHead.bind(res);
    let contentType = '',
      buffer = '',
      bufferBytes = 0,
      responseSeen = false;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    res.writeHead = ((status: number, ...args: unknown[]) => {
      const headers = args.at(-1);
      if (headers && typeof headers === 'object') {
        const entries = Array.isArray(headers)
          ? Array.from({ length: headers.length / 2 }, (_, i) => [
              headers[i * 2],
              headers[i * 2 + 1],
            ])
          : Object.entries(headers);
        for (const [key, value] of entries)
          if (String(key).toLowerCase() === 'content-type') contentType = String(value);
      }
      return Reflect.apply(writeHead, res, [status, ...args]);
    }) as ServerResponse['writeHead'];
    const sse = () =>
      (contentType || String(res.getHeader('content-type') ?? '')).startsWith('text/event-stream');
    const forward = async (wire: string, value?: unknown) => {
      scope.assertCurrent();
      const rpc =
        value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
      const response = !!rpc && ('result' in rpc || 'error' in rpc);
      const bytes = Buffer.from(wire);
      if (response) {
        if (responseSeen) throw new Error('Duplicate MCP response');
        if (!scope.expected || !isDeepStrictEqual(value, scope.expected)) {
          // SDK HTTP validation errors have no tool callback or body admission.
          if (
            scope.sealed ||
            scope.expected ||
            !rpc.error ||
            rpc.result !== undefined ||
            rpc.id !== null ||
            rpc.jsonrpc !== '2.0' ||
            res.statusCode < 400
          )
            throw new Error('The HTTP response does not match this invocation');
          scope.discardDelivery();
        }
        responseSeen = true;
        scope.completion?.release();
        scope.writing = true;
      }
      await new Promise<void>((resolve, reject) =>
        write(bytes, (error) => (error ? reject(error) : resolve())),
      );
      if (response) {
        scope.assertCurrent();
        scope.completion?.complete();
        scope.completion = undefined;
        scope.complete = true;
        this.forget(scope);
      }
    };
    const consume = async (final: boolean) => {
      if (sse()) {
        let delimiter: RegExpMatchArray | null;
        while ((delimiter = buffer.match(/\r?\n\r?\n/)) !== null) {
          const length = delimiter.index! + delimiter[0].length;
          const wire = buffer.slice(0, length);
          buffer = buffer.slice(length);
          bufferBytes -= Buffer.byteLength(wire);
          const data = wire
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n');
          await forward(wire, data ? JSON.parse(data) : undefined);
        }
        if (final && buffer.trim()) throw new Error('Incomplete SSE response');
      } else if (final && buffer) {
        const wire = buffer;
        buffer = '';
        bufferBytes = 0;
        await forward(wire, JSON.parse(wire));
      }
    };
    // A real Writable supplies Node overload validation, callbacks and bounded
    // backpressure. Hono's drain listener remains attached to ServerResponse.
    const sink = new Writable({
      highWaterMark: 65536,
      write(chunk: Buffer, _encoding, callback) {
        try {
          bufferBytes += chunk.length;
          if (bufferBytes > frameLimit) throw new Error('The MCP response frame is too large');
          buffer += decoder.decode(chunk, { stream: true });
          void consume(false).then(() => callback(), callback);
        } catch (error) {
          callback(error as Error);
        }
      },
      final(callback) {
        try {
          buffer += decoder.decode();
          void consume(true)
            .then(() => {
              if (!responseSeen) throw new Error('The HTTP invocation ended without its response');
              end(() => callback());
            })
            .catch(callback);
        } catch (error) {
          callback(error as Error);
        }
      },
    });
    sink.on('drain', () => res.emit('drain'));
    sink.on('error', () => {
      this.cancelScope(scope);
      res.destroy();
    });
    res.write = ((chunk: unknown, ...args: unknown[]) => {
      const size =
        typeof chunk === 'string'
          ? Buffer.byteLength(chunk)
          : chunk instanceof Uint8Array
            ? chunk.byteLength
            : 0;
      if (sink.writableLength + bufferBytes + size > frameLimit) {
        const error = new Error('The MCP response queue is too large');
        const callback = args.find((arg) => typeof arg === 'function') as
          ((error: Error) => void) | undefined;
        process.nextTick(() => {
          try {
            callback?.(error);
          } finally {
            sink.destroy(error);
          }
        });
        return false;
      }
      return Reflect.apply(sink.write, sink, [chunk, ...args]);
    }) as ServerResponse['write'];
    res.end = ((...args: Parameters<Writable['end']>) => {
      sink.end(...args);
      return res;
    }) as ServerResponse['end'];
  }
}

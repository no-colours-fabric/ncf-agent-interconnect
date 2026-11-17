export interface PeerListenerHandle {
  readonly port: number;
  close(): Promise<void>;
}
export interface PeerListenerState {
  address: string;
  port: number;
  state: 'listening' | 'error';
  error: string | null;
}
export interface PeerListenersOptions {
  bind(address: string, port: number): Promise<PeerListenerHandle>;
  changed?(): void;
  fallback?(): void;
}

/** Serializes destination-IP listeners without owning node identity, trust or outbound links. */
export class PeerListeners {
  private desired = new Set<string>();
  private handles = new Map<string, PeerListenerHandle>();
  private errors = new Map<string, string>();
  private serial: Promise<void> = Promise.resolve();
  private generation = 0;
  private active = false;
  port = 0;
  constructor(private readonly options: PeerListenersOptions) {}
  allows(address: string): boolean {
    return this.active && this.desired.has(address);
  }
  snapshot(): PeerListenerState[] {
    return [...this.desired].sort().map((address) => ({
      address,
      port: this.handles.get(address)?.port ?? this.port,
      state: this.handles.has(address) ? 'listening' : 'error',
      error: this.handles.has(address)
        ? null
        : (this.errors.get(address) ?? 'Listener unavailable'),
    }));
  }
  async start(addresses: readonly string[], port: number): Promise<void> {
    await this.close();
    this.active = true;
    this.port = port;
    this.desired = new Set(addresses);
    const generation = ++this.generation;
    await this.enqueue(async () => {
      // One bounded fallback selects a common port; runtime additions never move live listeners.
      const conflict = await this.reconcile(generation);
      if (conflict && port !== 0 && this.current(generation)) {
        await this.closeHandles();
        this.errors.clear();
        this.port = 0;
        await this.reconcile(generation);
        if (this.current(generation)) this.options.fallback?.();
      }
    });
  }
  update(addresses: readonly string[]): Promise<void> {
    if (!this.active) return Promise.resolve();
    const desired = new Set(addresses);
    const changed =
      desired.size !== this.desired.size || [...desired].some((a) => !this.desired.has(a));
    this.desired = desired; // Admission closes synchronously, before queued socket cleanup.
    if (changed) this.generation++;
    const generation = this.generation;
    return this.enqueue(async () => {
      await this.reconcile(generation);
    });
  }
  async close(): Promise<void> {
    this.active = false;
    this.desired.clear();
    this.generation++;
    await this.enqueue(async () => {
      await this.closeHandles();
      this.errors.clear();
    });
  }
  private current(generation: number): boolean {
    return this.active && generation === this.generation;
  }
  private enqueue(work: () => Promise<void>): Promise<void> {
    const operation = this.serial.then(work);
    this.serial = operation.catch(() => {});
    return operation;
  }
  private async closeHandles(): Promise<void> {
    const handles = [...this.handles.values()];
    this.handles.clear();
    await Promise.all(handles.map((handle) => handle.close()));
  }
  private async reconcile(generation: number): Promise<boolean> {
    if (!this.current(generation)) return false;
    let conflict = false;
    let changed = false;
    for (const [address, handle] of this.handles) {
      if (!this.desired.has(address)) {
        this.handles.delete(address);
        this.errors.delete(address);
        await handle.close();
        changed = true;
      }
    }
    for (const address of [...this.errors.keys()]) {
      if (!this.desired.has(address)) this.errors.delete(address);
    }
    for (const address of [...this.desired].sort()) {
      if (!this.current(generation)) break;
      if (this.handles.has(address)) continue;
      try {
        const handle = await this.options.bind(address, this.port);
        if (!this.current(generation) || !this.desired.has(address)) {
          await handle.close();
          continue;
        }
        if (!this.port) this.port = handle.port;
        this.handles.set(address, handle);
        this.errors.delete(address);
        changed = true;
      } catch (error) {
        if (!this.current(generation)) continue;
        const detail = error instanceof Error ? error.message : String(error);
        if (this.errors.get(address) !== detail) changed = true;
        this.errors.set(address, detail);
        if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') conflict = true;
      }
    }
    if (changed && this.current(generation)) this.options.changed?.();
    return conflict;
  }
}

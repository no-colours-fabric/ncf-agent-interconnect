/** A visible window grants one automatic search attempt until its next actual open. */
export class LanSearchLifecycle {
  private visible = false;
  private disposed = false;
  private generation = 0;

  constructor(private readonly start: (isCurrent: () => boolean) => Promise<unknown>) {}

  setVisible(visible: boolean): void {
    if (this.disposed || this.visible === visible) return;
    this.visible = visible;
    const generation = ++this.generation;
    if (!visible) return;
    const isCurrent = () => !this.disposed && this.visible && this.generation === generation;
    // The service snapshot owns success/failure; a window event must never retry it.
    try {
      void this.start(isCurrent).catch(() => {});
    } catch {
      // A synchronous failure consumes this epoch too.
    }
  }

  /** Explicit Start/Stop supersedes pending automatic work without reopening the epoch. */
  supersede(): void {
    this.generation++;
  }

  close(): void {
    this.disposed = true;
    this.visible = false;
    this.generation++;
  }
}

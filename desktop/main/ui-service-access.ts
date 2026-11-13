/** UI routing may resume after an awaited dialog while shutdown closes the store. */
export class UiServiceAccess<T> {
  constructor(
    private readonly getService: () => T | null,
    private readonly isQuitting: () => boolean,
  ) {}

  current(): T {
    if (this.isQuitting()) throw new Error('The node is not running');
    const service = this.getService();
    if (!service) throw new Error('The node is not running');
    return service;
  }

  async waitFor<R>(work: () => Promise<R>): Promise<R> {
    this.current();
    const result = await work();
    // This fences the continuation, not effects the awaited operation already made.
    this.current();
    return result;
  }
}

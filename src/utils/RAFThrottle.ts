/**
 * RAF-based throttling for high-frequency events
 * Ensures only one callback per animation frame
 */
export class RAFThrottle<T> {
  private _rafId: number | null = null;
  private _pending: T | null = null;
  private _callback: (data: T) => void;

  constructor(callback: (data: T) => void) {
    this._callback = callback;
  }

  /**
   * Queue data to be processed on next animation frame
   * Only the most recent data will be processed
   */
  queue(data: T): void {
    this._pending = data;

    if (this._rafId === null) {
      this._rafId = requestAnimationFrame(this._process);
    }
  }

  /**
   * Cancel any pending frame
   */
  cancel(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._pending = null;
  }

  /**
   * Process immediately if there's pending data
   */
  flush(): void {
    if (this._pending !== null) {
      const data = this._pending;
      this.cancel();
      this._callback(data);
    }
  }

  /**
   * Check if there's a pending frame
   */
  get isPending(): boolean {
    return this._rafId !== null;
  }

  private _process = (): void => {
    this._rafId = null;
    if (this._pending !== null) {
      const data = this._pending;
      this._pending = null;
      this._callback(data);
    }
  };

  /**
   * Cleanup
   */
  destroy(): void {
    this.cancel();
  }
}

/**
 * Create a throttled function using RAF
 */
export function rafThrottle<T extends (...args: unknown[]) => void>(
  fn: T
): T & { cancel: () => void; flush: () => void } {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (lastArgs !== null) {
          fn(...lastArgs);
          lastArgs = null;
        }
      });
    }
  }) as T & { cancel: () => void; flush: () => void };

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastArgs = null;
  };

  throttled.flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (lastArgs !== null) {
      fn(...lastArgs);
      lastArgs = null;
    }
  };

  return throttled;
}

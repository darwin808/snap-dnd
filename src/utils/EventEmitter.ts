/**
 * Lightweight pub/sub event emitter
 * Optimized for minimal allocations
 */
import type { Unsubscribe } from '../types/index.js';

export type EventCallback<T = unknown> = (data: T) => void;

export class EventEmitter<Events extends Record<string, unknown>> {
  private _listeners = new Map<keyof Events, Set<EventCallback>>();

  /**
   * Subscribe to an event
   */
  on<K extends keyof Events>(
    event: K,
    callback: EventCallback<Events[K]>
  ): Unsubscribe {
    let listeners = this._listeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this._listeners.set(event, listeners);
    }
    listeners.add(callback as EventCallback);

    return () => {
      listeners!.delete(callback as EventCallback);
      if (listeners!.size === 0) {
        this._listeners.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event once
   */
  once<K extends keyof Events>(
    event: K,
    callback: EventCallback<Events[K]>
  ): Unsubscribe {
    const unsubscribe = this.on(event, (data) => {
      unsubscribe();
      callback(data);
    });
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers
   */
  emit<K extends keyof Events>(event: K, data: Events[K]): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      // Iterate over a copy to allow unsubscribe during emit
      for (const callback of [...listeners]) {
        callback(data);
      }
    }
  }

  /**
   * Remove all listeners for an event, or all listeners
   */
  off<K extends keyof Events>(event?: K): void {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners<K extends keyof Events>(event: K): boolean {
    const listeners = this._listeners.get(event);
    return listeners !== undefined && listeners.size > 0;
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    return this._listeners.get(event)?.size ?? 0;
  }

  /**
   * Clear all listeners
   */
  destroy(): void {
    this._listeners.clear();
  }
}

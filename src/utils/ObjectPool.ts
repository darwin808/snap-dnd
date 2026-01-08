/**
 * Generic object pool for reusing frequently allocated objects
 * Reduces GC pressure during drag operations
 */
export class ObjectPool<T> {
  private _pool: T[] = [];
  private _factory: () => T;
  private _reset: (obj: T) => void;
  private _maxSize: number;

  constructor(
    factory: () => T,
    reset: (obj: T) => void,
    initialSize = 10,
    maxSize = 100
  ) {
    this._factory = factory;
    this._reset = reset;
    this._maxSize = maxSize;

    // Pre-allocate objects
    for (let i = 0; i < initialSize; i++) {
      this._pool.push(factory());
    }
  }

  /**
   * Get an object from the pool or create a new one
   */
  acquire(): T {
    return this._pool.pop() ?? this._factory();
  }

  /**
   * Return an object to the pool for reuse
   */
  release(obj: T): void {
    if (this._pool.length < this._maxSize) {
      this._reset(obj);
      this._pool.push(obj);
    }
  }

  /**
   * Clear all pooled objects
   */
  clear(): void {
    this._pool.length = 0;
  }

  /**
   * Current pool size
   */
  get size(): number {
    return this._pool.length;
  }
}

// Pre-configured pools for common types
import type { Point, Rect } from '../types/index.js';

export const pointPool = new ObjectPool<Point>(
  () => ({ x: 0, y: 0 }),
  (p) => {
    p.x = 0;
    p.y = 0;
  }
);

export const rectPool = new ObjectPool<Rect>(
  () => ({ x: 0, y: 0, width: 0, height: 0 }),
  (r) => {
    r.x = 0;
    r.y = 0;
    r.width = 0;
    r.height = 0;
  }
);

/**
 * Helper to get a point from pool with initial values
 */
export function acquirePoint(x: number, y: number): Point {
  const p = pointPool.acquire();
  p.x = x;
  p.y = y;
  return p;
}

/**
 * Helper to get a rect from pool with initial values
 */
export function acquireRect(
  x: number,
  y: number,
  width: number,
  height: number
): Rect {
  const r = rectPool.acquire();
  r.x = x;
  r.y = y;
  r.width = width;
  r.height = height;
  return r;
}

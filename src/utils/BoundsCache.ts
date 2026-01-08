/**
 * Cached bounding rect manager using WeakMap
 * Automatically cleans up when elements are removed from DOM
 */
export class BoundsCache {
  private _cache = new WeakMap<Element, DOMRect>();
  private _dirty = new WeakSet<Element>();
  private _invalidateAll = false;

  /**
   * Get cached bounds for an element, or compute and cache
   */
  get(element: Element): DOMRect {
    if (this._invalidateAll || this._dirty.has(element)) {
      return this._update(element);
    }

    const cached = this._cache.get(element);
    if (cached) {
      return cached;
    }

    return this._update(element);
  }

  /**
   * Mark a specific element's bounds as dirty
   */
  invalidate(element: Element): void {
    this._dirty.add(element);
  }

  /**
   * Mark all cached bounds as dirty (e.g., on scroll/resize)
   */
  invalidateAll(): void {
    this._invalidateAll = true;
  }

  /**
   * Force update bounds for an element
   */
  update(element: Element): DOMRect {
    return this._update(element);
  }

  /**
   * Remove element from cache
   */
  remove(element: Element): void {
    this._cache.delete(element);
  }

  /**
   * Clear the dirty flag after a frame
   */
  clearDirty(): void {
    this._invalidateAll = false;
    // WeakSet doesn't have clear(), but dirty elements
    // will be refreshed on next get() call
  }

  private _update(element: Element): DOMRect {
    const rect = element.getBoundingClientRect();
    this._cache.set(element, rect);
    this._dirty.delete(element);
    return rect;
  }
}

// Singleton instance for shared use
export const boundsCache = new BoundsCache();

/**
 * Check if a point is inside a rect
 */
export function pointInRect(x: number, y: number, rect: DOMRect): boolean {
  return (
    x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
  );
}

/**
 * Check if two rects intersect
 */
export function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/**
 * Get the center point of a rect
 */
export function rectCenter(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Calculate distance between two points
 */
export function distance(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

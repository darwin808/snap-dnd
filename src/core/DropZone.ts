/**
 * DropZone manages individual drop target areas
 * Handles hit testing and insertion index calculation
 */
import type { DataTransfer, DropZoneOptions, Point } from '../types/index.js';
import { boundsCache, pointInRect, rectCenter } from '../utils/BoundsCache.js';

export class DropZone {
  private _element: HTMLElement;
  private _options: DropZoneOptions;
  private _isActive = false;

  constructor(element: HTMLElement, options: DropZoneOptions = {}) {
    this._element = element;
    this._options = options;
  }

  /**
   * The DOM element for this drop zone
   */
  get element(): HTMLElement {
    return this._element;
  }

  /**
   * Whether this zone is currently active (being hovered)
   */
  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Update options
   */
  setOptions(options: Partial<DropZoneOptions>): void {
    Object.assign(this._options, options);
  }

  /**
   * Check if a point is inside this drop zone
   */
  containsPoint(x: number, y: number): boolean {
    const rect = boundsCache.get(this._element);
    return pointInRect(x, y, rect);
  }

  /**
   * Check if this zone accepts the given data
   */
  accepts(data: DataTransfer): boolean {
    const { accepts } = this._options;

    if (!accepts) return true;

    if (typeof accepts === 'function') {
      return accepts(data);
    }

    // Array of type strings
    for (const type of accepts) {
      if (data.hasType(type) || data.getData('type') === type) {
        return true;
      }
    }

    // Check data-accepts attribute on element
    const elementAccepts = this._element.dataset.accepts;
    if (elementAccepts) {
      const acceptedTypes = elementAccepts.split(',').map((s) => s.trim());
      for (const type of acceptedTypes) {
        if (data.hasType(type) || data.getData('type') === type) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Set active state and add/remove CSS class
   */
  setActive(active: boolean): void {
    if (this._isActive === active) return;

    this._isActive = active;

    if (active) {
      this._element.classList.add('snap-drop-active');
    } else {
      this._element.classList.remove('snap-drop-active');
    }
  }

  /**
   * Calculate insertion index for sortable behavior
   * Returns the index where an item should be inserted based on position
   */
  getInsertionIndex(
    x: number,
    y: number,
    itemSelector: string,
    excludeElement?: HTMLElement
  ): number {
    const items = Array.from(
      this._element.querySelectorAll<HTMLElement>(itemSelector)
    ).filter((el) => el !== excludeElement);

    if (items.length === 0) return 0;

    // Determine if list is vertical or horizontal
    const firstRect = boundsCache.get(items[0]);
    const lastRect = boundsCache.get(items[items.length - 1]);
    const isVertical = Math.abs(lastRect.top - firstRect.top) > Math.abs(lastRect.left - firstRect.left);

    for (let i = 0; i < items.length; i++) {
      const rect = boundsCache.get(items[i]);
      const center = rectCenter(rect);

      if (isVertical) {
        if (y < center.y) return i;
      } else {
        if (x < center.x) return i;
      }
    }

    return items.length;
  }

  /**
   * Get closest item to a point (for visual feedback)
   */
  getClosestItem(
    x: number,
    y: number,
    itemSelector: string,
    excludeElement?: HTMLElement
  ): { element: HTMLElement; position: 'before' | 'after' } | null {
    const items = Array.from(
      this._element.querySelectorAll<HTMLElement>(itemSelector)
    ).filter((el) => el !== excludeElement);

    if (items.length === 0) return null;

    let closestItem: HTMLElement | null = null;
    let closestDistance = Infinity;
    let position: 'before' | 'after' = 'after';

    // Determine orientation
    const firstRect = boundsCache.get(items[0]);
    const lastRect = boundsCache.get(items[items.length - 1]);
    const isVertical = Math.abs(lastRect.top - firstRect.top) > Math.abs(lastRect.left - firstRect.left);

    for (const item of items) {
      const rect = boundsCache.get(item);
      const center = rectCenter(rect);

      const dx = x - center.x;
      const dy = y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestItem = item;
        position = isVertical ? (y < center.y ? 'before' : 'after') : (x < center.x ? 'before' : 'after');
      }
    }

    if (!closestItem) return null;

    return { element: closestItem, position };
  }

  /**
   * Force update cached bounds
   */
  updateBounds(): void {
    boundsCache.update(this._element);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.setActive(false);
    boundsCache.remove(this._element);
  }
}

/**
 * DropZoneManager handles multiple drop zones
 */
export class DropZoneManager {
  private _zones = new Map<HTMLElement, DropZone>();

  /**
   * Register a drop zone
   */
  register(element: HTMLElement, options?: DropZoneOptions): DropZone {
    let zone = this._zones.get(element);
    if (zone) {
      if (options) zone.setOptions(options);
      return zone;
    }

    zone = new DropZone(element, options);
    this._zones.set(element, zone);
    return zone;
  }

  /**
   * Unregister a drop zone
   */
  unregister(element: HTMLElement): void {
    const zone = this._zones.get(element);
    if (zone) {
      zone.destroy();
      this._zones.delete(element);
    }
  }

  /**
   * Get drop zone for an element
   */
  get(element: HTMLElement): DropZone | undefined {
    return this._zones.get(element);
  }

  /**
   * Get all drop zone elements
   */
  getElements(): HTMLElement[] {
    return [...this._zones.keys()];
  }

  /**
   * Get all drop zones
   */
  getAll(): DropZone[] {
    return [...this._zones.values()];
  }

  /**
   * Find drop zone at point
   */
  findAtPoint(x: number, y: number): DropZone | null {
    for (const zone of this._zones.values()) {
      if (zone.containsPoint(x, y)) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Clear all drop zones
   */
  clear(): void {
    for (const zone of this._zones.values()) {
      zone.destroy();
    }
    this._zones.clear();
  }

  /**
   * Update all bounds (e.g., after scroll/resize)
   */
  updateAllBounds(): void {
    boundsCache.invalidateAll();
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.clear();
  }
}

/**
 * Sortable plugin - enables reordering items within a container
 */
import type {
  Plugin,
  SnapInstance,
  SortableOptions,
  DragSession,
} from '../types/index.js';
import { boundsCache, rectCenter } from '../utils/BoundsCache.js';

const defaultOptions: SortableOptions = {
  animation: 150,
  ghostClass: 'snap-sortable-ghost',
  placeholderClass: 'snap-sortable-placeholder',
};

export class Sortable implements Plugin {
  name = 'sortable';

  private _snap: SnapInstance | null = null;
  private _options: SortableOptions;
  private _placeholder: HTMLElement | null = null;
  private _originalIndex: number = -1;
  private _currentIndex: number = -1;
  private _container: HTMLElement | null = null;
  private _items: HTMLElement[] = [];
  private _unsubscribers: (() => void)[] = [];

  constructor(options: SortableOptions = {}) {
    this._options = { ...defaultOptions, ...options };
  }

  init(snap: SnapInstance): void {
    this._snap = snap;

    // Subscribe to state events via the snap options callbacks
    // We wrap them to add sortable behavior
    const originalOnDragStart = snap.options.onDragStart;
    const originalOnDragMove = snap.options.onDragMove;
    const originalOnDrop = snap.options.onDrop;
    const originalOnDragEnd = snap.options.onDragEnd;

    snap.setOptions({
      onDragStart: (e) => {
        this._onDragStart(e.element);
        return originalOnDragStart?.(e);
      },
      onDragMove: (e) => {
        this._onDragMove(e.position.x, e.position.y);
        originalOnDragMove?.(e);
      },
      onDrop: (e) => {
        // Add insertion index to event
        const enhancedEvent = {
          ...e,
          insertionIndex: this._currentIndex,
          sourceContainer: this._container ?? undefined,
        };
        originalOnDrop?.(enhancedEvent);
      },
      onDragEnd: (e) => {
        this._onDragEnd();
        originalOnDragEnd?.(e);
      },
    });
  }

  destroy(): void {
    this._cleanup();
    for (const unsub of this._unsubscribers) {
      unsub();
    }
    this._unsubscribers = [];
    this._snap = null;
  }

  private _onDragStart(element: HTMLElement): void {
    // Find container and items
    this._container = element.parentElement;
    if (!this._container) return;

    const selector = this._snap?.options.draggableSelector ?? '[data-draggable]';
    this._items = Array.from(
      this._container.querySelectorAll<HTMLElement>(selector)
    );

    this._originalIndex = this._items.indexOf(element);
    this._currentIndex = this._originalIndex;

    if (this._originalIndex === -1) return;

    // Create placeholder
    this._createPlaceholder(element);

    // Add ghost class
    if (this._options.ghostClass) {
      element.classList.add(this._options.ghostClass);
    }
  }

  private _onDragMove(x: number, y: number): void {
    if (!this._placeholder || !this._container) return;

    const selector = this._snap?.options.draggableSelector ?? '[data-draggable]';
    const activeElement = this._snap?.getActiveElement();

    // Get current items (excluding the dragged element)
    const items = Array.from(
      this._container.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => el !== activeElement && el !== this._placeholder);

    if (items.length === 0) {
      this._currentIndex = 0;
      return;
    }

    // Determine list orientation
    const firstRect = boundsCache.get(items[0]);
    const lastRect = boundsCache.get(items[items.length - 1]);
    const isVertical =
      Math.abs(lastRect.top - firstRect.top) >
      Math.abs(lastRect.left - firstRect.left);

    // Find new index
    let newIndex = items.length;
    for (let i = 0; i < items.length; i++) {
      const rect = boundsCache.get(items[i]);
      const center = rectCenter(rect);

      if (isVertical) {
        if (y < center.y) {
          newIndex = i;
          break;
        }
      } else {
        if (x < center.x) {
          newIndex = i;
          break;
        }
      }
    }

    // Adjust for original position
    if (newIndex > this._originalIndex) {
      newIndex++;
    }

    if (newIndex !== this._currentIndex) {
      this._currentIndex = newIndex;
      this._movePlaceholder(newIndex);
    }
  }

  private _onDragEnd(): void {
    this._cleanup();
  }

  private _createPlaceholder(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();

    this._placeholder = document.createElement('div');
    this._placeholder.className = this._options.placeholderClass ?? '';
    this._placeholder.style.cssText = `
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      box-sizing: border-box;
    `;

    // Insert placeholder at original position
    element.parentNode?.insertBefore(this._placeholder, element);
  }

  private _movePlaceholder(index: number): void {
    if (!this._placeholder || !this._container) return;

    const selector = this._snap?.options.draggableSelector ?? '[data-draggable]';
    const activeElement = this._snap?.getActiveElement();

    const items = Array.from(
      this._container.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => el !== activeElement);

    // Remove placeholder from current position
    this._placeholder.remove();

    // Insert at new position
    if (index >= items.length) {
      this._container.appendChild(this._placeholder);
    } else {
      // Find the item to insert before
      let insertBefore = items[index];
      if (insertBefore === this._placeholder) {
        insertBefore = items[index + 1];
      }
      if (insertBefore) {
        this._container.insertBefore(this._placeholder, insertBefore);
      } else {
        this._container.appendChild(this._placeholder);
      }
    }

    // Animate other items if animation enabled
    if (this._options.animation && this._options.animation > 0) {
      this._animateItems();
    }
  }

  private _animateItems(): void {
    if (!this._container) return;

    const selector = this._snap?.options.draggableSelector ?? '[data-draggable]';
    const activeElement = this._snap?.getActiveElement();

    const items = Array.from(
      this._container.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => el !== activeElement && el !== this._placeholder);

    // Get positions before
    const positions = new Map<HTMLElement, DOMRect>();
    for (const item of items) {
      positions.set(item, item.getBoundingClientRect());
    }

    // Force reflow
    void this._container.offsetHeight;

    // Animate from old to new positions
    for (const item of items) {
      const oldRect = positions.get(item);
      const newRect = item.getBoundingClientRect();

      if (!oldRect) continue;

      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top - newRect.top;

      if (dx !== 0 || dy !== 0) {
        item.style.transform = `translate(${dx}px, ${dy}px)`;
        item.style.transition = 'none';

        requestAnimationFrame(() => {
          item.style.transition = `transform ${this._options.animation}ms ease`;
          item.style.transform = '';
        });
      }
    }
  }

  private _cleanup(): void {
    // Remove placeholder
    this._placeholder?.remove();
    this._placeholder = null;

    // Remove ghost class from dragged element
    const activeElement = this._snap?.getActiveElement();
    if (activeElement && this._options.ghostClass) {
      activeElement.classList.remove(this._options.ghostClass);
    }

    // Reset state
    this._container = null;
    this._items = [];
    this._originalIndex = -1;
    this._currentIndex = -1;

    // Invalidate bounds cache
    boundsCache.invalidateAll();
  }

  /**
   * Get the current insertion index during drag
   */
  getCurrentIndex(): number {
    return this._currentIndex;
  }

  /**
   * Get the original index of the dragged item
   */
  getOriginalIndex(): number {
    return this._originalIndex;
  }
}

/**
 * Kanban plugin - enables moving items between multiple containers
 */
import type {
  Plugin,
  SnapInstance,
  KanbanOptions,
  Point,
} from '../types/index.js';
import { boundsCache, pointInRect, rectCenter } from '../utils/BoundsCache.js';

const defaultOptions: Required<KanbanOptions> = {
  containers: '[data-droppable]',
  items: '[data-draggable]',
  animation: 150,
};

export class Kanban implements Plugin {
  name = 'kanban';

  private _snap: SnapInstance | null = null;
  private _options: Required<KanbanOptions>;
  private _sourceContainer: HTMLElement | null = null;
  private _targetContainer: HTMLElement | null = null;
  private _placeholder: HTMLElement | null = null;
  private _originalIndex: number = -1;
  private _currentIndex: number = -1;

  constructor(options: KanbanOptions = {}) {
    this._options = { ...defaultOptions, ...options };
  }

  init(snap: SnapInstance): void {
    this._snap = snap;

    // Wrap snap callbacks
    const originalOnDragStart = snap.options.onDragStart;
    const originalOnDragMove = snap.options.onDragMove;
    const originalOnDropZoneEnter = snap.options.onDropZoneEnter;
    const originalOnDropZoneLeave = snap.options.onDropZoneLeave;
    const originalOnDrop = snap.options.onDrop;
    const originalOnDragEnd = snap.options.onDragEnd;

    snap.setOptions({
      onDragStart: (e) => {
        this._onDragStart(e.element);
        return originalOnDragStart?.(e);
      },
      onDragMove: (e) => {
        this._onDragMove(e.position);
        originalOnDragMove?.(e);
      },
      onDropZoneEnter: (e) => {
        this._onDropZoneEnter(e.dropZone);
        originalOnDropZoneEnter?.(e);
      },
      onDropZoneLeave: (e) => {
        this._onDropZoneLeave(e.dropZone);
        originalOnDropZoneLeave?.(e);
      },
      onDrop: (e) => {
        const enhancedEvent = {
          ...e,
          insertionIndex: this._currentIndex,
          sourceContainer: this._sourceContainer ?? undefined,
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
    this._snap = null;
  }

  private _onDragStart(element: HTMLElement): void {
    // Find source container
    this._sourceContainer = element.closest(this._options.containers);
    if (!this._sourceContainer) return;

    // Get original index within source container
    const items = Array.from(
      this._sourceContainer.querySelectorAll<HTMLElement>(this._options.items)
    );
    this._originalIndex = items.indexOf(element);

    // Create placeholder
    this._createPlaceholder(element);
  }

  private _onDragMove(position: Point): void {
    if (!this._targetContainer || !this._placeholder) return;

    // Calculate insertion index in target container
    const newIndex = this._calculateInsertionIndex(
      this._targetContainer,
      position.x,
      position.y
    );

    if (newIndex !== this._currentIndex) {
      this._currentIndex = newIndex;
      this._movePlaceholder(newIndex);
    }
  }

  private _onDropZoneEnter(dropZone: HTMLElement): void {
    // Check if it's a valid container
    if (!dropZone.matches(this._options.containers)) return;

    this._targetContainer = dropZone;
    this._targetContainer.classList.add('snap-kanban-target');

    // Insert placeholder into new container
    if (this._placeholder) {
      this._targetContainer.appendChild(this._placeholder);
      this._currentIndex = this._getItemCount(this._targetContainer);
    }
  }

  private _onDropZoneLeave(dropZone: HTMLElement): void {
    if (dropZone !== this._targetContainer) return;

    dropZone.classList.remove('snap-kanban-target');

    // Remove placeholder from old container
    this._placeholder?.remove();

    this._targetContainer = null;
    this._currentIndex = -1;
  }

  private _onDragEnd(): void {
    this._cleanup();
  }

  private _createPlaceholder(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();

    this._placeholder = document.createElement('div');
    this._placeholder.className = 'snap-kanban-placeholder';
    this._placeholder.style.cssText = `
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      box-sizing: border-box;
      opacity: 0.5;
      border: 2px dashed #ccc;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.05);
    `;

    // Insert in source container initially
    element.parentNode?.insertBefore(this._placeholder, element);
  }

  private _movePlaceholder(index: number): void {
    if (!this._placeholder || !this._targetContainer) return;

    const activeElement = this._snap?.getActiveElement();
    const items = Array.from(
      this._targetContainer.querySelectorAll<HTMLElement>(this._options.items)
    ).filter((el) => el !== activeElement && el !== this._placeholder);

    // Remove from current position
    this._placeholder.remove();

    // Insert at new position
    if (index >= items.length) {
      this._targetContainer.appendChild(this._placeholder);
    } else {
      const insertBefore = items[index];
      if (insertBefore) {
        this._targetContainer.insertBefore(this._placeholder, insertBefore);
      } else {
        this._targetContainer.appendChild(this._placeholder);
      }
    }

    // Animate if enabled
    if (this._options.animation > 0) {
      this._animateItems(this._targetContainer);
    }
  }

  private _calculateInsertionIndex(
    container: HTMLElement,
    x: number,
    y: number
  ): number {
    const activeElement = this._snap?.getActiveElement();
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(this._options.items)
    ).filter((el) => el !== activeElement && el !== this._placeholder);

    if (items.length === 0) return 0;

    // Determine orientation
    const firstRect = boundsCache.get(items[0]);
    const lastRect = boundsCache.get(items[items.length - 1]);
    const isVertical =
      Math.abs(lastRect.top - firstRect.top) >
      Math.abs(lastRect.left - firstRect.left);

    // Find insertion point
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

  private _getItemCount(container: HTMLElement): number {
    const activeElement = this._snap?.getActiveElement();
    return Array.from(
      container.querySelectorAll<HTMLElement>(this._options.items)
    ).filter((el) => el !== activeElement && el !== this._placeholder).length;
  }

  private _animateItems(container: HTMLElement): void {
    const activeElement = this._snap?.getActiveElement();
    const items = Array.from(
      container.querySelectorAll<HTMLElement>(this._options.items)
    ).filter((el) => el !== activeElement && el !== this._placeholder);

    // Store old positions
    const positions = new Map<HTMLElement, DOMRect>();
    for (const item of items) {
      positions.set(item, item.getBoundingClientRect());
    }

    // Force reflow
    void container.offsetHeight;

    // Animate
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

    // Remove classes
    this._sourceContainer?.classList.remove('snap-kanban-source');
    this._targetContainer?.classList.remove('snap-kanban-target');

    // Reset state
    this._sourceContainer = null;
    this._targetContainer = null;
    this._originalIndex = -1;
    this._currentIndex = -1;

    boundsCache.invalidateAll();
  }

  /**
   * Get source container during drag
   */
  getSourceContainer(): HTMLElement | null {
    return this._sourceContainer;
  }

  /**
   * Get target container during drag
   */
  getTargetContainer(): HTMLElement | null {
    return this._targetContainer;
  }

  /**
   * Get current insertion index
   */
  getCurrentIndex(): number {
    return this._currentIndex;
  }
}

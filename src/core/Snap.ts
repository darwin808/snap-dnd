/**
 * Snap - Main entry point for the drag and drop library
 * Coordinates all subsystems and provides the public API
 */
import type {
  SnapOptions,
  SnapInstance,
  ItemOptions,
  DropZoneOptions,
  Axis,
  Plugin,
  Behavior,
  SnapEventMap,
  SnapEventName,
  Unsubscribe,
} from '../types/index.js';
import { DragState } from './DragState.js';
import { DragEngine } from './DragEngine.js';
import { DropZoneManager } from './DropZone.js';
import { boundsCache } from '../utils/BoundsCache.js';

// Default options
const defaultOptions: SnapOptions = {
  draggableSelector: '[data-draggable]',
  dropZoneSelector: '[data-droppable]',
  axis: 'both',
  autoRefresh: false,
};

export class Snap implements SnapInstance {
  private _container: HTMLElement | ShadowRoot;
  private _options: SnapOptions;
  private _state: DragState;
  private _engine: DragEngine;
  private _dropZoneManager: DropZoneManager;

  // Imperative registrations
  private _imperativeDraggables = new Map<HTMLElement, ItemOptions>();
  private _imperativeDropZones = new Map<HTMLElement, DropZoneOptions>();

  // Plugins and behaviors
  private _plugins: Plugin[] = [];
  private _behaviors: Behavior[] = [];

  // Event listeners for on/off API
  private _eventListeners: Map<SnapEventName, Set<(e: unknown) => void>> = new Map();

  // State listener unsubscribers
  private _stateUnsubscribers: (() => void)[] = [];

  // MutationObserver for auto-refresh
  private _observer: MutationObserver | null = null;
  private _refreshScheduled = false;
  private _destroyed = false;

  // Scroll/resize handlers
  private _scrollHandler: (() => void) | null = null;
  private _resizeHandler: (() => void) | null = null;

  constructor(
    container: HTMLElement | ShadowRoot,
    options: SnapOptions = {}
  ) {
    this._container = container;
    this._options = { ...defaultOptions, ...options };

    // Wrap callbacks to emit events
    this._wrapCallbacks();

    // Initialize subsystems
    this._state = new DragState();
    this._dropZoneManager = new DropZoneManager();

    this._engine = new DragEngine({
      container: this._container,
      state: this._state,
      options: this._options,
      getDropZones: () => this._getDropZones(),
      getItemData: (el) => this._getItemData(el),
      getItemAxis: (el) => this._getItemAxis(el),
    });

    // Setup state listeners for behaviors
    this._setupStateListeners();

    // Initial scan for declarative elements
    this._scanDeclarativeElements();

    // Setup auto-refresh if enabled
    if (this._options.autoRefresh) {
      this._setupAutoRefresh();
    }

    // Setup scroll/resize handlers
    this._setupScrollResize();

    // Enable by default
    this.enable();
  }

  /**
   * Current options
   */
  get options(): SnapOptions {
    return this._options;
  }

  /**
   * Enable drag and drop
   */
  enable(): void {
    this._engine.enable();
  }

  /**
   * Disable drag and drop
   */
  disable(): void {
    this._engine.disable();
  }

  /**
   * Cleanup and destroy instance
   */
  destroy(): void {
    this._destroyed = true;
    this.disable();

    // Unsubscribe from state listeners
    for (const unsub of this._stateUnsubscribers) {
      unsub();
    }
    this._stateUnsubscribers = [];

    // Destroy plugins
    for (const plugin of this._plugins) {
      plugin.destroy();
    }
    this._plugins = [];

    // Destroy behaviors
    for (const behavior of this._behaviors) {
      behavior.destroy();
    }
    this._behaviors = [];

    // Cleanup subsystems
    this._engine.destroy();
    this._state.destroy();
    this._dropZoneManager.destroy();

    // Cleanup observers
    this._observer?.disconnect();
    this._observer = null;

    // Cleanup event handlers
    if (this._scrollHandler) {
      window.removeEventListener('scroll', this._scrollHandler, true);
      this._scrollHandler = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }

    // Clear registrations
    this._imperativeDraggables.clear();
    this._imperativeDropZones.clear();
  }

  /**
   * Re-scan for declarative elements (call after DOM changes)
   */
  refresh(): void {
    this._scanDeclarativeElements();
    boundsCache.invalidateAll();
  }

  /**
   * Register a draggable element imperatively
   */
  addDraggable(element: HTMLElement, options?: ItemOptions): void {
    this._imperativeDraggables.set(element, options ?? {});
  }

  /**
   * Unregister a draggable element
   */
  removeDraggable(element: HTMLElement): void {
    this._imperativeDraggables.delete(element);
  }

  /**
   * Register a drop zone imperatively
   */
  addDropZone(element: HTMLElement, options?: DropZoneOptions): void {
    this._imperativeDropZones.set(element, options ?? {});
    this._dropZoneManager.register(element, options);
  }

  /**
   * Unregister a drop zone
   */
  removeDropZone(element: HTMLElement): void {
    this._imperativeDropZones.delete(element);
    this._dropZoneManager.unregister(element);
  }

  /**
   * Check if currently dragging
   */
  isDragging(): boolean {
    return this._state.isDragging();
  }

  /**
   * Get the element currently being dragged
   */
  getActiveElement(): HTMLElement | null {
    return this._state.getActiveElement();
  }

  /**
   * Register a plugin
   */
  use(plugin: Plugin): this {
    this._plugins.push(plugin);
    plugin.init(this);
    return this;
  }

  /**
   * Add a behavior
   */
  addBehavior(behavior: Behavior): this {
    this._behaviors.push(behavior);
    return this;
  }

  /**
   * Update options dynamically
   */
  setOptions(options: Partial<SnapOptions>): void {
    Object.assign(this._options, options);
    this._engine.updateOptions(this._options);
  }

  /**
   * Subscribe to an event
   */
  on<K extends SnapEventName>(
    event: K,
    callback: (e: SnapEventMap[K]) => void
  ): Unsubscribe {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(callback as (e: unknown) => void);

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from an event
   */
  off<K extends SnapEventName>(
    event: K,
    callback: (e: SnapEventMap[K]) => void
  ): void {
    this._eventListeners.get(event)?.delete(callback as (e: unknown) => void);
  }

  /**
   * Emit an event to all listeners
   */
  private _emit<K extends SnapEventName>(event: K, data: SnapEventMap[K]): void {
    const listeners = this._eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }

  /**
   * Wrap user callbacks to also emit events through on/off system
   */
  private _wrapCallbacks(): void {
    const userCallbacks = { ...this._options };

    this._options.onDragStart = (e) => {
      this._emit('dragstart', e);
      return userCallbacks.onDragStart?.(e);
    };

    this._options.onDragMove = (e) => {
      this._emit('dragmove', e);
      userCallbacks.onDragMove?.(e);
    };

    this._options.onDragEnd = (e) => {
      this._emit('dragend', e);
      userCallbacks.onDragEnd?.(e);
    };

    this._options.onDrop = (e) => {
      this._emit('drop', e);
      userCallbacks.onDrop?.(e);
    };

    this._options.onDropZoneEnter = (e) => {
      this._emit('dropzoneenter', e);
      userCallbacks.onDropZoneEnter?.(e);
    };

    this._options.onDropZoneLeave = (e) => {
      this._emit('dropzoneleave', e);
      userCallbacks.onDropZoneLeave?.(e);
    };
  }

  // Internal methods

  private _getDropZones(): HTMLElement[] {
    // Combine declarative and imperative drop zones
    const selector = this._options.dropZoneSelector ?? '[data-droppable]';
    const containerEl = this._container instanceof ShadowRoot
      ? this._container
      : this._container;

    const declarative = Array.from(
      containerEl.querySelectorAll<HTMLElement>(selector)
    );

    const imperative = [...this._imperativeDropZones.keys()];

    // Unique elements
    return [...new Set([...declarative, ...imperative])];
  }

  private _getItemData(element: HTMLElement): Record<string, unknown> | undefined {
    return this._imperativeDraggables.get(element)?.data;
  }

  private _getItemAxis(element: HTMLElement): Axis | undefined {
    // Check imperative first
    const imperative = this._imperativeDraggables.get(element);
    if (imperative?.axis) return imperative.axis;

    // Check data attribute
    const axis = element.dataset.dragAxis as Axis | undefined;
    if (axis === 'x' || axis === 'y' || axis === 'both') {
      return axis;
    }

    return undefined;
  }

  private _scanDeclarativeElements(): void {
    const dropZoneSelector = this._options.dropZoneSelector ?? '[data-droppable]';
    const containerEl = this._container instanceof ShadowRoot
      ? this._container
      : this._container;

    // Register declarative drop zones
    const dropZones = containerEl.querySelectorAll<HTMLElement>(dropZoneSelector);
    for (const zone of dropZones) {
      if (!this._imperativeDropZones.has(zone)) {
        this._dropZoneManager.register(zone);
      }
    }
  }

  private _setupStateListeners(): void {
    // Forward state events to behaviors, store unsubscribers for cleanup
    this._stateUnsubscribers.push(
      this._state.subscribe('dragstart', (session) => {
        for (const behavior of this._behaviors) {
          behavior.onDragStart?.(session);
        }
      })
    );

    this._stateUnsubscribers.push(
      this._state.subscribe('dragmove', (session) => {
        for (const behavior of this._behaviors) {
          behavior.onDragMove?.(session);
        }
      })
    );

    this._stateUnsubscribers.push(
      this._state.subscribe('dragend', (session) => {
        for (const behavior of this._behaviors) {
          behavior.onDragEnd?.(session);
        }
      })
    );
  }

  private _setupAutoRefresh(): void {
    this._observer = new MutationObserver((mutations) => {
      // Guard against destroyed instance
      if (this._destroyed) return;

      let needsRefresh = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          needsRefresh = true;
          break;
        }
      }

      if (needsRefresh && !this._refreshScheduled) {
        this._refreshScheduled = true;
        // Debounce refresh
        requestAnimationFrame(() => {
          // Guard against destroyed instance in RAF callback
          if (this._destroyed) return;
          this._refreshScheduled = false;
          this.refresh();
        });
      }
    });

    const target = this._container instanceof ShadowRoot
      ? this._container
      : this._container;

    this._observer.observe(target, {
      childList: true,
      subtree: true,
    });
  }

  private _setupScrollResize(): void {
    // Invalidate bounds cache on scroll (capture phase for nested scrollers)
    this._scrollHandler = () => {
      if (this._state.isDragging()) {
        boundsCache.invalidateAll();
      }
    };
    window.addEventListener('scroll', this._scrollHandler, true);

    // Invalidate on resize
    this._resizeHandler = () => {
      boundsCache.invalidateAll();
    };
    window.addEventListener('resize', this._resizeHandler);
  }
}

// Export as default and named
export default Snap;

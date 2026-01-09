/**
 * Snap - A zero-dependency, memory-optimized drag and drop library
 *
 * @example Basic usage with data attributes
 * ```html
 * <div id="container">
 *   <div data-draggable>Drag me</div>
 *   <div data-droppable>Drop here</div>
 * </div>
 *
 * <script>
 *   const snap = new Snap(document.getElementById('container'));
 * </script>
 * ```
 *
 * @example Imperative usage
 * ```javascript
 * const snap = new Snap(container, {
 *   onDrop: (e) => console.log('Dropped!', e.element, e.dropZone)
 * });
 *
 * snap.addDraggable(myElement, { data: { id: 1 } });
 * snap.addDropZone(myZone, { accepts: ['item'] });
 * ```
 *
 * @example With Lit Element
 * ```javascript
 * class MyComponent extends LitElement {
 *   snap;
 *
 *   firstUpdated() {
 *     this.snap = new Snap(this.shadowRoot, {
 *       autoRefresh: true,
 *       onDrop: this.handleDrop.bind(this)
 *     });
 *   }
 *
 *   disconnectedCallback() {
 *     super.disconnectedCallback();
 *     this.snap?.destroy();
 *   }
 * }
 * ```
 */

// Main entry point
export { Snap, default } from './core/Snap.js';

// Core classes (for advanced usage)
export { DragState } from './core/DragState.js';
export { DragEngine } from './core/DragEngine.js';
export { DropZone, DropZoneManager } from './core/DropZone.js';

// Plugins
export { Sortable } from './plugins/Sortable.js';
export { Kanban } from './plugins/Kanban.js';
export { FileDrop, createFileDropZone } from './plugins/FileDrop.js';

// Behaviors
export { AutoScroll } from './behaviors/AutoScroll.js';
export { SnapGrid } from './behaviors/SnapGrid.js';
export { ConstraintAxis } from './behaviors/ConstraintAxis.js';

// Utilities (for custom implementations)
export { EventEmitter } from './utils/EventEmitter.js';
export { ObjectPool, pointPool, rectPool } from './utils/ObjectPool.js';
export { BoundsCache, boundsCache } from './utils/BoundsCache.js';
export { RAFThrottle, rafThrottle } from './utils/RAFThrottle.js';
export { SnapDataTransfer } from './utils/DataTransfer.js';

// Sensors (for custom implementations)
export { PointerSensor } from './sensors/PointerSensor.js';
export { FileSensor } from './sensors/FileSensor.js';

// Types
export type {
  // Core types
  Point,
  Rect,
  Axis,
  Unsubscribe,

  // Session types
  DragSession,
  DragPhase,
  DataTransfer,

  // Event types
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent,
  DropEvent,
  DropZoneEnterEvent,
  DropZoneLeaveEvent,
  FileDropEvent,
  SnapEventMap,
  SnapEventName,

  // Options types
  SnapOptions,
  SnapInstance,
  ItemOptions,
  DropZoneOptions,
  AutoScrollOptions,
  GridOptions,
  SortableOptions,
  KanbanOptions,
  FileDropOptions,

  // Plugin/Behavior types
  Plugin,
  Behavior,
  Sensor,
} from './types/index.js';

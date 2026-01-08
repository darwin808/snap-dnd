/**
 * Core types for Snap drag and drop library
 */

// Geometry types
export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Event callback types
export type Unsubscribe = () => void;

// Axis constraint
export type Axis = 'x' | 'y' | 'both';

// Drag session represents an active drag operation
export interface DragSession {
  readonly id: string;
  readonly element: HTMLElement;
  readonly origin: Point;
  readonly data: DataTransfer;
  current: Point;
  delta: Point;
  dropZone: HTMLElement | null;
  phase: DragPhase;
}

export type DragPhase = 'pending' | 'dragging' | 'dropping' | 'cancelled';

// Custom DataTransfer (not browser's)
export interface DataTransfer {
  setData(type: string, value: unknown): void;
  getData<T = unknown>(type: string): T | undefined;
  hasType(type: string): boolean;
  readonly types: string[];
  clear(): void;
}

// Event payloads
export interface DragStartEvent {
  readonly element: HTMLElement;
  readonly position: Point;
  readonly data: DataTransfer;
  cancel(): void;
}

export interface DragMoveEvent {
  readonly element: HTMLElement;
  readonly position: Point;
  readonly delta: Point;
  readonly dropZone: HTMLElement | null;
}

export interface DragEndEvent {
  readonly element: HTMLElement;
  readonly position: Point;
  readonly delta: Point;
  readonly cancelled: boolean;
}

export interface DropEvent {
  readonly element: HTMLElement;
  readonly dropZone: HTMLElement;
  readonly position: Point;
  readonly data: DataTransfer;
  readonly insertionIndex?: number;
  readonly sourceContainer?: HTMLElement;
}

export interface DropZoneEnterEvent {
  readonly element: HTMLElement;
  readonly dropZone: HTMLElement;
  readonly position: Point;
}

export interface DropZoneLeaveEvent {
  readonly element: HTMLElement;
  readonly dropZone: HTMLElement;
}

export interface FileDropEvent {
  readonly files: File[];
  readonly position: Point;
  readonly dropZone: HTMLElement;
}

// Auto-scroll options
export interface AutoScrollOptions {
  threshold?: number;
  maxSpeed?: number;
  acceleration?: number;
}

// Grid snap options
export interface GridOptions {
  x: number;
  y: number;
}

// Sortable plugin options
export interface SortableOptions {
  animation?: number;
  ghostClass?: string;
  placeholderClass?: string;
}

// Kanban plugin options
export interface KanbanOptions {
  containers?: string;
  items?: string;
  animation?: number;
}

// File drop plugin options
export interface FileDropOptions {
  accept?: string[];
  multiple?: boolean;
  maxSize?: number;
}

// Item-specific options (for imperative API)
export interface ItemOptions {
  data?: Record<string, unknown>;
  axis?: Axis;
  handle?: string;
  disabled?: boolean;
}

// Drop zone options (for imperative API)
export interface DropZoneOptions {
  accepts?: string[] | ((data: DataTransfer) => boolean);
  onEnter?: (event: DropZoneEnterEvent) => void;
  onLeave?: (event: DropZoneLeaveEvent) => void;
}

// Main configuration options
export interface SnapOptions {
  // Selectors (for declarative mode)
  draggableSelector?: string;
  dropZoneSelector?: string;
  handleSelector?: string;

  // Behavior
  axis?: Axis;
  grid?: GridOptions;
  delay?: number;
  distance?: number;

  // Auto-scroll
  autoScroll?: boolean | AutoScrollOptions;

  // Callbacks
  onDragStart?: (event: DragStartEvent) => void | false;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDrop?: (event: DropEvent) => void;
  onDropZoneEnter?: (event: DropZoneEnterEvent) => void;
  onDropZoneLeave?: (event: DropZoneLeaveEvent) => void;

  // Plugins
  sortable?: boolean | SortableOptions;
  kanban?: boolean | KanbanOptions;
  fileDrop?: boolean | FileDropOptions;

  // Advanced
  autoRefresh?: boolean;
  ghostClass?: string;
  placeholderClass?: string;
  /** Disable RAF throttling for snappier feel (may impact performance with many items) */
  throttle?: boolean;
}

// Internal state events
export type StateEvent =
  | 'dragstart'
  | 'dragmove'
  | 'dragend'
  | 'dropzoneenter'
  | 'dropzoneleave'
  | 'drop';

// Sensor interface for different input types
export interface Sensor {
  attach(): void;
  detach(): void;
}

// Plugin interface
export interface Plugin {
  name: string;
  init(snap: SnapInstance): void;
  destroy(): void;
}

// Behavior interface
export interface Behavior {
  name: string;
  onDragStart?(session: DragSession): void;
  onDragMove?(session: DragSession): void;
  onDragEnd?(session: DragSession): void;
  destroy(): void;
}

// Public Snap instance interface
export interface SnapInstance {
  readonly options: SnapOptions;
  enable(): void;
  disable(): void;
  destroy(): void;
  refresh(): void;
  setOptions(options: Partial<SnapOptions>): void;
  addDraggable(element: HTMLElement, options?: ItemOptions): void;
  removeDraggable(element: HTMLElement): void;
  addDropZone(element: HTMLElement, options?: DropZoneOptions): void;
  removeDropZone(element: HTMLElement): void;
  isDragging(): boolean;
  getActiveElement(): HTMLElement | null;
}

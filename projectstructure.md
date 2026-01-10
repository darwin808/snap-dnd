# Snap DnD - Project Structure & Reference

## Overview

**Name:** snap-dnd
**Version:** 0.2.1
**NPM:** https://www.npmjs.com/package/snap-dnd
**GitHub:** https://github.com/darwin808/snap-dnd

A zero-dependency, memory-optimized drag and drop library for vanilla JS and Web Components (including Lit).

---

## Project Structure

```
snap/
├── src/
│   ├── index.ts                 # Public API exports (full bundle)
│   ├── core-only.ts             # Core-only exports (no plugins)
│   ├── core/
│   │   ├── index.ts
│   │   ├── Snap.ts              # Main entry class
│   │   ├── DragEngine.ts        # Pointer event orchestration, ghost rendering
│   │   ├── DragState.ts         # Centralized state + pub/sub
│   │   └── DropZone.ts          # Drop zone management
│   ├── plugins/
│   │   ├── index.ts
│   │   ├── Sortable.ts          # Reorder within container
│   │   ├── Kanban.ts            # Multi-container transfer
│   │   └── FileDrop.ts          # External file handling
│   ├── behaviors/
│   │   ├── index.ts
│   │   ├── AutoScroll.ts        # Edge-triggered scrolling
│   │   ├── SnapGrid.ts          # Grid snapping
│   │   └── ConstraintAxis.ts    # X/Y movement constraints
│   ├── sensors/
│   │   ├── index.ts
│   │   ├── PointerSensor.ts     # Unified pointer events
│   │   └── FileSensor.ts        # Native drag for files
│   ├── types/
│   │   └── index.ts             # All TypeScript interfaces
│   └── utils/
│       ├── index.ts
│       ├── ObjectPool.ts        # Reusable objects (memory opt)
│       ├── EventEmitter.ts      # Lightweight pub/sub
│       ├── BoundsCache.ts       # Cached bounding rects (WeakMap)
│       ├── DataTransfer.ts      # Custom data transfer object
│       └── RAFThrottle.ts       # requestAnimationFrame throttle
├── dist/
│   ├── snap.esm.js              # Full bundle (37.8kb)
│   ├── snap.core.js             # Core only (19.8kb)
│   └── index.d.ts               # TypeScript declarations
├── benchmark/
│   ├── index.html               # Basic example
│   ├── grid.html                # Grid/nested sortable example
│   └── lit-example.html         # Lit Web Component example
├── package.json
└── tsconfig.json
```

---

## Key Features

### Core
- Pointer Events API for unified mouse/touch handling
- Event delegation (single listener on container)
- Pointer capture for reliable tracking
- RAF throttling (optional, can be disabled)
- Shadow DOM / Web Component support

### Plugins
- **Sortable**: Reorder items within a container
- **Kanban**: Move items between containers
- **FileDrop**: Handle external file drops

### Options
```typescript
interface SnapOptions {
  draggableSelector?: string;      // default: '[data-draggable]'
  dropZoneSelector?: string;       // default: '[data-droppable]'
  handleSelector?: string;
  axis?: 'x' | 'y' | 'both';
  grid?: { x: number; y: number };
  delay?: number;
  distance?: number;               // pixels before drag starts
  autoScroll?: boolean | AutoScrollOptions;
  throttle?: boolean;              // RAF throttling (default: true)
  ghostClass?: string;
  placeholderClass?: string;
  renderGhost?: (element: HTMLElement) => HTMLElement;  // custom ghost renderer

  // Callbacks
  onDragStart?: (event: DragStartEvent) => void | false;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDrop?: (event: DropEvent) => void;
  onDropZoneEnter?: (event: DropZoneEnterEvent) => void;
  onDropZoneLeave?: (event: DropZoneLeaveEvent) => void;
}
```

---

## Usage Examples

### Basic
```javascript
import { Snap, Sortable } from 'snap-dnd';

const snap = new Snap(container, {
  autoRefresh: true,
  distance: 3
}).use(new Sortable({ animation: 150 }));

// Event listeners
snap.on('dragstart', (e) => console.log('Started', e.element));
snap.on('drop', (e) => console.log('Dropped', e.element));

// Cleanup
snap.destroy();
```

### With Shadow DOM / Lit
```javascript
// Pass shadowRoot as container
this.snap = new Snap(this.shadowRoot, {
  autoRefresh: true,
  renderGhost: (element) => customCloneFunction(element)
}).use(new Sortable({ animation: 150 }));
```

### Data Attributes
```html
<div data-draggable>Drag me</div>
<div data-draggable data-drag-axis="x">Horizontal only</div>
<div data-droppable>Drop zone</div>
```

---

## API Reference

### Snap Instance Methods
```typescript
snap.enable()                    // Enable drag operations
snap.disable()                   // Disable drag operations
snap.destroy()                   // Cleanup all listeners
snap.refresh()                   // Refresh element cache (for dynamic DOM)
snap.setOptions(options)         // Update options
snap.addDraggable(element, options)
snap.removeDraggable(element)
snap.addDropZone(element, options)
snap.removeDropZone(element)
snap.isDragging()                // Returns boolean
snap.getActiveElement()          // Returns dragged element or null
snap.on(event, callback)         // Subscribe to event, returns unsubscribe fn
snap.off(event, callback)        // Unsubscribe from event
```

### Events
- `dragstart` - Drag begins
- `dragmove` - Drag position updates
- `dragend` - Drag ends (cancelled or completed)
- `drop` - Element dropped on valid zone
- `dropzoneenter` - Dragged element enters drop zone
- `dropzoneleave` - Dragged element leaves drop zone

---

## Things We Added (Session History)

### v0.1.7-0.1.8: Layout Shift Fix
- Fixed items shifting when drag starts
- Added `snap-dragging` class BEFORE `onDragStart` callback
- Changed from `position: absolute` to `display: none` for hiding dragged element

### v0.1.9: Nested Sortable Fix
- Fixed nested draggables (e.g., sections containing items)
- Used `:scope > ${selector}` to only get direct children
- Store `_draggedElement` reference for proper cleanup
- Auto-move element to placeholder position on drag end
- Copy computed margin to placeholder

### v0.1.10: Index Calculation Fix
- Removed incorrect `newIndex++` adjustment for filtered lists

### v0.1.11: Event Listener API
- Added `on()` and `off()` methods for dynamic event subscription
- Events: `dragstart`, `dragmove`, `dragend`, `drop`, `dropzoneenter`, `dropzoneleave`

### v0.1.12: Shadow DOM Ghost Rendering
- Added `renderGhost` option for custom ghost rendering
- Added recursive `_copyComputedStyles()` method in DragEngine
- Supports Lit elements with Shadow DOM

### v0.2.0: (unknown - external publish)

### v0.2.1: RAFThrottle Flush Fix
- Fixed bug where `flush()` passed null data
- `this.cancel()` was setting `_pending = null` before it was used
- Now saves data to local variable before calling cancel

---

## Build Commands

```bash
npm run build          # Build both bundles
npm run build:full     # Build full bundle only
npm run build:core     # Build core-only bundle
npm run dev            # Watch mode
npm run typecheck      # TypeScript check
npm run test           # Run tests
```

---

## Key Implementation Details

### Sortable Plugin (src/plugins/Sortable.ts)
- Uses `:scope > selector` for direct children only
- Stores `_draggedElement` reference (not relying on `getActiveElement()`)
- Auto-moves element to placeholder position on cleanup
- Copies computed margin to placeholder for proper spacing

### DragEngine (src/core/DragEngine.ts)
- Supports custom `renderGhost` function
- Recursively copies computed styles for Shadow DOM compatibility
- Ghost appended to `document.body` (not container) to avoid transform issues

### RAFThrottle (src/utils/RAFThrottle.ts)
- `flush()` saves pending data before calling `cancel()`
- Class-based `RAFThrottle<T>` and function-based `rafThrottle(fn)`

---

## CSS Classes (User Must Style)

```css
/* Applied during drag */
.snap-dragging {
  display: none;  /* or opacity: 0, visibility: hidden */
}

/* Ghost element */
.snap-ghost {
  /* Automatically has: position: fixed, pointer-events: none, z-index: 9999 */
}

/* Sortable placeholder */
.snap-sortable-placeholder {
  background: rgba(0, 0, 0, 0.1);
  border: 2px dashed #ccc;
}
```

---

## Benchmark Examples

- `benchmark/index.html` - Basic drag and drop
- `benchmark/grid.html` - Nested sortable (sections with items)
- `benchmark/lit-example.html` - Full Lit Web Components example

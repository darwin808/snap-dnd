# Snap

A zero-dependency, memory-optimized drag and drop library for vanilla JavaScript and Web Components.

## Features

- **Zero dependencies** - Pure vanilla JavaScript
- **Tiny footprint** - Core ~5KB gzipped, Full ~9KB gzipped
- **Memory efficient** - Object pooling, event delegation, WeakMap caches
- **Web Component ready** - Works with Shadow DOM and Lit Elements
- **Touch support** - Mouse, touch, and pointer events
- **Beginner friendly** - Works with just data attributes
- **Highly customizable** - Plugin system, behaviors, comprehensive options

## Bundle Sizes

| Import | Minified | Gzipped |
|--------|----------|---------|
| `snap-dnd/core` | 17.6 KB | **~5 KB** |
| `snap-dnd` (full) | 35.3 KB | ~9 KB |

## Installation

```bash
npm install snap-dnd
```

### Core Only (Minimal ~5KB)

If you don't need plugins (Sortable, Kanban, FileDrop), import the core:

```javascript
import { Snap } from 'snap-dnd/core';
```

## Quick Start

### Declarative (Data Attributes)

The simplest way to use Snap - just add data attributes:

```html
<div id="container">
  <div data-draggable>Drag me!</div>
  <div data-draggable>Drag me too!</div>
  <div data-droppable>Drop here</div>
</div>

<script type="module">
  import { Snap } from 'snap-dnd';

  const snap = new Snap(document.getElementById('container'), {
    onDrop: (e) => console.log('Dropped!', e.element, 'into', e.dropZone)
  });
</script>
```

### Imperative (JavaScript)

For more control, use the imperative API:

```javascript
import { Snap } from 'snap-dnd';

const snap = new Snap(container, {
  onDragStart: (e) => console.log('Started dragging', e.element),
  onDragMove: (e) => console.log('Moving', e.position),
  onDrop: (e) => console.log('Dropped', e.element, 'at index', e.insertionIndex),
});

// Add elements programmatically
snap.addDraggable(myElement, {
  data: { id: 1, type: 'task' },
  axis: 'y'  // Only vertical movement
});

snap.addDropZone(myZone, {
  accepts: ['task'],
  onEnter: () => myZone.classList.add('highlight')
});

// Cleanup when done
snap.destroy();
```

## Data Attributes

| Attribute | Description |
|-----------|-------------|
| `data-draggable` | Makes element draggable |
| `data-droppable` | Makes element a drop zone |
| `data-drag-handle` | Only this element can initiate drag |
| `data-drag-axis="x\|y"` | Constrain to horizontal or vertical |
| `data-drag-id="..."` | Custom ID passed to callbacks |
| `data-drag-type="..."` | Type for drop zone filtering |
| `data-accepts="a,b,c"` | Types this drop zone accepts |
| `data-file-drop` | Enable file drop zone |

## Options

```typescript
const snap = new Snap(container, {
  // Selectors
  draggableSelector: '[data-draggable]',
  dropZoneSelector: '[data-droppable]',
  handleSelector: '[data-drag-handle]',

  // Behavior
  axis: 'both',         // 'x', 'y', or 'both'
  grid: { x: 20, y: 20 },  // Snap to grid
  delay: 0,             // ms before drag starts
  distance: 0,          // px before drag starts

  // Auto-scroll when near edges
  autoScroll: true,     // or { threshold: 40, maxSpeed: 15 }

  // Callbacks
  onDragStart: (e) => {},
  onDragMove: (e) => {},
  onDragEnd: (e) => {},
  onDrop: (e) => {},
  onDropZoneEnter: (e) => {},
  onDropZoneLeave: (e) => {},

  // Advanced
  autoRefresh: false,   // Auto-detect DOM changes
  ghostClass: 'my-ghost',
});
```

## With Lit Elements

Snap works seamlessly with Web Components:

```javascript
import { LitElement, html } from 'lit';
import { Snap } from 'snap-dnd';

class TaskBoard extends LitElement {
  snap;

  firstUpdated() {
    this.snap = new Snap(this.shadowRoot, {
      autoRefresh: true,  // Handle Lit re-renders
      onDrop: this.handleDrop.bind(this)
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.snap?.destroy();
  }

  handleDrop(e) {
    // Update your state, Lit will re-render
    this.tasks = reorder(this.tasks, e.insertionIndex);
  }

  render() {
    return html`
      <ul>
        ${this.tasks.map(task => html`
          <li data-draggable data-drag-id=${task.id}>${task.title}</li>
        `)}
      </ul>
    `;
  }
}
```

## Plugins

### Sortable

Reorder items within a container:

```javascript
import { Snap, Sortable } from 'snap-dnd';

const snap = new Snap(container).use(new Sortable({
  animation: 150,
  ghostClass: 'sortable-ghost',
  placeholderClass: 'sortable-placeholder'
}));
```

### Kanban

Move items between multiple containers:

```javascript
import { Snap, Kanban } from 'snap-dnd';

const snap = new Snap(board).use(new Kanban({
  containers: '.column',
  items: '.card',
  animation: 150
}));
```

### Nested Sortable (Grid Layout)

Create nested sortable layouts where sections move vertically and items move horizontally:

```
┌─────────────────────────┐
│ [1] [2] [3]  ← horizontal │  ← Section 1 (vertical)
├─────────────────────────┤
│ [4] [5] [6]  ← horizontal │  ← Section 2 (vertical)
├─────────────────────────┤
│ [7] [8] [9]  ← horizontal │  ← Section 3 (vertical)
└─────────────────────────┘
```

```html
<div id="board">
  <div class="section" data-draggable data-drag-axis="y" data-droppable>
    <div class="item" data-draggable data-drag-axis="x">1</div>
    <div class="item" data-draggable data-drag-axis="x">2</div>
    <div class="item" data-draggable data-drag-axis="x">3</div>
  </div>
  <div class="section" data-draggable data-drag-axis="y" data-droppable>
    <div class="item" data-draggable data-drag-axis="x">4</div>
    <div class="item" data-draggable data-drag-axis="x">5</div>
    <div class="item" data-draggable data-drag-axis="x">6</div>
  </div>
  <div class="section" data-draggable data-drag-axis="y" data-droppable>
    <div class="item" data-draggable data-drag-axis="x">7</div>
    <div class="item" data-draggable data-drag-axis="x">8</div>
    <div class="item" data-draggable data-drag-axis="x">9</div>
  </div>
</div>
```

```javascript
import { Snap, Sortable } from 'snap-dnd';

const snap = new Snap(document.getElementById('board'), {
  onDrop: (e) => {
    const isSection = e.element.classList.contains('section');
    console.log(isSection ? 'Section' : 'Item', 'moved to index:', e.insertionIndex);
  }
}).use(new Sortable());
```

### FileDrop

Handle file drops from desktop:

```javascript
import { Snap, FileDrop } from 'snap-dnd';

const snap = new Snap(container).use(
  new FileDrop({
    accept: ['image/*', '.pdf'],
    multiple: true,
    maxSize: 10 * 1024 * 1024  // 10MB
  }).onFileDrop((e) => {
    console.log('Files dropped:', e.files);
  })
);
```

Or use the standalone helper:

```javascript
import { createFileDropZone } from 'snap-dnd';

const cleanup = createFileDropZone(element, {
  accept: ['image/*'],
  onDrop: (files) => uploadFiles(files)
});

// Later: cleanup();
```

## Behaviors

Add optional behaviors for extra functionality:

```javascript
import { Snap, AutoScroll, SnapGrid } from 'snap-dnd';

const snap = new Snap(container)
  .addBehavior(new AutoScroll({ threshold: 50, maxSpeed: 20 }))
  .addBehavior(new SnapGrid({ x: 10, y: 10 }));
```

## CSS

Snap doesn't inject any CSS. Add your own styles:

```css
/* Required for touch devices */
[data-draggable] {
  touch-action: none;
  user-select: none;
  cursor: grab;
}

/* Optional visual feedback */
.snap-dragging { opacity: 0.5; }
.snap-drop-active { background: rgba(0,120,255,0.1); }
.snap-ghost { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
```

See `examples/snap.css` for a complete reference stylesheet.

## API Reference

### Snap Instance

```typescript
interface Snap {
  enable(): void;
  disable(): void;
  destroy(): void;
  refresh(): void;

  addDraggable(element: HTMLElement, options?: ItemOptions): void;
  removeDraggable(element: HTMLElement): void;
  addDropZone(element: HTMLElement, options?: DropZoneOptions): void;
  removeDropZone(element: HTMLElement): void;

  isDragging(): boolean;
  getActiveElement(): HTMLElement | null;

  use(plugin: Plugin): this;
  addBehavior(behavior: Behavior): this;
  setOptions(options: Partial<SnapOptions>): void;
}
```

### Event Objects

```typescript
interface DragStartEvent {
  element: HTMLElement;
  position: { x: number; y: number };
  data: DataTransfer;
  cancel(): void;
}

interface DropEvent {
  element: HTMLElement;
  dropZone: HTMLElement;
  position: { x: number; y: number };
  data: DataTransfer;
  insertionIndex?: number;
  sourceContainer?: HTMLElement;
}
```

## Browser Support

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

## License

MIT

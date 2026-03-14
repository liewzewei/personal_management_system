# Drag and Drop Diagnostic Audit

## 1. DragOverlay

### ✅ DragOverlay IS Present
**File:** `/app/tasks/page.tsx` (lines 796-809)

```typescript
{/* Drag overlay — shows a ghost of the card being dragged */}
<DragOverlay>
  {activeDragTask ? (
    <div className="opacity-80 rotate-2">
      <KanbanCard
        task={activeDragTask}
        column="todo"
        subtaskCount={subtaskCounts[activeDragTask.id]?.total ?? 0}
        subtaskDoneCount={subtaskCounts[activeDragTask.id]?.done ?? 0}
        onClick={() => {}}
      />
    </div>
  ) : null}
</DragOverlay>
```

**Analysis:** DragOverlay is present and correctly configured. It shows a rotated version of the active task.

---

## 2. DraggableCard Transform Handling

### Current DraggableCard Implementation
**File:** `/components/tasks/KanbanCard.tsx` (lines 87-120)

```typescript
function DraggableCard({ task, children }: { task: Task; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id: task.id });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)` 
      : undefined,
    touchAction: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={cn(isDragging && "opacity-50")}>
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-60 transition-opacity"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
```

### Transform Analysis
- **Method:** Manual `translate3d(${transform.x}px, ${transform.y}px, 0)` string
- **NOT using:** `CSS.Translate.toString(transform)` from @dnd-kit/utilities
- **When not dragging:** `transform` is `undefined`, style becomes `{ touchAction: 'none', userSelect: 'none', ... }`
- **When dragging:** `transform` has `{x, y}` values, style includes transform string

**Potential Issue:** Using manual translate3d string instead of @dnd-kit's CSS utility might cause problems.

---

## 3. useDraggable Return Values

### Current Destructure
```typescript
const {
  attributes,
  listeners,
  setNodeRef,
  setActivatorNodeRef,
  transform,
  isDragging,
} = useDraggable({ id: task.id });
```

### Application
- ✅ `setActivatorNodeRef` is present and applied to handle (line 111)
- ✅ `transform` is used in style object
- ✅ `attributes` on wrapper div (line 109)
- ✅ `listeners` on handle div (line 112)

---

## 4. Sensors and Activation

### Current Sensors Configuration
**File:** `/app/tasks/page.tsx` (lines 148-152)

```typescript
// @dnd-kit sensors with keyboard accessibility
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor)
);
```

### Analysis
- **Distance constraint:** 8px ✅
- **No delay constraint** ✅
- **Keyboard sensor:** Present ✅

---

## 5. Event Propagation

### Card onClick Handler
**File:** `/components/tasks/KanbanCard.tsx` (lines 147-151)

```typescript
onClick={(e) => {
  const target = e.target as HTMLElement;
  if (target.closest("[data-checkbox]") || target.closest("[data-menu]")) return;
  onClick(task.id);
}}
```

### Analysis
- **No `preventDefault()`** ✅
- **No `stopPropagation()`** ✅
- **Only stops for checkbox and menu** ✅

### Other Event Handlers
- **Checkbox:** `onClick={(e) => e.stopPropagation()}` - Only on checkbox, not card
- **Menu:** `onClick={(e) => e.stopPropagation()}` - Only on menu, not card
- **No `onPointerDown`, `onMouseDown`, `onTouchStart`** on card ✅

---

## 6. Column Wrapper

### Current DroppableColumn Implementation
**File:** `/app/tasks/page.tsx` (lines 67-105)

```typescript
function DroppableColumn({
  id,
  title,
  count,
  isOver,
  children,
}: {
  id: string;
  title: string;
  count: number;
  isOver: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver: dropping } = useDroppable({ id });
  const highlighted = isOver || dropping;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col min-w-0 flex-1 rounded-lg bg-muted/40 border",
        highlighted && "border-dashed border-primary bg-primary/5"
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      </div>
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </div>
    </div>
  );
}
```

### Analysis
- ✅ **ScrollArea replaced with plain div**
- ✅ **No `pointer-events-none`**
- ✅ **No `overflow-hidden` on wrapper**
- ✅ **`overscrollBehavior: 'contain'`** on scrollable div
- ✅ **No position styles that could clip**

---

## 7. Active Drag State

### Diagnostic Console Log Added
**File:** `/app/tasks/page.tsx` (line 268)

```typescript
function handleDragStart(event: DragStartEvent) {
  console.log('drag started', event.active.id);
  setActiveDragId(event.active.id as string);
}
```

### State Management
- `activeDragId` state exists and is set in `handleDragStart`
- `activeDragTask` derived from tasks array using `activeDragId`

**TEST REQUIRED:** Check browser console when attempting to drag.

---

## 8. Card Position and Stacking Context

### DraggableCard Wrapper CSS
```typescript
<div ref={setNodeRef} style={style} {...attributes} className={cn(isDragging && "opacity-50")}>
```

### Analysis
- **Position:** Default (static) - not explicitly set
- **No parent transforms** detected in DroppableColumn
- **No `will-change`, `perspective`, `transform-style: preserve-3d`** detected
- **zIndex:** `isDragging ? 50 : undefined` - should work

---

## 9. Full Page Structure

### Complete JSX Hierarchy
```typescript
<DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
  <div className="flex gap-4 h-full p-4">
    <DroppableColumn id="todo-column" title="To Do" count={grouped.todo.length} isOver={false}>
      <div ref={setNodeRef} className="flex flex-col min-w-0 flex-1 rounded-lg bg-muted/40 border">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          {/* Header */}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ overscrollBehavior: 'contain' }}>
          {grouped.todo.map((task) => (
            <KanbanCard key={task.id} task={task} column="todo" ... />
          ))}
        </div>
      </div>
    </DroppableColumn>
    {/* Other columns... */}
  </div>
  <DragOverlay>
    {/* Overlay content */}
  </DragOverlay>
</DndContext>
```

### KanbanCard Structure (when draggable)
```typescript
<KanbanCard column="todo">
  <DraggableCard>
    <div ref={setNodeRef} style={style} {...attributes}> {/* Wrapper */}
      <div ref={setActivatorNodeRef} {...listeners}> {/* Handle */}
        <GripVertical />
      </div>
      <div className="group relative rounded-lg border bg-card p-3 ..."> {/* Card content */}
        {/* All card content */}
      </div>
    </div>
  </DraggableCard>
</KanbanCard>
```

---

## 🚨 POTENTIAL ISSUES IDENTIFIED

### 1. **CRITICAL: Manual Transform String**
Using manual `translate3d(${transform.x}px, ${transform.y}px, 0)` instead of `CSS.Translate.toString(transform)` from @dnd-kit/utilities. This is a common cause of drag not working.

### 2. **Double Opacity Setting**
- Style object: `opacity: isDragging ? 0.5 : 1`
- CSS class: `className={cn(isDragging && "opacity-50")}`
- This might cause opacity conflicts

### 3. **Missing CSS Import**
The code uses manual transform string but doesn't import CSS utilities from @dnd-kit. If the manual approach isn't working, we need the proper utility.

### 4. **Card Content Structure**
The card content div is INSIDE the draggable wrapper, which means the entire card (including content) should move when dragging.

---

## 🔍 DIAGNOSTIC TESTS REQUIRED

### Test 1: Console Output
Attempt to drag a To Do card by the grip handle and check:
1. Does `console.log('drag started', event.active.id)` appear in console?
2. What is the logged ID?

### Test 2: Transform Values
Add temporary logging in DraggableCard:
```typescript
console.log('transform:', transform, 'isDragging:', isDragging);
```

### Test 3: Active Drag State
Add temporary logging to see if activeDragTask is found:
```typescript
const activeDragTask = activeDragId ? tasks.find((t) => t.id === activeDragId) : null;
console.log('activeDragId:', activeDragId, 'activeDragTask:', !!activeDragTask);
```

### Test 4: DragOverlay Visibility
When dragging, does the DragOverlay appear at all? Check if you can see a rotated card anywhere.

---

## 📋 NEXT STEPS

1. **First:** Test the console output to see if `handleDragStart` fires
2. **If it fires:** The issue is likely the manual transform string
3. **If it doesn't fire:** The issue is with sensor setup or event interception

Please report the console output when attempting to drag, and whether you see any visual feedback at all.

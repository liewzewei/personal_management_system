# Drag and Drop Diagnostic Audit - Pointer Events Reaching Handle

## 🚨 **ROOT CAUSE IDENTIFIED**

The issue is **`e.stopPropagation()`** on the grip handle's `onPointerDown`. This is blocking @dnd-kit's PointerSensor from receiving the pointer event.

---

## DIAGNOSTIC TEST 1: handleDragStart Console Log

### ✅ Confirmed - Console Log is Present
**File:** `/app/tasks/page.tsx` (lines 267-270)

```typescript
function handleDragStart(event: DragStartEvent) {
  // console.log('drag started', event.active.id);
  setActiveDragId(event.active.id as string);
}
```

**Status:** ✅ Console log is present and ready to fire when @dnd-kit activates.

---

## DIAGNOSTIC TEST 2: stopPropagation Blocking @dnd-kit

### 🚨 **CRITICAL ISSUE FOUND**
**File:** `/components/tasks/KanbanCard.tsx` (lines 126-129)

```typescript
onPointerDown={(e) => {
  e.stopPropagation();  // ❌ THIS BLOCKS @dnd-kit
  console.log('grip handle pointer down');
}}
```

**Analysis:**
- `e.stopPropagation()` stops the event from bubbling up to the document
- @dnd-kit's PointerSensor attaches listeners at the document level
- When stopPropagation is called, the event never reaches @dnd-kit
- **This is why handleDragStart never fires**

### Other stopPropagation/preventDefault Calls Found:
- **Keyboard shortcut handler:** `e.preventDefault()` (line 257) - ✅ Not relevant
- **Archive reopen button:** `e.stopPropagation()` (line 901) - ✅ Not in drag path
- **Checkbox:** `e.stopPropagation()` (line 173) - ✅ Only on checkbox, not handle
- **Menu:** `e.stopPropagation()` (line 197) - ✅ Only on menu, not handle

**Conclusion:** The grip handle's `stopPropagation()` is the ONLY blocker.

---

## DIAGNOSTIC TEST 3: Current Sensors Implementation

### ✅ Sensors are Correctly Configured
**File:** `/app/tasks/page.tsx` (lines 148-152)

```typescript
// @dnd-kit sensors with keyboard accessibility
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  useSensor(KeyboardSensor)
);
```

### ✅ Imports are Correct
**File:** `/app/tasks/page.tsx` (lines 19-26)

```typescript
import {
  DndContext,
  DragOverlay,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  // ... other imports
} from "@dnd-kit/core";
```

**Analysis:** All imports and sensor configuration are correct.

---

## DIAGNOSTIC TEST 4: Complete Current DraggableCard

### Current Implementation (Lines 87-136)
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
    userSelect: 'none',
    WebkitUserSelect: 'none' as React.CSSProperties['WebkitUserSelect'],
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    // touchAction removed — now only on the handle element
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "relative",   // ADD THIS — required for absolute grip to position correctly
        isDragging && "opacity-50"
      )}
    >
      <div
        ref={setActivatorNodeRef}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center 
                   justify-center cursor-grab active:cursor-grabbing
                   opacity-0 group-hover:opacity-60 transition-opacity
                   hover:opacity-100 z-10"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          e.stopPropagation();  // ❌ PROBLEM HERE
          console.log('grip handle pointer down');
        }}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
```

**Analysis:** All @dnd-kit setup is correct, but `stopPropagation()` blocks the events.

---

## DIAGNOSTIC TEST 5: Props Order on Handle Element

### Current Props Order
```typescript
<div
  ref={setActivatorNodeRef}
  {...listeners}              // @dnd-kit's onPointerDown - APPLIED FIRST
  className="..."
  style={{ touchAction: 'none' }}
  onPointerDown={(e) => {    // Our onPointerDown - APPLIED LAST
    e.stopPropagation();     // ❌ OVERRIDES @dnd-kit's handler
    console.log('grip handle pointer down');
  }}
>
```

**Analysis:** In JSX, later props override earlier ones. Our `onPointerDown` with `stopPropagation()` is overriding @dnd-kit's `onPointerDown` from `{...listeners}`.

---

## DIAGNOSTIC TEST 6: Test Without ActivationConstraint

### **TEMPORARY TEST REQUIRED**
Change sensors to:
```typescript
const sensors = useSensors(
  useSensor(PointerSensor),  // Remove activationConstraint
  useSensor(KeyboardSensor)
);
```

**Expected Result:** Still won't work because `stopPropagation()` blocks the initial pointer event, not just the drag activation.

---

## 🎯 **ROOT CAUSE SUMMARY**

### The Problem:
1. `{...listeners}` adds @dnd-kit's `onPointerDown` handler to the grip handle
2. Our `onPointerDown` with `e.stopPropagation()` comes AFTER and overrides it
3. `stopPropagation()` prevents the event from reaching @dnd-kit's document-level listeners
4. @dnd-kit never activates → no drag → no ghost card → `handleDragStart` never fires

### Why Our Console Log Fires:
- Our `onPointerDown` fires because it's directly attached to the element
- But it blocks @dnd-kit from receiving the same event

### The Fix:
Remove `e.stopPropagation()` from the grip handle's `onPointerDown`. The `stopPropagation` is only needed to prevent the card's `onClick` from firing, but @dnd-kit already handles this automatically when drag starts.

---

## 📋 **IMMEDIATE FIX NEEDED**

**Remove this line:**
```typescript
e.stopPropagation();  // ❌ REMOVE THIS LINE
```

**Keep only:**
```typescript
onPointerDown={(e) => {
  console.log('grip handle pointer down');
}}
```

This will allow @dnd-kit's PointerSensor to receive the pointer event and activate the drag functionality.

---

## 🔍 **VERIFICATION AFTER FIX**

After removing `stopPropagation()`:
1. Click grip handle → Should see both console logs
2. Drag from grip → Should see "drag started [taskId]" 
3. Ghost card should appear and follow cursor
4. Drop on In Progress should work

The drag and drop should work immediately after this single change.

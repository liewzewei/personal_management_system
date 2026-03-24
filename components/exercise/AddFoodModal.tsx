/**
 * AddFoodModal — Two-tab modal for adding food to a meal slot.
 * Tab 1: Quick Add (name, calories, optional macros, save to library checkbox)
 * Tab 2: My Foods (saved foods sorted by use_count, search, add button)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useSavedFoods, useCreateSavedFood } from "@/lib/hooks/useNutrition";
import type { MealSlot, SavedFood } from "@/types";

interface AddFoodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  mealSlot: MealSlot;
  onAdd: (data: {
    food_name: string;
    calories: number;
    carbs_g?: number;
    fat_g?: number;
    protein_g?: number;
    saved_food_id?: string;
  }) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AddFoodModal({ open, onOpenChange, date: _date, mealSlot, onAdd }: AddFoodModalProps) {
  const [tab, setTab] = useState<"quick" | "library">("quick");

  // Quick Add state
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [saveToLibrary, setSaveToLibrary] = useState(false);

  // Library state
  const [searchQuery, setSearchQuery] = useState("");
  const { data: savedFoods } = useSavedFoods();
  const createSavedFood = useCreateSavedFood();

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab("quick");
    setFoodName("");
    setCalories("");
    setCarbsG("");
    setFatG("");
    setProteinG("");
    setSaveToLibrary(false);
    setSearchQuery("");
  }, [open]);

  const filteredFoods = useMemo(() => {
    if (!savedFoods) return [];
    if (!searchQuery.trim()) return savedFoods;
    const q = searchQuery.toLowerCase();
    return savedFoods.filter((f) => f.food_name.toLowerCase().includes(q));
  }, [savedFoods, searchQuery]);

  const canQuickAdd = foodName.trim().length > 0 && parseInt(calories) >= 0 && calories.length > 0;

  const handleQuickAdd = () => {
    const data: Parameters<typeof onAdd>[0] = {
      food_name: foodName.trim(),
      calories: parseInt(calories),
    };
    const c = parseFloat(carbsG);
    if (!isNaN(c) && c >= 0) data.carbs_g = c;
    const f = parseFloat(fatG);
    if (!isNaN(f) && f >= 0) data.fat_g = f;
    const p = parseFloat(proteinG);
    if (!isNaN(p) && p >= 0) data.protein_g = p;

    // Save to library if checked
    if (saveToLibrary) {
      createSavedFood.mutate({
        food_name: data.food_name,
        calories: data.calories,
        carbs_g: data.carbs_g,
        fat_g: data.fat_g,
        protein_g: data.protein_g,
      });
    }

    onAdd(data);
    onOpenChange(false);
  };

  const handleLibraryAdd = (food: SavedFood) => {
    onAdd({
      food_name: food.food_name,
      calories: food.calories,
      carbs_g: food.carbs_g ?? undefined,
      fat_g: food.fat_g ?? undefined,
      protein_g: food.protein_g ?? undefined,
      saved_food_id: food.id,
    });
    onOpenChange(false);
  };

  const MEAL_LABELS: Record<string, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to {MEAL_LABELS[mealSlot]}</DialogTitle>
        </DialogHeader>

        {/* Tab switch */}
        <div className="flex border-b -mx-6 px-6">
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "quick" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
            onClick={() => setTab("quick")}
          >
            Quick Add
          </button>
          <button
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "library" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            )}
            onClick={() => setTab("library")}
          >
            My Foods
          </button>
        </div>

        {tab === "quick" && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Food name</Label>
              <Input value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="e.g. Chicken rice" />
            </div>
            <div className="space-y-1.5">
              <Label>Calories (kcal)</Label>
              <Input type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="0" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Carbs (g)</Label>
                <Input type="number" min="0" step="0.1" value={carbsG} onChange={(e) => setCarbsG(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fat (g)</Label>
                <Input type="number" min="0" step="0.1" value={fatG} onChange={(e) => setFatG(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Protein (g)</Label>
                <Input type="number" min="0" step="0.1" value={proteinG} onChange={(e) => setProteinG(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-to-library"
                checked={saveToLibrary}
                onCheckedChange={(c) => setSaveToLibrary(c === true)}
              />
              <label htmlFor="save-to-library" className="text-xs text-muted-foreground cursor-pointer">
                Save to my food library
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleQuickAdd} disabled={!canQuickAdd}>Add</Button>
            </DialogFooter>
          </div>
        )}

        {tab === "library" && (
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search saved foods..."
                className="pl-9 h-9"
              />
            </div>

            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {filteredFoods.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {savedFoods?.length === 0 ? "No saved foods yet. Use Quick Add with 'Save to library' checked." : "No matches found."}
                </p>
              )}
              {filteredFoods.map((food) => (
                <div
                  key={food.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{food.food_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {food.calories} kcal
                      {food.carbs_g != null && ` · ${food.carbs_g}C`}
                      {food.fat_g != null && ` · ${food.fat_g}F`}
                      {food.protein_g != null && ` · ${food.protein_g}P`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleLibraryAdd(food)}>
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

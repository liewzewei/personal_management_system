/**
 * CaloriesTab — Main calorie tracking view within the Exercise page.
 *
 * Layout:
 * - Date navigation: <- [Today, Mar 13] -> (no future dates)
 * - Net Calorie gauge (circular progress)
 * - Macro row: Carbs | Protein | Fat | Water (4 mini cards)
 * - 4 meal sections (Breakfast/Lunch/Dinner/Snacks) with food log entries
 * - Water tracker: 8 glass icons (250ml each), click to fill
 * - Weight section with input
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Droplets, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/lib/hooks/use-toast";
import {
  useDailyNutrition,
  useFoodLogs,
  useCreateFoodLog,
  useDeleteFoodLog,
  useUpsertBodyMetric,
  useBodyMetrics,
} from "@/lib/hooks/useNutrition";
import { AddFoodModal } from "@/components/exercise/AddFoodModal";
import { BMRSetupModal } from "@/components/exercise/BMRSetupModal";
import type { FoodLog, MealSlot, UserPreferences } from "@/types";
import { cn } from "@/lib/utils";

interface CaloriesTabProps {
  preferences: UserPreferences | null;
  onPreferencesUpdate: () => void;
}

const MEAL_SLOTS: { key: MealSlot; label: string }[] = [
  { key: "breakfast", label: "Breakfast" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Dinner" },
  { key: "snack", label: "Snacks" },
];

const WATER_GLASSES = 8;
const WATER_PER_GLASS = 250; // ml

function getLocalDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateLabel(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateString(today);

  if (dateStr === todayStr) return "Today";

  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CaloriesTab({ preferences, onPreferencesUpdate }: CaloriesTabProps) {
  const { toast } = useToast();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return getLocalDateString(d);
  }, []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [bmrModalOpen, setBmrModalOpen] = useState(false);
  const [addFoodModalOpen, setAddFoodModalOpen] = useState(false);
  const [activeMealSlot, setActiveMealSlot] = useState<MealSlot>("breakfast");
  const [weightInput, setWeightInput] = useState("");

  const { data: nutrition } = useDailyNutrition(selectedDate);
  const { data: foodLogs } = useFoodLogs(selectedDate);
  const createFoodLog = useCreateFoodLog();
  const deleteFoodLog = useDeleteFoodLog();
  const upsertBodyMetric = useUpsertBodyMetric();
  const { data: recentMetrics } = useBodyMetrics({ limit: 1 });

  // Show BMR setup on first visit if not configured
  useEffect(() => {
    if (preferences && !preferences.bmr_calories) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBmrModalOpen(true);
    }
  }, [preferences]);

  // Load most recent weight into input
  useEffect(() => {
    if (recentMetrics && recentMetrics.length > 0 && recentMetrics[0].weight_kg) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWeightInput(String(recentMetrics[0].weight_kg));
    }
  }, [recentMetrics]);

  // Date navigation
  const canGoForward = selectedDate < today;
  const navigateDate = useCallback((direction: -1 | 1) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + direction);
    const newDate = getLocalDateString(d);
    if (newDate <= today) setSelectedDate(newDate);
  }, [selectedDate, today]);

  // Group food logs by meal slot
  const logsByMeal = useMemo(() => {
    const grouped: Record<MealSlot, FoodLog[]> = {
      breakfast: [], lunch: [], dinner: [], snack: [],
    };
    for (const log of (foodLogs ?? [])) {
      grouped[log.meal_slot as MealSlot]?.push(log);
    }
    return grouped;
  }, [foodLogs]);

  // Water tracking: total water from food logs today
  const totalWater = nutrition?.total_water_ml ?? 0;
  const filledGlasses = Math.min(Math.floor(totalWater / WATER_PER_GLASS), WATER_GLASSES);

  // Calorie gauge
  const calorieGoal = nutrition?.calorie_goal ?? 2000;
  const netCalories = nutrition?.net_calories ?? 0;
  const remaining = calorieGoal - netCalories;
  const gaugeColor = remaining > 200 ? "text-green-500" : remaining >= 0 ? "text-amber-500" : "text-red-500";

  // Handlers
  const handleAddFood = useCallback((data: {
    food_name: string;
    calories: number;
    carbs_g?: number;
    fat_g?: number;
    protein_g?: number;
    saved_food_id?: string;
  }) => {
    createFoodLog.mutate({
      date: selectedDate,
      meal_slot: activeMealSlot,
      ...data,
    }, {
      onSuccess: () => toast({ title: "Food logged" }),
      onError: () => toast({ title: "Failed to log food", variant: "destructive" }),
    });
  }, [selectedDate, activeMealSlot, createFoodLog, toast]);

  const handleDeleteFood = useCallback((logId: string) => {
    deleteFoodLog.mutate(
      { logId, date: selectedDate },
      {
        onSuccess: () => toast({ title: "Food removed" }),
        onError: () => toast({ title: "Failed to remove food", variant: "destructive" }),
      }
    );
  }, [selectedDate, deleteFoodLog, toast]);

  const handleAddWater = useCallback(() => {
    createFoodLog.mutate({
      date: selectedDate,
      meal_slot: "snack",
      food_name: "Water",
      calories: 0,
      water_ml: WATER_PER_GLASS,
    });
  }, [selectedDate, createFoodLog]);

  const handleSaveWeight = useCallback(() => {
    const w = parseFloat(weightInput);
    if (isNaN(w) || w <= 0) return;
    upsertBodyMetric.mutate(
      { date: selectedDate, weight_kg: w },
      {
        onSuccess: () => toast({ title: "Weight saved" }),
        onError: () => toast({ title: "Failed to save weight", variant: "destructive" }),
      }
    );
  }, [selectedDate, weightInput, upsertBodyMetric, toast]);

  const handleBMRSave = useCallback(async (data: {
    height_cm: number;
    weight_kg: number;
    age: number;
    biological_sex: "male" | "female";
    bmr_calories: number;
    daily_calorie_goal: number;
  }) => {
    try {
      await fetch("/api/calendar/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      setBmrModalOpen(false);
      onPreferencesUpdate();
      toast({ title: "Calorie tracking set up!" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    }
  }, [onPreferencesUpdate, toast]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <button
          className="text-sm font-medium min-w-[100px] text-center"
          onClick={() => setSelectedDate(today)}
        >
          {formatDateLabel(selectedDate)}
          {selectedDate !== today && (
            <span className="text-xs text-muted-foreground ml-1">({selectedDate})</span>
          )}
        </button>
        <Button variant="ghost" size="sm" onClick={() => navigateDate(1)} disabled={!canGoForward}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Net Calorie Summary */}
      <div className="rounded-lg border bg-card p-6 text-center">
        <p className={cn("text-3xl font-bold", gaugeColor)}>
          {netCalories.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {nutrition?.total_calories.toLocaleString() ?? 0} eaten
          {(nutrition?.calories_burned ?? 0) > 0 && ` - ${nutrition?.calories_burned.toLocaleString()} burned`}
          {" = "}
          {netCalories.toLocaleString()} net / {calorieGoal.toLocaleString()} goal
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {remaining > 0
            ? `${remaining.toLocaleString()} kcal remaining`
            : `${Math.abs(remaining).toLocaleString()} kcal over goal`}
        </p>
      </div>

      {/* Macro Row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Carbs</p>
          <p className="text-lg font-semibold">{Math.round(nutrition?.total_carbs_g ?? 0)}g</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Protein</p>
          <p className="text-lg font-semibold">{Math.round(nutrition?.total_protein_g ?? 0)}g</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Fat</p>
          <p className="text-lg font-semibold">{Math.round(nutrition?.total_fat_g ?? 0)}g</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">Water</p>
          <p className="text-lg font-semibold">{totalWater}ml</p>
        </div>
      </div>

      {/* Meal Sections */}
      {MEAL_SLOTS.map(({ key, label }) => (
        <div key={key} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{label}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setActiveMealSlot(key); setAddFoodModalOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add food
            </Button>
          </div>
          {logsByMeal[key].length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No food logged</p>
          )}
          {logsByMeal[key].map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{log.food_name}</p>
                <p className="text-xs text-muted-foreground">
                  {log.calories} kcal
                  {log.carbs_g != null && ` · ${log.carbs_g}C`}
                  {log.fat_g != null && ` · ${log.fat_g}F`}
                  {log.protein_g != null && ` · ${log.protein_g}P`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground"
                onClick={() => handleDeleteFood(log.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      ))}

      {/* Water Tracker */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Water</h3>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: WATER_GLASSES }).map((_, i) => (
            <button
              key={i}
              className={cn(
                "rounded-md border p-1.5 transition-colors",
                i < filledGlasses ? "bg-blue-100 border-blue-300 text-blue-600" : "text-muted-foreground/30 hover:bg-accent"
              )}
              onClick={handleAddWater}
              title={`${(i + 1) * WATER_PER_GLASS}ml`}
            >
              <Droplets className="h-5 w-5" />
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {totalWater}ml / {WATER_GLASSES * WATER_PER_GLASS}ml
          </span>
        </div>
      </div>

      {/* Weight Section */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Weight</h3>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            min="0"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            placeholder="e.g. 70.5"
            className="max-w-[140px]"
          />
          <span className="text-sm text-muted-foreground">kg</span>
          <Button size="sm" variant="outline" onClick={handleSaveWeight}>
            Save
          </Button>
        </div>
      </div>

      {/* Settings link */}
      <div className="pt-2">
        <Button variant="link" size="sm" className="text-muted-foreground p-0 h-auto" onClick={() => setBmrModalOpen(true)}>
          Recalculate BMR / Update goal
        </Button>
      </div>

      {/* Modals */}
      <AddFoodModal
        open={addFoodModalOpen}
        onOpenChange={setAddFoodModalOpen}
        date={selectedDate}
        mealSlot={activeMealSlot}
        onAdd={handleAddFood}
      />

      <BMRSetupModal
        open={bmrModalOpen}
        onOpenChange={setBmrModalOpen}
        initialData={preferences ? {
          height_cm: preferences.height_cm,
          weight_kg: preferences.weight_kg,
          age: preferences.age,
          biological_sex: preferences.biological_sex,
        } : undefined}
        onSave={handleBMRSave}
      />
    </div>
  );
}

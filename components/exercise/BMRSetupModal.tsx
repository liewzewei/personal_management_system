/**
 * BMRSetupModal — Triggered on first Calories tab visit when bmr_calories is null.
 * Fields: Height (cm), Weight (kg), Age, Biological sex, Activity level.
 * Live preview: "BMR: 1,847 kcal/day | TDEE: 2,493 kcal/day"
 * Footer: "Use TDEE as goal" | "Set custom goal" | Save.
 *
 * Source: Mifflin-St Jeor equation (Mifflin et al., 1990)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { calculateBMR, calculateTDEE, ACTIVITY_MULTIPLIERS } from "@/lib/exercise-utils";

interface BMRSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: {
    height_cm?: number | null;
    weight_kg?: number | null;
    age?: number | null;
    biological_sex?: "male" | "female" | null;
  };
  onSave: (data: {
    height_cm: number;
    weight_kg: number;
    age: number;
    biological_sex: "male" | "female";
    bmr_calories: number;
    daily_calorie_goal: number;
  }) => void;
}

export function BMRSetupModal({ open, onOpenChange, initialData, onSave }: BMRSetupModalProps) {
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [activityLevel, setActivityLevel] = useState<keyof typeof ACTIVITY_MULTIPLIERS>("moderately_active");
  const [customGoal, setCustomGoal] = useState("");
  const [useCustomGoal, setUseCustomGoal] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHeightCm(initialData?.height_cm ? String(initialData.height_cm) : "");
    setWeightKg(initialData?.weight_kg ? String(initialData.weight_kg) : "");
    setAge(initialData?.age ? String(initialData.age) : "");
    setSex(initialData?.biological_sex ?? "");
    setActivityLevel("moderately_active");
    setCustomGoal("");
    setUseCustomGoal(false);
  }, [open, initialData]);

  const bmr = useMemo(() => {
    const h = parseInt(heightCm);
    const w = parseFloat(weightKg);
    const a = parseInt(age);
    if (isNaN(h) || isNaN(w) || isNaN(a) || !sex) return null;
    return calculateBMR({ height_cm: h, weight_kg: w, age: a, biological_sex: sex });
  }, [heightCm, weightKg, age, sex]);

  const tdee = useMemo(() => {
    if (!bmr) return null;
    return calculateTDEE(bmr, activityLevel);
  }, [bmr, activityLevel]);

  const canSave = bmr !== null && sex !== "";

  const handleSave = () => {
    if (!bmr || !tdee || !sex) return;
    const goal = useCustomGoal ? parseInt(customGoal) : tdee;
    if (isNaN(goal) || goal <= 0) return;

    onSave({
      height_cm: parseInt(heightCm),
      weight_kg: parseFloat(weightKg),
      age: parseInt(age),
      biological_sex: sex,
      bmr_calories: bmr,
      daily_calorie_goal: goal,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set Up Calorie Tracking</DialogTitle>
          <DialogDescription>
            Used only for BMR calculation — never shared.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Height (cm)</Label>
              <Input type="number" min="0" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (kg)</Label>
              <Input type="number" min="0" step="0.1" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Age</Label>
              <Input type="number" min="0" value={age} onChange={(e) => setAge(e.target.value)} placeholder="25" />
            </div>
            <div className="space-y-1.5">
              <Label>Biological sex</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as "male" | "female")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Activity level</Label>
            <Select value={activityLevel} onValueChange={(v) => setActivityLevel(v as keyof typeof ACTIVITY_MULTIPLIERS)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTIVITY_MULTIPLIERS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live preview */}
          {bmr && tdee && (
            <div className="rounded-lg border bg-muted/50 p-3 text-center">
              <p className="text-sm">
                <span className="font-medium">BMR:</span> {bmr.toLocaleString()} kcal/day
                {" | "}
                <span className="font-medium">TDEE:</span> {tdee.toLocaleString()} kcal/day
              </p>
            </div>
          )}

          {/* Goal selection */}
          {bmr && tdee && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={!useCustomGoal ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseCustomGoal(false)}
                >
                  Use TDEE as goal
                </Button>
                <Button
                  type="button"
                  variant={useCustomGoal ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseCustomGoal(true)}
                >
                  Set custom goal
                </Button>
              </div>
              {useCustomGoal && (
                <Input
                  type="number"
                  min="0"
                  value={customGoal}
                  onChange={(e) => setCustomGoal(e.target.value)}
                  placeholder="e.g. 2000"
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

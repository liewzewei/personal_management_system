/**
 * RunLogModal — Modal for creating/editing a run session.
 *
 * Fields: Date, Distance+unit toggle, Duration (h/m/s), Route name,
 * Effort level (1-5), Calories, Laps toggle, Notes.
 * Live pace display and PR bucket detection as user types.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { calculatePace, formatPace, getDistanceBucket, estimateCaloriesBurned, PR_BUCKETS } from "@/lib/exercise-utils";
import type { ExerciseSession, DistanceUnit, RunLap } from "@/types";

interface RunLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: (ExerciseSession & { laps: RunLap[] }) | null;
  distanceUnit?: DistanceUnit;
  weightKg?: number | null;
  onSave: (data: RunFormData) => void;
}

export interface RunFormData {
  type: "run";
  date: string;
  distance_metres: number;
  duration_seconds: number;
  route_name?: string;
  effort_level?: number;
  calories_burned?: number;
  notes?: string;
  laps?: { lap_number: number; distance_metres: number; duration_seconds: number }[];
}

interface LapRow {
  distance: string;
  minutes: string;
  seconds: string;
}

const EFFORT_LABELS: Record<number, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Moderate",
  4: "Hard",
  5: "Max",
};

export function RunLogModal({
  open,
  onOpenChange,
  session,
  distanceUnit = "km",
  weightKg,
  onSave,
}: RunLogModalProps) {
  const isEdit = !!session;

  // Form state
  const [date, setDate] = useState("");
  const [distance, setDistance] = useState("");
  const [unit, setUnit] = useState<DistanceUnit>(distanceUnit);
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [routeName, setRouteName] = useState("");
  const [effortLevel, setEffortLevel] = useState<number | null>(null);
  const [caloriesOverride, setCaloriesOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [showLaps, setShowLaps] = useState(false);
  const [laps, setLaps] = useState<LapRow[]>([]);

  // Reset form on open
  useEffect(() => {
    if (!open) return;

    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(session.date);
      const distMetres = session.distance_metres ?? 0;
      setDistance(
        unit === "miles"
          ? (distMetres / 1609.344).toFixed(2)
          : (distMetres / 1000).toFixed(2)
      );
      setUnit(distanceUnit);
      const h = Math.floor(session.duration_seconds / 3600);
      const m = Math.floor((session.duration_seconds % 3600) / 60);
      const s = session.duration_seconds % 60;
      setHours(h > 0 ? String(h) : "");
      setMinutes(String(m));
      setSeconds(s > 0 ? String(s) : "");
      setRouteName(session.route_name ?? "");
      setEffortLevel(session.effort_level);
      setCaloriesOverride(session.calories_burned ? String(session.calories_burned) : "");
      setNotes(session.notes ?? "");
      if (session.laps && session.laps.length > 0) {
        setShowLaps(true);
        setLaps(
          session.laps.map((l) => ({
            distance: (l.distance_metres / 1000).toFixed(2),
            minutes: String(Math.floor(l.duration_seconds / 60)),
            seconds: String(l.duration_seconds % 60),
          }))
        );
      } else {
        setShowLaps(false);
        setLaps([]);
      }
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
      setDistance("");
      setUnit(distanceUnit);
      setHours("");
      setMinutes("");
      setSeconds("");
      setRouteName("");
      setEffortLevel(null);
      setCaloriesOverride("");
      setNotes("");
      setShowLaps(false);
      setLaps([]);
    }
  }, [open, session, distanceUnit, unit]);

  // Derived values
  const distanceMetres = useMemo(() => {
    const val = parseFloat(distance);
    if (isNaN(val) || val <= 0) return 0;
    return unit === "miles" ? val * 1609.344 : val * 1000;
  }, [distance, unit]);

  const durationSeconds = useMemo(() => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    return h * 3600 + m * 60 + s;
  }, [hours, minutes, seconds]);

  const livePace = useMemo(() => {
    if (distanceMetres <= 0 || durationSeconds <= 0) return null;
    return formatPace(calculatePace(distanceMetres, durationSeconds));
  }, [distanceMetres, durationSeconds]);

  const prBucket = useMemo(() => {
    if (distanceMetres <= 0) return null;
    return getDistanceBucket(distanceMetres);
  }, [distanceMetres]);

  const estimatedCalories = useMemo(() => {
    if (!weightKg || durationSeconds <= 0) return null;
    return estimateCaloriesBurned({ type: "run", duration_seconds: durationSeconds, weight_kg: weightKg });
  }, [weightKg, durationSeconds]);

  const canSave = distanceMetres > 0 && durationSeconds > 0 && date.length > 0;

  // Lap handlers
  const addLap = useCallback(() => {
    setLaps((prev) => [...prev, { distance: "", minutes: "", seconds: "" }]);
  }, []);

  const updateLap = useCallback((index: number, field: keyof LapRow, value: string) => {
    setLaps((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  const removeLap = useCallback((index: number) => {
    setLaps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = () => {
    const data: RunFormData = {
      type: "run",
      date,
      distance_metres: distanceMetres,
      duration_seconds: durationSeconds,
    };

    if (routeName.trim()) data.route_name = routeName.trim();
    if (effortLevel) data.effort_level = effortLevel;
    if (notes.trim()) data.notes = notes.trim();

    const calVal = parseInt(caloriesOverride);
    if (!isNaN(calVal) && calVal >= 0) {
      data.calories_burned = calVal;
    } else if (estimatedCalories) {
      data.calories_burned = estimatedCalories;
    }

    if (showLaps && laps.length > 0) {
      data.laps = laps
        .map((lap, i) => {
          const lapDist = parseFloat(lap.distance);
          const lapM = parseInt(lap.minutes) || 0;
          const lapS = parseInt(lap.seconds) || 0;
          const lapDuration = lapM * 60 + lapS;
          if (isNaN(lapDist) || lapDist <= 0 || lapDuration <= 0) return null;
          return {
            lap_number: i + 1,
            distance_metres: lapDist * 1000,
            duration_seconds: lapDuration,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null);
    }

    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Run" : "Log Run"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Distance + unit toggle */}
          <div className="space-y-1.5">
            <Label>Distance</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="flex-1"
              />
              <div className="flex rounded-md border overflow-hidden shrink-0">
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    unit === "km" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                  onClick={() => setUnit("km")}
                >
                  km
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    unit === "miles" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                  onClick={() => setUnit("miles")}
                >
                  mi
                </button>
              </div>
            </div>
            {prBucket && (
              <p className="text-xs text-amber-600 font-medium">
                This qualifies for a {PR_BUCKETS[prBucket].label} PR attempt
              </p>
            )}
          </div>

          {/* Duration */}
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground">hours</span>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground">min</span>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
            {livePace && (
              <p className="text-xs text-muted-foreground">
                Average pace: <span className="font-medium text-foreground">{livePace}</span>
              </p>
            )}
          </div>

          {/* Route name */}
          <div className="space-y-1.5">
            <Label>Route name (optional)</Label>
            <Input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g. NUS Loop"
              maxLength={200}
            />
          </div>

          {/* Effort level */}
          <div className="space-y-1.5">
            <Label>Effort level</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                    effortLevel === level
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => setEffortLevel(effortLevel === level ? null : level)}
                  title={EFFORT_LABELS[level]}
                >
                  {level}
                </button>
              ))}
            </div>
            {effortLevel && (
              <p className="text-[10px] text-muted-foreground">{EFFORT_LABELS[effortLevel]}</p>
            )}
          </div>

          {/* Calories */}
          <div className="space-y-1.5">
            <Label>Calories burned</Label>
            <Input
              type="number"
              min="0"
              value={caloriesOverride}
              onChange={(e) => setCaloriesOverride(e.target.value)}
              placeholder={
                estimatedCalories
                  ? `Est. ${estimatedCalories} kcal`
                  : "Enter calories"
              }
            />
            {!weightKg && (
              <p className="text-[10px] text-muted-foreground">
                Set your weight in Settings to enable auto-estimation
              </p>
            )}
          </div>

          {/* Laps toggle */}
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLaps(!showLaps);
                if (!showLaps && laps.length === 0) addLap();
              }}
            >
              {showLaps ? "Hide Laps" : "Add Interval/Laps"}
            </Button>

            {showLaps && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 text-[10px] font-medium text-muted-foreground">
                  <span>#</span>
                  <span>Dist (km)</span>
                  <span>Min</span>
                  <span>Sec</span>
                  <span />
                </div>
                {laps.map((lap, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr_1fr_1fr_auto] gap-2 items-center">
                    <span className="text-xs text-muted-foreground w-6 text-center">{i + 1}</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={lap.distance}
                      onChange={(e) => updateLap(i, "distance", e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={lap.minutes}
                      onChange={(e) => updateLap(i, "minutes", e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={lap.seconds}
                      onChange={(e) => updateLap(i, "seconds", e.target.value)}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeLap(i)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addLap}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Lap
                </Button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEdit ? "Save Changes" : "Save Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

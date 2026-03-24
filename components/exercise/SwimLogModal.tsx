/**
 * SwimLogModal — Modal for creating/editing a swim session.
 *
 * Fields: Date, Pool size (25m/50m) or Open water toggle, Laps,
 * Duration (h/m/s), Stroke type, SWOLF, Calories, Notes.
 * Live distance and pace display.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  calculateSwimmingDistance,
  calculateSwimPace,
  formatSwimPace,
  estimateCaloriesBurned,
} from "@/lib/exercise-utils";
import type { ExerciseSession, StrokeType } from "@/types";

interface SwimLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: ExerciseSession | null;
  weightKg?: number | null;
  onSave: (data: SwimFormData) => void;
}

export interface SwimFormData {
  type: "swim";
  date: string;
  distance_metres: number;
  duration_seconds: number;
  pool_length_metres?: 25 | 50;
  total_laps?: number;
  stroke_type?: StrokeType;
  swolf_score?: number;
  calories_burned?: number;
  notes?: string;
}

const STROKE_OPTIONS: { value: StrokeType; label: string }[] = [
  { value: "freestyle", label: "Freestyle" },
  { value: "backstroke", label: "Backstroke" },
  { value: "breaststroke", label: "Breaststroke" },
  { value: "butterfly", label: "Butterfly" },
  { value: "mixed", label: "Mixed" },
];

export function SwimLogModal({
  open,
  onOpenChange,
  session,
  weightKg,
  onSave,
}: SwimLogModalProps) {
  const isEdit = !!session;

  const [date, setDate] = useState("");
  const [poolLength, setPoolLength] = useState<25 | 50>(50);
  const [isOpenWater, setIsOpenWater] = useState(false);
  const [totalLaps, setTotalLaps] = useState("");
  const [manualDistance, setManualDistance] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [strokeType, setStrokeType] = useState<StrokeType | "">("");
  const [swolfScore, setSwolfScore] = useState("");
  const [caloriesOverride, setCaloriesOverride] = useState("");
  const [notes, setNotes] = useState("");

  // Reset form on open
  useEffect(() => {
    if (!open) return;

    if (session) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDate(session.date);
      setIsOpenWater(!session.pool_length_metres);
      setPoolLength(session.pool_length_metres ?? 50);
      setTotalLaps(session.total_laps ? String(session.total_laps) : "");
      setManualDistance(
        session.distance_metres && !session.pool_length_metres
          ? String(session.distance_metres)
          : ""
      );
      const h = Math.floor(session.duration_seconds / 3600);
      const m = Math.floor((session.duration_seconds % 3600) / 60);
      const s = session.duration_seconds % 60;
      setHours(h > 0 ? String(h) : "");
      setMinutes(String(m));
      setSeconds(s > 0 ? String(s) : "");
      setStrokeType(session.stroke_type ?? "");
      setSwolfScore(session.swolf_score != null ? String(session.swolf_score) : "");
      setCaloriesOverride(session.calories_burned ? String(session.calories_burned) : "");
      setNotes(session.notes ?? "");
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setDate(`${yyyy}-${mm}-${dd}`);
      setPoolLength(50);
      setIsOpenWater(false);
      setTotalLaps("");
      setManualDistance("");
      setHours("");
      setMinutes("");
      setSeconds("");
      setStrokeType("");
      setSwolfScore("");
      setCaloriesOverride("");
      setNotes("");
    }
  }, [open, session]);

  // Derived values
  const distanceMetres = useMemo(() => {
    if (isOpenWater) {
      const val = parseFloat(manualDistance);
      return isNaN(val) || val <= 0 ? 0 : val;
    }
    const laps = parseInt(totalLaps);
    if (isNaN(laps) || laps <= 0) return 0;
    return calculateSwimmingDistance(laps, poolLength);
  }, [isOpenWater, manualDistance, totalLaps, poolLength]);

  const durationSeconds = useMemo(() => {
    const h = parseInt(hours) || 0;
    const m = parseInt(minutes) || 0;
    const s = parseInt(seconds) || 0;
    return h * 3600 + m * 60 + s;
  }, [hours, minutes, seconds]);

  const livePace = useMemo(() => {
    if (distanceMetres <= 0 || durationSeconds <= 0) return null;
    return formatSwimPace(calculateSwimPace(distanceMetres, durationSeconds));
  }, [distanceMetres, durationSeconds]);

  const estimatedCalories = useMemo(() => {
    if (!weightKg || durationSeconds <= 0) return null;
    return estimateCaloriesBurned({ type: "swim", duration_seconds: durationSeconds, weight_kg: weightKg });
  }, [weightKg, durationSeconds]);

  const canSave = distanceMetres > 0 && durationSeconds > 0 && date.length > 0;

  const handleSave = () => {
    const data: SwimFormData = {
      type: "swim",
      date,
      distance_metres: distanceMetres,
      duration_seconds: durationSeconds,
    };

    if (!isOpenWater) {
      data.pool_length_metres = poolLength;
      const laps = parseInt(totalLaps);
      if (!isNaN(laps) && laps > 0) data.total_laps = laps;
    }
    if (strokeType) data.stroke_type = strokeType as StrokeType;

    const swolf = parseFloat(swolfScore);
    if (!isNaN(swolf) && swolf >= 0) data.swolf_score = swolf;

    const calVal = parseInt(caloriesOverride);
    if (!isNaN(calVal) && calVal >= 0) {
      data.calories_burned = calVal;
    } else if (estimatedCalories) {
      data.calories_burned = estimatedCalories;
    }

    if (notes.trim()) data.notes = notes.trim();

    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Swim" : "Log Swim"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* Pool size / Open water toggle */}
          <div className="space-y-1.5">
            <Label>Pool</Label>
            <div className="flex gap-2">
              <div className="flex rounded-md border overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    !isOpenWater && poolLength === 25 ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                  onClick={() => { setIsOpenWater(false); setPoolLength(25); }}
                >
                  25m
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    !isOpenWater && poolLength === 50 ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                  onClick={() => { setIsOpenWater(false); setPoolLength(50); }}
                >
                  50m
                </button>
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    isOpenWater ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                  onClick={() => setIsOpenWater(true)}
                >
                  Open Water
                </button>
              </div>
            </div>
          </div>

          {/* Laps or manual distance */}
          {isOpenWater ? (
            <div className="space-y-1.5">
              <Label>Distance (metres)</Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 1500"
                value={manualDistance}
                onChange={(e) => setManualDistance(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Total laps</Label>
              <Input
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={totalLaps}
                onChange={(e) => setTotalLaps(e.target.value)}
              />
              {distanceMetres > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total distance: <span className="font-medium text-foreground">
                    {distanceMetres.toLocaleString()}m
                  </span>{" "}
                  ({parseInt(totalLaps)} laps × {poolLength}m)
                </p>
              )}
            </div>
          )}

          {/* Duration */}
          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Input type="number" min="0" placeholder="0" value={hours} onChange={(e) => setHours(e.target.value)} />
                <span className="text-[10px] text-muted-foreground">hours</span>
              </div>
              <div className="flex-1">
                <Input type="number" min="0" max="59" placeholder="0" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
                <span className="text-[10px] text-muted-foreground">min</span>
              </div>
              <div className="flex-1">
                <Input type="number" min="0" max="59" placeholder="0" value={seconds} onChange={(e) => setSeconds(e.target.value)} />
                <span className="text-[10px] text-muted-foreground">sec</span>
              </div>
            </div>
            {livePace && (
              <p className="text-xs text-muted-foreground">
                Pace: <span className="font-medium text-foreground">{livePace}</span>
              </p>
            )}
          </div>

          {/* Stroke type */}
          <div className="space-y-1.5">
            <Label>Stroke type</Label>
            <Select value={strokeType} onValueChange={(v) => setStrokeType(v as StrokeType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select stroke" />
              </SelectTrigger>
              <SelectContent>
                {STROKE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SWOLF */}
          <div className="space-y-1.5">
            <Label>
              SWOLF score{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              value={swolfScore}
              onChange={(e) => setSwolfScore(e.target.value)}
              placeholder="e.g. 45"
            />
            <p className="text-[10px] text-muted-foreground">
              Seconds per length + strokes per length. Lower is better.
            </p>
          </div>

          {/* Calories */}
          <div className="space-y-1.5">
            <Label>Calories burned</Label>
            <Input
              type="number"
              min="0"
              value={caloriesOverride}
              onChange={(e) => setCaloriesOverride(e.target.value)}
              placeholder={estimatedCalories ? `Est. ${estimatedCalories} kcal` : "Enter calories"}
            />
            {!weightKg && (
              <p className="text-[10px] text-muted-foreground">
                Set your weight in Settings to enable auto-estimation
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How was the swim?"
              rows={3}
              maxLength={1000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isEdit ? "Save Changes" : "Save Swim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * exercise-utils.ts
 * Pure utility functions for exercise calculations.
 * No Supabase calls. All functions are side-effect free and testable.
 * Imported by both client components and server-side API routes.
 */

import type { PRDistanceBucket } from '@/types';

// PR Bucket Definitions (distances in metres, tolerance +/- 250m)
export const PR_BUCKETS: Record<
  PRDistanceBucket,
  { min: number; max: number; label: string }
> = {
  '1km':           { min: 750,   max: 1250,  label: '1 km'         },
  '5km':           { min: 4750,  max: 5250,  label: '5 km'         },
  '10km':          { min: 9750,  max: 10250, label: '10 km'        },
  'half_marathon': { min: 20900, max: 21300, label: 'Half Marathon' },
};

/**
 * getDistanceBucket
 * Returns the PR bucket a distance falls into, or null if none.
 * Single source of truth for PR eligibility.
 * Examples: 5100m -> '5km', 4749m -> null, 10000m -> '10km'
 */
export function getDistanceBucket(
  distanceMetres: number
): PRDistanceBucket | null {
  for (const [bucket, range] of Object.entries(PR_BUCKETS)) {
    if (distanceMetres >= range.min && distanceMetres <= range.max) {
      return bucket as PRDistanceBucket;
    }
  }
  return null;
}

/**
 * calculatePace
 * Returns pace in seconds per km.
 * Example: 5100m in 1680s -> 329.4 s/km (approx 5:29 /km)
 */
export function calculatePace(
  distanceMetres: number,
  durationSeconds: number
): number {
  const distanceKm = distanceMetres / 1000;
  return durationSeconds / distanceKm;
}

/**
 * formatPace
 * Converts pace in seconds/km to "MM:SS /km" display string.
 * Example: 329 -> "5:29 /km"
 */
export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`;
}

/**
 * formatDuration
 * Converts total seconds to "H:MM:SS" or "MM:SS".
 * Example: 3661 -> "1:01:01", 330 -> "5:30"
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * metresToDisplay
 * Converts metres to display string in user preferred unit.
 * Example: 5100m, 'km' -> "5.10 km" | 5100m, 'miles' -> "3.17 mi"
 */
export function metresToDisplay(
  metres: number,
  unit: 'km' | 'miles' = 'km'
): string {
  if (unit === 'miles') return `${(metres / 1609.344).toFixed(2)} mi`;
  return `${(metres / 1000).toFixed(2)} km`;
}

/**
 * calculateSwimmingDistance
 * Returns total distance in metres from laps x pool length.
 */
export function calculateSwimmingDistance(
  totalLaps: number,
  poolLengthMetres: 25 | 50
): number {
  return totalLaps * poolLengthMetres;
}

/**
 * calculateSwimPace
 * Returns pace in seconds per 100m.
 * Example: 1250m in 1565s -> 125.2 s/100m (approx 2:05 /100m)
 */
export function calculateSwimPace(
  distanceMetres: number,
  durationSeconds: number
): number {
  return (durationSeconds / distanceMetres) * 100;
}

/**
 * formatSwimPace
 * Converts pace in seconds/100m to "MM:SS /100m".
 * Example: 125 -> "2:05 /100m"
 */
export function formatSwimPace(secondsPer100m: number): string {
  const minutes = Math.floor(secondsPer100m / 60);
  const seconds = Math.round(secondsPer100m % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')} /100m`;
}

/**
 * calculateSWOLF
 * SWOLF = seconds per length + strokes per length.
 * Lower SWOLF = better efficiency.
 * Benchmarks: <40 good, 40-55 average, >55 needs work.
 */
export function calculateSWOLF(
  secondsPerLength: number,
  strokesPerLength: number
): number {
  return secondsPerLength + strokesPerLength;
}

/**
 * calculateBMR
 * Mifflin-St Jeor equation for Basal Metabolic Rate.
 * Male:   10 x weight(kg) + 6.25 x height(cm) - 5 x age + 5
 * Female: 10 x weight(kg) + 6.25 x height(cm) - 5 x age - 161
 * Returns daily BMR in kilocalories.
 *
 * Source: Mifflin et al., 1990
 */
export function calculateBMR(params: {
  weight_kg: number;
  height_cm: number;
  age: number;
  biological_sex: 'male' | 'female';
}): number {
  const { weight_kg, height_cm, age, biological_sex } = params;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  return Math.round(biological_sex === 'male' ? base + 5 : base - 161);
}

/**
 * calculateTDEE
 * Total Daily Energy Expenditure = BMR x activity multiplier.
 * Source: Standard MET-based approach.
 */
export const ACTIVITY_MULTIPLIERS = {
  sedentary:         { label: 'Sedentary (little/no exercise)',        value: 1.2   },
  lightly_active:    { label: 'Lightly active (1-3 days/week)',        value: 1.375 },
  moderately_active: { label: 'Moderately active (3-5 days/week)',     value: 1.55  },
  very_active:       { label: 'Very active (6-7 days/week)',           value: 1.725 },
  extra_active:      { label: 'Extra active (physical job + training)', value: 1.9  },
} as const;

export function calculateTDEE(
  bmr: number,
  activityLevel: keyof typeof ACTIVITY_MULTIPLIERS
): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel].value);
}

/**
 * estimateCaloriesBurned
 * MET-based estimate. MET values: run ~9.8, swim ~6.0, other ~5.0.
 * Formula: MET x weight_kg x hours
 */
export function estimateCaloriesBurned(params: {
  type: 'run' | 'swim' | 'other';
  duration_seconds: number;
  weight_kg: number;
}): number {
  const MET: Record<string, number> = { run: 9.8, swim: 6.0, other: 5.0 };
  const hours = params.duration_seconds / 3600;
  return Math.round(MET[params.type] * params.weight_kg * hours);
}

/**
 * predictRaceTime
 * Riegel (1977) formula: T2 = T1 x (D2/D1)^1.06
 * Example: 5km in 28:30 -> predicted 10km approx 59:17
 *
 * Source: Riegel, 1977
 */
export function predictRaceTime(
  knownDistanceMetres: number,
  knownDurationSeconds: number,
  targetDistanceMetres: number
): number {
  return knownDurationSeconds *
    Math.pow(targetDistanceMetres / knownDistanceMetres, 1.06);
}

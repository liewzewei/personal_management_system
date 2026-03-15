/**
 * SessionCard — Displays a single exercise session in the list.
 * Shows date, distance, duration, pace, route, effort dots, PR badge.
 * Three-dot menu: Edit, Delete.
 */

"use client";

import { MoreHorizontal, Pencil, Trash2, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDuration, formatPace, formatSwimPace, calculatePace, calculateSwimPace, metresToDisplay } from "@/lib/exercise-utils";
import type { ExerciseSession, DistanceUnit } from "@/types";

interface SessionCardProps {
  session: ExerciseSession;
  distanceUnit?: DistanceUnit;
  onClick?: (sessionId: string) => void;
  onEdit?: (sessionId: string) => void;
  onDelete?: (sessionId: string) => void;
}

export function SessionCard({ session, distanceUnit = "km", onClick, onEdit, onDelete }: SessionCardProps) {
  const isRun = session.type === "run";
  const isSwim = session.type === "swim";

  const distance = session.distance_metres
    ? metresToDisplay(session.distance_metres, distanceUnit)
    : null;

  const pace = isRun && session.distance_metres
    ? formatPace(calculatePace(session.distance_metres, session.duration_seconds))
    : isSwim && session.distance_metres
      ? formatSwimPace(calculateSwimPace(session.distance_metres, session.duration_seconds))
      : null;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card p-3 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onClick?.(session.id)}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{session.date}</span>
          {distance && (
            <span className="text-sm text-muted-foreground">{distance}</span>
          )}
          <span className="text-sm text-muted-foreground">
            {formatDuration(session.duration_seconds)}
          </span>
          {pace && (
            <span className="text-sm text-muted-foreground">{pace}</span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isRun && session.route_name && (
            <span className="text-xs text-muted-foreground">{session.route_name}</span>
          )}
          {isRun && session.effort_level && (
            <span className="text-xs text-muted-foreground">
              {"●".repeat(session.effort_level)}{"○".repeat(5 - session.effort_level)}
            </span>
          )}
          {isSwim && session.stroke_type && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {session.stroke_type}
            </Badge>
          )}
          {isSwim && session.pool_length_metres && (
            <span className="text-xs text-muted-foreground">
              {session.total_laps} laps × {session.pool_length_metres}m
            </span>
          )}
          {session.is_pr && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5 py-0">
              <Trophy className="h-3 w-3 mr-0.5" />
              PR
            </Badge>
          )}
        </div>
      </div>

      {(onEdit || onDelete) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(session.id); }}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

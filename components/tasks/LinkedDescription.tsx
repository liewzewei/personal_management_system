/**
 * LinkedDescription component.
 *
 * Renders a plain-text string with URLs detected and converted
 * to clickable anchor tags. All links open in a new tab.
 * Preserves whitespace and newlines (whitespace-pre-wrap).
 *
 * URL detection regex: /(https?:\/\/[^\s]+)/g
 * Security: all links use target="_blank" rel="noopener noreferrer"
 */

import { cn } from "@/lib/utils";

interface LinkedDescriptionProps {
  text: string;
  className?: string;
}

export function LinkedDescription({ text, className }: LinkedDescriptionProps) {
  if (!text) return null;

  // Fast path: no URLs → render plain text without splitting overhead
  if (!/https?:\/\//.test(text)) {
    return <p className={cn("text-sm whitespace-pre-wrap", className)}>{text}</p>;
  }

  const parts = text.split(/(https?:\/\/[^\s]+)/g);

  return (
    <p className={cn("text-sm whitespace-pre-wrap", className)}>
      {parts.map((part, i) => {
        // Use a fresh non-global regex to avoid lastIndex statefulness bug
        const isUrl = /^https?:\/\/[^\s]+$/.test(part);
        return isUrl ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline hover:text-blue-700 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        );
      })}
    </p>
  );
}

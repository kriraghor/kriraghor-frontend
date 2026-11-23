import { Avatar } from "@kriraghor/ui/kit";
import { cn } from "@kriraghor/ui/cn";

/**
 * A gym trainer's account photo, or their initials, beside their name (decision 23 Nov 2026). The
 * avatar has a fixed size, so a photo arriving late never moves the line; it is named for screen readers.
 */
export function TrainerFace({ name, src, size = 32, className, testId = "trainer-face" }: { name: string; src?: string | null; size?: number; className?: string; testId?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} data-testid={testId}>
      <Avatar name={name} src={src} size={size} alt={name} />
      <span className="truncate">{name}</span>
    </span>
  );
}

import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** tailwind-merge that knows the token names (rounded-control, max-w-content …) from @kriraghor/tokens. */
const merge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ["control", "card", "pill"],
      container: ["form", "content", "wide"],
    },
  },
});

/** Joins class names; a later Tailwind class wins over an earlier one of the same kind. */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
}

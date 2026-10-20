"use client";

/**
 * The first form primitives, kept as names for the pages that import them; they are the kit's
 * components now (./kit), so every page picks up the 09 §7 look.
 */
import type { ReactNode } from "react";
import { Notice as KitNotice } from "./kit/Display";

export { Field, PasswordField } from "./kit/Form";
export { Button } from "./kit/Button";

/** The old two-tone notice: "info" or "error". */
export function Notice({ tone = "info", children }: { tone?: "info" | "error"; children: ReactNode }) {
  return <KitNotice tone={tone}>{children}</KitNotice>;
}

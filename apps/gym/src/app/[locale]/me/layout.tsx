import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";

/** The gym account area's sidebar: passes, trainer plans, updates, and the way back to kriraghor.com. */
export default function Layout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}

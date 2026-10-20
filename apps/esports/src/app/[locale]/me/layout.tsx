import type { ReactNode } from "react";
import { AccountShell } from "@/components/account/AccountShell";

/** The account area's sidebar (design plan Part D). */
export default function Layout({ children }: { children: ReactNode }) {
  return <AccountShell>{children}</AccountShell>;
}

import type { ReactNode } from "react";
import { ManageShell } from "@/components/manage/ManageShell";

/** /manage: the gym owner's and gym staff's desks (moved from vendor.kriraghor.com/vendor/gyms). */
export default function Layout({ children }: { children: ReactNode }) {
  return <ManageShell>{children}</ManageShell>;
}

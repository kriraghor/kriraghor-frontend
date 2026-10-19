import { AreaShell } from "@/components/AreaShell";

export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return <AreaShell area="admin">{children}</AreaShell>;
}

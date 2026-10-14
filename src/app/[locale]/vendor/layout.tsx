import { AreaShell } from "@/components/AreaShell";

export default function VendorLayout({ children }: LayoutProps<"/[locale]/vendor">) {
  return <AreaShell area="vendor">{children}</AreaShell>;
}

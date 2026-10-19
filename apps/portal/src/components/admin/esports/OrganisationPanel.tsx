"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { organisersAdmin } from "@/lib/admin/organisers";
import { Notice } from "../../ui";

/**
 * The `organisation` panel on the Moderation desk (M14 lite, for M22): the organisation's name,
 * description and contact, and its members. The owner's NID and the registration document were
 * reviewed on the documents desk (locked check owner_documents_approved).
 */
export function OrganisationPanel({ payload }: { payload: Record<string, unknown> }) {
  const t = useTranslations("organisersDesk");
  const id = String(payload.organisationId);
  const q = useQuery({ queryKey: ["admin-org", id], queryFn: () => organisersAdmin.get(id) });
  if (q.isPending) return <div className="mt-4 h-32 animate-pulse bg-surface-2" />;
  if (q.isError || !q.data) return <Notice tone="error">{t("failed")}</Notice>;
  const o = q.data;
  return (
    <div className="mt-6 space-y-3 border-t-2 border-line pt-4" data-testid="organisation-panel">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">{t("panel.name")}</dt>
        <dd className="font-semibold">{o.name}</dd>
        <dt className="text-muted">{t("panel.about")}</dt>
        <dd className="whitespace-pre-line">{o.about ?? "–"}</dd>
        <dt className="text-muted">{t("panel.contact")}</dt>
        <dd>{o.contactEmail ?? "–"}</dd>
        <dt className="text-muted">{t("panel.members")}</dt>
        <dd>{o.members.map((m) => `${m.name ?? "–"} (${m.role})`).join(", ")}</dd>
      </dl>
      <p className="text-sm text-muted">{t("panel.docs")}</p>
    </div>
  );
}

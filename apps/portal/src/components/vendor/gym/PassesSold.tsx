"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft } from "@phosphor-icons/react";
import { Link } from "@kriraghor/ui/i18n/navigation";
import { DataTable, FilterBar, PageTitle, type Column } from "@kriraghor/ui/kit";
import { formatTaka } from "@/lib/admin/finance";
import { gymDesk, type Sold } from "@/lib/vendor/gym";
import { useUrlFilters } from "@/lib/use-url-filters";
import { StatusBadge } from "../../StatusBadge";
import { deskAccessKey, staffPermissionsAt } from "@/lib/vendor/team";
import { problemOf } from "@kriraghor/api-client";
import { DeskAccessNotice, useWorkplaces } from "../StaffAccess";

type Row = Awaited<ReturnType<typeof gymDesk.sold>>["items"][number];
const STATUSES = ["active", "redeemed", "expired", "refunded", "cancelled"] as const;

/**
 * /vendor/gyms/[id]/passes (M20): passes sold, with the price, the Kriraghor fee, what the gym is paid
 * and when. Round B3: the gym's staff with passes.view see the passes without any money (the API
 * leaves it out), so the money columns go.
 */
export function PassesSold({ id }: { id: string }) {
  const t = useTranslations("vendorGym");
  const locale = useLocale();
  const { values, set } = useUrlFilters({ status: { default: "", allowed: ["", ...STATUSES] } });
  const status = (values.status || undefined) as Sold["status"] | undefined;
  const wp = useWorkplaces();
  const perms = staffPermissionsAt(wp.refs, "gym", id);
  const gym = useQuery({ queryKey: ["vendor-gym", id], queryFn: () => gymDesk.get(id), enabled: !wp.me.isPending && perms === null });
  const gymName = perms ? wp.named.find((w) => w.businessType === "gym" && w.businessId === id)?.business.name : gym.data?.name;
  const q = useQuery({ queryKey: ["gym-sold", id, status], queryFn: () => gymDesk.sold(id, status), enabled: !wp.me.isPending });
  const withMoney = perms === null && (q.data?.items ?? []).every((p) => Boolean(p.money));
  // Staff answers carry no money (B3): a missing amount shows a dash.
  const money = (n: number | null | undefined) => (typeof n === "number" ? formatTaka(n, locale) : "–");
  const day = (d: string) => new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

  const columns: Column<Row>[] = [
    {
      id: "pass",
      header: t("sold.pass"),
      primary: true,
      sort: (p) => p.code,
      cell: (p) => (
        <>
          <span className="block font-semibold">{t(`kind.${p.kind}`)}</span>
          <span className="font-mono text-xs font-normal text-muted">{p.code}</span>
        </>
      ),
    },
    { id: "member", header: t("sold.member"), sort: (p) => p.holder, cell: (p) => p.holder ?? "–" },
    { id: "valid", header: t("sold.valid"), sort: (p) => p.validFrom, cell: (p) => <span className="whitespace-nowrap">{p.validFrom === p.validTo ? day(p.validFrom) : `${day(p.validFrom)} – ${day(p.validTo)}`}</span> },
  ];
  const moneyColumns: Column<Row>[] = [
    { id: "price", header: t("sold.price"), align: "end", hideBelow: "lg", sort: (p) => p.money?.price, cell: (p) => money(p.money?.price) },
    { id: "fee", header: t("sold.fee"), align: "end", hideBelow: "lg", sort: (p) => p.money?.fee, cell: (p) => money(p.money?.fee) },
    {
      id: "net",
      header: t("sold.net"),
      align: "end",
      sort: (p) => p.money?.net,
      cell: (p) => (
        <>
          <span className="font-semibold">{money(p.money?.net)}</span>
          <span className="block text-xs text-muted">{p.money?.released ? t("sold.paidOut", { amount: money(p.money?.net) }) : p.money?.refunded ? t("sold.refunded", { amount: money(p.money?.refunded) }) : t("sold.held")}</span>
        </>
      ),
    },
  ];
  const statusColumn: Column<Row>[] = [
    {
      id: "status",
      header: t("sold.status"),
      sort: (p) => p.status,
      cell: (p) => (
        <StatusBadge status={p.status} domain="pass">
          {t(`passStatus.${p.status}`)}
        </StatusBadge>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-[1200px] px-5 py-8">
      <PageTitle
        back={
          <Link href={perms ? "/vendor" : `/vendor/gyms/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-text hover:underline">
            <ArrowLeft size={16} aria-hidden />
            {gymName ?? t("title")}
          </Link>
        }
        title={t("sold.title")}
        description={withMoney ? t("sold.lead") : t("sold.leadStaff")}
      />
      <div className="mt-6 flex flex-col gap-4">
        <DeskAccessNotice error={q.error} />
        <FilterBar
          chips={{
            value: values.status,
            onChange: (v) => set({ status: v }),
            label: t("sold.status"),
            options: [{ value: "", label: t("sold.all") }, ...STATUSES.map((s) => ({ value: s, label: t(`passStatus.${s}`) }))],
          }}
        />
        <DataTable
          label={t("sold.title")}
          testId="gym-sold"
          columns={[...columns, ...(withMoney ? moneyColumns : []), ...statusColumn]}
          rows={deskAccessKey(problemOf(q.error)?.code) ? [] : q.data?.items}
          rowId={(p) => p.id}
          loading={q.isPending}
          error={q.error}
          onRetry={() => void q.refetch()}
          empty={{ title: t("sold.empty") }}
        />
      </div>
    </section>
  );
}

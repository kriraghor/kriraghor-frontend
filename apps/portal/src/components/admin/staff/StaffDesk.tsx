"use client";

import { Suspense, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { UserPlus } from "@phosphor-icons/react";
import { Badge, Button, DataTable, DetailLayout, FilterBar, Notice, PageTitle, Skeleton, type Column } from "@kriraghor/ui/kit";
import { PERMISSIONS, STAFF_STATUSES, activeMasters, grantableSet, staffAdmin, staffStatusTone, type StaffRow } from "@/lib/admin/staff";
import { useUrlFilters } from "@/lib/use-url-filters";
import { useAdminMe } from "../useAdminMe";
import { InviteDialog } from "./InviteDialog";
import { StaffPanel } from "./StaffPanel";

/**
 * /admin/staff (M01-FR-16..FR-18, masters only): every staff member with their team, two-factor
 * and permissions; a member's permission checklist saved in one change with a reason; invite,
 * offboard, reset two-factor and promote to master, each confirmed with an authenticator code.
 */
export function StaffDesk() {
  // Filters and the open staff member live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("staffDesk");
  const qc = useQueryClient();
  const { ready, me } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({ q: { default: "" }, status: { default: "", allowed: ["", ...STAFF_STATUSES] } });
  const open = params.get("id");
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const master = Boolean(me?.isMaster);
  const list = useQuery({ queryKey: ["admin-staff"], enabled: ready && master, queryFn: () => staffAdmin.list() });
  const all = list.data?.data;
  const grantable = grantableSet(list.data);
  const masters = activeMasters(all ?? []);
  const needle = values.q.trim().toLowerCase();
  // The staff list is small and complete, so name, employee id and team filter here, without an audited search.
  const rows = all?.filter((r) => (!values.status || r.status === values.status) && (!needle || [r.displayName, r.employeeId, r.team ?? ""].some((s) => s.toLowerCase().includes(needle))));
  const openRow = all?.find((r) => r.userId === open) ?? null;
  const select = (id: string | null) => set({ id });
  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["admin-staff"] });
    if (open) await qc.invalidateQueries({ queryKey: ["entity-history", "user", open] });
  };

  const columns: Column<StaffRow>[] = [
    {
      id: "name",
      header: t("col.name"),
      primary: true,
      sort: (r) => r.displayName,
      cell: (r) => (
        <>
          <span className="font-semibold">{r.displayName}</span>
          {r.isMaster ? (
            <Badge tone="prize" className="ml-2">
              {t("master")}
            </Badge>
          ) : null}
          <span className="block font-mono text-xs text-muted">{r.phone ?? r.email ?? ""}</span>
        </>
      ),
    },
    { id: "employeeId", header: t("col.employeeId"), sort: (r) => r.employeeId, cell: (r) => <span className="font-mono">{r.employeeId}</span> },
    { id: "team", header: t("col.team"), hideBelow: "lg", sort: (r) => r.team, cell: (r) => r.team ?? t("noTeam") },
    { id: "status", header: t("col.status"), sort: (r) => r.status, cell: (r) => <Badge tone={staffStatusTone(r.status)}>{t(`status.${r.status}`)}</Badge> },
    { id: "twoFactor", header: t("col.twoFactor"), sort: (r) => (r.twoFactorEnabled ? 1 : 0), cell: (r) => <Badge tone={r.twoFactorEnabled ? "brand" : "warning"}>{r.twoFactorEnabled ? t("on") : t("off")}</Badge> },
    {
      id: "permissions",
      header: t("col.permissions"),
      align: "end",
      sort: (r) => r.permissions.length,
      cell: (r) => (r.isMaster ? t("allPermissions") : t("permissionCount", { n: r.permissions.length, total: PERMISSIONS.length })),
    },
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !master ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <DetailLayout
          className="mt-6"
          open={Boolean(open)}
          onClose={() => select(null)}
          title={openRow?.displayName ?? t("member")}
          pane={
            open ? (
              openRow ? (
                <StaffPanel key={openRow.userId} row={openRow} grantable={grantable} viewerId={me?.id ?? null} masters={masters} onChanged={refresh} />
              ) : list.isPending ? (
                <Skeleton className="h-64" />
              ) : (
                <Notice tone="info">{t("notFound")}</Notice>
              )
            ) : null
          }
          width={460}
          testId="staff-pane"
        >
          <div className="flex flex-col gap-4">
            {msg ? (
              <Notice tone="success">
                {msg}
              </Notice>
            ) : null}
            <FilterBar
              search={{ value: values.q, onChange: (v) => set({ q: v }), label: t("search"), placeholder: t("searchPlaceholder"), testId: "staff-search" }}
              selects={[
                {
                  id: "status",
                  label: t("statusFilter"),
                  value: values.status,
                  onChange: (v) => set({ status: v }),
                  anyLabel: t("allStatuses"),
                  options: STAFF_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
                },
              ]}
              onClear={clear}
              actions={
                master ? (
                  <Button
                    type="button"
                    icon={<UserPlus size={18} aria-hidden />}
                    onClick={() => {
                      setMsg(null);
                      setInviting(true);
                    }}
                    data-testid="staff-invite-open"
                  >
                    {t("invite.open")}
                  </Button>
                ) : null
              }
            />
            <DataTable
              label={t("title")}
              testId="admin-staff"
              columns={columns}
              rows={rows}
              rowId={(r) => r.userId}
              loading={list.isPending}
              error={list.error}
              onRetry={() => void list.refetch()}
              empty={{ title: t("empty") }}
              onRowClick={(r) => select(r.userId)}
              selectedId={open}
              complete
            />
          </div>
        </DetailLayout>
      )}
      {inviting ? (
        <InviteDialog
          grantable={grantable}
          onClose={() => setInviting(false)}
          onDone={async (message, userId) => {
            setInviting(false);
            setMsg(message);
            await refresh();
            select(userId);
          }}
        />
      ) : null}
    </div>
  );
}

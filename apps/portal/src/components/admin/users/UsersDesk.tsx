"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, DataTable, DetailLayout, FilterBar, Notice, PageTitle, Skeleton, type Column } from "@kriraghor/ui/kit";
import { ROLES, SEARCH_MIN, USER_STATUSES, roleStatusTone, searchQuery, userStatusTone, usersAdmin, type AdminUser } from "@/lib/admin/users";
import { useCursorList } from "@/lib/use-cursor-list";
import { useUrlFilters } from "@/lib/use-url-filters";
import { formatDhaka, useAdminMe } from "../useAdminMe";
import { UserPanel } from "./UserPanel";

/**
 * /admin/users (M01-FR-19..FR-22): search members by name, email or phone (2+ characters; each
 * search is audited), filter by account status and role, and open one account beside the list to
 * suspend, restore, sign out everywhere, fix gender, change a role's status or (masters) ban.
 */
export function UsersDesk() {
  // Filters and the open account live in the URL (useSearchParams), so the desk renders inside Suspense.
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-40 max-w-[1320px]" />}>
      <Desk />
    </Suspense>
  );
}

function Desk() {
  const t = useTranslations("usersDesk");
  const locale = useLocale();
  const { ready, me } = useAdminMe();
  const { values, set, clear, params } = useUrlFilters({
    q: { default: "" },
    status: { default: "", allowed: ["", ...USER_STATUSES] },
    role: { default: "", allowed: ["", ...ROLES] },
  });
  const { status, role } = values;
  const q = searchQuery(values.q);
  const tooShort = Boolean(values.q.trim()) && !q;
  const open = params.get("id");
  const allowed = Boolean(me && (me.isMaster || me.permissions.includes("manage_users")));
  const list = useCursorList<AdminUser>(["admin-users", q ?? "", status, role], (cursor) => usersAdmin.list({ q, status, role, cursor }), { enabled: ready && allowed });
  const select = (id: string | null) => set({ id });
  const viewer = me ? { id: me.id, isMaster: me.isMaster } : null;

  const columns: Column<AdminUser>[] = [
    {
      id: "name",
      header: t("col.name"),
      primary: true,
      sort: (u) => u.displayName,
      cell: (u) => (
        <>
          <span className="font-semibold">{u.displayName}</span>
          {u.username ? <span className="block text-xs text-muted">@{u.username}</span> : null}
        </>
      ),
    },
    {
      id: "contact",
      header: t("col.contact"),
      cell: (u) => (
        <>
          <span className="block font-mono text-xs">{u.phone ?? t("none")}</span>
          <span className="block break-all text-xs text-muted">{u.email ?? ""}</span>
        </>
      ),
    },
    {
      id: "roles",
      header: t("col.roles"),
      hideBelow: "lg",
      cell: (u) => (
        <span className="flex flex-wrap gap-1">
          {u.roles.map((r) => (
            <Badge key={r.role} tone={roleStatusTone(r.status)}>
              {t(`role.${r.role}`)}
            </Badge>
          ))}
        </span>
      ),
    },
    { id: "status", header: t("col.status"), sort: (u) => u.status, cell: (u) => <Badge tone={userStatusTone(u.status)}>{t(`status.${u.status}`)}</Badge> },
    { id: "kyc", header: t("col.kyc"), sort: (u) => u.kycStatus, cell: (u) => (t.has(`kyc.${u.kycStatus}`) ? t(`kyc.${u.kycStatus}`) : u.kycStatus) },
    {
      id: "lastLogin",
      header: t("col.lastLogin"),
      hideBelow: "xl",
      sort: (u) => u.lastLoginAt,
      cell: (u) => <span className="whitespace-nowrap">{u.lastLoginAt ? formatDhaka(u.lastLoginAt, locale) : t("never")}</span>,
    },
  ];

  const openRow = list.rows?.find((r) => r.id === open);

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
      <PageTitle title={t("title")} description={t("intro")} />
      {ready && !allowed ? (
        <Notice tone="error" className="mt-6 max-w-3xl">
          {t("noAccess")}
        </Notice>
      ) : (
        <DetailLayout className="mt-6" open={Boolean(open)} onClose={() => select(null)} title={openRow?.displayName ?? t("account")} pane={open ? <UserPanel key={open} id={open} viewer={viewer} /> : null} width={440} testId="user-pane">
          <div className="flex flex-col gap-4">
            <FilterBar
              search={{ value: values.q, onChange: (v) => set({ q: v }), label: t("search"), placeholder: t("searchPlaceholder"), testId: "user-search" }}
              selects={[
                {
                  id: "status",
                  label: t("statusFilter"),
                  value: status,
                  onChange: (v) => set({ status: v }),
                  anyLabel: t("allStatuses"),
                  options: USER_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) })),
                },
                {
                  id: "role",
                  label: t("roleFilter"),
                  value: role,
                  onChange: (v) => set({ role: v }),
                  anyLabel: t("allRoles"),
                  options: ROLES.map((r) => ({ value: r, label: t(`role.${r}`) })),
                },
              ]}
              onClear={clear}
            />
            {tooShort ? (
              <p className="text-sm text-muted" role="status" data-testid="search-too-short">
                {t("searchMin", { n: SEARCH_MIN })}
              </p>
            ) : null}
            <DataTable
              label={t("title")}
              testId="admin-users"
              columns={columns}
              rows={list.rows}
              rowId={(r) => r.id}
              loading={list.loading}
              error={list.error}
              onRetry={list.retry}
              empty={{ title: q ? t("emptySearch") : t("empty") }}
              hasMore={list.hasMore}
              onMore={list.more}
              busy={list.busy}
              onRowClick={(r) => select(r.id)}
              selectedId={open}
            />
          </div>
        </DetailLayout>
      )}
    </div>
  );
}

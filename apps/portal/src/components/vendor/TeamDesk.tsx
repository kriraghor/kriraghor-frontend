"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Barbell, PencilSimple, SoccerBall, Storefront, UserMinus, UserPlus, UsersThree } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import { useAuth } from "@kriraghor/ui/auth";
import { Badge, Button, ButtonLink, Checkbox, Chip, DataTable, Dialog, EmptyState, ErrorState, Notice, PageTitle, PhoneField, Select, Skeleton, useConfirm, useToast, type Column } from "@kriraghor/ui/kit";
import {
  addableBusinesses,
  businessKey,
  defaultPermissions,
  GYM_PRESET_KEYS,
  isGymCatalogue,
  lockedPermissions,
  matchingPreset,
  membersPerBusiness,
  presetPermissions,
  samePermissions,
  staffErrorKey,
  team,
  teamPhone,
  togglePermission,
  type BusinessType,
  type CatalogueEntry,
  type TeamBusiness,
  type TeamMember,
} from "@/lib/vendor/team";
import { cn } from "@kriraghor/ui/cn";
import { MePanel } from "../MePanel";

const ICON: Record<BusinessType, typeof SoccerBall> = { venue: SoccerBall, gym: Barbell, shop: Storefront };

/** The words for a team API answer (MEMBER_NOT_FOUND, TEAM_FULL, …) in the page's language. */
function useTeamError() {
  const t = useTranslations("team");
  return (err: unknown, max?: number) => {
    if (!err) return null;
    const p = problemOf(err);
    return t(`errors.${staffErrorKey(p?.code)}`, { max: max ?? 0 });
  };
}

/**
 * /vendor/team (Round B3, Q69, Q169, Q170): the owner's staff at their venues, gyms and shops. Each
 * member is added by the verified phone number of their Kriraghor account, works at one business and
 * does only what the owner ticks (defaults on, optional ones off; an action brings the list it needs).
 * The list shows the last four digits of a phone, never the whole number. Removing someone takes
 * their access away on their next request.
 */
export function TeamDesk() {
  const t = useTranslations("team");
  const locale = useLocale();
  const { status } = useAuth();
  const q = useQuery({ queryKey: ["my-team"], enabled: status === "signed_in", queryFn: () => team.list(), retry: false });
  const [filter, setFilter] = useState<string>("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  if (status === "signed_out") return <MePanel signInHref="/vendor/sign-in" />;
  if (q.isPending) return <Skeleton className="mx-auto mt-10 h-64 max-w-[1200px] rounded-card" />;
  if (q.isError || !q.data) {
    const code = problemOf(q.error)?.code;
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        {code === "ROLE_REQUIRED" || code === "ROLE_SUSPENDED" ? <Notice tone="error">{t(`errors.${code}`)}</Notice> : <ErrorState onRetry={() => void q.refetch()} />}
      </section>
    );
  }

  const data = q.data;
  const max = data.maxMembers;
  const businesses = data.businesses.filter((b) => b.status !== "removed");
  const counts = membersPerBusiness(data.items);
  const addable = addableBusinesses(businesses, counts, max);
  const shown = filter ? data.items.filter((m) => businessKey(m.businessType, m.businessId) === filter) : data.items;
  const date = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
  const catalogueOf = (type: BusinessType): CatalogueEntry[] => data.permissionCatalogue[type] ?? [];
  const nameOf = (m: TeamMember) => m.business?.name ?? businesses.find((b) => b.id === m.businessId)?.name ?? "–";

  const columns: Column<TeamMember>[] = [
    {
      id: "member",
      header: t("col.member"),
      primary: true,
      sort: (m) => m.member.displayName ?? "",
      cell: (m) => (
        <>
          <span className="block font-semibold">{m.member.displayName ?? t("member")}</span>
          <span className="block font-mono text-xs font-normal text-muted">{m.member.phoneLast4 ? `••••${m.member.phoneLast4}` : "–"}</span>
        </>
      ),
    },
    {
      id: "business",
      header: t("col.business"),
      sort: (m) => nameOf(m),
      cell: (m) => (
        <>
          <span className="block">{nameOf(m)}</span>
          <span className="block text-xs text-muted">{t(`type.${m.businessType}`)}</span>
        </>
      ),
    },
    {
      id: "permissions",
      header: t("col.permissions"),
      cell: (m) => <PermissionSummary type={m.businessType} permissions={m.permissions} total={catalogueOf(m.businessType).length} />,
    },
    { id: "added", header: t("col.added"), hideBelow: "lg", sort: (m) => m.addedAt, cell: (m) => <span className="whitespace-nowrap">{date.format(new Date(m.addedAt))}</span> },
    {
      id: "actions",
      header: <span className="sr-only">{t("col.actions")}</span>,
      label: t("col.actions"),
      align: "end",
      cell: (m) => (
        <span className="inline-flex flex-wrap justify-end gap-1">
          <Button type="button" variant="secondary" icon={<PencilSimple size={16} aria-hidden />} onClick={() => setEditing(m)} data-testid="team-edit">
            {t("edit")}
          </Button>
          <Button type="button" variant="ghost" className="text-danger" icon={<UserMinus size={16} aria-hidden />} onClick={() => setRemoving(m)} data-testid="team-remove">
            {t("remove")}
          </Button>
        </span>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-[1200px] px-5 pb-16 pt-8" data-testid="team-desk">
      <PageTitle
        title={t("title")}
        description={t("lead")}
        actions={
          businesses.length ? (
            <Button type="button" icon={<UserPlus size={18} aria-hidden />} onClick={() => setAdding(true)} disabled={!addable.length} data-testid="team-add">
              {t("add")}
            </Button>
          ) : null
        }
      />
      {!businesses.length ? (
        <EmptyState
          className="mt-8"
          icon={<UsersThree aria-hidden />}
          title={t("noBusiness")}
          body={t("noBusinessBody")}
          action={
            <ButtonLink href="/vendor" variant="secondary">
              {t("toHome")}
            </ButtonLink>
          }
        />
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="team-caps">
            {businesses.map((b) => {
              const Icon = ICON[b.businessType];
              const n = counts.get(businessKey(b.businessType, b.id)) ?? 0;
              return (
                <li key={businessKey(b.businessType, b.id)} className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-soft text-brand-text">
                    <Icon size={20} weight="fill" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{b.name ?? t(`type.${b.businessType}`)}</span>
                    <span className="block text-sm text-muted">{t("cap", { n, max })}</span>
                  </span>
                  {n >= max ? <Badge tone="warning">{t("full")}</Badge> : null}
                </li>
              );
            })}
          </ul>
          {businesses.length > 1 ? (
            <div role="group" aria-label={t("filter")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              <Chip active={!filter} count={data.items.length || undefined} onClick={() => setFilter("")} className="min-h-11 shrink-0" data-testid="team-filter-all">
                {t("all")}
              </Chip>
              {businesses.map((b) => {
                const k = businessKey(b.businessType, b.id);
                return (
                  <Chip key={k} active={filter === k} count={counts.get(k) || undefined} onClick={() => setFilter(k)} className="min-h-11 shrink-0">
                    {b.name ?? t(`type.${b.businessType}`)}
                  </Chip>
                );
              })}
            </div>
          ) : null}
          <DataTable
            label={t("title")}
            testId="team-table"
            columns={columns}
            rows={shown}
            rowId={(m) => m.id}
            rowTestId="team-row"
            empty={{
              icon: <UsersThree aria-hidden />,
              title: t("empty"),
              body: t("emptyBody"),
              action: addable.length ? (
                <Button type="button" icon={<UserPlus size={18} aria-hidden />} onClick={() => setAdding(true)}>
                  {t("add")}
                </Button>
              ) : undefined,
            }}
          />
          <p className="text-sm text-muted">{t("note")}</p>
        </div>
      )}
      {adding ? <AddStaff businesses={addable} catalogueOf={catalogueOf} max={max} preset={filter} onClose={() => setAdding(false)} /> : null}
      {editing ? <EditStaff member={editing} name={nameOf(editing)} catalogue={catalogueOf(editing.businessType)} onClose={() => setEditing(null)} /> : null}
      {removing ? <RemoveStaff member={removing} name={nameOf(removing)} onClose={() => setRemoving(null)} /> : null}
    </section>
  );
}

/** "6 of 9 · Check in, No-show, …" (the labels in full on wide screens). */
function PermissionSummary({ type, permissions, total }: { type: BusinessType; permissions: string[]; total: number }) {
  const t = useTranslations("team");
  return (
    <span className="block max-w-[34ch]" data-testid="team-permissions" data-type={type}>
      <span className="block font-semibold">{t("permCount", { n: permissions.length, total })}</span>
      <span className="block text-xs text-muted">{permissions.map((p) => (t.has(`perm.${p}`) ? t(`perm.${p}`) : p)).join(", ") || t("none")}</span>
    </span>
  );
}

/**
 * The permission checkboxes of one business type: defaults come pre-ticked by the caller; an action
 * ticks the list it needs, and that list stays ticked (disabled, with why) while an action needs it.
 */
function PermissionPicker({ catalogue, value, onChange, idPrefix }: { catalogue: CatalogueEntry[]; value: string[]; onChange: (v: string[]) => void; idPrefix: string }) {
  const t = useTranslations("team");
  const locked = lockedPermissions(catalogue, value);
  const label = (k: string) => (t.has(`perm.${k}`) ? t(`perm.${k}`) : k);
  return (
    <fieldset className="flex flex-col" data-testid="permission-picker">
      <legend className="text-sm font-semibold">{t("permissions")}</legend>
      <p className="mb-1 text-sm text-muted">{t("permissionsHelp")}</p>
      {isGymCatalogue(catalogue) ? <GymPresets catalogue={catalogue} value={value} onChange={onChange} /> : null}
      {catalogue.map((p) => {
        const id = `${idPrefix}-${p.key.replace(/\W/g, "-")}`;
        const isLocked = locked.has(p.key);
        return (
          <div key={p.key} className="border-t border-line first:border-t-0">
            <Checkbox
              id={id}
              checked={value.includes(p.key)}
              disabled={isLocked}
              onChange={(e) => onChange(togglePermission(catalogue, value, p.key, e.target.checked))}
              data-testid={`perm-${p.key}`}
              label={
                <span className="flex flex-col py-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">
                    {label(p.key)}
                    {!p.default ? <Badge tone="info">{t("optional")}</Badge> : null}
                  </span>
                  <span className="text-sm text-muted">{t.has(`permHelp.${p.key}`) ? t(`permHelp.${p.key}`) : null}</span>
                  {isLocked ? <span className="text-xs text-muted">{t("neededBy")}</span> : p.needs && !value.includes(p.needs) ? <span className="text-xs text-muted">{t("alsoTicks", { what: label(p.needs) })}</span> : null}
                </span>
              }
            />
          </div>
        );
      })}
      <p className="mt-2 text-sm text-muted">{t("neverNote")}</p>
    </fieldset>
  );
}

/** M27: one tap fills the boxes for a usual gym job (receptionist, cashier …); the boxes stay editable. */
function GymPresets({ catalogue, value, onChange }: { catalogue: CatalogueEntry[]; value: string[]; onChange: (v: string[]) => void }) {
  const t = useTranslations("team");
  const current = matchingPreset(catalogue, value);
  return (
    <div className="mb-2 flex flex-col gap-1.5" data-testid="gym-presets">
      <span className="text-sm text-muted">{t("presets.label")}</span>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("presets.label")}>
        {GYM_PRESET_KEYS.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={current === k}
            onClick={() => onChange(presetPermissions(catalogue, k))}
            className={cn(
              "min-h-9 rounded-pill border px-3 text-sm font-semibold transition-colors",
              current === k ? "border-brand bg-brand-soft text-brand-text" : "border-line-strong/60 hover:bg-surface-2",
            )}
            data-testid={`preset-${k}`}
          >
            {t(`presets.${k}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function AddStaff({ businesses, catalogueOf, max, preset, onClose }: { businesses: TeamBusiness[]; catalogueOf: (t: BusinessType) => CatalogueEntry[]; max: number; preset: string; onClose: () => void }) {
  const t = useTranslations("team");
  const qc = useQueryClient();
  const toast = useToast();
  const explain = useTeamError();
  const first = businesses.find((b) => businessKey(b.businessType, b.id) === preset) ?? businesses[0];
  const [business, setBusiness] = useState(first ? businessKey(first.businessType, first.id) : "");
  const picked = businesses.find((b) => businessKey(b.businessType, b.id) === business);
  const [permissions, setPermissions] = useState<string[]>(() => (first ? defaultPermissions(catalogueOf(first.businessType)) : []));
  const [phone, setPhone] = useState("");
  const [tried, setTried] = useState(false);
  const ask = useConfirm();
  const e164 = teamPhone(phone);
  const save = useMutation({
    mutationFn: () => team.add({ businessType: picked!.businessType, businessId: picked!.id, phone: e164!, permissions }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["my-team"] });
      toast.show(t("added", { name: r.member.member.displayName ?? t("member"), business: picked?.name ?? "" }));
      onClose();
    },
  });
  const submit = async () => {
    setTried(true);
    if (!picked || !e164 || !permissions.length) return;
    if (await ask("add")) save.mutate();
  };
  const changeBusiness = (k: string) => {
    setBusiness(k);
    const b = businesses.find((x) => businessKey(x.businessType, x.id) === k);
    if (b) setPermissions(defaultPermissions(catalogueOf(b.businessType)));
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={t("addTitle")}
      description={t("addLead")}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={() => void submit()} busy={save.isPending} data-testid="team-add-confirm">
            {t("addConfirm")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        data-testid="team-add-form"
      >
        <PhoneField
          id="team-phone"
          label={t("phone")}
          hint={t("phoneHint")}
          error={tried && !e164 ? t("phoneInvalid") : undefined}
          value={phone}
          onChange={setPhone}
          onBlur={() => phone && setTried(true)}
          placeholder="01XXXXXXXXX"
          required
          autoFocus
          data-testid="team-phone"
        />
        <Select id="team-business" label={t("business")} value={business} onChange={(e) => changeBusiness(e.target.value)} data-testid="team-business">
          {businesses.map((b) => (
            <option key={businessKey(b.businessType, b.id)} value={businessKey(b.businessType, b.id)}>
              {`${b.name ?? "–"} · ${t(`type.${b.businessType}`)}`}
            </option>
          ))}
        </Select>
        {picked ? <PermissionPicker key={business} catalogue={catalogueOf(picked.businessType)} value={permissions} onChange={setPermissions} idPrefix="add" /> : null}
        {tried && !permissions.length ? <Notice tone="error">{t("pickOne")}</Notice> : null}
        {save.error ? <Notice tone="error">{explain(save.error, max)}</Notice> : null}
      </form>
    </Dialog>
  );
}

function EditStaff({ member, name, catalogue, onClose }: { member: TeamMember; name: string; catalogue: CatalogueEntry[]; onClose: () => void }) {
  const t = useTranslations("team");
  const qc = useQueryClient();
  const toast = useToast();
  const explain = useTeamError();
  const [permissions, setPermissions] = useState<string[]>(member.permissions);
  const unchanged = samePermissions(permissions, member.permissions);
  const save = useMutation({
    mutationFn: () => team.update(member.id, permissions),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-team"] });
      toast.show(t("saved"));
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={t("editTitle", { name: member.member.displayName ?? t("member") })}
      description={t("editLead", { business: name })}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={save.isPending}>
            {t("cancel")}
          </Button>
          <Button type="button" confirm="save" onClick={() => save.mutate()} disabled={unchanged || !permissions.length} busy={save.isPending} data-testid="team-edit-confirm">
            {t("save")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <PermissionPicker catalogue={catalogue} value={permissions} onChange={setPermissions} idPrefix={`edit-${member.id}`} />
        {!permissions.length ? <Notice tone="error">{t("pickOne")}</Notice> : null}
        {save.error ? <Notice tone="error">{explain(save.error)}</Notice> : null}
      </div>
    </Dialog>
  );
}

/** Confirm before removing (like ReasonDialog, without a reason: the API takes none). */
function RemoveStaff({ member, name, onClose }: { member: TeamMember; name: string; onClose: () => void }) {
  const t = useTranslations("team");
  const qc = useQueryClient();
  const toast = useToast();
  const explain = useTeamError();
  const who = member.member.displayName ?? t("member");
  const remove = useMutation({
    mutationFn: () => team.remove(member.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-team"] });
      toast.show(t("removed", { name: who }));
      onClose();
    },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => (!o ? onClose() : undefined)}
      title={t("removeTitle", { name: who })}
      description={t("removeLead", { business: name })}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={remove.isPending}>
            {t("keep")}
          </Button>
          <Button type="button" variant="danger" onClick={() => remove.mutate()} busy={remove.isPending} data-testid="team-remove-confirm">
            {t("removeConfirm")}
          </Button>
        </>
      }
    >
      <div data-testid="team-remove-dialog">{remove.error ? <Notice tone="error">{explain(remove.error)}</Notice> : <p className="text-sm text-muted">{t("removeNote")}</p>}</div>
    </Dialog>
  );
}

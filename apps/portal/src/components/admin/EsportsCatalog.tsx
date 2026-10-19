"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { api, problemOf, type Problem } from "@kriraghor/api-client";
import type { components } from "@kriraghor/api-client/schema";
import { Button, Notice } from "../ui";
import { AdminSubnav } from "./AdminSubnav";
import { useAdminMe } from "./useAdminMe";

type Table = "esports-games" | "esports-modes" | "esports-maps" | "esports-points-presets";
type Game = components["schemas"]["EsportsGame"];
type Item = components["schemas"]["EsportsGame"] | components["schemas"]["EsportsMode"] | components["schemas"]["EsportsMap"] | components["schemas"]["EsportsPointsPreset"];
type FieldDef = { name: string; kind: "text" | "number" | "list" | "select"; options?: string[]; createOnly?: boolean };

const TABLES: Table[] = ["esports-games", "esports-modes", "esports-maps", "esports-points-presets"];
const NAMES: FieldDef[] = [
  { name: "key", kind: "text", createOnly: true },
  { name: "nameEn", kind: "text" },
  { name: "nameBn", kind: "text" },
  { name: "sort", kind: "number" },
];
const FIELDS: Record<Table, FieldDef[]> = {
  "esports-games": [
    ...NAMES,
    { name: "publisher", kind: "text" },
    { name: "platform", kind: "select", options: ["mobile", "pc", "console"] },
    { name: "uidLabelEn", kind: "text" },
    { name: "uidLabelBn", kind: "text" },
    { name: "uidRegex", kind: "text" },
    { name: "ignMaxLen", kind: "number" },
  ],
  "esports-modes": [...NAMES, { name: "teamSize", kind: "number" }, { name: "maxTeams", kind: "number" }, { name: "maxPlayers", kind: "number" }, { name: "maxSubs", kind: "number" }],
  "esports-maps": NAMES,
  "esports-points-presets": [...NAMES, { name: "placementPoints", kind: "list" }, { name: "killPoints", kind: "number" }],
};
const hasGame = (table: Table) => table !== "esports-games";

/** M03 §7.1 esports catalogue desk (manage_esports or manage_catalog). Rows are deactivated, never deleted. */
export function EsportsCatalog() {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const qc = useQueryClient();
  const { ready } = useAdminMe();
  const [table, setTable] = useState<Table>("esports-games");
  const [gameId, setGameId] = useState<string>("");
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);

  const games = useQuery({
    queryKey: ["catalog", "esports-games"],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/catalog/{table}", { params: { path: { table: "esports-games" } } });
      if (error) throw error;
      return data.items as Game[];
    },
  });
  const rows = useQuery({
    queryKey: ["catalog", table, gameId],
    enabled: ready,
    queryFn: async () => {
      const { data, error } = await api("admin").GET("/admin/catalog/{table}", { params: { path: { table }, query: hasGame(table) && gameId ? { gameId } : {} } });
      if (error) throw error;
      return data.items as Item[];
    },
  });
  const gameName = useMemo(() => new Map((games.data ?? []).map((g) => [g.id, locale === "bn" ? g.nameBn : g.nameEn])), [games.data, locale]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["catalog"] });

  async function toggle(item: Item) {
    setNotice(null);
    const path = { table, id: item.id };
    const res = item.isActive
      ? await api("admin").POST("/admin/catalog/{table}/{id}/deactivate", { params: { path } })
      : await api("admin").POST("/admin/catalog/{table}/{id}/reactivate", { params: { path } });
    if (res.error) setNotice({ tone: "error", text: problemOf(res.error)?.title ?? "Error" });
    await refresh();
  }

  if (!ready) {
    return (
      <p className="px-5 py-12 text-muted" role="status">
        …
      </p>
    );
  }

  return (
    <>
      <AdminSubnav />
      <div className="mx-auto max-w-[1320px] px-5 pb-16 pt-8">
        <h1 className="text-3xl font-extrabold">{t("title")}</h1>
        <p className="mt-2 max-w-3xl text-muted">{t("intro")}</p>

        <div role="tablist" aria-label={t("title")} className="mt-6 flex flex-wrap gap-1 border-b-2 border-line">
          {TABLES.map((tb) => (
            <button
              key={tb}
              role="tab"
              type="button"
              aria-selected={table === tb}
              onClick={() => {
                setTable(tb);
                setEditing(null);
              }}
              className={`min-h-11 border-b-4 px-4 text-sm font-bold ${table === tb ? "border-brand text-ink" : "border-transparent text-muted"}`}
            >
              {t(`tabs.${tb}`)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          {hasGame(table) ? (
            <label className="flex flex-col text-sm font-semibold text-muted">
              {t("game")}
              <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="min-h-11 border-2 border-line bg-surface px-3 text-ink">
                <option value="">{t("allGames")}</option>
                {(games.data ?? []).map((g) => (
                  <option key={g.id} value={g.id}>
                    {gameName.get(g.id)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="ml-auto">
            <Button type="button" onClick={() => setEditing("new")}>
              {t("add")}
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="mt-4 max-w-3xl">
            <Notice tone={notice.tone}>{notice.text}</Notice>
          </div>
        ) : null}

        <div role="tabpanel" className="mt-4 overflow-x-auto border-2 border-line bg-surface">
          {rows.isPending ? (
            <p className="p-5 text-muted" role="status">
              …
            </p>
          ) : !rows.data?.length ? (
            <p className="p-5 text-muted">{t("empty")}</p>
          ) : (
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b-2 border-line">
                <tr>
                  <th scope="col" className="px-4 py-2">{t("key")}</th>
                  <th scope="col" className="px-4 py-2">{t("nameEn")}</th>
                  {hasGame(table) ? <th scope="col" className="px-4 py-2">{t("game")}</th> : null}
                  <th scope="col" className="px-4 py-2">{summaryHeader(table, t)}</th>
                  <th scope="col" className="px-4 py-2"><span className="sr-only">Status and actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.data.map((item) => (
                  <tr key={item.id} className={item.isActive ? "" : "text-muted"}>
                    <td className="px-4 py-2 font-mono">{item.key}</td>
                    <td className="px-4 py-2">
                      {locale === "bn" ? item.nameBn : item.nameEn}
                      {"version" in item ? (
                        <span className="ml-2 text-xs text-muted">
                          v{item.version}
                          {item.isLatest ? ` · ${t("latest")}` : ""}
                        </span>
                      ) : null}
                    </td>
                    {hasGame(table) ? <td className="px-4 py-2">{"gameId" in item ? gameName.get(item.gameId) : ""}</td> : null}
                    <td className="px-4 py-2">{summary(item)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.isActive ? "bg-brand-soft text-brand-text" : "bg-surface-2 text-muted"}`}>{item.isActive ? t("active") : t("inactive")}</span>
                        {!("isLatest" in item) || item.isLatest ? (
                          <button type="button" className="min-h-11 border-2 border-line px-3 text-xs font-semibold" onClick={() => setEditing(item)}>
                            {t("edit")}
                          </button>
                        ) : null}
                        <button type="button" className="min-h-11 border-2 border-line px-3 text-xs font-semibold" onClick={() => void toggle(item)}>
                          {item.isActive ? t("deactivate") : t("reactivate")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing ? (
        <EditDrawer
          table={table}
          item={editing === "new" ? null : editing}
          games={games.data ?? []}
          defaultGameId={gameId}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setNotice({ tone: "info", text: t("saved") });
            await refresh();
          }}
        />
      ) : null}
    </>
  );
}

function summaryHeader(table: Table, t: ReturnType<typeof useTranslations<"catalog">>) {
  if (table === "esports-games") return t("uidRegex");
  if (table === "esports-modes") return `${t("teamSize")} × ${t("maxTeams")} / ${t("maxPlayers")}`;
  if (table === "esports-points-presets") return t("placementPoints");
  return t("sort");
}

function summary(item: Item): string {
  if ("uidRegex" in item) return item.uidRegex;
  if ("teamSize" in item) return `${item.teamSize} × ${item.maxTeams} / ${item.maxPlayers}`;
  if ("placementPoints" in item) return `${item.placementPoints.join(", ")} · +${item.killPoints}/kill`;
  return String(item.sort);
}

function EditDrawer({
  table,
  item,
  games,
  defaultGameId,
  onClose,
  onSaved,
}: {
  table: Table;
  item: Item | null;
  games: Game[];
  defaultGameId: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const fields = FIELDS[table];
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = { gameId: item && "gameId" in item ? item.gameId : defaultGameId || games[0]?.id || "" };
    for (const f of fields) {
      const cur = item ? (item as Record<string, unknown>)[f.name] : undefined;
      v[f.name] = cur === undefined || cur === null ? (f.name === "platform" ? "mobile" : "") : Array.isArray(cur) ? cur.join(", ") : String(cur);
    }
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function body() {
    const out: Record<string, unknown> = {};
    for (const f of fields) {
      if (item && f.createOnly) continue;
      const raw = values[f.name].trim();
      if (raw === "") continue;
      out[f.name] = f.kind === "number" ? Number(raw) : f.kind === "list" ? raw.split(",").map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)) : raw;
    }
    if (!item && hasGame(table)) out.gameId = values.gameId;
    return out;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = item
        ? await api("admin").PATCH("/admin/catalog/{table}/{id}", { params: { path: { table, id: item.id } }, body: body() as never })
        : await api("admin").POST("/admin/catalog/{table}", { params: { path: { table } }, body: body() as never });
      if (res.error) throw problemOf(res.error);
      await onSaved();
    } catch (err) {
      setProblem(problemOf(err) ?? { code: "UNKNOWN", title: "Could not save", status: 0 });
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (name: string) => problem?.errors?.find((x) => x.field === name)?.message;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form role="dialog" aria-modal="true" aria-labelledby="edit-title" onSubmit={save} className="h-full w-full max-w-md overflow-y-auto border-l-2 border-line-strong bg-surface p-6">
        <h2 id="edit-title" className="text-lg font-extrabold">
          {item ? `${t("edit")}: ${item.key}` : `${t("add")}: ${t(`tabs.${table}`)}`}
        </h2>
        {item && "version" in item ? <p className="mt-2 text-sm text-muted">{t("newVersionNote", { version: item.version + 1 })}</p> : null}
        <div className="mt-4 grid gap-4">
          {!item && hasGame(table) ? (
            <label className="flex flex-col text-sm font-semibold text-muted">
              {t("game")}
              <select value={values.gameId} onChange={(e) => setValues((v) => ({ ...v, gameId: e.target.value }))} className="min-h-11 border-2 border-line bg-surface px-3 text-ink">
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {locale === "bn" ? g.nameBn : g.nameEn}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {fields.map((f, i) => {
            const id = `cat-${f.name}`;
            const err = fieldError(f.name);
            const disabled = Boolean(item && f.createOnly);
            return (
              <div key={f.name} className="flex flex-col gap-1">
                <label htmlFor={id} className="text-sm font-semibold text-muted">
                  {t(f.name)}
                </label>
                {f.kind === "select" ? (
                  <select id={id} value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="min-h-11 border-2 border-line bg-surface px-3 text-ink">
                    {(f.options ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    ref={i === 0 ? firstRef : undefined}
                    value={values[f.name]}
                    disabled={disabled}
                    inputMode={f.kind === "number" ? "numeric" : undefined}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `${id}-error` : f.name === "key" ? `${id}-hint` : undefined}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    className={`min-h-11 border-2 bg-surface px-3 text-ink disabled:bg-surface-2 ${err ? "border-danger" : "border-line"} ${f.name === "key" || f.name === "uidRegex" ? "font-mono" : ""}`}
                  />
                )}
                {f.name === "key" ? (
                  <p id={`${id}-hint`} className="text-xs text-muted">
                    {t("keyHint")}
                  </p>
                ) : null}
                {err ? (
                  <p id={`${id}-error`} role="alert" className="text-sm text-danger">
                    {err}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {problem && !problem.errors?.length ? (
          <div className="mt-4">
            <Notice tone="error">
              {problem.title}
              {problem.detail ? `: ${problem.detail}` : ""}
            </Notice>
          </div>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="min-h-12 border-2 border-line px-4 font-semibold" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <Button type="submit" busy={busy}>
            {t("save")}
          </Button>
        </div>
      </form>
    </div>
  );
}

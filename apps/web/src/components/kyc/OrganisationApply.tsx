"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, problemOf } from "@kriraghor/api-client";
import { publicEnv } from "@kriraghor/session/env";
import { Badge, Button, ButtonLink, Field, Notice, Skeleton, Textarea, type Tone } from "@kriraghor/ui/kit";

const ok = async <T,>(res: { data?: T; error?: unknown }): Promise<T> => {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
};
const orgs = {
  mine: async () => ok(await api().GET("/me/organisations")),
  // Esports is organised by Kriraghor only (21 Oct 2026): the API refuses kind "esports" (403 ORG_KIND_CLOSED).
  create: async (body: { name: string; about?: string | null; contactEmail?: string | null }) => ok(await api().POST("/me/organisations", { body: { ...body, kind: "sports" } })),
  submit: async (id: string) => ok(await api().POST("/me/organisations/{id}/submit", { params: { path: { id } } })),
};
const TONE: Record<string, Tone> = { verified: "brand", pending_review: "info", changes_requested: "warning", rejected: "danger", suspended: "danger", draft: "neutral" };
const SENDABLE = ["draft", "changes_requested", "rejected"];

/**
 * M14 lite on /account/business?as=organiser: once the organiser role is applied for, the owner
 * registers the club, league or venue they run sports events for and sends it for review (M05 kind
 * organisation). Esports events are run by Kriraghor only, so new organisations are always "sports";
 * an older esports organisation is still listed, without actions. Verified organisations open their
 * events console on vendor.kriraghor.com.
 */
export function OrganisationApply({ roleActive }: { roleActive: boolean }) {
  const t = useTranslations("business.org");
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["my-organisations"], queryFn: () => orgs.mine() });
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [email, setEmail] = useState("");
  const done = () => qc.invalidateQueries({ queryKey: ["my-organisations"] });
  const create = useMutation({ mutationFn: () => orgs.create({ name: name.trim(), about: about.trim() || null, contactEmail: email.trim() || null }), onSuccess: done });
  const submit = useMutation({ mutationFn: (id: string) => orgs.submit(id), onSuccess: done });
  const problem = problemOf(create.error ?? submit.error);
  const consoleUrl = `${publicEnv().VENDOR_URL}/vendor/events`;
  if (q.isPending) return <Skeleton className="mt-6 h-24 rounded-card" />;
  const mine = (q.data?.items ?? []).filter((o) => o.role === "owner");
  const canCreate = !mine.some((o) => o.kind === "sports");

  return (
    <div className="mt-8 border-t border-line pt-6" data-testid="org-apply">
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("lead")}</p>
      {mine.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {mine.map((o) => {
            const esports = o.kind === "esports";
            return (
              <li key={o.id} className="rounded-card border border-line p-4" data-testid="my-organisation">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 text-lg font-semibold">
                    {o.name} <span className="text-sm font-normal text-muted">· {t(`kind.${o.kind}`)}</span>
                  </span>
                  <span data-testid="org-status">
                    <Badge tone={TONE[o.status] ?? "neutral"}>{t(`status.${o.status}`)}</Badge>
                  </span>
                </div>
                {o.reviewReason ? <p className="mt-2 text-sm text-danger">{o.reviewReason.text ?? o.reviewReason.code}</p> : null}
                {esports ? (
                  <p className="mt-2 text-sm text-muted">{t("esportsClosed")}</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {SENDABLE.includes(o.status) ? (
                      <Button type="button" busy={submit.isPending} disabled={!roleActive} onClick={() => submit.mutate(o.id)} data-testid="org-submit">
                        {t("submit")}
                      </Button>
                    ) : null}
                    {o.status === "verified" ? (
                      <ButtonLink href={consoleUrl} data-testid="open-console">
                        {t("openConsole")}
                      </ButtonLink>
                    ) : null}
                  </div>
                )}
                {!esports && !roleActive && SENDABLE.includes(o.status) ? <p className="mt-2 text-sm text-muted">{t("waitDocs")}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {canCreate ? (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          data-testid="org-form"
        >
          <Field id="org-name" label={t("name")} value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={120} />
          <Textarea id="org-about" label={t("about")} value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1000} rows={3} />
          <Field id="org-email" type="email" label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} autoComplete="email" />
          <div>
            <Button type="submit" busy={create.isPending} data-testid="org-create">
              {t("create")}
            </Button>
          </div>
        </form>
      ) : null}
      {problem ? (
        <div className="mt-3">
          <Notice tone="error">{problem.code === "ORG_KIND_CLOSED" ? t("esportsClosed") : problem.title}</Notice>
        </div>
      ) : null}
    </div>
  );
}

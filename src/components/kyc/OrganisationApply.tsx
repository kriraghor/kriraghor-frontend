"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api, problemOf } from "@/lib/api/client";
import { publicEnv } from "@/lib/env";
import { Button, Field, Notice } from "../ui";

const ok = async <T,>(res: { data?: T; error?: unknown }): Promise<T> => {
  if (res.error || res.data === undefined) throw res.error;
  return res.data;
};
const orgs = {
  mine: async () => ok(await api().GET("/me/organisations")),
  create: async (body: { name: string; about?: string | null; contactEmail?: string | null }) => ok(await api().POST("/me/organisations", { body })),
  submit: async (id: string) => ok(await api().POST("/me/organisations/{id}/submit", { params: { path: { id } } })),
};
const TONE: Record<string, string> = { verified: "border-brand text-brand", pending_review: "border-amber-500", changes_requested: "border-danger text-danger", rejected: "border-danger text-danger", suspended: "border-danger text-danger", draft: "border-line text-muted" };

/**
 * M14 lite on /account/business?as=organiser: once the organiser role is applied for, the owner
 * registers the organisation and sends it for review (M05 kind organisation). Verified organisations
 * open the organiser console on vendor.kriraghor.com.
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
  const vendor = `${publicEnv().VENDOR_URL}/vendor/esports`;
  if (q.isPending) return <div className="mt-6 h-24 animate-pulse bg-surface-2" />;
  const mine = (q.data?.items ?? []).filter((o) => o.role === "owner");

  return (
    <div className="mt-8 border-t-2 border-line pt-6" data-testid="org-apply">
      <h2 className="text-xl font-extrabold">{t("title")}</h2>
      <p className="mt-1 text-sm text-muted">{t("lead")}</p>
      {mine.length ? (
        <ul className="mt-4 flex flex-col gap-3">
          {mine.map((o) => (
            <li key={o.id} className="border-2 border-line p-4" data-testid="my-organisation">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1 text-lg font-extrabold">{o.name}</span>
                <span className={`border-2 px-2 py-0.5 text-sm font-bold ${TONE[o.status] ?? TONE.draft}`} data-testid="org-status">
                  {t(`status.${o.status}`)}
                </span>
              </div>
              {o.reviewReason ? <p className="mt-2 text-sm text-danger">{o.reviewReason.text ?? o.reviewReason.code}</p> : null}
              <div className="mt-3 flex flex-wrap gap-3">
                {["draft", "changes_requested", "rejected"].includes(o.status) ? (
                  <Button type="button" busy={submit.isPending} disabled={!roleActive} onClick={() => submit.mutate(o.id)} data-testid="org-submit">
                    {t("submit")}
                  </Button>
                ) : null}
                {o.status === "verified" ? (
                  <a href={vendor} className="inline-flex min-h-12 items-center bg-brand px-5 font-bold text-white hover:bg-brand-hover" data-testid="open-console">
                    {t("openConsole")}
                  </a>
                ) : null}
              </div>
              {!roleActive && ["draft", "changes_requested", "rejected"].includes(o.status) ? <p className="mt-2 text-sm text-muted">{t("waitDocs")}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          data-testid="org-form"
        >
          <Field id="org-name" label={t("name")} value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={120} />
          <div className="flex flex-col gap-1">
            <label htmlFor="org-about" className="text-sm font-semibold text-muted">
              {t("about")}
            </label>
            <textarea id="org-about" value={about} onChange={(e) => setAbout(e.target.value)} maxLength={1000} rows={3} className="border-2 border-line bg-surface p-3" />
          </div>
          <Field id="org-email" type="email" label={t("email")} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={160} autoComplete="email" />
          <Button type="submit" busy={create.isPending} data-testid="org-create">
            {t("create")}
          </Button>
        </form>
      )}
      {problem ? (
        <div className="mt-3">
          <Notice tone="error">{problem.title}</Notice>
        </div>
      ) : null}
    </div>
  );
}

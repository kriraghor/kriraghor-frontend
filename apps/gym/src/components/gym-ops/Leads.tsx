"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ChatCircleText, Phone, WhatsappLogo } from "@phosphor-icons/react";
import { Badge, Button, Dialog, EmptyState, Notice, SegmentedControl, SkeletonList, Textarea, useToast } from "@kriraghor/ui/kit";
import { telUrl, whatsappUrl, gymOps2, type Lead } from "@/lib/gym-ops";
import { GymPage, useFmt, useGymError, type GymCtx } from "../gym-manage/common";
import { MemberPick, type PickedMember } from "./parts";

/**
 * /manage/[gymId]/leads (M27-FR-66 to FR-69; leads.manage; Basic plan): people who asked about the gym from its
 * page. Call or WhatsApp them (the number comes from an audited reveal), mark them contacted or lost with a
 * note, and joined once they are a member.
 */
export function Leads({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="leads" feature="leads" title={t("leads.title")} description={t("leads.lead")} testId="go-leads">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

type View = "new" | "contacted" | "joined" | "lost";
const TONE = { new: "info", contacted: "warning", joined: "brand", lost: "neutral" } as const;

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const [view, setView] = useState<View>("new");
  const [open, setOpen] = useState<Lead | null>(null);
  const q = useQuery({ queryKey: ["go-leads", ctx.gymId, view], queryFn: () => gymOps2.leads(ctx.gymId, view) });
  const counts = q.data?.counts;
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        label={t("leads.title")}
        value={view}
        onChange={setView}
        className="self-start"
        options={(["new", "contacted", "joined", "lost"] as const).map((v) => ({ value: v, label: `${t(`leads.status.${v}`)}${counts ? ` (${f.n(counts[v])})` : ""}` }))}
      />
      {q.isPending ? (
        <SkeletonList rows={3} />
      ) : q.isError ? (
        <Notice tone="error">{err(q.error)}</Notice>
      ) : !q.data.items.length ? (
        <EmptyState icon={<ChatCircleText size={28} aria-hidden />} title={t(`leads.empty.${view}`)} body={view === "new" ? t("leads.emptyHint") : undefined} />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2" data-testid="lead-list">
          {q.data.items.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => setOpen(l)} className="surface-card flex w-full flex-col items-start gap-1 p-4 text-left hover:border-line-strong">
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="font-semibold">{l.name}</span>
                  <Badge tone={TONE[l.status]}>{t(`leads.status.${l.status}`)}</Badge>
                </span>
                <span className="text-xs text-muted">
                  …{l.phoneLast4} · {f.date(l.createdAt)} {f.time(l.createdAt)}
                  {l.bestTime ? ` · ${t("leads.best", { time: l.bestTime })}` : ""}
                </span>
                {l.message ? <span className="line-clamp-2 text-sm">{l.message}</span> : null}
                {l.note ? <span className="text-xs text-muted">{t("leads.noteLine", { note: l.note })}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open ? <LeadDialog ctx={ctx} lead={open} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function LeadDialog({ ctx, lead, onClose }: { ctx: GymCtx; lead: Lead; onClose: () => void }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState(lead.note ?? "");
  const [member, setMember] = useState<PickedMember | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const update = async (status?: "contacted" | "joined" | "lost") => {
    setBusy(status ?? "note");
    setProblem(null);
    try {
      await gymOps2.updateLead(ctx.gymId, lead.id, { ...(status ? { status } : {}), note: note.trim() || null, ...(status === "joined" && member ? { memberId: member.id } : {}) });
      toast.show(t("leads.saved"));
      void qc.invalidateQueries({ queryKey: ["go-leads", ctx.gymId] });
      onClose();
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const reach = async (how: "call" | "whatsapp") => {
    setBusy(how);
    try {
      const { phone } = await gymOps2.leadPhone(ctx.gymId, lead.id);
      if (how === "call") window.location.assign(telUrl(phone));
      else {
        const url = whatsappUrl(phone, t("leads.message", { name: lead.name.split(" ")[0], gym: ctx.gym.name }));
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }
      if (lead.status === "new") void gymOps2.updateLead(ctx.gymId, lead.id, { status: "contacted" }).then(() => qc.invalidateQueries({ queryKey: ["go-leads", ctx.gymId] }));
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(null);
    }
  };
  const can = { contacted: ["new", "lost"].includes(lead.status), lost: ["new", "contacted"].includes(lead.status), joined: ["new", "contacted"].includes(lead.status) };
  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onClose()} title={lead.name} description={`…${lead.phoneLast4} · ${f.date(lead.createdAt)}`}>
      <div className="flex flex-col gap-3 px-6 pb-5">
        {lead.message ? <p className="whitespace-pre-line rounded-control bg-surface-2 p-3 text-sm">{lead.message}</p> : null}
        {lead.bestTime ? <p className="text-sm text-muted">{t("leads.best", { time: lead.bestTime })}</p> : null}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void reach("call")} busy={busy === "call"}>
            <Phone size={18} aria-hidden />
            {t("leads.call")}
          </Button>
          <Button variant="secondary" onClick={() => void reach("whatsapp")} busy={busy === "whatsapp"}>
            <WhatsappLogo size={18} aria-hidden />
            WhatsApp
          </Button>
        </div>
        <Textarea id="lead-note" label={t("note")} optional={t("optional")} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        {can.joined ? <MemberPick gymId={ctx.gymId} id="lead-member" label={t("leads.becameMember")} optional={t("leads.forJoined")} value={member} onChange={setMember} /> : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {can.joined ? (
            <Button
              onClick={() => void update("joined")}
              disabled={!member}
              busy={busy === "joined"}
              confirm={{ kind: "save", title: t("leads.joinedAsk", { name: lead.name, member: member?.displayName ?? "" }), confirmLabel: t("leads.markJoined") }}
              data-testid="lead-joined"
            >
              {t("leads.markJoined")}
            </Button>
          ) : null}
          {can.contacted ? (
            <Button variant="secondary" onClick={() => void update("contacted")} busy={busy === "contacted"} confirm={{ kind: "save", title: t("leads.contactedAsk", { name: lead.name }), confirmLabel: t("leads.markContacted") }}>
              {t("leads.markContacted")}
            </Button>
          ) : null}
          {can.lost ? (
            <Button variant="ghost" onClick={() => void update("lost")} busy={busy === "lost"} confirm={{ kind: "save", title: t("leads.lostAsk", { name: lead.name }), confirmLabel: t("leads.markLost") }}>
              {t("leads.markLost")}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => void update()} busy={busy === "note"} confirm="save">
            {t("leads.saveNote")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

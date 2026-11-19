"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Megaphone } from "@phosphor-icons/react";
import { Badge, Button, Card, EmptyState, Field, Notice, Select, SkeletonList, Textarea, useToast } from "@kriraghor/ui/kit";
import { newKey } from "@kriraghor/ui/format";
import { gymOps2, type NoticeSegment } from "@/lib/gym-ops";
import { GymPage, useFmt, useGymError, usePackages, type GymCtx } from "../gym-manage/common";

/**
 * /manage/[gymId]/notices (M27-FR-62 to FR-65; notices.send; Standard plan): write a short notice to a group of
 * members (all active, ending soon, expired, not seen, on a package, in a class), see how many it reaches and
 * how (the app, email, not reachable), send it. In-app and push to linked members, email to the others with
 * an email; never SMS. A few notices a day at most.
 */
export function Notices({ gymId }: { gymId: string }) {
  const t = useTranslations("go");
  return (
    <GymPage gymId={gymId} page="notices" feature="notices" title={t("notices.title")} description={t("notices.lead")} testId="go-notices">
      {(ctx) => <Body ctx={ctx} />}
    </GymPage>
  );
}

const KINDS = ["active", "expiring", "expired", "not_seen", "package", "class"] as const;
type Kind = (typeof KINDS)[number];

function Body({ ctx }: { ctx: GymCtx }) {
  const t = useTranslations("go");
  const f = useFmt();
  const err = useGymError();
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("active");
  const [days, setDays] = useState("7");
  const [packageId, setPackageId] = useState("");
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [key, setKey] = useState(newKey);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const packages = usePackages(ctx.gymId, kind === "package");
  const classes = useQuery({ queryKey: ["go-classes", ctx.gymId], queryFn: () => gymOps2.classes(ctx.gymId), enabled: kind === "class" && Boolean(ctx.gym.features.classes) });
  const history = useQuery({ queryKey: ["go-notices", ctx.gymId], queryFn: () => gymOps2.notices(ctx.gymId) });
  const segment: NoticeSegment | null =
    kind === "package" ? (packageId ? { kind, packageId } : null) : kind === "class" ? (classId ? { kind, classId } : null) : ["expiring", "expired", "not_seen"].includes(kind) ? (/^\d{1,3}$/.test(days) && Number(days) >= 1 ? { kind, days: Number(days) } : null) : { kind };
  const [est, setEst] = useState<Awaited<ReturnType<typeof gymOps2.estimate>> | null>(null);
  const segKey = JSON.stringify(segment);
  useEffect(() => {
    let live = true;
    if (!segment) return;
    const h = window.setTimeout(() => {
      gymOps2
        .estimate(ctx.gymId, segment)
        .then((r) => live && setEst(r))
        .catch(() => live && setEst(null));
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- segKey is the segment's identity
  }, [segKey, ctx.gymId]);
  const reachable = est ? est.reach.app + est.reach.email : 0;
  const capped = est ? est.sentToday >= est.dailyCap : false;
  const send = async () => {
    if (!segment) return setProblem(t("notices.pickGroup"));
    if (!title.trim() || !body.trim()) return setProblem(t("notices.writeIt"));
    setBusy(true);
    setProblem(null);
    try {
      const n = await gymOps2.sendNotice(ctx.gymId, { title: title.trim(), body: body.trim(), segment }, key);
      toast.show(t("notices.sent", { n: f.n(n.targetCount) }));
      setTitle("");
      setBody("");
      setKey(newKey());
      void qc.invalidateQueries({ queryKey: ["go-notices", ctx.gymId] });
      setEst(null);
    } catch (e) {
      setProblem(err(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
      <Card className="flex flex-col gap-3" data-testid="notice-form">
        <h2 className="font-display text-lg font-bold">{t("notices.write")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select id="n-kind" label={t("notices.to")} value={kind} onChange={(e) => setKind(e.target.value as Kind)} data-testid="notice-kind">
            {KINDS.map((k) => (
              <option key={k} value={k} disabled={k === "class" && !ctx.gym.features.classes}>
                {t(`notices.seg.${k}`)}
              </option>
            ))}
          </Select>
          {["expiring", "expired", "not_seen"].includes(kind) ? (
            <Field id="n-days" label={t("notices.days")} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, "").slice(0, 3))} />
          ) : kind === "package" ? (
            <Select id="n-pkg" label={t("notices.package")} value={packageId} onChange={(e) => setPackageId(e.target.value)}>
              <option value="">–</option>
              {packages.all.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          ) : kind === "class" ? (
            <Select id="n-class" label={t("notices.class")} value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">–</option>
              {(classes.data?.items ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
        {est && segment ? (
          <Notice tone={reachable ? "info" : "warning"}>
            <span data-testid="notice-reach">
              {t("notices.reach", { members: f.n(est.members), app: f.n(est.reach.app), email: f.n(est.reach.email), none: f.n(est.reach.none) })}
            </span>
          </Notice>
        ) : null}
        <Field id="n-title" label={t("notices.titleLabel")} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} data-testid="notice-title" />
        <Textarea id="n-body" label={t("notices.body")} value={body} maxLength={500} onChange={(e) => setBody(e.target.value)} hint={t("notices.bodyHint", { n: f.n(body.length) })} data-testid="notice-body" />
        {capped ? <Notice tone="warning">{t("notices.capped", { n: f.n(est?.dailyCap ?? 0) })}</Notice> : null}
        {problem ? (
          <p role="alert" className="text-sm text-danger">
            {problem}
          </p>
        ) : null}
        <Button
          onClick={() => void send()}
          busy={busy}
          disabled={!reachable || capped}
          confirm={segment && title.trim() && body.trim() ? { kind: "send", title: t("notices.sendAsk", { n: f.n(reachable) }), body: t("notices.sendBody") } : undefined}
          data-testid="notice-send"
        >
          <Megaphone size={18} aria-hidden />
          {t("notices.send", { n: f.n(reachable) })}
        </Button>
        <p className="text-xs text-muted">{t("notices.noSms")}</p>
      </Card>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">{t("notices.history")}</h2>
        {history.isPending ? (
          <SkeletonList rows={3} />
        ) : !history.data?.items.length ? (
          <EmptyState icon={<Megaphone size={28} aria-hidden />} title={t("notices.none")} />
        ) : (
          <ul className="flex flex-col gap-2" data-testid="notice-history">
            {history.data.items.map((n) => (
              <li key={n.id}>
                <Card className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{n.title}</p>
                    <Badge tone="neutral">{t("notices.toN", { n: f.n(n.targetCount) })}</Badge>
                  </div>
                  <p className="whitespace-pre-line text-sm text-muted">{n.body}</p>
                  <p className="text-xs text-muted">
                    {t(`notices.seg.${n.segment.kind}`)} · {f.date(n.sentAt)} {f.time(n.sentAt)} · {n.sentBy.displayName ?? "–"}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}


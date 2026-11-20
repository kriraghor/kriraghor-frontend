"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, File, FileText, Image as ImageIcon, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { formatBytes, uploadStore, type Upload } from "@kriraghor/session/uploads";
import { cn } from "../cn";

const ICON = { photo: ImageIcon, document: FileText, file: File } as const;
const EMPTY: Upload[] = [];

/**
 * Every file being uploaded, bottom right (tester feedback, 19 Nov 2026): what it is, the percentage,
 * the bytes sent of the total, and Cancel. Finished uploads leave by themselves; a failed one stays
 * until it is closed. Mounted once by the shared Providers.
 */
export function UploadTray() {
  const t = useTranslations("kit.upload");
  const items = useSyncExternalStore(uploadStore.subscribe, uploadStore.snapshot, () => EMPTY);
  if (!items.length) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-[max(16px,env(safe-area-inset-bottom,0px))] right-[max(16px,env(safe-area-inset-right,0px))] z-[60] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      role="status"
      aria-live="polite"
      data-testid="upload-tray"
    >
      {items.map((u) => {
        const Icon = ICON[u.kind];
        const pct = u.total ? Math.min(100, Math.round((u.loaded / u.total) * 100)) : 0;
        const failed = u.status === "failed";
        return (
          <div key={u.id} className="pointer-events-auto rounded-card border border-line bg-surface p-3 shadow-lg" data-testid="upload-item">
            <div className="flex items-center gap-3">
              <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-control", failed ? "bg-danger/10 text-danger" : "bg-brand/10 text-brand-text")}>
                {u.status === "done" ? <CheckCircle size={20} aria-hidden /> : failed ? <WarningCircle size={20} aria-hidden /> : u.status === "uploading" ? <UploadSimple size={20} aria-hidden /> : <Icon size={20} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{t(`${u.status}`, { kind: t(`kind.${u.kind}`) })}</span>
                <span className="block text-xs tabular-nums text-muted">
                  {t("progress", { pct, loaded: formatBytes(u.loaded), total: formatBytes(u.total) })}
                </span>
              </span>
              {u.status === "uploading" ? (
                <button type="button" onClick={u.cancel} className="rounded-control px-2 py-1 text-sm font-semibold text-muted hover:bg-surface-2 hover:text-ink">
                  {t("cancel")}
                </button>
              ) : (
                <button type="button" onClick={() => uploadStore.dismiss(u.id)} className="inline-flex size-8 items-center justify-center rounded-control text-muted hover:bg-surface-2" aria-label={t("close")}>
                  <X size={16} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
              <div className={cn("h-full rounded-full transition-[width] duration-200", failed ? "bg-danger" : "bg-brand")} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

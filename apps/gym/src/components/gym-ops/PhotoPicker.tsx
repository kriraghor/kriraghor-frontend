"use client";

import { useEffect, useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ImageSquare, Trash, UploadSimple } from "@phosphor-icons/react";
import { formatBytes } from "@kriraghor/session/uploads";
import { Button } from "@kriraghor/ui/kit";
import { PHOTO_TYPES } from "@/lib/validate";

/**
 * Choose one photo (tester feedback, 19 Nov 2026): an upload icon and the rules up front, then a preview
 * with the file's name and size. The upload itself runs on Save, and its progress shows in the upload
 * tray. `current` is the photo already saved; Remove clears it (`onChange(null, true)`).
 */
export function PhotoPicker({
  current,
  file,
  removed,
  onChange,
  error,
  label,
}: {
  current: string | null;
  file: File | null;
  removed: boolean;
  onChange: (file: File | null, removed: boolean) => void;
  error?: string;
  label: string;
}) {
  const t = useTranslations("gm.photo");
  const id = useId();
  // The preview URL follows the chosen file; the old one is released when the file changes.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const shown = preview ?? (removed ? null : current);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-3 rounded-control border border-dashed border-line-strong/60 p-3">
        <span className="inline-flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-control bg-surface-2 text-muted">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <ImageSquare size={28} aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1 text-sm">
          {file ? (
            <>
              <span className="block truncate font-semibold">{file.name}</span>
              <span className="block text-xs text-muted">{t("ready", { size: formatBytes(file.size) })}</span>
            </>
          ) : (
            <span className="block text-xs text-muted">{t("rules")}</span>
          )}
        </span>
        <label htmlFor={id} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control border border-line-strong/60 bg-surface px-3 text-sm font-semibold hover:bg-surface-2">
          <UploadSimple size={16} aria-hidden /> {shown ? t("change") : t("choose")}
        </label>
        <input
          id={id}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          className="sr-only"
          data-testid="photo-input"
          onChange={(e) => {
            onChange(e.target.files?.[0] ?? null, false);
            e.target.value = "";
          }}
        />
        {shown ? (
          <Button type="button" variant="ghost" size="sm" className="text-danger" onClick={() => onChange(null, Boolean(current))} aria-label={t("remove")}>
            <Trash size={16} aria-hidden />
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

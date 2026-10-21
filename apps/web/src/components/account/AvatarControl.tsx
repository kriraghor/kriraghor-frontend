"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Camera, Trash, UploadSimple } from "@phosphor-icons/react";
import { problemOf } from "@kriraghor/api-client";
import type { Me } from "@kriraghor/ui/account";
import { Avatar, Button, Notice, useToast } from "@kriraghor/ui/kit";
import { AVATAR_ACCEPT, AVATAR_MAX_SETTING, avatarErrorOf, avatarFileProblem, megabytes, removeAvatar, uploadAvatar, type AvatarProblem } from "@/lib/avatar";
import { publicLimit, usePublicSettings } from "@/lib/public-settings";

/**
 * The profile photo (M01 avatar, Round B1): pick a JPEG, PNG or WebP, see it, then save it; or remove
 * the current one. The type and size are checked here first (the size limit is the public setting
 * users.avatar_max_bytes); the server checks the bytes again. Used on /account/settings and from the
 * pro checklist on /pro.
 */
export function AvatarControl({ me, onDone }: { me: Me; onDone?: () => void }) {
  const t = useTranslations("accountSettings.photo");
  const toast = useToast();
  const qc = useQueryClient();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const settings = usePublicSettings();
  const max = publicLimit(settings.data, AVATAR_MAX_SETTING);
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<AvatarProblem | null>(null);

  // The preview URL lives as long as the picked file.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  const after = async (next: Me, message: string) => {
    qc.setQueryData(["me"], next);
    setFile(null);
    if (input.current) input.current.value = "";
    toast.show(message);
    // The pro checklist scores the photo.
    await qc.invalidateQueries({ queryKey: ["pro-profiles"] });
    onDone?.();
  };
  const upload = useMutation({ mutationFn: (f: File) => uploadAvatar(f), onSuccess: (next) => after(next, t("saved")) });
  const remove = useMutation({ mutationFn: () => removeAvatar(), onSuccess: (next) => after(next, t("removed")) });
  const failed = upload.error ?? remove.error;
  const failure = failed ? (avatarErrorOf(failed) ?? null) : null;
  const shown = problem ?? failure;
  const maxText = max ? megabytes(max) : null;

  const clear = () => {
    setFile(null);
    setProblem(null);
    if (input.current) input.current.value = "";
  };
  const pick = (f: File | undefined) => {
    upload.reset();
    remove.reset();
    if (!f) return clear();
    const why = avatarFileProblem(f, max);
    setProblem(why);
    setFile(why ? null : f);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center" data-testid="avatar-control">
      <Avatar name={me.displayName} src={preview ?? me.avatarUrl} size={96} className="ring-2 ring-line" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="text-sm text-muted">{maxText ? t("hint", { mb: maxText }) : t("hintNoSize")}</p>
        <input ref={input} id={inputId} type="file" accept={AVATAR_ACCEPT} className="sr-only" tabIndex={-1} aria-label={t("choose")} onChange={(e) => pick(e.target.files?.[0])} data-testid="avatar-input" />
        <div className="flex flex-wrap gap-2">
          {file ? (
            <>
              <Button type="button" icon={<UploadSimple size={18} aria-hidden />} busy={upload.isPending} onClick={() => upload.mutate(file)} data-testid="avatar-save">
                {t("save")}
              </Button>
              <Button type="button" variant="secondary" onClick={clear} disabled={upload.isPending}>
                {t("cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="secondary" icon={<Camera size={18} aria-hidden />} onClick={() => input.current?.click()} disabled={remove.isPending} data-testid="avatar-pick">
                {me.avatarUrl ? t("change") : t("choose")}
              </Button>
              {me.avatarUrl ? (
                <Button type="button" variant="ghost" icon={<Trash size={18} aria-hidden />} busy={remove.isPending} onClick={() => remove.mutate()} data-testid="avatar-remove">
                  {t("remove")}
                </Button>
              ) : null}
            </>
          )}
        </div>
        {file ? <p className="text-sm text-muted">{t("previewNote")}</p> : null}
        {shown ? (
          <Notice tone="error">{shown === "tooLarge" && !maxText ? t("errors.tooLargeNoSize") : t(`errors.${shown}`, { mb: maxText ?? "" })}</Notice>
        ) : failed ? (
          <Notice tone="error">{problemOf(failed)?.title ?? t("errors.generic")}</Notice>
        ) : null}
      </div>
    </div>
  );
}
